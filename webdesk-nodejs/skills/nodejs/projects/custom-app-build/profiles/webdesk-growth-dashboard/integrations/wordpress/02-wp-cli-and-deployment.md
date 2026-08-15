---
tier: 2
load_when: ["webdesk-growth-dashboard", "integration-work", "deployment"]
description: "Controlled production WP-CLI allowlist enforcement mechanics, GitHub-based WordPress.com deployment pipeline, and the Case Study/Portfolio migration command's technical requirements."
---

# WordPress — WP-CLI and Deployment

> Concrete enforcement mechanics for the production WP-CLI allowlist and deployment pipeline stated in `../../knowledge/07-wordpress-integration.md`. Loaded only when implementing the deployment/migration path.

---

## Production WP-CLI allowlist enforcement

The allowlist (`../../knowledge/07-wordpress-integration.md` §"Controlled WP-CLI"):

```
version/status checks, cache clearing, rewrite flushing, database checks (non-mutating),
approved imports, approved migrations, approved search-and-replace
```

**Enforcement mechanism:** the dashboard never exposes raw WP-CLI command execution to any operator or automated process. Instead, each allowlisted operation is a **named, parameterized action** in the dashboard (e.g., "Clear WordPress cache," "Run approved Case Study migration [dry-run|apply]") that internally invokes a specific, hardcoded WP-CLI command with validated parameters — never a free-text command field. This is the practical difference between "an allowlist exists in documentation" and "an allowlist is actually enforced": there is no code path from the dashboard to an arbitrary WP-CLI invocation, allowlisted or not.

```ts
// packages/integrations/wordpress/src/wp-cli-actions.ts
// Each function below is the ENTIRE surface of production WP-CLI access from the dashboard.
// No generic "run WP-CLI command" function exists.
export async function checkCoreVersion(env: Environment): Promise<VersionInfo> { ... }
export async function clearCache(env: Environment): Promise<CacheClearResult> { ... }
export async function flushRewriteRules(env: Environment): Promise<void> { ... }
export async function checkDatabase(env: Environment): Promise<DbCheckResult> { ... }
export async function runCaseStudyMigration(env: Environment, opts: { dryRun: boolean }): Promise<MigrationReport> { ... }
// A new allowlisted action requires a new named function here, reviewed at Code Review — never
// a runtime-configurable command string.
```

---

## GitHub-based deployment pipeline

```text
feature branch → Pull Request → automated PHP/JS/SCSS/security/build checks
  → staging branch/deployment → QA and stakeholder approval
  → exact approved commit to production → smoke tests
```

- CI checks (PHP lint/static analysis, JS/SCSS build, security scan) run via GitHub Actions on the WordPress repository, independent of the dashboard monorepo's own CI (`../../knowledge/01-approved-architecture.md` styling-row note on repository build isolation).
- WordPress.com's GitHub-based deployment mechanism promotes an approved commit — the dashboard's Release Center records the resulting deployment status via `../../knowledge/06-github-app-integration.md`'s `deployment_status` webhook consumption.
- **Direct SFTP deployment and manual production editing are prohibited** (`10_WordPress_Integration_and_Migration.md §11`) — no code path, documented or otherwise, uses SFTP credentials for production changes.

---

## Migration command technical requirements

The Case Study/Portfolio migration command (`../../knowledge/07-wordpress-integration.md` §"Case Study and Portfolio migration") is itself one of the allowlisted `runCaseStudyMigration`-style actions above, and must:

- Support `--dry-run` (report-only, no writes) as the default mode operators use before `--apply`.
- Back up database and uploads before any `--apply` run (coordinates with `../../knowledge/11-retention-backup-and-operations.md`'s pre-deployment backup requirement).
- Preserve IDs, slugs, dates, statuses, authors, URLs exactly.
- Preserve taxonomy terms and relationships.
- Map every documented existing meta key (`10_WordPress_Integration_and_Migration.md §5–§6`) to its native `register_post_meta()` equivalent.
- Convert upload-result-array meta fields to WordPress attachment IDs.
- Preserve gallery order and repeatable Case Study content-block order.
- Log exceptions per-record rather than aborting the whole run on one bad record.
- Report before/after counts per entity type.
- Be idempotent where possible (`--apply` on already-migrated content is a safe no-op, not a duplicate).
- Provide rollback instructions as part of its own output, not a separately-maintained document that can drift from the actual migration behavior.

---

## verify-at-discovery checklist

- [ ] WP-CLI/SSH access constraints on the WordPress.com hosting plan (`12_Open_Items_and_Implementation_Inputs.md §2`).
- [ ] Exact current plugin versions and active theme, confirmed before the Theme Migration and Reconciliation Report is finalized.
- [ ] WordPress.com's specific GitHub deployment integration mechanics (branch mapping, build step if any).

See `pointers.md` for documentation anchors.
