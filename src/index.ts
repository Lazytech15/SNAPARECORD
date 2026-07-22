export { showToast, dismissToast, clearToasts, configureToast } from "./toast.js";
export {
  handleError,
  normalizeError,
  configureErrorHandler,
  setErrorMessage,
  wrapFetch,
  createAxiosErrorInterceptor,
  clearErrorCache,
} from "./errorHandler.js";
export { DEFAULT_ERROR_MESSAGES } from "./errorMessages.js";
export {
  createApiClient,
  apiClient,
  createGetClient,
  createPostClient,
  createPutClient,
  createDeleteClient,
} from "./apiClient.js";
export {
  AuthDataClient,
  createAuthDataClient,
  createGetAuthDataClient,
  createPostAuthDataClient,
  createPutAuthDataClient,
  createDeleteAuthDataClient,
} from "./authData.js";

export type {
  ToastType,
  ToastPosition,
  ToastOptions,
  ShowToastParams,
  FriendlyMessage,
  ErrorMessageMap,
  ErrorStatus,
  NormalizedError,
  HandleErrorOptions,
  ConfigureErrorHandlerOptions,
} from "./types.js";
export type {
  ApiClient,
  ApiClientOptions,
  RequestConfig,
  MethodApiClient,
  WriteMethodApiClient,
} from "./apiClient.js";
export type {
  AuthDataRequest,
  AuthDataStorage,
  AuthDataClientOptions,
  AuthDataResult,
  AuthDataMethodRequest,
  AuthDataMethodClientOptions,
} from "./authData.js";

// Convenience toast shortcuts
import { showToast } from "./toast.js";
import type { ToastType } from "./types.js";

export const toast: Record<ToastType, (message: string, title?: string) => string | null> = {
  success: (message, title) => showToast({ type: "success", message, title }),
  error: (message, title) => showToast({ type: "error", message, title }),
  warning: (message, title) => showToast({ type: "warning", message, title }),
  info: (message, title) => showToast({ type: "info", message, title }),
};
