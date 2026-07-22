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

/** Show a toast notification. Returns the toast id, usable with dismissToast(). */
export function showToast({
  message,
  title,
  type = "info",
  duration,
}: ShowToastParams): string | null {
  if (typeof document === "undefined") {
    // Non-browser environment (SSR, node script) - fall back to console.
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

  const iconHtml = globalOptions.showIcon
    ? `<div class="fte-toast-icon">${ICONS[type] || ICONS.info}</div>`
    : "";

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
    (toastEl.querySelector(".fte-toast-title") as HTMLElement).textContent = title;
  }
  (toastEl.querySelector(".fte-toast-message") as HTMLElement).textContent = message;

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

  if (finalDuration > 0) {
    toastEl.addEventListener("mouseenter", pauseTimer);
    toastEl.addEventListener("mouseleave", startTimer);
    // Kick off after the enter transition's first frame so the bar is visible at full width first
    requestAnimationFrame(() => requestAnimationFrame(startTimer));
  }

  return id;
}

/** Manually dismiss a toast by id. */
export function dismissToast(id: string | null): void {
  if (!id || typeof document === "undefined") return;
  const el = document.getElementById(id);
  if (!el) return;
  el.setAttribute("data-visible", "false");
  setTimeout(() => el.remove(), 200);
}

/** Remove all currently visible toasts. */
export function clearToasts(): void {
  if (!container) return;
  Array.from(container.children).forEach((child) => dismissToast(child.id));
}
