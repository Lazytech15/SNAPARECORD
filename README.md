# SNAPARECORD

Universal, framework-agnostic toast notifications + error handling, written in
TypeScript with full type declarations included (no `@types/*` package
needed).

Instead of surfacing raw errors like `404`, `403`, `Failed to fetch`, or a stack
trace to your users, this library maps them to clear, human-readable messages
and displays them as a toast — with sane defaults out of the box and full
override support.

- Zero dependencies, works with plain JS, React, Vue, Svelte, etc.
- Wraps `fetch` or `axios` so errors are handled automatically.
- Built-in friendly messages for common HTTP status codes (400, 401, 403,
  404, 408, 409, 413, 422, 429, 500, 502, 503, 504) plus network/timeout.
- Fully overridable per-status or per-call custom messages.
- Duplicate-error suppression so a burst of the same failure doesn't spam
  the user with repeated toasts.
- Optional logger/hook so you can still send raw errors to Sentry, etc.

## Install

This package isn't published to the public npm registry — it's meant to be
installed straight from GitHub.

**Option A — as a dependency (recommended):**

```bash
npm install github:YOUR_USERNAME/snaparecord
# or pin to a tag/branch:
npm install github:YOUR_USERNAME/snaparecord#v1.0.0
```

`dist/` is committed to this repo, so this works with no build step on your
end — npm just clones it and you import it like any other package.

**Option B — clone and copy in:**

```bash
git clone https://github.com/YOUR_USERNAME/snaparecord.git
```

Then copy `dist/` (and `src/toast.css`) into your project and import from
that path directly, editing whatever request shapes/endpoints you need per
project.

Either way, install the two runtime dependencies alongside it if your
project doesn't already have them:

```bash
npm install axios jose
```

Import the (optional but recommended) stylesheet once, anywhere in your app:

```js
import "snaparecord/styles.css";
// or, if you copied the files in directly:
import "./snaparecord/toast.css";
```

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

## AuthData: batched, JWT-signed, cached, polled fetching

Plain `localStorage.setItem("authData", JSON.stringify(data))` has two
problems: anyone with dev-tools access can read *and edit* it, and your app
has no way to tell if it's been tampered with. `AuthDataClient` fixes both —
it fetches several related endpoints as one batch, signs the combined result
into a JWT before it's written to storage, and rejects (and silently
discards) anything that comes back unsigned, expired, or tampered with.

```ts
// api/authData.ts
import { authApi } from "./authApi.js";
import { createAuthDataClient } from "snaparecord";

export const authData = createAuthDataClient({
  client: authApi, // reuses the client above, so `Authorization: Bearer <jwt>`
                    // is already attached to every one of these requests
  requests: [
    { key: "profile", url: "/me" },
    { key: "permissions", url: "/permissions" },
    { key: "settings", url: "/settings" },
  ],
  // Signs/verifies the *cached* blob. Never sent to the server — keep it out
  // of source control (env var) and it protects what sits in localStorage.
  jwtSecret: import.meta.env.VITE_AUTH_CACHE_SECRET,
  cacheTtlMs: 24 * 60 * 60 * 1000, // 1 day (default) — repeat loads read the
                                    // verified cache instantly instead of refetching
  pollIntervalMs: 60 * 1000,       // 1 minute (default)
  onUpdate: (data) => console.log("fresh AuthData:", data),
  onError: (err) => console.error("AuthData fetch failed:", err),
});
```

```ts
// on app start / after login
const { data, fromCache } = await authData.getData();
// data.profile, data.permissions, data.settings — one call, three endpoints

// keep it fresh in the background, one request tick per minute, never
// overlapping (a slow response just skips that tick instead of stacking up)
authData.startPolling();

// force a real network refetch, e.g. right after login
await authData.getData({ force: true });

// on logout
authData.destroy(); // stops polling + clears the signed cache
```

`createAuthDataClient(options)` accepts:

| Option | Description |
|---|---|
| `client` | An `ApiClient` from `createApiClient` — supplies the JWT auth header and error handling |
| `requests` | Array of `{ key, url, method?, params?, data?, config? }` endpoints to fetch as one batch |
| `jwtSecret` | Symmetric secret (HS256) used to sign/verify the cached blob |
| `cacheTtlMs` | How long the cache stays valid (default: 1 day) |
| `pollIntervalMs` | Interval between background poll ticks (default: 1 minute) |
| `storage` | Web Storage–compatible store (default: `localStorage`, falls back to in-memory outside the browser) |
| `storageKey` | Key the signed blob is stored under |
| `onUpdate(data)` | Called with fresh data after every successful fetch (initial, forced, or polled) |
| `onError(err)` | Called when a fetch/poll fails |

`AuthDataClient` instance methods: `getData({ force? })`, `refresh()`,
`startPolling()`, `stopPolling()`, `clearCache()`, `destroy()`.

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
| `createAuthDataClient(options)` / `AuthDataClient` | Batched, JWT-signed, cached, pollable multi-endpoint data client |
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
