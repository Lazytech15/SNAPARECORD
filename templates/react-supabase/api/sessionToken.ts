// Supabase manages its own session internally (and persists it to
// localStorage itself) — but `AuthDataClient`/`ApiClient` need a SYNC
// `getAuthToken(): string | null` they can call on every request/poll tick.
// `supabase.auth.getSession()` is async, so we can't call it directly there.
//
// Fix: keep one in-memory mirror of the current access token, updated
// automatically every time Supabase's own auth state changes (sign in,
// sign out, or a silent token refresh). Nothing else in the app should
// read/write Supabase's session directly — always go through this.
import { supabase } from "./supabaseClient";

let token: string | null = null;

// Prime the mirror on load (covers page refresh, where a session may
// already exist in Supabase's own persisted storage).
supabase.auth.getSession().then(({ data }) => {
  token = data.session?.access_token ?? null;
});

// Keep the mirror in sync forever after — this fires on SIGNED_IN,
// SIGNED_OUT, and TOKEN_REFRESHED, so callers never hold a stale token.
supabase.auth.onAuthStateChange((_event, session) => {
  token = session?.access_token ?? null;
});

export const sessionToken = {
  get: (): string | null => token,
  // EDIT ME: these are no-ops on purpose. Don't call sessionToken.set/clear()
  // yourself for Supabase — always call supabase.auth.signInWithPassword(...)
  // / supabase.auth.signOut() (see AuthContext.tsx) and let onAuthStateChange
  // above update the mirror for you. Manually setting a token here would
  // desync it from Supabase's real session.
  set: (_value: string): void => {},
  clear: (): void => {},
};
