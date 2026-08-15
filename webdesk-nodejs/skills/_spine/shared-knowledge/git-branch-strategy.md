---
tier: 2
load_when: ["git-decision"]
description: "Branching model for Node.js projects: feature/*, fix/*, main/staging, PR flow, protected branches."
---

# Git Branch Strategy (Node.js)

> The branching model every Node.js project uses. Trunk-style with a staging integration branch and protected `main`.

---

## Branch model

```
main                ← production. Protected. Merge only via PR from staging, with G6 passed.
  ↑
staging             ← integration branch. Always deployable to the staging env. Always green.
  ↑
feature/<sprint>-<short-name>     forks from staging
fix/<bug-id>-<short-name>         forks from staging
hotfix/<short-name>               forks from main (urgent prod fix)
chore/<short-name>                deps/refactor/docs, no behavior change
```

No `develop`/`master` naming — we use `main` + `staging`.

---

## Branch purposes

### `main`

- Reflects production. What's on `main` is what's deployed.
- **Protected:** no direct push, no force-push, no deletion.
- Merges from `staging` only, via PR, with required reviewers + green CI + **G6 passed**.
- Each release tags the commit: `v1.0.0`, `v1.1.0`.

### `staging`

- Integration branch; always deployable to the staging environment; must always pass CI.
- Merges from `feature/*` and `fix/*` via PR (Code Review + 1 human reviewer).
- This is where G4/G5 QA runs against the staging deploy.

### `feature/<sprint>-<short-name>`

- Per-sprint work. Example: `feature/S2.1-ddi-inventory-sync`, `feature/S3.2-rbac-module`.
- Forks from `staging`; merges back to `staging` via PR; deleted after merge.

### `fix/<bug-id>-<short-name>`

- Bug fixes routed via the **no-auto-fix** flow (orchestrator `02-routing-table.md`). Example: `fix/BUG-014-watermark-resume`.
- Forks from `staging`; merges back to `staging` via PR; the **developer merges** — no auto-merge.

### `hotfix/<short-name>`

- Urgent production fix bypassing `staging`. Example: `hotfix/sync-token-refresh`.
- Forks from `main`; merges to **both** `main` and `staging`; requires senior approval + audit-log entry. < 1% of deploys.

### `chore/<short-name>`

- Dependency bumps, refactors, docs — no behavior change. Example: `chore/bump-sequelize-6.37`.

---

## Naming rules

```
<type>/<identifier>-<short-description>
```

- Type: `feature` | `fix` | `hotfix` | `chore`.
- Identifier: sprint id (`S2.1`) for features, bug id (`BUG-014`) for fixes, topic for chores.
- Description: lowercase, hyphens, 3–5 words, kebab-case (matches the kebab-case filename convention).

---

## Branch protection

### `main`

- Require PR before merge; require approvals: **2** (1 senior + 1 any dev).
- Require status checks to pass (CI: lint, typecheck, tests, dependency audit, migration dry-run).
- Require CODEOWNERS approval; require branch up to date.
- Require **linear history** (squash or rebase only — no merge commits).
- Force-push: NO. Deletion: NO.

### `staging`

- Require PR before merge; require approvals: **1**.
- Require status checks to pass; require branch up to date.
- Force-push: NO. Deletion: NO.

### `feature/*`, `fix/*`

- No protection — the developer's working space.

---

## PR workflow

1. **Branch:** `git checkout staging && git pull && git checkout -b feature/S2.1-ddi-inventory-sync`
2. **Commit:** small atomic commits; Conventional-Commits message (below).
3. **Push + PR:** `git push -u origin feature/S2.1-ddi-inventory-sync` → `gh pr create` (use the PR template — `_spine/shared-knowledge/pr-template.md`).
4. **Review:** the GitHub Action invokes Code Review Agent automatically; required human reviewers per CODEOWNERS; address feedback; re-request review.
5. **Merge:** **squash and merge** (preferred — keeps `staging` history clean). The developer merges; no auto-merge for fixes.
6. **Cleanup:** delete the branch after merge (auto-delete recommended).

CI must be green before merge: ESLint + Prettier, typecheck (if TS), unit + integration tests, OSV/dependency audit, and migration dry-run on any branch that adds a migration.

---

## Commit messages (Conventional Commits)

```
<type>(<scope>): <brief>

Why, not just what. Multiple lines if needed.

Refs: #<PR>, <sprint or bug id>
```

Types: `feat`, `fix`, `chore`, `docs`, `style`, `refactor`, `test`, `perf`, `ci`. Scope: the area — `sync`, `rbac`, `bigcommerce`, `ddi`, `auth`, `repo`, `migration`.

Example:

```
feat(sync): add watermark-resume to the DDI inventory pull

Mid-run kill no longer reprocesses from zero — the per-entity sync_state
watermark is committed per batch in a transaction, so resume picks up at
the last committed page. Adds overlapping-run guard via an advisory lock.

Refs: #142, S2.1
```

---

## Releasing

### Standard release

1. `staging` is green and milestone QA (G5) passes.
2. PR `staging → main`, title `Release: <project> <version>`.
3. Required reviewers approve; CI green; migration dry-run clean.
4. **G6 confirmed** by Delivery Head + client (Delivery Head verifies a tested backup/rollback first).
5. Squash-merge to `main`; tag `git tag -a v1.0.0 -m "Initial launch"`; push the tag.
6. The deploy adapter (build → migrate → release → health-check → rollback) runs against the project's `host_target`.

### Hotfix

Fork from `main` → minimal fix → PR to `main` (2 approvals + senior) → tag + deploy → back-port PR `hotfix → staging`. > 1% hotfix rate means `staging` isn't stable — investigate the process.

---

## Tags

`v<major>.<minor>.<patch>`. Migrations are released atomically with the code that needs them — never tag a release whose migrations haven't passed the dry-run.

---

Last reviewed: 2026-06-30 (initial Node.js build)
Next review due: 2026-09-30
