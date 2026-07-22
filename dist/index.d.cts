import { AxiosInstance, AxiosRequestConfig } from 'axios';

type ToastType = "error" | "success" | "warning" | "info";
type ToastPosition = "top-right" | "top-left" | "bottom-right" | "bottom-left" | "top-center" | "bottom-center";
interface ToastOptions {
    position?: ToastPosition;
    duration?: number;
    showIcon?: boolean;
}
interface ShowToastParams {
    message: string;
    title?: string;
    type?: ToastType;
    duration?: number;
}
interface FriendlyMessage {
    title: string;
    message: string;
    severity: ToastType;
}
type ErrorMessageMap = Record<string | number, FriendlyMessage>;
type ErrorStatus = string | number;
interface NormalizedError {
    status: ErrorStatus;
    title: string;
    message: string;
    severity: ToastType;
    raw: unknown;
}
interface HandleErrorOptions {
    customMessage?: string;
    title?: string;
    severity?: ToastType;
    silent?: boolean;
    dedupeKey?: string;
}
interface ConfigureErrorHandlerOptions {
    messages?: Partial<ErrorMessageMap>;
    dedupeWindowMs?: number;
    logger?: (normalized: NormalizedError, raw: unknown) => void;
    onError?: (normalized: NormalizedError) => boolean | void;
}
interface AxiosLikeInterceptor {
    onFulfilled: <T>(response: T) => T;
    onRejected: (error: unknown) => Promise<never>;
}

/** Configure global defaults for all toasts. */
declare function configureToast(options?: ToastOptions): void;
/** Show a toast notification. Returns the toast id, usable with dismissToast(). */
declare function showToast({ message, title, type, duration, }: ShowToastParams): string | null;
/** Manually dismiss a toast by id. */
declare function dismissToast(id: string | null): void;
/** Remove all currently visible toasts. */
declare function clearToasts(): void;

/** Configure the global error handler. */
declare function configureErrorHandler(options?: ConfigureErrorHandlerOptions): void;
/** Register/override a friendly message for a specific status code or key. */
declare function setErrorMessage(key: ErrorStatus, { title, message, severity }: Partial<FriendlyMessage>): void;
/**
 * Normalize any thrown/caught error (fetch Response, axios error, plain Error,
 * raw status number) into a consistent shape.
 */
declare function normalizeError(err: unknown, customMessage?: string): NormalizedError;
/**
 * Main entry point: takes any raw error (HTTP status, fetch Response, axios
 * error, thrown Error) and shows a friendly toast instead of the raw error.
 */
declare function handleError(err: unknown, opts?: HandleErrorOptions): NormalizedError;
/** Clears the internal duplicate-suppression cache. Mostly useful for tests. */
declare function clearErrorCache(): void;
/**
 * Wraps the native fetch so any non-ok response or network failure
 * automatically goes through handleError and shows a friendly toast.
 * The original Response/rejection is still returned/thrown so your
 * existing .then/.catch logic keeps working.
 */
declare function wrapFetch(fetchImpl?: typeof fetch | undefined): typeof fetch;
/**
 * Returns request/response interceptor functions compatible with axios.
 * Usage: const { onFulfilled, onRejected } = createAxiosErrorInterceptor();
 *        axiosInstance.interceptors.response.use(onFulfilled, onRejected);
 */
declare function createAxiosErrorInterceptor(opts?: HandleErrorOptions): AxiosLikeInterceptor;

/**
 * Default human-friendly messages for common HTTP status codes
 * and well-known error types. These can be overridden or extended
 * via configureErrorHandler({ messages: { ... } }).
 */
declare const DEFAULT_ERROR_MESSAGES: ErrorMessageMap;

