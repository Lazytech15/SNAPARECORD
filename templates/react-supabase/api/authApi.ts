// EDIT ME: adjust the table-request conventions below to taste, and set
// onAuthError to match your app's login route.
//
// ── Why this file looks different from the PHP template ───────────────────
// The PHP template's `authApi` is real axios hitting real URLs. Supabase
// doesn't have "URLs" in that sense — `supabase.from('table').select()` is a
// query builder call, not an HTTP verb. But `AuthDataClient` (the batching/
// caching/polling engine in "snaparecord") only ever calls one thing:
//
//     client.request({ url, method, params, data })
//
// So this file's whole job is to satisfy that same shape — a small adapter
// that translates { url, method, params, data } into the equivalent
// Supabase table call. Everything downstream (authDataClient.ts,
// AuthContext.tsx, the JWE cache, polling) is UNCHANGED from the PHP
// template, because it only ever talks to this interface, never to
// Supabase directly.
import type { ApiClient, RequestConfig } from "snaparecord";
import { handleError } from "snaparecord";
import { supabase } from "./supabaseClient";

// ── Request conventions used by the adapter below ──────────────────────────
// `url`    -> the table (or view) name, e.g. "profiles"
// `params.select`  -> columns to select, default "*"
// `params.eq`      -> object of column:value equality filters, e.g. { id: userId }
// `params.single`  -> true to unwrap a single row instead of an array
// `params.orderBy` -> [column, { ascending: boolean }]
// `params.limit`   -> number
// `data`           -> row(s) to insert/update, for POST/PUT/PATCH
//
// Examples:
//   { key: "profile", url: "profiles", params: { eq: { id: userId }, single: true } }
//   { key: "posts", url: "posts", params: { eq: { userId }, orderBy: ["created_at", { ascending: false }] } }
//   authApi.post("posts", { title, body, user_id: userId })
//   authApi.put("posts", { title }, { params: { eq: { id: postId } } })

interface SupabaseParams {
  select?: string;
  eq?: Record<string, unknown>;
  single?: boolean;
  orderBy?: [string, { ascending?: boolean }];
  limit?: number;
}

async function runRequest<T>(cfg: RequestConfig & { url?: string; method?: string; params?: SupabaseParams; data?: unknown }): Promise<T> {
  const table = cfg.url as string;
  const method = (cfg.method ?? "GET").toUpperCase();
  const params = (cfg.params ?? {}) as SupabaseParams;

  try {
    if (method === "GET") {
      let query = supabase.from(table).select(params.select ?? "*");
      for (const [col, val] of Object.entries(params.eq ?? {})) query = query.eq(col, val as never);
      if (params.orderBy) query = query.order(params.orderBy[0], params.orderBy[1]);
      if (params.limit) query = query.limit(params.limit);

      const { data, error } = params.single ? await query.single() : await query;
      if (error) throw error;
      return data as T;
    }

    if (method === "POST") {
      const { data, error } = await supabase.from(table).insert(cfg.data).select();
      if (error) throw error;
      return data as T;
    }

    if (method === "PUT" || method === "PATCH") {
      let query = supabase.from(table).update(cfg.data as object);
      for (const [col, val] of Object.entries(params.eq ?? {})) query = query.eq(col, val as never);
      const { data, error } = await query.select();
      if (error) throw error;
      return data as T;
    }

    if (method === "DELETE") {
      let query = supabase.from(table).delete();
      for (const [col, val] of Object.entries(params.eq ?? {})) query = query.eq(col, val as never);
      const { error } = await query;
      if (error) throw error;
      return undefined as T;
    }

    throw new Error(`Unsupported method for Supabase adapter: ${method}`);
  } catch (err) {
    // Route Supabase errors through the same friendly-toast pipeline the
    // PHP template uses, so error UX is identical regardless of backend.
    const normalized = handleError(err, { silent: cfg.silent ?? false });
    if (normalized.status === 401) {
      // Session expired/invalid — EDIT ME: redirect to your login route.
      window.location.href = "/login";
    }
    throw normalized;
  }
}

export const authApi: ApiClient = {
  raw: supabase as unknown as ApiClient["raw"], // escape hatch for anything not covered above
  get: (url, cfg) => runRequest({ ...cfg, url, method: "GET" }),
  post: (url, data, cfg) => runRequest({ ...cfg, url, method: "POST", data }),
  put: (url, data, cfg) => runRequest({ ...cfg, url, method: "PUT", data }),
  patch: (url, data, cfg) => runRequest({ ...cfg, url, method: "PATCH", data }),
  delete: (url, cfg) => runRequest({ ...cfg, url, method: "DELETE" }),
  request: (cfg) => runRequest(cfg),
};
