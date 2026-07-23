<div align="center">

# SNAPARECORD

**A secure, centralized data layer for your browser app.**
Encrypted local cache · JWT-secured auth · centralized API client · toasts · background sync

[![npm-free install](https://img.shields.io/badge/install-github-blue?logo=github)](https://github.com/Lazytech15/snaparecord)
[![TypeScript](https://img.shields.io/badge/TypeScript-ready-3178C6?logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![Zero-config cache encryption](https://img.shields.io/badge/cache-AES--256--GCM-brightgreen)](#authdata-batched-encrypted-cached-polled-fetching)
[![Framework agnostic](https://img.shields.io/badge/framework-agnostic-lightgrey)](#quick-start)
[![License: MIT](https://img.shields.io/badge/license-MIT-yellow.svg)](#license)

</div>

---

Most apps fetch data, dump it in `localStorage`, and hope nobody opens
devtools. SNAPARECORD is built for the alternative: one centralized client
that talks to your backend, encrypts what it caches, refreshes itself in the
background, and tells the user in plain language when something goes wrong —
instead of that logic being copy-pasted (or missing) in every component.

## Why teams reach for this

| | |
|---|---|
| 🔒 **Encrypted cache, always on** | Batched data is AES-256-GCM encrypted before it ever touches `localStorage` — unreadable *and* tamper-proof, no opt-out |
| 🔁 **Background polling** | Keeps cached data fresh on an interval without ever stacking overlapping requests |
| ⚡ **One fetch, not fifty** | A whole page's worth of endpoints load as a single batched request at login, cached until it expires |
| 🍞 **Friendly errors, automatically** | 400/401/403/404/500-class errors become clear toasts instead of raw status codes or stack traces |
| 🧩 **Plugs into any auth provider** | Supabase, Auth0, Google OAuth, or your own backend — it only needs a bearer token getter |
| 🪶 **Framework agnostic** | Plain JS, React, Vue, Svelte — ships a React scaffold (`npx snaparecord init`) but isn't tied to it |

## How the pieces fit together

```
 Your backend / Supabase (RLS enforced here)
              │  HTTPS + Bearer token
              ▼
        authApi (createApiClient)
   — direct, uncached, per-call requests —
              │
              ▼
     AuthDataClient (authData)
 — batches GETs at login, encrypts (AES-256-GCM)
   before caching, polls every N seconds,
   resets daily —
              │
              ▼
        Your UI components
   (reads from cache instantly, updates
    live as polling/refresh land)
```

SNAPARECORD never talks to your database directly and doesn't replace
row-level security — it's the layer between "data already authorized by your
backend" and "data safely sitting in the user's browser."

---

## Full feature list

- Centralized axios API client — one place for base URL, auth headers,
  timeouts, and error handling (`createApiClient`)
- Method-locked clients (`createGetClient`, `createPostClient`, ...) so a
  read-only component can't accidentally import a delete-capable client
- Batched multi-endpoint fetching with `AuthDataClient` — one login-time
  call instead of N waterfall requests
- Mandatory AES-256-GCM cache encryption (JWE) — no plaintext mode
- Auth-tag verification on every cache read — corrupted or forged entries
  are detected and discarded automatically
- Configurable cache TTL (defaults to a daily reset) and poll interval
  (defaults to 1 minute)
- Non-overlapping polling — a slow tick is skipped, never queued
- Manual `refresh()` hook so mutations elsewhere in the app can update the
  cache on demand
- Universal toast notifications with built-in friendly messages for common
  HTTP status codes, fully overridable
- Duplicate-error suppression so a burst of identical failures doesn't spam
  the user
- `npx snaparecord init` scaffolds an editable starter setup (API client,
  AuthDataClient, React context) instead of hiding it behind a black box
- `--backend supabase`/`--backend firebase` scaffold that same starter setup
  wired to Supabase/Firestore instead of REST, auto-installing the SDK

---

## Install

This package isn't published to the public npm registry — it's meant to be
installed straight from GitHub.

**Option A — as a dependency (recommended):**

```bash
npm install github:Lazytech15/snaparecord
# or pin to a tag/branch:
npm install github:Lazytech15/snaparecord#v1.0.0
```

`dist/` is committed to this repo, so this works with no build step on your
end — npm just clones it and you import it like any other package.

**Option B — clone and copy in:**

```bash
git clone https://github.com/Lazytech15/snaparecord.git
```

Then copy `dist/` (and `src/toast.css`) into your project and import from
that path directly, editing whatever request shapes/endpoints you need per
project. Since you're copying files instead of installing the package, also
install its two runtime dependencies yourself:

```bash
npm install axios jose
```

(Option A doesn't need this step — `axios` and `jose` are regular
dependencies of the package, so they're installed automatically along with
it.)

Import the (optional but recommended) stylesheet once, anywhere in your app:

```js
import "snaparecord/styles.css";
// or, if you copied the files in directly:
import "./snaparecord/toast.css";
```

## Scaffold a starter setup (React)

The package itself is framework-agnostic and ships no React components — but
since a real app needs the same handful of files every time (a centralized
API client, an `AuthDataClient` instance, and a React context that ties them
together with polling), run:

```bash
npx snaparecord init
```

By default this scaffolds the plain REST/axios template. Pass `--backend` to
scaffold one wired for Supabase or Firebase instead — the package needed
(`@supabase/supabase-js` or `firebase`) is installed for you automatically:

```bash
npx snaparecord init --backend php        # default — REST via axios
npx snaparecord init --backend supabase   # also runs: <npm|yarn|pnpm|bun> add @supabase/supabase-js
npx snaparecord init --backend firebase   # also runs: <npm|yarn|pnpm|bun> add firebase
```

All three flags scaffold the same **public shape** —
`authApi`, `authGetClient`, `<AuthProvider>`/`useAuth()` — only the transport
underneath differs, so the rest of your app (components, `EditPostForm`
example, etc.) never needs to know which backend is in use. See
[Using the Supabase/Firebase templates](#using-the-supabasefirebase-templates)
below for what's different about those two and how to wire them up.

Other flags:

- `--dir <path>` — scaffold somewhere other than `src/` (default: `src`)
- `--force` — overwrite files that already exist at the destination
- `--no-install` — skip the automatic package install (Supabase/Firebase
  only); prints the manual `install`/`add` command instead

This copies editable starter files into your project:

```
src/
  api/
    sessionToken.ts       # holds the live auth token (memory by default)
    authApi.ts             # createApiClient() — EDIT: baseURL, onError
                            # (Supabase/Firebase: an ApiClient-shaped adapter instead — see below)
    authDataClient.ts       # createAuthDataClient() — EDIT: requests, cache/poll timing
    supabaseClient.ts       # (--backend supabase only) the one supabase-js client
    firebaseClient.ts       # (--backend firebase only) initializeApp + auth + firestore
  contexts/
    AuthContext.tsx          # <AuthProvider> — EDIT: user shape, login() request/response
  components/
    EditPostForm.tsx          # example: mutate + refresh() the cache
  vite-env.d.ts                # created if missing — needed for import.meta.env types
```

Nothing here is generated at runtime or hidden — it's a plain starting point
meant to be opened and adjusted to your backend's actual endpoints and
response shapes. Re-running `init` skips files that already exist; add
`--force` to overwrite.

After scaffolding, wrap your app once:

```tsx
import { AuthProvider } from "./contexts/AuthContext";

<AuthProvider>
  <App />
</AuthProvider>
```

and consume it anywhere with `useAuth()`.

## Using the Supabase/Firebase templates

`AuthDataClient` (caching, JWE encryption, polling) is identical across all
three backends — it only ever calls `client.request({ url, method, params,
data })`. What changes per backend is `authApi.ts`: instead of axios hitting
real HTTP URLs, it's a small adapter that translates that same shape into
Supabase/Firestore calls, so nothing downstream (`authDataClient.ts`,
`AuthContext.tsx`, the encrypted cache) has to change.

### Supabase (`--backend supabase`)

1. Set your project's env vars (`.env`):
   ```
   VITE_SUPABASE_URL=https://xxxxx.supabase.co
   VITE_SUPABASE_ANON_KEY=your-anon-key
   VITE_AUTH_CACHE_SECRET=some-long-random-string   # still needed — encrypts the local cache
   ```
2. `authApi.ts`'s adapter maps `{ url, method, params, data }` onto
   `supabase.from(table)...`:

   | Field | Meaning |
   |---|---|
   | `url` | table (or view) name, e.g. `"profiles"` |
   | `params.select` | columns to select (default `"*"`) |
   | `params.eq` | `{ column: value }` equality filters |
   | `params.single` | `true` to unwrap a single row instead of an array |
   | `params.orderBy` | `[column, { ascending }]` |
   | `params.limit` | row limit |
   | `data` | row(s) to insert/update, for `POST`/`PUT`/`PATCH` |

   ```ts
   { key: "profile", url: "profiles", params: { eq: { id: userId }, single: true } }
   authApi.post("posts", { title, body, user_id: userId })
   authApi.put("posts", { title }, { params: { eq: { id: postId } } })
   ```
3. `sessionToken.ts` mirrors Supabase's own (async) session into a sync
   value via `supabase.auth.onAuthStateChange` — don't call
   `sessionToken.set()`/`clear()` yourself, they're no-ops on purpose. Always
   go through `supabase.auth.signInWithPassword(...)` /
   `supabase.auth.signOut()` (already wired in `AuthContext.tsx`).
4. Prefer Postgres RLS (`USING (id = auth.uid())`) over hardcoding the
   current user's id into `authDataClient.ts`'s `requests` — that array is
   built once, before the user's id is known, so a literal `eq: { id: ... }`
   there is a placeholder you'll want to replace or route around with RLS.

### Firebase (`--backend firebase`)

1. Set your project's env vars (`.env`), from the Firebase console:
   ```
   VITE_FIREBASE_API_KEY=...
   VITE_FIREBASE_AUTH_DOMAIN=...
   VITE_FIREBASE_PROJECT_ID=...
   VITE_FIREBASE_STORAGE_BUCKET=...
   VITE_FIREBASE_MESSAGING_SENDER_ID=...
   VITE_FIREBASE_APP_ID=...
   VITE_AUTH_CACHE_SECRET=some-long-random-string   # still needed — encrypts the local cache
   ```
2. `authApi.ts`'s adapter maps `{ url, method, params, data }` onto
   Firestore calls:

   | Field | Meaning |
   |---|---|
   | `url` | `"collection"` for a query, or `"collection/docId"` for a single doc |
   | `params.where` | `[field, operator, value][]`, e.g. `[["userId", "==", uid]]` |
   | `params.orderBy` | `[field, "asc" \| "desc"]` |
   | `params.limit` | doc limit |
   | `data` | fields to write, for `POST`/`PUT`/`PATCH` |

   ```ts
   { key: "profile", url: `profiles/${userId}` }
   { key: "posts", url: "posts", params: { where: [["userId", "==", userId]], orderBy: ["createdAt", "desc"] } }
   authApi.post("posts", { title, body, userId })
   authApi.put(`posts/${postId}`, { title })
   ```
3. `sessionToken.ts` mirrors Firebase's ID token into a sync value via
   `onIdTokenChanged` — same no-op-on-purpose `set()`/`clear()` as above.
   Always use `signInWithEmailAndPassword(auth, ...)` / `signOut(auth)`
   (already wired in `AuthContext.tsx`).
4. `authDataClient.ts`'s `requests` array is also built once, before
   `auth.currentUser` resolves — either scope access via Firestore security
   rules keyed on `request.auth.uid` instead of a literal doc path, or
   rebuild the client after `onAuthStateChanged` fires with the real uid.
5. Firestore already has realtime listeners (`onSnapshot`) — prefer those
   directly in a component for anything that needs to be truly live; use
   this bundle's polling for things you'd rather pull on a timer instead.

### If you hit `Cannot find module 'firebase/...'` or `'@supabase/supabase-js'`

`init --backend supabase|firebase` installs the package automatically, but
your editor's TypeScript server may still show stale "module not found"
errors from before the install finished — restart it
(`Ctrl+Shift+P` → "TypeScript: Restart TS Server") and it'll resolve.

### If you hit `Property 'env' does not exist on type 'ImportMeta'`

All three templates read config via `import.meta.env.VITE_*`, which needs
Vite's ambient types referenced somewhere in your project — normally a
`src/vite-env.d.ts` containing `/// <reference types="vite/client" />`.
`init` creates this file automatically if nothing already provides that
reference, but if you're seeing this on an older project, add it by hand.

## Quick start

```js
import { toast, handleError, wrapFetch } from "snaparecord";

// Simple toasts
toast.success("Profile updated!");
toast.error("Could not save changes.");

// Wrap fetch once, anywhere in your app's setup
const fetch = wrapFetch();

async function loadUser(id) {
  const res = await fetch(`/api/users/${id}`); // 404 -> friendly toast, automatically
  if (!res.ok) return null;
  return res.json();
}
```

## Handling errors manually (fetch, axios, try/catch)

```js
import { handleError } from "snaparecord";

try {
  const res = await fetch("/api/data");
  if (!res.ok) {
    handleError(res.status); // shows "Not found" toast for a 404, etc.
    return;
  }
} catch (err) {
  handleError(err); // network errors, timeouts, thrown Errors all handled
}
```

### Axios — one-off interceptor

```js
import axios from "axios";
import { createAxiosErrorInterceptor } from "snaparecord";

const api = axios.create({ baseURL: "/api" });
const { onFulfilled, onRejected } = createAxiosErrorInterceptor();
api.interceptors.response.use(onFulfilled, onRejected);
```

### Axios — centralized API client (recommended)

For a real app you usually want one shared client per backend/domain instead
of wiring up interceptors everywhere. `createApiClient` builds a preconfigured
axios instance: base URL, auth header injection, response unwrapping (you get
`response.data` directly), and friendly-toast error handling, all in one
place. Name the result after what it talks to and import it wherever you need it:

```ts
// api/authApi.ts
import { createApiClient } from "snaparecord";

export const authApi = createApiClient({
  baseURL: "/api/auth",
  getAuthToken: () => sessionToken.get(), // see "Securing the auth token" below
  // 401s are handled globally below, don't also toast them here
  silentStatuses: [401],
  onError: (normalized) => {
    if (normalized.status === 401) {
      window.location.href = "/login";
    }
  },
});
```

```ts
// anywhere else in your app
import { authApi } from "./api/authApi.js";

async function login(email: string, password: string) {
  // on failure, a friendly toast fires automatically (e.g. 400/422 -> "Invalid data")
  // and the promise rejects with the normalized { status, title, message } error
  const user = await authApi.post("/login", { email, password });
  return user;
}
```

You can create as many named clients as you have backends/domains
(`authApi`, `billingApi`, `usersApi`, ...) — each gets its own base URL,
auth token source, and error-handling behavior. If you only need one client
for the whole app, the package also exports a ready-to-use default:

```ts
import { apiClient } from "snaparecord";

const posts = await apiClient.get("/posts");
```

`createApiClient(options)` accepts:

| Option | Description |
|---|---|
| `baseURL` | Prefixed to every request URL |
| `timeout` | Request timeout in ms (default 15000) |
| `headers` | Default headers sent on every request |
| `withCredentials` | Send cookies cross-origin |
| `getAuthToken()` | Return a token to auto-attach as `Authorization: Bearer <token>` |
| `silentStatuses` | Status codes normalized/logged but never toasted |
| `onError(normalized, rawError)` | Extra hook run after every failed request |

Each client exposes `get`, `post`, `put`, `patch`, `delete`, `request`, and
`.raw` (the underlying axios instance, for anything not covered above).

## AuthData: batched, encrypted, cached, polled fetching

Plain `localStorage.setItem("authData", JSON.stringify(data))` has two
problems: anyone with dev-tools access (or an XSS payload) can **read** it,
and anyone can **edit** it with no way for your app to tell. `AuthDataClient`
fixes both, and always — there's no plaintext mode to opt out of. It fetches
several related endpoints as one batch, then encrypts the combined result
(AES-256-GCM, via a compact JWE) before it's ever written to storage. What
sits in `localStorage` is ciphertext: unreadable without your secret, and
authenticated, so a modified/forged entry fails to decrypt and is discarded
rather than trusted.

```ts
// api/authData.ts
import { authApi } from "./authApi.js";
import { createAuthDataClient } from "snaparecord";

export const authData = createAuthDataClient({
  client: authApi, // reuses the client above, so `Authorization: Bearer <token>`
                    // is already attached to every one of these requests
  requests: [
    { key: "profile", url: "/me" },
    { key: "permissions", url: "/permissions" },
    { key: "finance", url: "/finance/summary" },
    { key: "operations", url: "/operations/status" },
  ],
  // Encrypts the *cached* blob (AES-256-GCM). Never sent to the server — keep
  // it out of source control (env var), and never reuse your auth provider's
  // token as this secret. Any string works; it's stretched into a proper
  // 256-bit key internally, but longer/random is still better.
  jwtSecret: import.meta.env.VITE_AUTH_CACHE_SECRET,
  cacheTtlMs: 24 * 60 * 60 * 1000, // 1 day (default) — repeat loads decrypt the
                                    // verified cache instantly instead of refetching
  pollIntervalMs: 60 * 1000,       // 1 minute (default)
  onUpdate: (data) => console.log("fresh AuthData:", data),
  onError: (err) => console.error("AuthData fetch failed:", err),
});
```

```ts
// on app start / after login
const { data, fromCache } = await authData.getData();
// data.profile, data.permissions, data.finance, data.operations — one call, many endpoints

// keep it fresh in the background, one request tick per minute, never
// overlapping (a slow response just skips that tick instead of stacking up)
authData.startPolling();

// force a real network refetch, e.g. right after login
await authData.getData({ force: true });

// after a mutation made via authApi that should be reflected in the cache
await authData.refresh();

// on logout
authData.destroy(); // stops polling + wipes the encrypted cache
```

`createAuthDataClient(options)` accepts:

| Option | Description |
|---|---|
| `client` | An `ApiClient` from `createApiClient` — supplies the auth header and error handling |
| `requests` | Array of `{ key, url, method?, params?, data?, config? }` endpoints to fetch as one batch |
| `jwtSecret` | Symmetric secret used to encrypt/decrypt the cached blob (A256GCM) |
| `cacheTtlMs` | How long the cache stays valid (default: 1 day) |
| `pollIntervalMs` | Interval between background poll ticks (default: 1 minute) |
| `storage` | Web Storage–compatible store (default: `localStorage`, falls back to in-memory outside the browser) |
| `storageKey` | Key the encrypted blob is stored under |
| `onUpdate(data)` | Called with fresh data after every successful fetch (initial, forced, or polled) |
| `onError(err)` | Called when a fetch/poll fails |

`AuthDataClient` instance methods: `getData({ force? })`, `refresh()`,
`startPolling()`, `stopPolling()`, `clearCache()`, `destroy()`.

## How this fits with your auth provider / database

SNAPARECORD doesn't replace your auth provider (Supabase Auth, Auth0, Google
OAuth, your own backend) or your database's row-level security — it sits
entirely in the browser, one layer downstream of both. It only needs one
thing from whichever provider you use: a function that returns the current
bearer token.

```ts
// Supabase
getAuthToken: () => supabase.auth.getSession()?.data?.session?.access_token

// Auth0
getAuthToken: () => cachedAuth0Token // e.g. kept in sessionToken.ts, refreshed via getTokenSilently()

// Google / any OIDC provider
getAuthToken: () => googleIdToken
```

Division of responsibility:

- **Your provider / RLS** decides *what* data a given user is allowed to
  fetch — that's server-side authorization and doesn't change.
- **SNAPARECORD** decides *how* that already-authorized data is fetched,
  cached, and protected once it lands in the browser: encrypted at rest,
  deduplicated across requests, and kept fresh via polling instead of being
  refetched on every render.

Use a separate secret for `jwtSecret` than whatever token your provider
issues — they protect different things and shouldn't be interchangeable.



## Custom messages

Override the default message for one call:

```js
handleError(403, { customMessage: "You need to upgrade your plan to do that." });
```

Or configure global overrides / additions once at startup:

```js
import { configureErrorHandler } from "snaparecord";

configureErrorHandler({
  messages: {
    404: { title: "Nothing here", message: "That page doesn't exist anymore." },
    payment_required: { title: "Upgrade required", message: "Please upgrade your plan." },
  },
  dedupeWindowMs: 5000, // suppress identical repeat toasts for 5s
  logger: (normalized, rawError) => {
    // send raw error details to your monitoring tool, users only ever see `normalized`
    console.error("Raw error:", rawError);
  },
  onError: (normalized) => {
    if (normalized.status === 401) {
      window.location.href = "/login";
      return false; // returning false suppresses the toast for this case
    }
  },
});
```

## Toast configuration

```js
import { configureToast } from "snaparecord";

configureToast({
  position: "bottom-right", // top-right (default), top-left, bottom-right, bottom-left, top-center, bottom-center
  duration: 4000,            // ms before auto-dismiss, 0 = stays until closed
  showIcon: true,
});
```

## API reference

| Export | Description |
|---|---|
| `toast.success/error/warning/info(message, title?)` | Quick one-off toasts |
| `showToast({ message, title?, type?, duration? })` | Full toast control |
| `dismissToast(id)` / `clearToasts()` | Manually dismiss |
| `configureToast(options)` | Set global toast defaults |
| `handleError(err, opts?)` | Normalize any error + show friendly toast |
| `normalizeError(err, customMessage?)` | Just normalize, no toast |
| `configureErrorHandler(options)` | Set global message map, logger, hooks |
| `setErrorMessage(key, { title, message })` | Override a single status message |
| `wrapFetch(fetchImpl?)` | Returns a fetch wrapper with auto error handling |
| `createAxiosErrorInterceptor(opts?)` | Axios response interceptor pair |
| `createApiClient(options)` | Centralized axios client: base URL, auth header, error toasts |
| `apiClient` | Ready-to-use default `createApiClient()` instance |
| `createAuthDataClient(options)` / `AuthDataClient` | Batched, AES-256-GCM encrypted, cached, pollable multi-endpoint data client |
| `DEFAULT_ERROR_MESSAGES` | The built-in status -> message map |

## Why cache/dedupe errors?

If ten requests fail with a 500 at once (e.g. a batch of parallel calls to a
downed endpoint), users don't need ten identical toasts. `handleError`
suppresses repeats of the same status within `dedupeWindowMs` (default
3000ms), configurable or disabled via `configureErrorHandler({ dedupeWindowMs: 0 })`.

## Updating this repo (maintainer notes)

Since `dist/` is committed (not gitignored) so this can be cloned and used
directly with no build step, remember to rebuild and commit it whenever
`src/` changes:

```bash
npm run typecheck
npm run build
git add -A
git commit -m "..."
git push
```

## License

MIT