interface ApiClientOptions {
    baseURL?: string;
    timeout?: number;
    headers?: Record<string, string>;
    withCredentials?: boolean;
    /** Return a token to auto-attach as `Authorization: Bearer <token>` */
    getAuthToken?: (() => string | null | undefined) | null;
    /** status codes that should never trigger a toast (e.g. you handle them manually) */
    silentStatuses?: ErrorStatus[];
    /** Called after every failed request, after the toast fires */
    onError?: ((normalizedError: NormalizedError, rawError: unknown) => void) | null;
}
/** Per-request escape hatch: `client.get(url, { silent: true })` skips the toast for that call only. */
interface RequestConfig extends AxiosRequestConfig {
    silent?: boolean;
}
interface ApiClient {
    /** The underlying axios instance, for anything not covered below (interceptors, defaults, etc.) */
    raw: AxiosInstance;
    get<T = unknown>(url: string, cfg?: RequestConfig): Promise<T>;
    post<T = unknown>(url: string, data?: unknown, cfg?: RequestConfig): Promise<T>;
    put<T = unknown>(url: string, data?: unknown, cfg?: RequestConfig): Promise<T>;
    patch<T = unknown>(url: string, data?: unknown, cfg?: RequestConfig): Promise<T>;
    delete<T = unknown>(url: string, cfg?: RequestConfig): Promise<T>;
    request<T = unknown>(cfg: RequestConfig): Promise<T>;
}
/**
 * Creates a centralized axios-based API client. Every request/response goes
 * through this single instance, so auth headers, base URL, and error toasts
 * are all handled in one place instead of being repeated at every call site.
 */
declare function createApiClient(options?: ApiClientOptions): ApiClient;
/**
 * A ready-to-use default client with no baseURL/auth configured, so simple
 * apps can just `import { apiClient } from "snaparecord"` and go.
 * For anything with a base URL, auth tokens, or multiple backends, prefer
 * calling `createApiClient()` yourself and naming the result (see README).
 */
declare const apiClient: ApiClient;
/**
 * A client that only exposes one HTTP verb. Useful when you want it to be
 * obvious, at the import site, exactly what kind of request a component is
 * allowed to make (e.g. a read-only component only ever imports the GET client).
 */
interface MethodApiClient<T = unknown> {
    /** The underlying axios instance, for anything not covered below. */
    raw: AxiosInstance;
    request(url: string, cfg?: RequestConfig): Promise<T>;
}
interface WriteMethodApiClient<T = unknown> {
    raw: AxiosInstance;
    request(url: string, data?: unknown, cfg?: RequestConfig): Promise<T>;
}
/**
 * Pre-built client whose only capability is GET. Import this into any
 * component that only ever *reads* data.
 *
 *   import { createGetClient } from "snaparecord";
 *   export const apiGetClient = createGetClient({ baseURL: "/api" });
 *   const todo = await apiGetClient.request("/todos/1");
 */
declare function createGetClient(options?: ApiClientOptions): MethodApiClient;
/**
 * Pre-built client whose only capability is POST. Import this into any
 * component that only ever *creates* data.
 *
 *   import { createPostClient } from "snaparecord";
 *   export const apiPostClient = createPostClient({ baseURL: "/api" });
 *   await apiPostClient.request("/todos", { title: "New todo" });
 */
declare function createPostClient(options?: ApiClientOptions): WriteMethodApiClient;
/**
 * Pre-built client whose only capability is PUT. Import this into any
 * component that only ever *replaces/updates* data.
 *
 *   import { createPutClient } from "snaparecord";
 *   export const apiPutClient = createPutClient({ baseURL: "/api" });
 *   await apiPutClient.request("/todos/1", { title: "Updated todo" });
 */
declare function createPutClient(options?: ApiClientOptions): WriteMethodApiClient;
/**
 * Pre-built client whose only capability is DELETE. Import this into any
 * component that only ever *removes* data.
 *
 *   import { createDeleteClient } from "snaparecord";
 *   export const apiDeleteClient = createDeleteClient({ baseURL: "/api" });
 *   await apiDeleteClient.request("/todos/1");
 */
declare function createDeleteClient(options?: ApiClientOptions): MethodApiClient;

