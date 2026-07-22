import type { ErrorMessageMap } from "./types.js";

/**
 * Default human-friendly messages for common HTTP status codes
 * and well-known error types. These can be overridden or extended
 * via configureErrorHandler({ messages: { ... } }).
 */
export const DEFAULT_ERROR_MESSAGES: ErrorMessageMap = {
  400: {
    title: "Something's not right",
    message: "We couldn't process your request. Please check your input and try again.",
    severity: "warning",
  },
  401: {
    title: "Please sign in",
    message: "Your session has expired or you're not signed in. Please log in again.",
    severity: "warning",
  },
  403: {
    title: "Access denied",
    message: "You don't have permission to do that. Contact support if you think this is a mistake.",
    severity: "warning",
  },
  404: {
    title: "Not found",
    message: "We couldn't find what you were looking for. It may have been moved or removed.",
    severity: "warning",
  },
  408: {
    title: "Request timed out",
    message: "That took too long to respond. Please try again.",
    severity: "warning",
  },
  409: {
    title: "Conflict",
    message: "This action conflicts with the current state. Please refresh and try again.",
    severity: "warning",
  },
  413: {
    title: "File too large",
    message: "The file or data you're sending is too large. Please try a smaller one.",
    severity: "warning",
  },
  422: {
    title: "Invalid data",
    message: "Some of the information provided isn't valid. Please review and try again.",
    severity: "warning",
  },
  429: {
    title: "Slow down",
    message: "You're doing that too often. Please wait a moment and try again.",
    severity: "warning",
  },
  500: {
    title: "Something went wrong",
    message: "We're experiencing a problem on our end. Please try again in a moment.",
    severity: "error",
  },
  502: {
    title: "Server unavailable",
    message: "Our servers are temporarily unavailable. Please try again shortly.",
    severity: "error",
  },
  503: {
    title: "Service unavailable",
    message: "This service is temporarily down for maintenance. Please try again soon.",
    severity: "error",
  },
  504: {
    title: "Server timed out",
    message: "The server took too long to respond. Please try again.",
    severity: "error",
  },
  network: {
    title: "You're offline",
    message: "We couldn't reach the server. Please check your internet connection.",
    severity: "error",
  },
  timeout: {
    title: "Request timed out",
    message: "That took longer than expected. Please try again.",
    severity: "warning",
  },
  unknown: {
    title: "Unexpected error",
    message: "Something unexpected happened. Please try again, or contact support if it continues.",
    severity: "error",
  },
};
