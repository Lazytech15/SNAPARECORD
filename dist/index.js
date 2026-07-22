// src/toast.ts
var container = null;
var idCounter = 0;
var DEFAULT_OPTIONS = {
  position: "top-right",
  duration: 4500,
  showIcon: true
};
var globalOptions = { ...DEFAULT_OPTIONS };
var ICONS = {
  error: "!",
  success: "\u2713",
  warning: "!",
  info: "i"
};
function ensureContainer() {
  if (container && document.body.contains(container)) return container;
  container = document.createElement("div");
  container.className = "fte-toast-container";
  container.setAttribute("data-position", globalOptions.position);
  document.body.appendChild(container);
  return container;
}
function configureToast(options = {}) {
  globalOptions = { ...globalOptions, ...options };
  if (container) {
    container.setAttribute("data-position", globalOptions.position);
  }
}
function showToast({
  message,
  title,
  type = "info",
  duration
}) {
  if (typeof document === "undefined") {
    console.log(`[toast:${type}] ${title ? title + " - " : ""}${message}`);
    return null;
  }
  const el = ensureContainer();
  const id = `fte-toast-${++idCounter}`;
  const finalDuration = duration ?? globalOptions.duration;
  const toastEl = document.createElement("div");
  toastEl.className = "fte-toast";
  toastEl.id = id;
  toastEl.setAttribute("data-type", type);
  toastEl.setAttribute("role", "alert");
  const iconHtml = globalOptions.showIcon ? `<div class="fte-toast-icon">${ICONS[type] || ICONS.info}</div>` : "";
  toastEl.innerHTML = `
    ${iconHtml}
    <div class="fte-toast-body">
      ${title ? `<div class="fte-toast-title"></div>` : ""}
      <div class="fte-toast-message"></div>
    </div>
    <button class="fte-toast-close" aria-label="Dismiss">&times;</button>
    ${finalDuration > 0 ? `<div class="fte-toast-progress"><div class="fte-toast-progress-bar"></div></div>` : ""}
  `;
  if (title) {
    toastEl.querySelector(".fte-toast-title").textContent = title;
  }
  toastEl.querySelector(".fte-toast-message").textContent = message;
  toastEl.querySelector(".fte-toast-close").addEventListener(
    "click",
    () => {
      dismissToast(id);
    }
  );
  el.appendChild(toastEl);
  requestAnimationFrame(() => {
    toastEl.setAttribute("data-visible", "true");
  });
  let dismissTimer = null;
  let remaining = finalDuration;
  let startedAt = Date.now();
  const progressBar = toastEl.querySelector(".fte-toast-progress-bar");
  const startTimer = () => {
    if (finalDuration <= 0) return;
    startedAt = Date.now();
    if (progressBar) {
      progressBar.style.transition = `transform ${remaining}ms linear`;
      void progressBar.offsetWidth;
      progressBar.style.transform = "scaleX(0)";
    }
    dismissTimer = setTimeout(() => dismissToast(id), remaining);
  };
  const pauseTimer = () => {
    if (finalDuration <= 0 || !dismissTimer) return;
    clearTimeout(dismissTimer);
    dismissTimer = null;
    remaining -= Date.now() - startedAt;
    if (progressBar) {
      const computedTransform = getComputedStyle(progressBar).transform;
      progressBar.style.transition = "none";
      progressBar.style.transform = computedTransform;
    }
  };
  if (finalDuration > 0) {
    toastEl.addEventListener("mouseenter", pauseTimer);
    toastEl.addEventListener("mouseleave", startTimer);
    requestAnimationFrame(() => requestAnimationFrame(startTimer));
  }
  return id;
}
function dismissToast(id) {
  if (!id || typeof document === "undefined") return;
  const el = document.getElementById(id);
  if (!el) return;
  el.setAttribute("data-visible", "false");
  setTimeout(() => el.remove(), 200);
}
function clearToasts() {
  if (!container) return;
  Array.from(container.children).forEach((child) => dismissToast(child.id));
}

