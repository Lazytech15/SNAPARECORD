import { EncryptJWT, jwtDecrypt } from "jose";
import { handleError } from "./errorHandler.js";
import type { ApiClient, RequestConfig } from "./apiClient.js";

/** One endpoint to include in a batched AuthData fetch. */
export interface AuthDataRequest {
  /** Unique key this endpoint's result will be stored under, e.g. "profile", "permissions". */
  key: string;
  url: string;
  method?: "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
  params?: Record<string, unknown>;
  data?: unknown;
  /** Extra per-request axios config (headers, etc). `silent` is supported here too. */
  config?: RequestConfig;
}

/** Minimal Web Storage–compatible interface, so this also works outside the browser. */
export interface AuthDataStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

export interface AuthDataClientOptions {
  /** The api client (from createApiClient) used to perform the requests. Its getAuthToken
   *  is what attaches `Authorization: Bearer <jwt>` to every outgoing request. */
  client: ApiClient;
  /** The endpoints to fetch together as one logical "AuthData" bundle. */
  requests: AuthDataRequest[];
  /** Symmetric secret used to ENCRYPT the cached payload (A256GCM, via JWE). Never sent over the
   *  wire — it only protects what sits in browser storage. Encryption is always on: the cache is
   *  never written as readable JSON, so it can't be read *or* tampered with from devtools/XSS
   *  without this secret. Use a long random string (32+ chars) injected via env var — never
   *  hardcode it in source. */
  jwtSecret: string;
  /** How long a cached bundle stays valid before it must be re-fetched. Default: 24h. */
  cacheTtlMs?: number;
  /** How often background polling re-fetches, once started. Default: 1 minute. */
  pollIntervalMs?: number;
  /** Where the signed cache blob is persisted. Default: window.localStorage (falls back to an
   *  in-memory store outside the browser, so this never throws during SSR). */
  storage?: AuthDataStorage;
  /** Key under which the signed cache blob is stored. */
  storageKey?: string;
  /** Called with the fresh data every time a fetch (initial, forced, or polled) succeeds. */
  onUpdate?: (data: Record<string, unknown>) => void;
  /** Called with the normalized error whenever a fetch/poll fails. */
  onError?: (error: unknown) => void;
  /**
   * Dedupe/batch key used for the ONE toast shown when this bundle fails —
   * see `errorHandler`'s `handleError`. Individual endpoints inside
   * `requests` never toast on their own (they're fetched with `silent: true`
   * by default); only the bundle as a whole does, so N failing endpoints in
   * one bundle still produce a single toast, and repeated bundle failures
   * (e.g. every poll tick) batch into that one toast's "xN" counter instead
   * of flooding new toasts. Defaults to `authdata:${storageKey}` — set this
   * explicitly if you run more than one AuthDataClient with the same
   * storageKey and want their failures kept separate.
   */
  errorDedupeKey?: string;
}

export interface AuthDataResult {
  data: Record<string, unknown>;
  /** True if this result came from the signed local cache instead of a network call. */
  fromCache: boolean;
  fetchedAt: number;
}

const DEFAULT_CACHE_TTL_MS = 24 * 60 * 60 * 1000; // 1 day
const DEFAULT_POLL_INTERVAL_MS = 60 * 1000; // 1 minute
const DEFAULT_STORAGE_KEY = "fte_auth_data_cache";

interface CachedPayload {
  data: Record<string, unknown>;
  fetchedAt: number;
}

/** In-memory fallback so this class never throws when `localStorage` isn't available (SSR, tests, RN without polyfill). */
function createMemoryStorage(): AuthDataStorage {
  const store = new Map<string, string>();
  return {
    getItem: (key) => (store.has(key) ? store.get(key)! : null),
    setItem: (key, value) => void store.set(key, value),
    removeItem: (key) => void store.delete(key),
  };
}

