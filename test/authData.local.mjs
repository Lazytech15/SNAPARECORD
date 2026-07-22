// Quick local smoke test for AuthDataClient — no real server needed,
// `client.request` is stubbed so you can see caching/polling/signing behavior.
//
// Run: npm run build && node test/authData.local.mjs

import { createApiClient, createAuthDataClient } from "../dist/index.js";

let callCount = 0;
const client = createApiClient({ baseURL: "https://example.invalid" });

// Stub the network call so this runs with no server.
// In real usage you'd just pass a normal createApiClient({ baseURL: "..." })
// and skip this override entirely.
client.request = async (cfg) => {
  callCount++;
  await new Promise((r) => setTimeout(r, 50));
  if (cfg.url === "/profile") return { name: "Renato" };
  if (cfg.url === "/permissions") return { role: "admin" };
  return null;
};

const authData = createAuthDataClient({
  client,
  requests: [
    { key: "profile", url: "/profile" },
    { key: "permissions", url: "/permissions" },
  ],
  jwtSecret: "replace-with-a-real-secret",
  cacheTtlMs: 2000, // shortened just for this test
  pollIntervalMs: 100, // shortened just for this test
  onUpdate: (data) => console.log("onUpdate ->", JSON.stringify(data)),
});

const r1 = await authData.getData();
console.log("1) first getData — hits network:", r1.fromCache, "| calls:", callCount);

const r2 = await authData.getData();
console.log("2) second getData — served from signed cache:", r2.fromCache, "| calls:", callCount);

authData.startPolling();
await new Promise((r) => setTimeout(r, 550));
authData.stopPolling();
console.log("3) after ~5 poll ticks, total calls:", callCount);

await new Promise((r) => setTimeout(r, 2100));
const r3 = await authData.getData();
console.log("4) after cache TTL expiry, fromCache:", r3.fromCache, "(should be false)");
