// Real-network test for AuthDataClient against jsonplaceholder.typicode.com
// (no stubbing — this makes actual HTTP requests, so you can see it
// batch, cache, sign, and poll for real).
//
// Run: npm run build && node test/authData.jsonplaceholder.mjs

import { createApiClient, createAuthDataClient } from "../dist/index.js";

const client = createApiClient({
  baseURL: "https://jsonplaceholder.typicode.com",
});

const authData = createAuthDataClient({
  client,
  requests: [
    { key: "todo", url: "/todos/1" },
    { key: "user", url: "/users/1" },
  ],
  jwtSecret: "replace-with-a-real-secret",
  cacheTtlMs: 2000, // shortened just for this test
  pollIntervalMs: 3000, // shortened just for this test
  onUpdate: (data) => console.log("onUpdate ->", JSON.stringify(data)),
  onError: (err) => console.error("onError ->", err),
});

try {
  const r1 = await authData.getData();
  console.log("1) first getData — hits network:", r1.fromCache, "| todo:", r1.data.todo?.title);

  const r2 = await authData.getData();
  console.log("2) second getData — served from signed cache:", r2.fromCache);

  console.log("3) starting polling every 3s for ~7s...");
  authData.startPolling();
  await new Promise((r) => setTimeout(r, 7000));
  authData.stopPolling();
  console.log("   polling stopped");

  await new Promise((r) => setTimeout(r, 2100));
  const r3 = await authData.getData();
  console.log("4) after cache TTL expiry, fromCache:", r3.fromCache, "(should be false)");
} catch (err) {
  console.error("Request failed:", err?.message ?? err);
} finally {
  authData.destroy();
}