function resolveDefaultStorage(): AuthDataStorage {
  if (typeof window !== "undefined" && window.localStorage) {
    return window.localStorage;
  }
  return createMemoryStorage();
}

/**
 * Fetches multiple related endpoints as one batch, signs the combined result into a JWT
 * before it ever touches storage (so cached data can't be read or tampered with as plain
 * JSON), caches it for `cacheTtlMs` so repeat loads are instant, and can optionally poll
 * the server on a fixed interval without ever letting two fetches overlap.
 */
export class AuthDataClient {
  private readonly client: ApiClient;
  private readonly requests: AuthDataRequest[];
  private readonly jwtSecret: string;
  private secretKey: Uint8Array | null = null;
  private secretKeyPromise: Promise<Uint8Array> | null = null;
  private readonly cacheTtlMs: number;
  private readonly pollIntervalMs: number;
  private readonly storage: AuthDataStorage;
  private readonly storageKey: string;
  private readonly onUpdate?: (data: Record<string, unknown>) => void;
  private readonly onError?: (error: unknown) => void;
  private readonly errorDedupeKey: string;

  private pollTimer: ReturnType<typeof setInterval> | null = null;
  private inFlight: Promise<AuthDataResult> | null = null;

  constructor(options: AuthDataClientOptions) {
    if (!options?.client) throw new Error("AuthDataClient requires an api `client`.");
    if (!options?.requests?.length) throw new Error("AuthDataClient requires a non-empty `requests` array.");
    if (!options?.jwtSecret) throw new Error("AuthDataClient requires a `jwtSecret` to sign the cache.");

    this.client = options.client;
    this.requests = options.requests;
    this.jwtSecret = options.jwtSecret;
    this.cacheTtlMs = options.cacheTtlMs ?? DEFAULT_CACHE_TTL_MS;
    this.pollIntervalMs = options.pollIntervalMs ?? DEFAULT_POLL_INTERVAL_MS;
    this.storage = options.storage ?? resolveDefaultStorage();
    this.storageKey = options.storageKey ?? DEFAULT_STORAGE_KEY;
    this.onUpdate = options.onUpdate;
    this.onError = options.onError;
    this.errorDedupeKey = options.errorDedupeKey ?? `authdata:${this.storageKey}`;
  }

  /**
   * Returns the AuthData bundle. Serves instantly from the verified local cache when it's
   * still fresh; otherwise fetches all requests from the server, caches, and returns them.
   * Pass `{ force: true }` to always hit the server (e.g. after login/logout).
   */
  async getData(opts: { force?: boolean } = {}): Promise<AuthDataResult> {
    if (!opts.force) {
      const cached = await this.readCache();
      if (cached) {
        return { data: cached.data, fromCache: true, fetchedAt: cached.fetchedAt };
      }
    }
    return this.refresh();
  }

  /**
   * Fetches every configured endpoint in parallel and re-signs the cache. Concurrent calls
   * (e.g. a manual refresh landing mid-poll) share a single in-flight request instead of
   * firing duplicate calls at the server.
   */
  async refresh(): Promise<AuthDataResult> {
    if (this.inFlight) return this.inFlight;

    this.inFlight = this.fetchAll()
      .then(async (data) => {
        const fetchedAt = Date.now();
        await this.writeCache({ data, fetchedAt });
        this.onUpdate?.(data);
        return { data, fromCache: false, fetchedAt };
      })
      .catch((err) => {
        // silent:false here is what actually shows the toast — this is the
        // ONE toast for the whole bundle. Its dedupeKey means repeated
        // bundle failures (e.g. back-to-back poll ticks) bump this same
        // toast's "xN" counter instead of stacking a new one each time.
        const normalized = handleError(err, { dedupeKey: this.errorDedupeKey });
        this.onError?.(normalized);
        throw normalized;
      })
      .finally(() => {
        this.inFlight = null;
      });

    return this.inFlight;
  }

