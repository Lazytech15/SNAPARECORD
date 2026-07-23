import type { ShowToastParams, ToastOptions, ToastType } from "./types.js";

let container: HTMLDivElement | null = null;
let idCounter = 0;

const DEFAULT_OPTIONS: Required<ToastOptions> = {
  position: "top-right",
  duration: 4500,
  showIcon: true,
};

let globalOptions: Required<ToastOptions> = { ...DEFAULT_OPTIONS };

const ICONS: Record<ToastType, string> = {
  error: "!",
  success: "\u2713",
  warning: "!",
  info: "i",
};

/** Internal bookkeeping for one live toast, so a repeat with the same `key` can bump it. */
interface ActiveToast {
  id: string;
  count: number;
  el: HTMLDivElement;
  countEl: HTMLElement;
  duration: number;
  restart: () => void;
}

// key -> the toast currently on screen for that key (only tracked when `key` is passed).
const activeByKey = new Map<string, ActiveToast>();
// id -> key, so dismissal can clean up activeByKey without a scan.
const keyById = new Map<string, string>();

function ensureContainer(): HTMLDivElement {
  if (container && document.body.contains(container)) return container;

  container = document.createElement("div");
  container.className = "fte-toast-container";
  container.setAttribute("data-position", globalOptions.position);
  document.body.appendChild(container);
  return container;
}

/** Configure global defaults for all toasts. */
export function configureToast(options: ToastOptions = {}): void {
  globalOptions = { ...globalOptions, ...options };
  if (container) {
    container.setAttribute("data-position", globalOptions.position);
  }
}

/**
 * Show a toast notification. Returns the toast id, usable with dismissToast().
 *
 * Pass `key` to coalesce repeats: if a toast with the same key is still
 * visible, this bumps its "xN" counter and refreshes its timer instead of
 * stacking a new, visually-identical toast on top of it.
 */
export function showToast({
  message,
  title,
  type = "info",
  duration,
  key,
}: ShowToastParams): string | null {
  if (typeof document === "undefined") {
    // Non-browser environment (SSR, node script) - fall back to console.
    console.log(`[toast:${type}] ${title ? title + " - " : ""}${message}`);
    return null;
  }

  // Repeat of a still-visible toast: bump its counter instead of stacking a new one.
  if (key) {
    const existing = activeByKey.get(key);
    if (existing) {
      existing.count += 1;
      existing.countEl.textContent = `\u00d7${existing.count}`;
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

  const iconHtml = globalOptions.showIcon
    ? `<div class="fte-toast-icon">${ICONS[type] || ICONS.info}</div>`
    : "";

  toastEl.innerHTML = `
    ${iconHtml}
    <div class="fte-toast-body">
      ${
        title
          ? `<div class="fte-toast-title"><span class="fte-toast-title-text"></span><span class="fte-toast-count" style="display:none"></span></div>`
          : ""
      }
      <div class="fte-toast-message"></div>
    </div>
    <button class="fte-toast-close" aria-label="Dismiss">&times;</button>
    ${finalDuration > 0 ? `<div class="fte-toast-progress"><div class="fte-toast-progress-bar"></div></div>` : ""}
  `;

  if (title) {
    (toastEl.querySelector(".fte-toast-title-text") as HTMLElement).textContent = title;
  }
  (toastEl.querySelector(".fte-toast-message") as HTMLElement).textContent = message;

  const countEl = toastEl.querySelector(".fte-toast-count") as HTMLElement;

  (toastEl.querySelector(".fte-toast-close") as HTMLButtonElement).addEventListener(
    "click",
    () => {
      dismissToast(id);
    }
  );

  el.appendChild(toastEl);

  // Trigger enter transition
  requestAnimationFrame(() => {
    toastEl.setAttribute("data-visible", "true");
  });

  let dismissTimer: ReturnType<typeof setTimeout> | null = null;
  let remaining = finalDuration;
  let startedAt = Date.now();
  const progressBar = toastEl.querySelector(".fte-toast-progress-bar") as HTMLElement | null;

  const startTimer = () => {
    if (finalDuration <= 0) return;
    startedAt = Date.now();
    if (progressBar) {
      progressBar.style.transition = `transform ${remaining}ms linear`;
      // Force reflow so the transition applies before we change the value
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

  /** Reset the countdown to the full duration, e.g. when a repeat bumps this toast. */
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
    // Kick off after the enter transition's first frame so the bar is visible at full width first
    requestAnimationFrame(() => requestAnimationFrame(startTimer));
  }

  if (key) {
    const record: ActiveToast = { id, count: 1, el: toastEl, countEl, duration: finalDuration, restart };
    activeByKey.set(key, record);
    keyById.set(id, key);
  }

  return id;
}

/** Manually dismiss a toast by id. */
export function dismissToast(id: string | null): void {
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

/** Remove all currently visible toasts. */
export function clearToasts(): void {
  if (!container) return;
  Array.from(container.children).forEach((child) => dismissToast(child.id));
}
