// EDIT ME: point baseURL at your backend, and adjust onError to match your
// app's login route / redirect behavior.
import { createApiClient } from "snaparecord";
import { sessionToken } from "./sessionToken";

export const authApi = createApiClient({
  baseURL: import.meta.env.VITE_API_BASE_URL ?? "/api",
  getAuthToken: () => sessionToken.get(),
  // 401s are handled globally below — don't also toast them per-call.
  silentStatuses: [401],
  onError: (normalized) => {
    if (normalized.status === 401) {
      sessionToken.clear();
      window.location.href = "/login";
    }
  },
});

// EDIT ME: add one createApiClient() per additional backend/domain, e.g.:
// export const billingApi = createApiClient({ baseURL: "/api/billing", getAuthToken: () => sessionToken.get() });
