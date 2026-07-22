#!/usr/bin/env node
// Runs on `npm install` (via the "prepare" lifecycle script). For a
// `npm install github:...` dependency, npm installs devDependencies and
// runs "prepare" specifically so packages installed from git can build
// themselves — there is no prepublish step for git installs, unlike a
// normal registry tarball.
//
// dist/ is meant to be committed directly to the repo (see README), so in
// the common case this is a no-op. It only actually builds if dist/ is
// ever missing or incomplete, so a git install can never end up in the
// "Cannot find module 'snaparecord'" state.
const { existsSync } = require("node:fs");
const { execSync } = require("node:child_process");
const { join } = require("node:path");

const root = join(__dirname, "..");
const requiredFiles = ["dist/index.js", "dist/index.cjs", "dist/index.d.ts"];
const missing = requiredFiles.some((f) => !existsSync(join(root, f)));

if (!missing) {
  process.exit(0);
}

console.log("[snaparecord] dist/ missing or incomplete — building...");
try {
  execSync("npx --no-install tsup", { cwd: root, stdio: "inherit" });
} catch (err) {
  console.error(
    "[snaparecord] Build failed. If you're developing this package, run `npm install` then `npm run build` manually."
  );
  // Don't hard-fail the parent project's install over this — surface the
  // problem instead of silently succeeding with a broken package.
  process.exitCode = 1;
}
