// EDIT ME: list whatever tables/rows your app needs bundled together on
// login/app-start (profile, permissions, settings, ...), and tune the
// cache/poll timing to your data's freshness needs.
//
// This works EXACTLY like the PHP template's authDataClient.ts — same
// caching, same JWE-encrypted local storage, same polling — because
// `authApi` (in this folder) already speaks the `ApiClient` interface
// `AuthDataClient` expects. Only the request *shape* below (table/eq/select
// instead of a URL path) is Supabase-specific.
import { createGetAuthDataClient } from "snaparecord";
import { authApi } from "./authApi";
import { sessionToken } from "./sessionToken";

const sharedOptions = {
  client: authApi,

  // `getAuthToken` here only decides WHETHER to fetch/poll (falsy = skip).
  // The actual request auth is handled by the Supabase client itself
  // (it attaches the session's JWT internally on every call) — this is
  // just the "is someone logged in?" gate.
  getAuthToken: () => sessionToken.get(),

  // Signs/verifies the *cached* blob in storage — never sent to Supabase.
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
 *   data.profile // -> the single row from `profiles` where id = current user
 */
export const authGetClient = createGetAuthDataClient({
  ...sharedOptions,
  requests: [
    {
      key: "profile",
      url: "profiles",
      params: { eq: { id: "REPLACE_WITH_CURRENT_USER_ID" }, single: true },
    },
    // { key: "posts", url: "posts", params: { eq: { user_id: userId }, orderBy: ["created_at", { ascending: false }] } },
  ],
});

// EDIT ME: `getData()`'s requests are fixed at construction time above, but
// `profile`'s `eq.id` needs the CURRENT user's id, which you only know after
// login. Simplest fix: rebuild/replace this bundle's `eq` value inside
// AuthContext's login()/the auth-state listener before the first
// `getData({ force: true })` call — see AuthContext.tsx for the pattern
// (or, since it's Supabase, prefer a Postgres RLS policy like
// `USING (id = auth.uid())` and drop the `eq` filter entirely).