  /**
   * Starts polling the server every `pollIntervalMs` (default 1 minute). Overlapping ticks
   * are skipped automatically — if a request is still in flight when the next tick fires,
   * that tick is a no-op — so a slow endpoint can never stack up requests against the server.
   */
  startPolling(): void {
    if (this.pollTimer) return;
    this.pollTimer = setInterval(() => {
      if (this.inFlight) return; // previous tick still running — skip, don't queue up
      this.refresh().catch(() => {
        /* already reported via onError inside refresh() */
      });
    }, this.pollIntervalMs);
  }

  /** Stops background polling. Safe to call even if polling was never started. */
  stopPolling(): void {
    if (this.pollTimer) {
      clearInterval(this.pollTimer);
      this.pollTimer = null;
    }
  }

  /** Removes the signed cache entry, forcing the next `getData()` to hit the server. */
  clearCache(): void {
    this.storage.removeItem(this.storageKey);
  }

  /** Stops polling and clears the cache. Call on logout/unmount. */
  destroy(): void {
    this.stopPolling();
    this.clearCache();
  }

  private async fetchAll(): Promise<Record<string, unknown>> {
    const entries = await Promise.all(
      this.requests.map(async (req) => {
        const result = await this.client.request<unknown>({
          url: req.url,
          method: req.method ?? "GET",
          params: req.params,
          data: req.data,
          ...req.config,
          // Each endpoint in the bundle is silent by default: a failure here
          // is reported once for the whole bundle (see refresh()'s catch),
          // not once per endpoint. Set `config: { silent: false }` on a
          // specific request if you deliberately want it to toast on its own
          // in addition to the bundle-level toast.
          silent: req.config?.silent ?? true,
        });
        return [req.key, result] as const;
      })
    );
    return Object.fromEntries(entries);
  }

  /** Derives a proper 256-bit AES-GCM key from the (arbitrary-length) `jwtSecret` via SHA-256,
   *  so callers don't need to hand-roll a correctly sized/entropy key themselves. Cached after
   *  first use since digesting is async (WebCrypto) but the result never changes. */
  private async getSecretKey(): Promise<Uint8Array> {
    if (this.secretKey) return this.secretKey;
    if (!this.secretKeyPromise) {
      this.secretKeyPromise = crypto.subtle
        .digest("SHA-256", new TextEncoder().encode(this.jwtSecret))
        .then((digest) => {
          this.secretKey = new Uint8Array(digest);
          return this.secretKey;
        });
    }
    return this.secretKeyPromise;
  }

  /** Encrypts `{ data, fetchedAt }` into a compact JWE (A256GCM, direct key) before writing it to
   *  storage. This is authenticated encryption: the payload is unreadable AND unforgeable without
   *  the secret — unlike a plain signed JWT, nothing here is visible as plaintext in devtools,
   *  localStorage, or to an XSS payload that can only read storage, not the secret. */
  private async writeCache(payload: CachedPayload): Promise<void> {
    const secretKey = await this.getSecretKey();
    const expiresAt = Math.floor((payload.fetchedAt + this.cacheTtlMs) / 1000);
    const jwe = await new EncryptJWT({ data: payload.data, fetchedAt: payload.fetchedAt })
      .setProtectedHeader({ alg: "dir", enc: "A256GCM" })
      .setIssuedAt()
      .setExpirationTime(expiresAt)
      .encrypt(secretKey);
    this.storage.setItem(this.storageKey, jwe);
  }

  /** Decrypts and authenticates the cached JWE. Returns null (and clears it) if it's missing,
   *  expired, or has been tampered with — a modified ciphertext fails the GCM auth tag check
   *  before any data is ever produced, so corrupted/forged cache entries are never trusted. */
  private async readCache(): Promise<CachedPayload | null> {
    const jwe = this.storage.getItem(this.storageKey);
    if (!jwe) return null;

    try {
      const secretKey = await this.getSecretKey();
      const { payload } = await jwtDecrypt(jwe, secretKey);
      return {
        data: payload.data as Record<string, unknown>,
        fetchedAt: payload.fetchedAt as number,
      };
    } catch {
      // Expired, malformed, or auth-tag mismatch — never trust it, just start clean.
      this.storage.removeItem(this.storageKey);
      return null;
    }
  }
}

