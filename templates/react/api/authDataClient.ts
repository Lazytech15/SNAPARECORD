// EDIT ME: list whatever endpoints your app needs bundled together on
// login/app-start (profile, permissions, settings, ...), and tune the
// cache/poll timing to your data's freshness needs.
import { createAuthDataClient } from "snaparecord";
import { authApi } from "./authApi";

export const authDataClient = createAuthDataClient({
  client: authApi,

  requests: [
    { key: "profile", url: "/me" },
    { key: "permissions", url: "/permissions" },
    // { key: "settings", url: "/settings" },
  ],

  // Signs/verifies the *cached* blob in storage — never sent to the server.
  // Keep this out of source control (env var).
  jwtSecret: import.meta.env.VITE_AUTH_CACHE_SECRET,

  cacheTtlMs: 24 * 60 * 60 * 1000, // how long the local cache stays valid
  pollIntervalMs: 60 * 1000, // background refresh interval once startPolling() is called

  onUpdate: (data: Record<string, unknown>) => {
    // EDIT ME: hook into analytics/logging if useful
  },
  onError: (err: unknown) => {
    // EDIT ME: send to your error tracker
  },
});
