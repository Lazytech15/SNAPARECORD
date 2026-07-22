// EDIT ME: point baseURL at your backend, and adjust onError to match your
// app's login route / redirect behavior.
//
// To try the example requests in authDataClient.ts as-is, point this at
// https://jsonplaceholder.typicode.com instead of your real backend.
//
// ── What lives here vs. authDataClient.ts ──────────────────────────────────
// `authApi` is the DIRECT line to the server. Import this in any component
// that needs to fetch, search, create, update, or delete something with
// per-call variables (a specific id, a search term, form data the user just
// typed). Every call hits the server fresh — there's no caching here.
//
// `authDataClient.ts` is different: it's a fixed bundle of GET endpoints,
// fetched together once on login/app-start and cached locally so the app
// loads fast without re-hitting the server every render. It does NOT take
// per-call variables. If a mutation made here (via authApi) should update
// what's in that cache, call `refresh()` from `useAuth()` afterwards — see
// AuthContext.tsx and components/EditPostForm.tsx for the full loop.
import { createApiClient, type NormalizedError } from "snaparecord";
import { sessionToken } from "./sessionToken";

export const authApi = createApiClient({
  baseURL: import.meta.env.VITE_API_BASE_URL ?? "/api",
  getAuthToken: () => sessionToken.get(),
  // 401s are handled globally below — don't also toast them per-call.
  silentStatuses: [401],
  onError: (normalized: NormalizedError) => {
    if (normalized.status === 401) {
      sessionToken.clear();
      window.location.href = "/login";
    }
  },
});

// ── Usage cheat sheet ───────────────────────────────────────────────────────
// Fetch one:        await authApi.get(`/posts/${id}`)
// Search/list:       await authApi.get("/posts", { params: { userId, q: search } })
// Create:            await authApi.post("/posts", { title, body, userId })
// Update by id:      await authApi.put(`/posts/${id}`, { id, title, body, userId })
// Partial update:    await authApi.patch(`/posts/${id}`, { title })
// Delete by id:      await authApi.delete(`/posts/${id}`)
// Per-call opt-out of the global 401 redirect/toast: authApi.get(url, { silent: true })

// EDIT ME: add one createApiClient() per additional backend/domain, e.g.:
// export const billingApi = createApiClient({ baseURL: "/api/billing", getAuthToken: () => sessionToken.get() });