/** Convenience factory, mirroring `createApiClient`. */
export function createAuthDataClient(options: AuthDataClientOptions): AuthDataClient {
  return new AuthDataClient(options);
}

/**
 * A single request entry for one of the method-locked AuthData clients below.
 * `method` is omitted here on purpose — the client factory (GET/POST/PUT/DELETE)
 * already pins it, so it can never be set to something else by mistake.
 */
export type AuthDataMethodRequest = Omit<AuthDataRequest, "method">;

/** Options for the method-locked AuthData client factories below. */
export type AuthDataMethodClientOptions = Omit<AuthDataClientOptions, "requests"> & {
  requests: AuthDataMethodRequest[];
};

function createMethodLockedAuthDataClient(
  method: "GET" | "POST" | "PUT" | "DELETE",
  options: AuthDataMethodClientOptions
): AuthDataClient {
  return new AuthDataClient({
    ...options,
    requests: options.requests.map((req) => ({ ...req, method })),
  });
}

/**
 * Pre-built AuthData client whose requests are all forced to GET. Import this
 * into any component that only ever *reads* a bundle of endpoints.
 *
 *   import { createGetAuthDataClient } from "snaparecord";
 *   export const authGetClient = createGetAuthDataClient({
 *     client: authApi,
 *     requests: [{ key: "todo", url: "/todos/1" }, { key: "user", url: "/users/1" }],
 *     jwtSecret: import.meta.env.VITE_AUTH_CACHE_SECRET,
 *   });
 */
export function createGetAuthDataClient(options: AuthDataMethodClientOptions): AuthDataClient {
  return createMethodLockedAuthDataClient("GET", options);
}

/**
 * Pre-built AuthData client whose requests are all forced to POST. Import this
 * into any component that only ever *creates* data via a batched request.
 *
 *   import { createPostAuthDataClient } from "snaparecord";
 *   export const authPostClient = createPostAuthDataClient({
 *     client: authApi,
 *     requests: [{ key: "createTodo", url: "/todos", data: { title: "New todo" } }],
 *     jwtSecret: import.meta.env.VITE_AUTH_CACHE_SECRET,
 *   });
 */
export function createPostAuthDataClient(options: AuthDataMethodClientOptions): AuthDataClient {
  return createMethodLockedAuthDataClient("POST", options);
}

/**
 * Pre-built AuthData client whose requests are all forced to PUT. Import this
 * into any component that only ever *updates* data via a batched request.
 *
 *   import { createPutAuthDataClient } from "snaparecord";
 *   export const authPutClient = createPutAuthDataClient({
 *     client: authApi,
 *     requests: [{ key: "updateTodo", url: "/todos/1", data: { title: "Updated" } }],
 *     jwtSecret: import.meta.env.VITE_AUTH_CACHE_SECRET,
 *   });
 */
export function createPutAuthDataClient(options: AuthDataMethodClientOptions): AuthDataClient {
  return createMethodLockedAuthDataClient("PUT", options);
}

/**
 * Pre-built AuthData client whose requests are all forced to DELETE. Import this
 * into any component that only ever *removes* data via a batched request.
 *
 *   import { createDeleteAuthDataClient } from "snaparecord";
 *   export const authDeleteClient = createDeleteAuthDataClient({
 *     client: authApi,
 *     requests: [{ key: "deleteTodo", url: "/todos/1" }],
 *     jwtSecret: import.meta.env.VITE_AUTH_CACHE_SECRET,
 *   });
 */
export function createDeleteAuthDataClient(options: AuthDataMethodClientOptions): AuthDataClient {
  return createMethodLockedAuthDataClient("DELETE", options);
}
