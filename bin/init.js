#!/usr/bin/env node
// Scaffolds editable starter files (api client, AuthData client, React
// AuthContext) into the consuming project. Deliberately copies plain,
// editable .ts/.tsx files rather than something generated at runtime —
// this is a one-time starting point you're expected to open and adjust,
// not a black box.
//
// Usage (from the consumer project root):
//   npx snaparecord init
//   npx snaparecord init --dir src/lib     (custom target directory)
//   npx snaparecord init --force           (overwrite existing files)

import { existsSync, mkdirSync, readdirSync, statSync, copyFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join, relative } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const packageRoot = join(__dirname, "..");

function parseArgs(argv) {
  const args = { command: argv[0], dir: "src", force: false };
  for (let i = 1; i < argv.length; i++) {
    if (argv[i] === "--dir") args.dir = argv[++i];
    else if (argv[i] === "--force") args.force = true;
  }
  return args;
}

function copyDirRecursive(srcDir, destDir, force, results) {
  mkdirSync(destDir, { recursive: true });
  for (const entry of readdirSync(srcDir)) {
    const srcPath = join(srcDir, entry);
    const destPath = join(destDir, entry);
    if (statSync(srcPath).isDirectory()) {
      copyDirRecursive(srcPath, destPath, force, results);
      continue;
    }
    if (existsSync(destPath) && !force) {
      results.skipped.push(destPath);
      continue;
    }
    copyFileSync(srcPath, destPath);
    results.copied.push(destPath);
  }
}

function runInit(args) {
  const templateRoot = join(packageRoot, "templates", "react");
  if (!existsSync(templateRoot)) {
    console.error("Could not find bundled templates — is the package installed correctly?");
    process.exit(1);
  }

  const targetRoot = join(process.cwd(), args.dir);
  const results = { copied: [], skipped: [] };
  copyDirRecursive(templateRoot, targetRoot, args.force, results);

  if (results.copied.length) {
    console.log(`Added ${results.copied.length} file(s):`);
    for (const f of results.copied) console.log(`  + ${relative(process.cwd(), f)}`);
  }
  if (results.skipped.length) {
    console.log(`\nSkipped ${results.skipped.length} existing file(s) (use --force to overwrite):`);
    for (const f of results.skipped) console.log(`  - ${relative(process.cwd(), f)}`);
  }
  if (!results.copied.length && !results.skipped.length) {
    console.log("Nothing to copy.");
    return;
  }

  console.log(`
Next steps:
  1. Open ${args.dir}/api/authApi.ts       — set baseURL / onError for your backend
  2. Open ${args.dir}/api/authDataClient.ts — list the endpoints you want bundled
  3. Open ${args.dir}/contexts/AuthContext.tsx — adjust login()'s request/response shape
  4. Wrap your app: <AuthProvider>...</AuthProvider>
  5. Import "snaparecord/styles.css" once, anywhere in your app's entry file
`);
}

const args = parseArgs(process.argv.slice(2));

if (args.command !== "init") {
  console.log(`snaparecord CLI

Usage:
  npx snaparecord init [--dir <path>] [--force]

  init     Copy editable starter files (API client, AuthData client, React
           AuthContext) into your project so you can adjust them to your
           backend's actual endpoints/shapes.
  --dir    Target directory, relative to cwd. Default: src
  --force  Overwrite files that already exist at the destination.
`);
  process.exit(args.command ? 1 : 0);
}

runInit(args);