// src/errorMessages.ts
var DEFAULT_ERROR_MESSAGES = {
  400: {
    title: "Something's not right",
    message: "We couldn't process your request. Please check your input and try again.",
    severity: "warning"
  },
  401: {
    title: "Please sign in",
    message: "Your session has expired or you're not signed in. Please log in again.",
    severity: "warning"
  },
  403: {
    title: "Access denied",
    message: "You don't have permission to do that. Contact support if you think this is a mistake.",
    severity: "warning"
  },
  404: {
    title: "Not found",
    message: "We couldn't find what you were looking for. It may have been moved or removed.",
    severity: "warning"
  },
  408: {
    title: "Request timed out",
    message: "That took too long to respond. Please try again.",
    severity: "warning"
  },
  409: {
    title: "Conflict",
    message: "This action conflicts with the current state. Please refresh and try again.",
    severity: "warning"
  },
  413: {
    title: "File too large",
    message: "The file or data you're sending is too large. Please try a smaller one.",
    severity: "warning"
  },
  422: {
    title: "Invalid data",
    message: "Some of the information provided isn't valid. Please review and try again.",
    severity: "warning"
  },
  429: {
    title: "Slow down",
    message: "You're doing that too often. Please wait a moment and try again.",
    severity: "warning"
  },
  500: {
    title: "Something went wrong",
    message: "We're experiencing a problem on our end. Please try again in a moment.",
    severity: "error"
  },
  502: {
    title: "Server unavailable",
    message: "Our servers are temporarily unavailable. Please try again shortly.",
    severity: "error"
  },
  503: {
    title: "Service unavailable",
    message: "This service is temporarily down for maintenance. Please try again soon.",
    severity: "error"
  },
  504: {
    title: "Server timed out",
    message: "The server took too long to respond. Please try again.",
    severity: "error"
  },
  network: {
    title: "You're offline",
    message: "We couldn't reach the server. Please check your internet connection.",
    severity: "error"
  },
  timeout: {
    title: "Request timed out",
    message: "That took longer than expected. Please try again.",
    severity: "warning"
  },
  unknown: {
    title: "Unexpected error",
    message: "Something unexpected happened. Please try again, or contact support if it continues.",
    severity: "error"
  }
};

// src/errorHandler.ts
var messageMap = { ...DEFAULT_ERROR_MESSAGES };
var errorCache = /* @__PURE__ */ new Map();
var dedupeWindowMs = 3e3;
var logger = null;
var onError = null;
function configureErrorHandler(options = {}) {
  if (options.messages) {
    messageMap = { ...messageMap, ...options.messages };
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
function setErrorMessage(key, { title, message, severity }) {
  messageMap[key] = {
    title: title ?? messageMap[key]?.title ?? "",
    message: message ?? messageMap[key]?.message ?? "",
    severity: severity || messageMap[key]?.severity || "error"
  };
}
function getStatusFromError(err) {
  if (err == null) return "unknown";
  if (typeof err === "number") return err;
  const e = err;
  if (e.status) return e.status;
  if (e.response && e.response.status) return e.response.status;
  if (e.name === "AbortError") return "timeout";
  if (err instanceof TypeError && /fetch|network/i.test(err.message)) return "network";
  if (typeof navigator !== "undefined" && navigator && navigator.onLine === false) return "network";
  return "unknown";
}
function normalizeError(err, customMessage) {
  const status = getStatusFromError(err);
  const fallback = messageMap.unknown;
  const mapped = messageMap[status] || fallback;
  return {
    status,
    title: mapped.title,
    message: customMessage || mapped.message,
    severity: mapped.severity || "error",
    raw: err
  };
}
function shouldSuppressDuplicate(cacheKey) {
  if (!cacheKey || dedupeWindowMs <= 0) return false;
  const now = Date.now();
  const last = errorCache.get(cacheKey);
  if (last && now - last < dedupeWindowMs) {
    return true;
  }
  errorCache.set(cacheKey, now);
  return false;
}
function handleError(err, opts = {}) {
  const normalized = normalizeError(err, opts.customMessage);
  if (opts.title) normalized.title = opts.title;
  if (opts.severity) normalized.severity = opts.severity;
  if (logger) {
    try {
      logger(normalized, err);
    } catch (_) {
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
        message: normalized.message
      });
    }
  }
  return normalized;
}
function clearErrorCache() {
  errorCache.clear();
}
function wrapFetch(fetchImpl = typeof fetch !== "undefined" ? fetch : void 0) {
  if (!fetchImpl) {
    throw new Error("No fetch implementation available to wrap.");
  }
  return async function wrappedFetch(...args) {
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
  };
}
function createAxiosErrorInterceptor(opts = {}) {
  return {
    onFulfilled: (response) => response,
    onRejected: (error) => {
      handleError(error, opts);
      return Promise.reject(error);
    }
  };
}

