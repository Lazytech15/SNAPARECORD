import axios, { AxiosInstance, AxiosRequestConfig, AxiosResponse } from "axios";
import { handleError } from "./errorHandler.js";
import type { ErrorStatus, NormalizedError } from "./types.js";

export interface ApiClientOptions {
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
export interface RequestConfig extends AxiosRequestConfig {
  silent?: boolean;
}

export interface ApiClient {
  /** The underlying axios instance, for anything not covered below (interceptors, defaults, etc.) */
  raw: AxiosInstance;
  get<T = unknown>(url: string, cfg?: RequestConfig): Promise<T>;
  post<T = unknown>(url: string, data?: unknown, cfg?: RequestConfig): Promise<T>;
  put<T = unknown>(url: string, data?: unknown, cfg?: RequestConfig): Promise<T>;
  patch<T = unknown>(url: string, data?: unknown, cfg?: RequestConfig): Promise<T>;
  delete<T = unknown>(url: string, cfg?: RequestConfig): Promise<T>;
  request<T = unknown>(cfg: RequestConfig): Promise<T>;
}

const DEFAULT_CLIENT_OPTIONS: Required<
  Pick<ApiClientOptions, "baseURL" | "timeout" | "headers" | "withCredentials" | "silentStatuses">
> & Pick<ApiClientOptions, "getAuthToken" | "onError"> = {
  baseURL: "",
  timeout: 15000,
  headers: {},
  withCredentials: false,
  getAuthToken: null,
  silentStatuses: [],
  onError: null,
};

/**
 * Creates a centralized axios-based API client. Every request/response goes
 * through this single instance, so auth headers, base URL, and error toasts
 * are all handled in one place instead of being repeated at every call site.
 */
export function createApiClient(options: ApiClientOptions = {}): ApiClient {
  const config = { ...DEFAULT_CLIENT_OPTIONS, ...options };

  const instance = axios.create({
    baseURL: config.baseURL,
    timeout: config.timeout,
    headers: config.headers,
    withCredentials: config.withCredentials,
  });

  // Auto-attach the auth token (if a getter was provided) on every outgoing request.
  instance.interceptors.request.use((reqConfig) => {
    if (typeof config.getAuthToken === "function") {
      const token = config.getAuthToken();
      if (token) {
        reqConfig.headers = reqConfig.headers ?? ({} as typeof reqConfig.headers);
        (reqConfig.headers as Record<string, string>).Authorization = `Bearer ${token}`;
      }
    }
    return reqConfig;
  });

  // Unwrap `response.data` on success; route every failure through the
  // shared friendly-error handler so a single toast style/behavior applies
  // no matter which endpoint failed.
  instance.interceptors.response.use(
    (response: AxiosResponse) => response.data,
    (error) => {
      const status = error?.response?.status;
      const requestSilent = (error?.config as RequestConfig | undefined)?.silent === true;
      const silent = requestSilent || config.silentStatuses.includes(status);

      const dedupeKey = error?.config
        ? `${error.config.method || "get"}:${error.config.url}`
        : undefined;

      const normalized = handleError(error, { silent, dedupeKey });

      if (typeof config.onError === "function") {
        config.onError(normalized, error);
      }

      return Promise.reject(normalized);
    }
  );

  return {
    raw: instance,
    get: (url, cfg) => instance.get(url, cfg),
    post: (url, data, cfg) => instance.post(url, data, cfg),
    put: (url, data, cfg) => instance.put(url, data, cfg),
    patch: (url, data, cfg) => instance.patch(url, data, cfg),
    delete: (url, cfg) => instance.delete(url, cfg),
    request: (cfg) => instance.request(cfg),
  };
}

/**
 * A ready-to-use default client with no baseURL/auth configured, so simple
 * apps can just `import { apiClient } from "snaparecord"` and go.
 * For anything with a base URL, auth tokens, or multiple backends, prefer
 * calling `createApiClient()` yourself and naming the result (see README).
 */
export const apiClient: ApiClient = createApiClient();

/**
 * A client that only exposes one HTTP verb. Useful when you want it to be
 * obvious, at the import site, exactly what kind of request a component is
 * allowed to make (e.g. a read-only component only ever imports the GET client).
 */
export interface MethodApiClient<T = unknown> {
  /** The underlying axios instance, for anything not covered below. */
  raw: AxiosInstance;
  request(url: string, cfg?: RequestConfig): Promise<T>;
}

export interface WriteMethodApiClient<T = unknown> {
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
export function createGetClient(options: ApiClientOptions = {}): MethodApiClient {
  const client = createApiClient(options);
  return {
    raw: client.raw,
    request: (url, cfg) => client.get(url, cfg),
  };
}

/**
 * Pre-built client whose only capability is POST. Import this into any
 * component that only ever *creates* data.
 *
 *   import { createPostClient } from "snaparecord";
 *   export const apiPostClient = createPostClient({ baseURL: "/api" });
 *   await apiPostClient.request("/todos", { title: "New todo" });
 */
export function createPostClient(options: ApiClientOptions = {}): WriteMethodApiClient {
  const client = createApiClient(options);
  return {
    raw: client.raw,
    request: (url, data, cfg) => client.post(url, data, cfg),
  };
}

/**
 * Pre-built client whose only capability is PUT. Import this into any
 * component that only ever *replaces/updates* data.
 *
 *   import { createPutClient } from "snaparecord";
 *   export const apiPutClient = createPutClient({ baseURL: "/api" });
 *   await apiPutClient.request("/todos/1", { title: "Updated todo" });
 */
export function createPutClient(options: ApiClientOptions = {}): WriteMethodApiClient {
  const client = createApiClient(options);
  return {
    raw: client.raw,
    request: (url, data, cfg) => client.put(url, data, cfg),
  };
}

/**
 * Pre-built client whose only capability is DELETE. Import this into any
 * component that only ever *removes* data.
 *
 *   import { createDeleteClient } from "snaparecord";
 *   export const apiDeleteClient = createDeleteClient({ baseURL: "/api" });
 *   await apiDeleteClient.request("/todos/1");
 */
export function createDeleteClient(options: ApiClientOptions = {}): MethodApiClient {
  const client = createApiClient(options);
  return {
    raw: client.raw,
    request: (url, cfg) => client.delete(url, cfg),
  };
}
