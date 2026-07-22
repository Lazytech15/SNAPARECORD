import { SignJWT, jwtVerify } from "jose";
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
  /** Symmetric secret used to sign/verify the cached payload (HS256). Never sent over the wire —
   *  it only protects what sits in storage, so a tampered/forged cache entry is rejected on read. */
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
  private readonly secretKey: Uint8Array;
  private readonly cacheTtlMs: number;
  private readonly pollIntervalMs: number;
  private readonly storage: AuthDataStorage;
  private readonly storageKey: string;
  private readonly onUpdate?: (data: Record<string, unknown>) => void;
  private readonly onError?: (error: unknown) => void;

  private pollTimer: ReturnType<typeof setInterval> | null = null;
  private inFlight: Promise<AuthDataResult> | null = null;

  constructor(options: AuthDataClientOptions) {
    if (!options?.client) throw new Error("AuthDataClient requires an api `client`.");
    if (!options?.requests?.length) throw new Error("AuthDataClient requires a non-empty `requests` array.");
    if (!options?.jwtSecret) throw new Error("AuthDataClient requires a `jwtSecret` to sign the cache.");

    this.client = options.client;
    this.requests = options.requests;
    this.secretKey = new TextEncoder().encode(options.jwtSecret);
    this.cacheTtlMs = options.cacheTtlMs ?? DEFAULT_CACHE_TTL_MS;
    this.pollIntervalMs = options.pollIntervalMs ?? DEFAULT_POLL_INTERVAL_MS;
    this.storage = options.storage ?? resolveDefaultStorage();
    this.storageKey = options.storageKey ?? DEFAULT_STORAGE_KEY;
    this.onUpdate = options.onUpdate;
    this.onError = options.onError;
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
        const normalized = handleError(err, { silent: true });
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
        });
        return [req.key, result] as const;
      })
    );
    return Object.fromEntries(entries);
  }

  /** Signs `{ data, fetchedAt }` as an HS256 JWT (with a matching `exp`) before writing it to storage. */
  private async writeCache(payload: CachedPayload): Promise<void> {
    const expiresAt = Math.floor((payload.fetchedAt + this.cacheTtlMs) / 1000);
    const jwt = await new SignJWT({ data: payload.data, fetchedAt: payload.fetchedAt })
      .setProtectedHeader({ alg: "HS256" })
      .setIssuedAt()
      .setExpirationTime(expiresAt)
      .sign(this.secretKey);
    this.storage.setItem(this.storageKey, jwt);
  }

  /** Verifies the cached JWT's signature and expiry. Returns null (and clears it) if it's
   *  missing, expired, or has been tampered with. */
  private async readCache(): Promise<CachedPayload | null> {
    const jwt = this.storage.getItem(this.storageKey);
    if (!jwt) return null;

    try {
      const { payload } = await jwtVerify(jwt, this.secretKey);
      return {
        data: payload.data as Record<string, unknown>,
        fetchedAt: payload.fetchedAt as number,
      };
    } catch {
      // Expired, malformed, or signature mismatch — never trust it, just start clean.
      this.storage.removeItem(this.storageKey);
      return null;
    }
  }
}

/** Convenience factory, mirroring `createApiClient`. */
export function createAuthDataClient(options: AuthDataClientOptions): AuthDataClient {
  return new AuthDataClient(options);
}
