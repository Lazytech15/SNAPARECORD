// Firebase ID tokens are fetched ASYNCHRONOUSLY (`user.getIdToken()`) and
// auto-refresh roughly every hour — but `AuthDataClient`/`ApiClient` need a
// SYNC `getAuthToken(): string | null` they can call on every request/poll
// tick. This keeps one in-memory mirror of the current ID token, updated
// automatically by `onIdTokenChanged`, which fires on sign-in, sign-out,
// AND every silent token refresh — so callers never hold a stale token.
import { onIdTokenChanged } from "firebase/auth";
import { auth } from "./firebaseClient";

let token: string | null = null;

onIdTokenChanged(auth, async (user) => {
  token = user ? await user.getIdToken() : null;
});

export const sessionToken = {
  get: (): string | null => token,
  // EDIT ME: no-ops on purpose — don't call these directly for Firebase.
  // Always use firebase/auth's signIn.../signOut() (see AuthContext.tsx)
  // and let onIdTokenChanged above keep this mirror in sync.
  set: (_value: string): void => {},
  clear: (): void => {},
};