// src/apiClient.ts
import axios from "axios";
var DEFAULT_CLIENT_OPTIONS = {
  baseURL: "",
  timeout: 15e3,
  headers: {},
  withCredentials: false,
  getAuthToken: null,
  silentStatuses: [],
  onError: null
};
function createApiClient(options = {}) {
  const config = { ...DEFAULT_CLIENT_OPTIONS, ...options };
  const instance = axios.create({
    baseURL: config.baseURL,
    timeout: config.timeout,
    headers: config.headers,
    withCredentials: config.withCredentials
  });
  instance.interceptors.request.use((reqConfig) => {
    if (typeof config.getAuthToken === "function") {
      const token = config.getAuthToken();
      if (token) {
        reqConfig.headers = reqConfig.headers ?? {};
        reqConfig.headers.Authorization = `Bearer ${token}`;
      }
    }
    return reqConfig;
  });
  instance.interceptors.response.use(
    (response) => response.data,
    (error) => {
      const status = error?.response?.status;
      const requestSilent = error?.config?.silent === true;
      const silent = requestSilent || config.silentStatuses.includes(status);
      const dedupeKey = error?.config ? `${error.config.method || "get"}:${error.config.url}` : void 0;
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
    request: (cfg) => instance.request(cfg)
  };
}
var apiClient = createApiClient();
function createGetClient(options = {}) {
  const client = createApiClient(options);
  return {
    raw: client.raw,
    request: (url, cfg) => client.get(url, cfg)
  };
}
function createPostClient(options = {}) {
  const client = createApiClient(options);
  return {
    raw: client.raw,
    request: (url, data, cfg) => client.post(url, data, cfg)
  };
}
function createPutClient(options = {}) {
  const client = createApiClient(options);
  return {
    raw: client.raw,
    request: (url, data, cfg) => client.put(url, data, cfg)
  };
}
function createDeleteClient(options = {}) {
  const client = createApiClient(options);
  return {
    raw: client.raw,
    request: (url, cfg) => client.delete(url, cfg)
  };
}

// src/authData.ts
import { SignJWT, jwtVerify } from "jose";
var DEFAULT_CACHE_TTL_MS = 24 * 60 * 60 * 1e3;
var DEFAULT_POLL_INTERVAL_MS = 60 * 1e3;
var DEFAULT_STORAGE_KEY = "fte_auth_data_cache";
function createMemoryStorage() {
  const store = /* @__PURE__ */ new Map();
  return {
    getItem: (key) => store.has(key) ? store.get(key) : null,
    setItem: (key, value) => void store.set(key, value),
    removeItem: (key) => void store.delete(key)
  };
}
function resolveDefaultStorage() {
  if (typeof window !== "undefined" && window.localStorage) {
    return window.localStorage;
  }
  return createMemoryStorage();
}
var AuthDataClient = class {
  constructor(options) {
    this.pollTimer = null;
    this.inFlight = null;
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
  async getData(opts = {}) {
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
  async refresh() {
    if (this.inFlight) return this.inFlight;
    this.inFlight = this.fetchAll().then(async (data) => {
      const fetchedAt = Date.now();
      await this.writeCache({ data, fetchedAt });
      this.onUpdate?.(data);
      return { data, fromCache: false, fetchedAt };
    }).catch((err) => {
      const normalized = handleError(err, { silent: true });
      this.onError?.(normalized);
      throw normalized;
    }).finally(() => {
      this.inFlight = null;
    });
    return this.inFlight;
  }
  /**
   * Starts polling the server every `pollIntervalMs` (default 1 minute). Overlapping ticks
   * are skipped automatically — if a request is still in flight when the next tick fires,
   * that tick is a no-op — so a slow endpoint can never stack up requests against the server.
   */
  startPolling() {
    if (this.pollTimer) return;
    this.pollTimer = setInterval(() => {
      if (this.inFlight) return;
      this.refresh().catch(() => {
      });
    }, this.pollIntervalMs);
  }
  /** Stops background polling. Safe to call even if polling was never started. */
  stopPolling() {
    if (this.pollTimer) {
      clearInterval(this.pollTimer);
      this.pollTimer = null;
    }
  }
  /** Removes the signed cache entry, forcing the next `getData()` to hit the server. */
  clearCache() {
    this.storage.removeItem(this.storageKey);
  }
  /** Stops polling and clears the cache. Call on logout/unmount. */
  destroy() {
    this.stopPolling();
    this.clearCache();
  }
  async fetchAll() {
    const entries = await Promise.all(
      this.requests.map(async (req) => {
        const result = await this.client.request({
          url: req.url,
          method: req.method ?? "GET",
          params: req.params,
          data: req.data,
          ...req.config
        });
        return [req.key, result];
      })
    );
    return Object.fromEntries(entries);
  }
  /** Signs `{ data, fetchedAt }` as an HS256 JWT (with a matching `exp`) before writing it to storage. */
  async writeCache(payload) {
    const expiresAt = Math.floor((payload.fetchedAt + this.cacheTtlMs) / 1e3);
    const jwt = await new SignJWT({ data: payload.data, fetchedAt: payload.fetchedAt }).setProtectedHeader({ alg: "HS256" }).setIssuedAt().setExpirationTime(expiresAt).sign(this.secretKey);
    this.storage.setItem(this.storageKey, jwt);
  }
  /** Verifies the cached JWT's signature and expiry. Returns null (and clears it) if it's
   *  missing, expired, or has been tampered with. */
  async readCache() {
    const jwt = this.storage.getItem(this.storageKey);
    if (!jwt) return null;
    try {
      const { payload } = await jwtVerify(jwt, this.secretKey);
      return {
        data: payload.data,
        fetchedAt: payload.fetchedAt
      };
    } catch {
      this.storage.removeItem(this.storageKey);
      return null;
    }
  }
};
function createAuthDataClient(options) {
  return new AuthDataClient(options);
}
function createMethodLockedAuthDataClient(method, options) {
  return new AuthDataClient({
    ...options,
    requests: options.requests.map((req) => ({ ...req, method }))
  });
}
function createGetAuthDataClient(options) {
  return createMethodLockedAuthDataClient("GET", options);
}
function createPostAuthDataClient(options) {
  return createMethodLockedAuthDataClient("POST", options);
}
function createPutAuthDataClient(options) {
  return createMethodLockedAuthDataClient("PUT", options);
}
function createDeleteAuthDataClient(options) {
  return createMethodLockedAuthDataClient("DELETE", options);
}

// src/index.ts
var toast = {
  success: (message, title) => showToast({ type: "success", message, title }),
  error: (message, title) => showToast({ type: "error", message, title }),
  warning: (message, title) => showToast({ type: "warning", message, title }),
  info: (message, title) => showToast({ type: "info", message, title })
};
export {
  AuthDataClient,
  DEFAULT_ERROR_MESSAGES,
  apiClient,
  clearErrorCache,
  clearToasts,
  configureErrorHandler,
  configureToast,
  createApiClient,
  createAuthDataClient,
  createAxiosErrorInterceptor,
  createDeleteAuthDataClient,
  createDeleteClient,
  createGetAuthDataClient,
  createGetClient,
  createPostAuthDataClient,
  createPostClient,
  createPutAuthDataClient,
  createPutClient,
  dismissToast,
  handleError,
  normalizeError,
  setErrorMessage,
  showToast,
  toast,
  wrapFetch
};
//# sourceMappingURL=index.js.map