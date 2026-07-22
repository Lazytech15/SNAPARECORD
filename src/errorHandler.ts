import { showToast } from "./toast.js";
import { DEFAULT_ERROR_MESSAGES } from "./errorMessages.js";
import type {
  AxiosLikeInterceptor,
  ConfigureErrorHandlerOptions,
  ErrorMessageMap,
  ErrorStatus,
  FriendlyMessage,
  HandleErrorOptions,
  NormalizedError,
} from "./types.js";

let messageMap: ErrorMessageMap = { ...DEFAULT_ERROR_MESSAGES };
let errorCache = new Map<string, number>(); // key -> timestamp, used to dedupe/suppress repeat toasts
let dedupeWindowMs = 3000;
let logger: ConfigureErrorHandlerOptions["logger"] | null = null;
let onError: ConfigureErrorHandlerOptions["onError"] | null = null;

/** Configure the global error handler. */
export function configureErrorHandler(options: ConfigureErrorHandlerOptions = {}): void {
  if (options.messages) {
    messageMap = { ...messageMap, ...options.messages } as ErrorMessageMap;
  }
  if (typeof options.dedupeWindowMs === "number") {
    dedupeWindowMs = options.dedupeWindowMs;
  }
  if (typeof options.logger === "function") {
    logger = options.logger;
  }
  if (typeof options.onError === "function") {
    onError = options.onError;
  }
}

/** Register/override a friendly message for a specific status code or key. */
export function setErrorMessage(
  key: ErrorStatus,
  { title, message, severity }: Partial<FriendlyMessage>
): void {
  messageMap[key] = {
    title: title ?? messageMap[key]?.title ?? "",
    message: message ?? messageMap[key]?.message ?? "",
    severity: severity || messageMap[key]?.severity || "error",
  };
}

interface AxiosLikeError {
  status?: ErrorStatus;
  response?: { status?: ErrorStatus };
  name?: string;
  message?: string;
}

function getStatusFromError(err: unknown): ErrorStatus {
  if (err == null) return "unknown";
  if (typeof err === "number") return err;
  const e = err as AxiosLikeError;
  if (e.status) return e.status;
  if (e.response && e.response.status) return e.response.status; // axios-style
  if (e.name === "AbortError") return "timeout";
  if (err instanceof TypeError && /fetch|network/i.test(err.message)) return "network";
  if (typeof navigator !== "undefined" && navigator && navigator.onLine === false) return "network";
  return "unknown";
}

/**
 * Normalize any thrown/caught error (fetch Response, axios error, plain Error,
 * raw status number) into a consistent shape.
 */
export function normalizeError(err: unknown, customMessage?: string): NormalizedError {
  const status = getStatusFromError(err);
  const fallback = messageMap.unknown;
  const mapped = messageMap[status] || fallback;

  return {
    status,
    title: mapped.title,
    message: customMessage || mapped.message,
    severity: mapped.severity || "error",
    raw: err,
  };
}

function shouldSuppressDuplicate(cacheKey?: string): boolean {
  if (!cacheKey || dedupeWindowMs <= 0) return false;
  const now = Date.now();
  const last = errorCache.get(cacheKey);
  if (last && now - last < dedupeWindowMs) {
    return true;
  }
  errorCache.set(cacheKey, now);
  return false;
}

/**
 * Main entry point: takes any raw error (HTTP status, fetch Response, axios
 * error, thrown Error) and shows a friendly toast instead of the raw error.
 */
export function handleError(err: unknown, opts: HandleErrorOptions = {}): NormalizedError {
  const normalized = normalizeError(err, opts.customMessage);
  if (opts.title) normalized.title = opts.title;
  if (opts.severity) normalized.severity = opts.severity;

  if (logger) {
    try {
      logger(normalized, err);
    } catch (_) {
      /* never let logging break the app */
    }
  }

  let suppressed = false;
  if (onError) {
    const result = onError(normalized);
    suppressed = result === false;
  }

  if (!suppressed && !opts.silent) {
    const dedupeKey = opts.dedupeKey ?? String(normalized.status);
    if (!shouldSuppressDuplicate(dedupeKey)) {
      showToast({
        type: normalized.severity,
        title: normalized.title,
        message: normalized.message,
      });
    }
  }

  return normalized;
}

/** Clears the internal duplicate-suppression cache. Mostly useful for tests. */
export function clearErrorCache(): void {
  errorCache.clear();
}

/**
 * Wraps the native fetch so any non-ok response or network failure
 * automatically goes through handleError and shows a friendly toast.
 * The original Response/rejection is still returned/thrown so your
 * existing .then/.catch logic keeps working.
 */
export function wrapFetch(
  fetchImpl: typeof fetch | undefined = typeof fetch !== "undefined" ? fetch : undefined
): typeof fetch {
  if (!fetchImpl) {
    throw new Error("No fetch implementation available to wrap.");
  }

  return async function wrappedFetch(...args: Parameters<typeof fetch>): ReturnType<typeof fetch> {
    try {
      const response = await fetchImpl(...args);
      if (!response.ok) {
        handleError(response.status);
      }
      return response;
    } catch (err) {
      handleError(err);
      throw err;
    }
  } as typeof fetch;
}

/**
 * Returns request/response interceptor functions compatible with axios.
 * Usage: const { onFulfilled, onRejected } = createAxiosErrorInterceptor();
 *        axiosInstance.interceptors.response.use(onFulfilled, onRejected);
 */
export function createAxiosErrorInterceptor(opts: HandleErrorOptions = {}): AxiosLikeInterceptor {
  return {
    onFulfilled: (response) => response,
    onRejected: (error: unknown) => {
      handleError(error, opts);
      return Promise.reject(error);
    },
  };
}
