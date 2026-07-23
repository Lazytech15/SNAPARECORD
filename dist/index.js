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
var activeByKey = /* @__PURE__ */ new Map();
var keyById = /* @__PURE__ */ new Map();
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
  duration,
  key
}) {
  if (typeof document === "undefined") {
    console.log(`[toast:${type}] ${title ? title + " - " : ""}${message}`);
    return null;
  }
  if (key) {
    const existing = activeByKey.get(key);
    if (existing) {
      existing.count += 1;
      existing.countEl.textContent = `\xD7${existing.count}`;
      existing.countEl.style.display = "inline-block";
      existing.restart();
      return existing.id;
    }
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
      ${title ? `<div class="fte-toast-title"><span class="fte-toast-title-text"></span><span class="fte-toast-count" style="display:none"></span></div>` : ""}
      <div class="fte-toast-message"></div>
    </div>
    <button class="fte-toast-close" aria-label="Dismiss">&times;</button>
    ${finalDuration > 0 ? `<div class="fte-toast-progress"><div class="fte-toast-progress-bar"></div></div>` : ""}
  `;
  if (title) {
    toastEl.querySelector(".fte-toast-title-text").textContent = title;
  }
  toastEl.querySelector(".fte-toast-message").textContent = message;
  const countEl = toastEl.querySelector(".fte-toast-count");
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
  const restart = () => {
    if (finalDuration <= 0) return;
    if (dismissTimer) {
      clearTimeout(dismissTimer);
      dismissTimer = null;
    }
    remaining = finalDuration;
    if (progressBar) {
      progressBar.style.transition = "none";
      progressBar.style.transform = "scaleX(1)";
      void progressBar.offsetWidth;
    }
    startTimer();
  };
  if (finalDuration > 0) {
    toastEl.addEventListener("mouseenter", pauseTimer);
    toastEl.addEventListener("mouseleave", startTimer);
    requestAnimationFrame(() => requestAnimationFrame(startTimer));
  }
  if (key) {
    const record = { id, count: 1, el: toastEl, countEl, duration: finalDuration, restart };
    activeByKey.set(key, record);
    keyById.set(id, key);
  }
  return id;
}
function dismissToast(id) {
  if (!id || typeof document === "undefined") return;
  const el = document.getElementById(id);
  const key = keyById.get(id);
  if (key) {
    activeByKey.delete(key);
    keyById.delete(id);
  }
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
    showToast({
      type: normalized.severity,
      title: normalized.title,
      message: normalized.message,
      key: dedupeWindowMs > 0 ? dedupeKey : void 0
    });
  }
  return normalized;
}
function clearErrorCache() {
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
import { EncryptJWT, jwtDecrypt } from "jose";
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
    this.secretKey = null;
    this.secretKeyPromise = null;
    this.pollTimer = null;
    this.inFlight = null;
    if (!options?.client) throw new Error("AuthDataClient requires an api `client`.");
    if (!options?.requests?.length) throw new Error("AuthDataClient requires a non-empty `requests` array.");
    if (!options?.jwtSecret) throw new Error("AuthDataClient requires a `jwtSecret` to sign the cache.");
    if (typeof options?.getAuthToken !== "function") {
      throw new Error(
        "AuthDataClient requires a `getAuthToken` function, so it knows whether a session exists before fetching or polling \u2014 pass the same function you use as `getAuthToken` on the client's createApiClient(...)."
      );
    }
    this.client = options.client;
    this.requests = options.requests;
    this.jwtSecret = options.jwtSecret;
    this.getAuthToken = options.getAuthToken;
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
   *
   * If `getAuthToken()` currently returns a falsy value, this resolves immediately with
   * `{ data: {}, fromCache: false, fetchedAt: null, authenticated: false }` and touches
   * neither the network nor the cache.
   */
  async getData(opts = {}) {
    if (!this.getAuthToken()) {
      return { data: {}, fromCache: false, fetchedAt: null, authenticated: false };
    }
    if (!opts.force) {
      const cached = await this.readCache();
      if (cached) {
        return { data: cached.data, fromCache: true, fetchedAt: cached.fetchedAt, authenticated: true };
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
    if (!this.getAuthToken()) {
      return { data: {}, fromCache: false, fetchedAt: null, authenticated: false };
    }
    if (this.inFlight) return this.inFlight;
    this.inFlight = this.fetchAll().then(async (data) => {
      const fetchedAt = Date.now();
      await this.writeCache({ data, fetchedAt });
      this.onUpdate?.(data);
      return { data, fromCache: false, fetchedAt, authenticated: true };
    }).catch((err) => {
      const normalized = handleError(err, { dedupeKey: this.errorDedupeKey });
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
      if (!this.getAuthToken()) return;
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
          ...req.config,
          // Each endpoint in the bundle is silent by default: a failure here
          // is reported once for the whole bundle (see refresh()'s catch),
          // not once per endpoint. Set `config: { silent: false }` on a
          // specific request if you deliberately want it to toast on its own
          // in addition to the bundle-level toast.
          silent: req.config?.silent ?? true
        });
        return [req.key, result];
      })
    );
    return Object.fromEntries(entries);
  }
  /** Derives a proper 256-bit AES-GCM key from the (arbitrary-length) `jwtSecret` via SHA-256,
   *  so callers don't need to hand-roll a correctly sized/entropy key themselves. Cached after
   *  first use since digesting is async (WebCrypto) but the result never changes. */
  async getSecretKey() {
    if (this.secretKey) return this.secretKey;
    if (!this.secretKeyPromise) {
      this.secretKeyPromise = crypto.subtle.digest("SHA-256", new TextEncoder().encode(this.jwtSecret)).then((digest) => {
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
  async writeCache(payload) {
    const secretKey = await this.getSecretKey();
    const expiresAt = Math.floor((payload.fetchedAt + this.cacheTtlMs) / 1e3);
    const jwe = await new EncryptJWT({ data: payload.data, fetchedAt: payload.fetchedAt }).setProtectedHeader({ alg: "dir", enc: "A256GCM" }).setIssuedAt().setExpirationTime(expiresAt).encrypt(secretKey);
    this.storage.setItem(this.storageKey, jwe);
  }
  /** Decrypts and authenticates the cached JWE. Returns null (and clears it) if it's missing,
   *  expired, or has been tampered with — a modified ciphertext fails the GCM auth tag check
   *  before any data is ever produced, so corrupted/forged cache entries are never trusted. */
  async readCache() {
    const jwe = this.storage.getItem(this.storageKey);
    if (!jwe) return null;
    try {
      const secretKey = await this.getSecretKey();
      const { payload } = await jwtDecrypt(jwe, secretKey);
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