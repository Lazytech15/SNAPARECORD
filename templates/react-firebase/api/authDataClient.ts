// EDIT ME: list whatever Firestore docs/queries your app needs bundled
// together on login/app-start (profile, permissions, settings, ...), and
// tune the cache/poll timing to your data's freshness needs.
//
// This works EXACTLY like the PHP template's authDataClient.ts — same
// caching, same JWE-encrypted local storage, same polling — because
// `authApi` (in this folder) already speaks the `ApiClient` interface
// `AuthDataClient` expects. Only the request *shape* below (Firestore
// paths/where-clauses instead of a URL path) is Firebase-specific.
//
// A NOTE ON POLLING WITH FIRESTORE: Firestore already has realtime listeners
// (`onSnapshot`) which are usually a better fit than polling for live data.
// This bundle's `pollIntervalMs` is still useful for anything you'd rather
// pull on a timer than subscribe to permanently (e.g. a rarely-changing
// settings doc) — use `onSnapshot` directly in a component for anything
// that truly needs to be realtime.
import { createGetAuthDataClient } from "snaparecord";
import { authApi } from "./authApi";
import { sessionToken } from "./sessionToken";
import { auth } from "./firebaseClient";

const sharedOptions = {
  client: authApi,

  // Only decides WHETHER to fetch/poll (falsy = skip) — the actual request
  // auth is handled by the Firebase SDK itself via security rules tied to
  // `request.auth.uid`.
  getAuthToken: () => sessionToken.get(),

  // Signs/verifies the *cached* blob in storage — never sent to Firebase.
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
};

/**
 * The post-login data bundle. Import `authGetClient` wherever a component
 * needs to *read* one of these keys.
 *
 *   const { data } = await authGetClient.getData();
 *   data.profile // -> the doc at profiles/<uid>
 */
export const authGetClient = createGetAuthDataClient({
  ...sharedOptions,
  requests: [
    { key: "profile", url: `profiles/${auth.currentUser?.uid ?? "REPLACE_WITH_CURRENT_UID"}` },
    // { key: "posts", url: "posts", params: { where: [["userId", "==", uid]], orderBy: ["createdAt", "desc"] } },
  ],
});

// EDIT ME: `requests` above is only read ONCE, at import time — but
// `auth.currentUser` isn't populated until after Firebase resolves the
// session (or after login), so the uid baked in here can be stale/empty.
// Two ways to fix, pick one:
//   1. (Simplest) Skip the uid entirely — point Firestore security rules
//      at `request.auth.uid` server-side (e.g. a query/rule keyed off
//      the caller's own uid) so the client never needs to know its own
//      uid up front.
//   2. Rebuild this client after auth resolves: move this whole
//      `createGetAuthDataClient({...})` call into a function
//      `buildAuthGetClient(uid: string)` and call it from
//      `onAuthStateChanged` in AuthContext.tsx once `uid` is known,
//      storing the result in a ref instead of a module-level constant.
