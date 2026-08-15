---
tier: 2
load_when: ["code-production", "backend-active", "scaffold"]
description: "Node 22+ LTS policy, the engines field, lockfile discipline, and ESM specifics."
---

# Backend 02 — Node LTS & Engines

> Runtime version policy, how we pin it, lockfile discipline, and the ESM details that trip people up. Read at scaffold time and when bumping Node.

---

## Node 22+ LTS

- Target the **active LTS line, Node 22+.** LTS only — never a current/odd release in production.
- Pin the version so local, CI, and production agree:
  - `package.json` `engines.node` (the contract — see below).
  - `.nvmrc` / `.node-version` (developer machines).
  - The CI matrix and the Docker base image use the **same** major (e.g. `node:22-bookworm-slim`).
- Plan the upgrade before the LTS line goes end-of-life; a Node bump is a `pt-version-upgrade` project, not an ad-hoc change.

```json
{
  "engines": { "node": ">=22 <23" }
}
```

Set `engine-strict=true` (in `.npmrc`) so an install on the wrong Node fails loudly instead of producing a subtly-broken `node_modules`.

---

## Lockfile discipline

- **Commit the lockfile** (`package-lock.json` for npm; `pnpm-lock.yaml` / `yarn.lock` if that's the chosen manager — one manager per repo, no mixing).
- **CI installs with `npm ci`,** not `npm install` — `ci` installs exactly the lockfile, fails on drift, and is reproducible. `install` mutates the lockfile and is for adding deps locally only.
- Dependency changes go through review like code; the lockfile diff is part of the PR.
- **Security:** CI runs an advisory scan (`npm audit` / OSV) on every PR (blueprint §19 CI). A new high/critical advisory blocks merge. Minimize dependencies (NODE standard) to keep this surface small.
- Pin direct dependencies to a sensible range; let the lockfile pin the exact transitive tree. Renovate/Dependabot proposes bumps; they're reviewed, not auto-merged into production.

---

## ESM specifics

`"type": "module"` in `package.json` — the whole codebase is ESM. The gotchas:

- **Include the file extension** in relative imports: `import { x } from './lib/util.js'` — not `'./lib/util'`. ESM does not resolve extensionless relative paths.
- **No `require`, `module.exports`, `__dirname`, `__filename`.** Derive paths from `import.meta.url`:
  ```js
  import { fileURLToPath } from "node:url";
  import { dirname } from "node:path";
  const __dirname = dirname(fileURLToPath(import.meta.url));
  ```
- **Top-level `await`** is available — use it sparingly in entrypoints (e.g. config validation), not in library modules that should stay synchronous to import.
- **JSON imports** use the import attribute: `import pkg from './package.json' with { type: 'json' }` (or read the file).
- **Conditional / dynamic loading:** `await import('./adapter.js')` returns a promise — used for the integration-adapter selection so only the in-scope adapter loads.
- **Interop:** importing a CommonJS dependency gives you its `module.exports` as the default import: `import cjsLib from 'some-cjs-pkg'`. Named imports from CJS may not resolve — destructure from the default if needed.
- Prefer `node:`-prefixed builtins (`node:fs/promises`, `node:crypto`, `node:test`) so the import is unambiguously the builtin, not a shadowing dependency.

---

## Scripts (package.json baseline)

```json
{
  "scripts": {
    "start": "node src/server.js",
    "dev": "node --watch src/server.js",
    "lint": "eslint .",
    "format": "prettier --check .",
    "test": "node --test",
    "migrate": "node src/db/migrate.js",
    "migrate:undo": "node src/db/migrate.js --down"
  }
}
```

`node --test` and `node --watch` are native (no nodemon/jest needed for the common case) — consistent with "prefer native Node APIs, minimize dependencies." Use vitest only when its features are actually needed (`testing/01`).
