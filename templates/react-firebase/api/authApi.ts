// EDIT ME: adjust the path/query conventions below to taste.
//
// ── Why this file looks different from the PHP template ───────────────────
// Firestore doesn't have "URLs" — `getDocs(query(collection(db, 'posts')))`
// is an SDK call, not an HTTP verb. But `AuthDataClient` (the batching/
// caching/polling engine in "snaparecord") only ever calls one thing:
//
//     client.request({ url, method, params, data })
//
// So this file's whole job is to satisfy that same shape — translating
// { url, method, params, data } into the equivalent Firestore call.
// Everything downstream (authDataClient.ts, AuthContext.tsx, the JWE cache,
// polling) is UNCHANGED from the PHP template, because it only ever talks
// to this interface, never to Firestore directly.
import type { ApiClient, RequestConfig } from "snaparecord";
import { handleError } from "snaparecord";
import {
  collection,
  doc,
  getDoc,
  getDocs,
  addDoc,
  updateDoc,
  deleteDoc,
  query,
  where,
  orderBy as fsOrderBy,
  limit as fsLimit,
  type WhereFilterOp,
} from "firebase/firestore";
import { db } from "./firebaseClient";

// ── Request conventions used by the adapter below ──────────────────────────
// `url`     -> "collection" for a query, or "collection/docId" for a single doc
// `params.where`   -> [field, operator, value][] e.g. [["userId", "==", uid]]
// `params.orderBy` -> [field, "asc" | "desc"]
// `params.limit`   -> number
// `data`           -> fields to write, for POST/PUT/PATCH
//
// Examples:
//   { key: "profile", url: `profiles/${userId}` }                     // single doc
//   { key: "posts", url: "posts", params: { where: [["userId", "==", userId]], orderBy: ["createdAt", "desc"] } }
//   authApi.post("posts", { title, body, userId })
//   authApi.put(`posts/${postId}`, { title })

interface FirestoreParams {
  where?: [string, WhereFilterOp, unknown][];
  orderBy?: [string, "asc" | "desc"];
  limit?: number;
}

async function runRequest<T>(
  cfg: RequestConfig & { url?: string; method?: string; params?: FirestoreParams; data?: unknown }
): Promise<T> {
  const path = cfg.url as string;
  const method = (cfg.method ?? "GET").toUpperCase();
  const params = cfg.params ?? {};
  const isDocPath = path.includes("/"); // "collection/docId" vs. "collection"

  try {
    if (method === "GET") {
      if (isDocPath) {
        const snap = await getDoc(doc(db, path));
        return (snap.exists() ? { id: snap.id, ...snap.data() } : null) as T;
      }
      const clauses = [
        ...(params.where ?? []).map(([field, op, value]) => where(field, op, value)),
        ...(params.orderBy ? [fsOrderBy(params.orderBy[0], params.orderBy[1])] : []),
        ...(params.limit ? [fsLimit(params.limit)] : []),
      ];
      const snap = await getDocs(query(collection(db, path), ...clauses));
      return snap.docs.map((d) => ({ id: d.id, ...d.data() })) as T;
    }

    if (method === "POST") {
      const ref = await addDoc(collection(db, path), cfg.data as object);
      return { id: ref.id, ...(cfg.data as object) } as T;
    }

    if (method === "PUT" || method === "PATCH") {
      if (!isDocPath) throw new Error("PUT/PATCH requires a doc path, e.g. 'posts/123'.");
      await updateDoc(doc(db, path), cfg.data as object);
      return { id: path.split("/").pop(), ...(cfg.data as object) } as T;
    }

    if (method === "DELETE") {
      if (!isDocPath) throw new Error("DELETE requires a doc path, e.g. 'posts/123'.");
      await deleteDoc(doc(db, path));
      return undefined as T;
    }

    throw new Error(`Unsupported method for Firestore adapter: ${method}`);
  } catch (err) {
    // Route Firestore errors through the same friendly-toast pipeline the
    // PHP template uses, so error UX is identical regardless of backend.
    const normalized = handleError(err, { silent: cfg.silent ?? false });
    if (normalized.status === 401 || normalized.status === 403) {
      // Expired/invalid session or a denied security rule — EDIT ME: redirect to your login route.
      window.location.href = "/login";
    }
    throw normalized;
  }
}

export const authApi: ApiClient = {
  raw: db as unknown as ApiClient["raw"], // escape hatch for anything not covered above
  get: (url, cfg) => runRequest({ ...cfg, url, method: "GET" }),
  post: (url, data, cfg) => runRequest({ ...cfg, url, method: "POST", data }),
  put: (url, data, cfg) => runRequest({ ...cfg, url, method: "PUT", data }),
  patch: (url, data, cfg) => runRequest({ ...cfg, url, method: "PATCH", data }),
  delete: (url, cfg) => runRequest({ ...cfg, url, method: "DELETE" }),
  request: (cfg) => runRequest(cfg),
};