/** One endpoint to include in a batched AuthData fetch. */
interface AuthDataRequest {
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
interface AuthDataStorage {
    getItem(key: string): string | null;
    setItem(key: string, value: string): void;
    removeItem(key: string): void;
}
interface AuthDataClientOptions {
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
interface AuthDataResult {
    data: Record<string, unknown>;
    /** True if this result came from the signed local cache instead of a network call. */
    fromCache: boolean;
    fetchedAt: number;
}
/**
 * Fetches multiple related endpoints as one batch, signs the combined result into a JWT
 * before it ever touches storage (so cached data can't be read or tampered with as plain
 * JSON), caches it for `cacheTtlMs` so repeat loads are instant, and can optionally poll
 * the server on a fixed interval without ever letting two fetches overlap.
 */
declare class AuthDataClient {
    private readonly client;
    private readonly requests;
    private readonly secretKey;
    private readonly cacheTtlMs;
    private readonly pollIntervalMs;
    private readonly storage;
    private readonly storageKey;
    private readonly onUpdate?;
    private readonly onError?;
    private pollTimer;
    private inFlight;
    constructor(options: AuthDataClientOptions);
    /**
     * Returns the AuthData bundle. Serves instantly from the verified local cache when it's
     * still fresh; otherwise fetches all requests from the server, caches, and returns them.
     * Pass `{ force: true }` to always hit the server (e.g. after login/logout).
     */
    getData(opts?: {
        force?: boolean;
    }): Promise<AuthDataResult>;
    /**
     * Fetches every configured endpoint in parallel and re-signs the cache. Concurrent calls
     * (e.g. a manual refresh landing mid-poll) share a single in-flight request instead of
     * firing duplicate calls at the server.
     */
    refresh(): Promise<AuthDataResult>;
    /**
     * Starts polling the server every `pollIntervalMs` (default 1 minute). Overlapping ticks
     * are skipped automatically — if a request is still in flight when the next tick fires,
     * that tick is a no-op — so a slow endpoint can never stack up requests against the server.
     */
    startPolling(): void;
    /** Stops background polling. Safe to call even if polling was never started. */
    stopPolling(): void;
    /** Removes the signed cache entry, forcing the next `getData()` to hit the server. */
    clearCache(): void;
    /** Stops polling and clears the cache. Call on logout/unmount. */
    destroy(): void;
    private fetchAll;
    /** Signs `{ data, fetchedAt }` as an HS256 JWT (with a matching `exp`) before writing it to storage. */
    private writeCache;
    /** Verifies the cached JWT's signature and expiry. Returns null (and clears it) if it's
     *  missing, expired, or has been tampered with. */
    private readCache;
}
/** Convenience factory, mirroring `createApiClient`. */
declare function createAuthDataClient(options: AuthDataClientOptions): AuthDataClient;
/**
 * A single request entry for one of the method-locked AuthData clients below.
 * `method` is omitted here on purpose — the client factory (GET/POST/PUT/DELETE)
 * already pins it, so it can never be set to something else by mistake.
 */
type AuthDataMethodRequest = Omit<AuthDataRequest, "method">;
/** Options for the method-locked AuthData client factories below. */
type AuthDataMethodClientOptions = Omit<AuthDataClientOptions, "requests"> & {
    requests: AuthDataMethodRequest[];
};
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
declare function createGetAuthDataClient(options: AuthDataMethodClientOptions): AuthDataClient;
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
declare function createPostAuthDataClient(options: AuthDataMethodClientOptions): AuthDataClient;
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
declare function createPutAuthDataClient(options: AuthDataMethodClientOptions): AuthDataClient;
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
declare function createDeleteAuthDataClient(options: AuthDataMethodClientOptions): AuthDataClient;

declare const toast: Record<ToastType, (message: string, title?: string) => string | null>;

export { type ApiClient, type ApiClientOptions, AuthDataClient, type AuthDataClientOptions, type AuthDataMethodClientOptions, type AuthDataMethodRequest, type AuthDataRequest, type AuthDataResult, type AuthDataStorage, type ConfigureErrorHandlerOptions, DEFAULT_ERROR_MESSAGES, type ErrorMessageMap, type ErrorStatus, type FriendlyMessage, type HandleErrorOptions, type MethodApiClient, type NormalizedError, type RequestConfig, type ShowToastParams, type ToastOptions, type ToastPosition, type ToastType, type WriteMethodApiClient, apiClient, clearErrorCache, clearToasts, configureErrorHandler, configureToast, createApiClient, createAuthDataClient, createAxiosErrorInterceptor, createDeleteAuthDataClient, createDeleteClient, createGetAuthDataClient, createGetClient, createPostAuthDataClient, createPostClient, createPutAuthDataClient, createPutClient, dismissToast, handleError, normalizeError, setErrorMessage, showToast, toast, wrapFetch };
