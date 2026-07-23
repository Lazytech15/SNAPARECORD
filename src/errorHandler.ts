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
// > 0 enables batching repeats of the same error (by dedupeKey) into a single
// toast with an "xN" counter, for as long as that toast stays on screen.
// 0 disables batching, so every failure gets its own toast.
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
    // Pass the key through to showToast() so a repeat of the same failure,
    // while the previous toast for it is still on screen, bumps that
    // toast's "xN" counter and refreshes its timer instead of stacking a
    // visually-identical duplicate. Set dedupeWindowMs to 0 to opt out and
    // always show a separate toast per failure.
    showToast({
      type: normalized.severity,
      title: normalized.title,
      message: normalized.message,
      key: dedupeWindowMs > 0 ? dedupeKey : undefined,
    });
  }

  return normalized;
}

/**
 * @deprecated No longer needed — batching is now driven by whether a toast
 * for that key is still on screen (see toast.ts), not a time-based cache.
 * Kept as a no-op so existing imports don't break.
 */
export function clearErrorCache(): void {}

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
