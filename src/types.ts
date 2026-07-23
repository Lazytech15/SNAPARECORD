export type ToastType = "error" | "success" | "warning" | "info";
export type ToastPosition =
  | "top-right"
  | "top-left"
  | "bottom-right"
  | "bottom-left"
  | "top-center"
  | "bottom-center";

export interface ToastOptions {
  position?: ToastPosition;
  duration?: number;
  showIcon?: boolean;
}

export interface ShowToastParams {
  message: string;
  title?: string;
  type?: ToastType;
  duration?: number;
  /**
   * When two toasts share the same key while the first is still visible,
   * the second one won't stack a new toast — it bumps a "xN" counter on
   * the existing one instead and refreshes its auto-dismiss timer.
   */
  key?: string;
}

export interface FriendlyMessage {
  title: string;
  message: string;
  severity: ToastType;
}

export type ErrorMessageMap = Record<string | number, FriendlyMessage>;

export type ErrorStatus = string | number;

export interface NormalizedError {
  status: ErrorStatus;
  title: string;
  message: string;
  severity: ToastType;
  raw: unknown;
}

export interface HandleErrorOptions {
  customMessage?: string;
  title?: string;
  severity?: ToastType;
  silent?: boolean;
  dedupeKey?: string;
}

export interface ConfigureErrorHandlerOptions {
  messages?: Partial<ErrorMessageMap>;
  dedupeWindowMs?: number;
  logger?: (normalized: NormalizedError, raw: unknown) => void;
  onError?: (normalized: NormalizedError) => boolean | void;
}

export interface AxiosErrorInterceptorOptions extends HandleErrorOptions {}

export interface AxiosLikeInterceptor {
  onFulfilled: <T>(response: T) => T;
  onRejected: (error: unknown) => Promise<never>;
}
