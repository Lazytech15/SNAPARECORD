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
//   npx snaparecord init --backend supabase   (also auto-installs @supabase/supabase-js)
//   npx snaparecord init --backend firebase   (also auto-installs firebase)
//   npx snaparecord init --backend firebase --no-install   (skip the auto-install)

import { existsSync, mkdirSync, readdirSync, statSync, copyFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join, relative } from "node:path";
import { spawnSync } from "node:child_process";

const __dirname = dirname(fileURLToPath(import.meta.url));
const packageRoot = join(__dirname, "..");

const BACKENDS = {
  php: "react",
  supabase: "react-supabase",
  firebase: "react-firebase",
};

// Package(s) each backend needs at runtime. `null` means nothing extra —
// the PHP template only needs axios/jose, which are already snaparecord's
// own hard dependencies and get installed automatically with the package.
const BACKEND_PACKAGES = {
  php: null,
  supabase: ["@supabase/supabase-js"],
  firebase: ["firebase"],
};

function parseArgs(argv) {
  const args = { command: argv[0], dir: "src", force: false, backend: "php", install: true };
  for (let i = 1; i < argv.length; i++) {
    if (argv[i] === "--dir") args.dir = argv[++i];
    else if (argv[i] === "--force") args.force = true;
    else if (argv[i] === "--backend") args.backend = argv[++i];
    else if (argv[i] === "--no-install") args.install = false;
  }
  return args;
}

/** Detects the consumer project's package manager from whichever lockfile is present. Defaults to npm. */
function detectPackageManager(cwd) {
  if (existsSync(join(cwd, "pnpm-lock.yaml"))) return "pnpm";
  if (existsSync(join(cwd, "yarn.lock"))) return "yarn";
  if (existsSync(join(cwd, "bun.lockb"))) return "bun";
  return "npm";
}

/** Runs `<pm> add <packages>` (or npm's `install`) in the consumer's project root, streaming output live. */
function installPackages(cwd, packages) {
  const pm = detectPackageManager(cwd);
  const addCmd = pm === "npm" ? "install" : "add";
  console.log(`\nInstalling ${packages.join(", ")} with ${pm}...`);
  const result = spawnSync(pm, [addCmd, ...packages], { cwd, stdio: "inherit", shell: true });
  if (result.status !== 0) {
    console.error(
      `\n${pm} ${addCmd} failed (exit code ${result.status ?? "unknown"}). Install manually:\n  ${pm} ${addCmd} ${packages.join(" ")}`
    );
    return false;
  }
  return true;
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
  const templateDir = BACKENDS[args.backend];
  if (!templateDir) {
    console.error(
      `Unknown --backend "${args.backend}". Choose one of: ${Object.keys(BACKENDS).join(", ")}`
    );
    process.exit(1);
  }

  const templateRoot = join(packageRoot, "templates", templateDir);
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

  const backendNotes = {
    php: {
      steps: [
        `Open ${args.dir}/api/authApi.ts       — set baseURL / onError for your backend`,
        `Open ${args.dir}/api/authDataClient.ts — list the endpoints you want bundled`,
      ],
    },
    supabase: {
      steps: [
        `Set VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY in your .env (see ${args.dir}/api/supabaseClient.ts)`,
        `Open ${args.dir}/api/authDataClient.ts — list the tables/rows you want bundled`,
      ],
    },
    firebase: {
      steps: [
        `Set VITE_FIREBASE_* config values in your .env (see ${args.dir}/api/firebaseClient.ts)`,
        `Open ${args.dir}/api/authDataClient.ts — list the docs/queries you want bundled`,
      ],
    },
  };
  const notes = backendNotes[args.backend];
  const packages = BACKEND_PACKAGES[args.backend];

  let installedAutomatically = false;
  if (packages) {
    if (args.install) {
      installedAutomatically = installPackages(process.cwd(), packages);
    } else {
      console.log(`\nSkipped install (--no-install). Run manually: npm install ${packages.join(" ")}`);
    }
  }

  const steps = [...notes.steps];
  if (packages && !installedAutomatically) {
    steps.unshift(`npm install ${packages.join(" ")}`);
  }

  console.log(`
Next steps (backend: ${args.backend}):`);
  steps.forEach((step, i) => console.log(`  ${i + 1}. ${step}`));
  console.log(`  ${steps.length + 1}. Open ${args.dir}/contexts/AuthContext.tsx — adjust login()'s request/response shape
  ${steps.length + 2}. Wrap your app: <AuthProvider>...</AuthProvider>
  ${steps.length + 3}. Import "snaparecord/styles.css" once, anywhere in your app's entry file
`);
}

const args = parseArgs(process.argv.slice(2));

if (args.command !== "init") {
  console.log(`snaparecord CLI

Usage:
  npx snaparecord init [--dir <path>] [--force] [--backend <name>] [--no-install]

  init        Copy editable starter files (API client, AuthData client, React
              AuthContext) into your project so you can adjust them to your
              backend's actual endpoints/shapes.
  --dir       Target directory, relative to cwd. Default: src
  --force     Overwrite files that already exist at the destination.
  --backend   Which backend template to scaffold: php (default), supabase, firebase.
              - php:      plain REST/axios client — point authApi.ts at any HTTP backend.
              - supabase: authApi.ts wraps @supabase/supabase-js (table queries,
                          supabase.auth session) behind the same ApiClient interface.
              - firebase: authApi.ts wraps firebase/firestore + firebase/auth behind
                          the same ApiClient interface.
              All three produce the same public shape (authApi, authGetClient,
              AuthProvider/useAuth) — only the transport underneath differs, so the
              rest of your app never needs to know which one is in use.
  --no-install  Skip auto-installing the backend's package (@supabase/supabase-js
              or firebase). Off by default — supabase/firebase are installed for
              you automatically, detecting npm/yarn/pnpm/bun from your lockfile.
`);
  process.exit(args.command ? 1 : 0);
}

runInit(args);
