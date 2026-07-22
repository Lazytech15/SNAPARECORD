// EDIT ME: list whatever GET endpoints your app needs bundled together on
// login/app-start (profile, permissions, settings, ...), and tune the
// cache/poll timing to your data's freshness needs.
//
// ── What this file is for ───────────────────────────────────────────────────
// This is the post-login CACHE bootstrap, not a general request tool. On login
// (see AuthContext.tsx) it fetches every endpoint below in one batch, signs +
// caches the result locally, and can poll on an interval — so the app has
// profile/permissions/settings ready instantly without re-hitting the server
// on every render.
//
// For anything else — fetching a specific record, searching, creating,
// updating, deleting — use `authApi` directly from the component instead
// (see authApi.ts). This file only ever grows when you have a genuinely new
// endpoint to bundle in, not a new component: many components can (and
// should) import the same `authGetClient` below and just read the `key`
// they need.
//
// ── Keeping the cache in sync after a mutation ─────────────────────────────
// After a component does `authApi.post/put/patch/delete(...)`, that write
// does NOT automatically update this cache. Call `refresh()` from
// `useAuth()` (see AuthContext.tsx) right after a successful mutation to
// force this bundle to re-fetch and push the new data out to every consumer.
// Full example: components/EditPostForm.tsx.
//
// The example endpoints below point at jsonplaceholder.typicode.com so you
// can see this working end-to-end before wiring up your real API — swap
// `authApi`'s baseURL and these urls/keys for your own backend.
import { createGetAuthDataClient } from "snaparecord";
import { authApi } from "./authApi";

const sharedOptions = {
  client: authApi,

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
};

/**
 * The post-login data bundle. Import `authGetClient` wherever a component needs
 * to *read* one of these keys — every component shares this same cached bundle,
 * so add a new `{ key, url }` here only when you need a genuinely new endpoint,
 * not a new component.
 *
 * Example: https://jsonplaceholder.typicode.com/todos/1 and /users/1.
 *
 *   // in any component:
 *   const { data } = await authGetClient.getData();
 *   data.user // -> whatever GET /users/1 returned
 */
export const authGetClient = createGetAuthDataClient({
  ...sharedOptions,
  requests: [
    { key: "todo", url: "/todos/1" },
    { key: "user", url: "/users/1" },
    // { key: "posts", url: "/posts", params: { userId: 1 } },
  ],
});

// EDIT ME: `createPostAuthDataClient` / `createPutAuthDataClient` /
// `createDeleteAuthDataClient` also exist in "snaparecord", but are only
// useful for a FIXED action with no per-call variables (e.g. "dismiss
// onboarding banner on next login"). For normal create/update/delete flows
// driven by user input, use `authApi.post/put/patch/delete(...)` directly —
// see authApi.ts's usage cheat sheet and components/EditPostForm.tsx.
