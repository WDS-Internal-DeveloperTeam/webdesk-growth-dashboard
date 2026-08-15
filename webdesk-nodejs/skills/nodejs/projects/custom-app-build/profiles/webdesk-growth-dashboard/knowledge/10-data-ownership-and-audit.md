---
tier: 1
load_when: ["webdesk-growth-dashboard", "schema-work", "security-topic", "g_schema"]
description: "PostgreSQL/Git/WordPress/Vercel Blob/environment-variable ownership boundaries, the extended base-entity standard, and the audit-event design (including the retention/legal-hold columns the base skill has never needed before). No two competing sources of truth."
---

# 10 — Data Ownership and Audit

> The base skill's own project-state model (`project.json`, append-only `audit_log`) is the closest existing pattern, but it is a **delivery-process** artifact with no retention policy of its own — it has never needed one. This file is where that pattern is extended into a **product-grade, retention-aware, legal-hold-aware** audit design, because the dashboard's own requirement (7-year immutable retention for approval-related events) is a genuinely different lifecycle than anything the base skill has modeled.

---

## Ownership boundaries — one source of truth per fact

No two systems own the same fact. This is a hard rule, restated from `01_Dashboard_Master_Specification.md §8` and `04_Data_Model_and_Ownership.md §3`:

| System                                     | Owns                                                                                                                                                                                                                                                    | Never owns                                                                                                                                                                                                                     |
| ------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **PostgreSQL**                             | Operational application data: users, sessions, roles, permissions, task/job progress, notifications, comments, review assignments, scan progress, import staging data, locks/retries, operational contact configuration, UI preferences                 | Durable versioned content (that's Git); published website content (that's WordPress); binary files (that's Blob); secret values (those are env vars)                                                                           |
| **Git** (both repositories)                | Durable versioned artifacts: approved Markdown documents, agent specifications, approved strategy/content/design/code-review/QA/release artifacts, theme and dashboard application code, approved state snapshots, handoff documents, release manifests | Operational runtime state (PostgreSQL); live publication status (WordPress); secret values                                                                                                                                     |
| **WordPress**                              | Published website content: posts, pages, terms, media, menus, approved drafts, publication status, public URLs, native metadata used by the live site                                                                                                   | Dashboard-internal workflow state; approval history (the dashboard's `approvals`/`workflow_instances` records are the source of truth for _how_ something got approved; WordPress just reflects the _result_ once published)   |
| **Vercel Blob**                            | Private binary files: uploads, screenshots, scan evidence, exports, documentation assets, case-study/portfolio source assets                                                                                                                            | Metadata about those files (PostgreSQL owns metadata; Blob owns bytes only)                                                                                                                                                    |
| **Environment variables / secret manager** | Secret values                                                                                                                                                                                                                                           | Everything else — the dashboard stores only secret _metadata and verification status_ (`knowledge/05`, `06`, `07`, `09`'s "never the secret value" rule, repeated for every integration because it's the same rule every time) |

**Roadmaps represent intent, not implementation proof.** Repository implementation state and verified production state always outrank a roadmap claim — restated directly from `01_Dashboard_Master_Specification.md §9` ("Roadmap intent is never treated as proof that a page or feature is live") because this is one of the specific failures (`01 §3`) the dashboard was commissioned to fix, and it is easy for a well-intentioned feature to quietly regress this if the Home module or Page Inventory ever infers "deployed" from a workflow-stage field instead of a verified GitHub SHA / WordPress publication check.

**No two competing sources of truth.** If an implementation decision would create a second place that could answer "is this page live," that is itself a bug to fix at design time, not a redundancy to tolerate — WordPress's publication state is the single answer to that question; the dashboard's records are an _indexed copy_ of it (per the ownership matrix in `04_Data_Model_and_Ownership.md §3`: "Page publication state | Indexed copy | Approved artifact/history | **Primary** | ..."), refreshed by scan/sync, never treated as independently authoritative when it diverges from what a fresh WordPress read shows.

---

## The extended base-entity standard

Every primary PostgreSQL entity in this project extends the base skill's implicit entity conventions (UUID PK, `underscored: true`, `created_at`/`updated_at`) with the dashboard's required standard columns (`04_Data_Model_and_Ownership.md §1`):

```text
id                  UUID primary key (gen_random_uuid())
public_id           human-readable stable identifier, unique
project_id          UUID, where project-scoped (this project's scoping key — see note below)
version             integer, default 1
status              controlled enum or status reference
owner_user_id       UUID nullable
created_at          timestamptz (UTC)
created_by          UUID
updated_at          timestamptz (UTC)
updated_by          UUID
lock_version        integer, for optimistic concurrency (If-Match / lock-version checks per
                     08_API_and_Integration_Contracts.md §2)
deleted_at          timestamptz nullable (soft deletion)
deleted_by          UUID nullable
retention_category  controlled value — see knowledge/11-retention-backup-and-operations.md
confidentiality     public / internal / confidential / restricted
audit_context_id    UUID nullable — links to the audit_events entry that produced this state
```

**On `project_id` vs. the base skill's `tenant_id`:** the base skill's multi-tenancy guidance (`nodejs/knowledge/database/03-multi-tenancy.md`, NODE-104) is reused as a **mechanism** — repository-layer scoping, a fail-closed default scope, an explicit-and-audited elevated-scope path — with `project_id` as the scoping key instead of `tenant_id`, per the resolved single-organization reading in `knowledge/05-google-workspace-sso-and-local-admin.md`. Every repository function still takes a scope parameter and includes it in the `WHERE` clause; a missing scope still fails closed rather than silently returning everything. The "master" cross-scope path in the base skill's pattern has no direct product equivalent here (there is no cross-client oversight dashboard) — the closest analog is the Super Admin role's system-wide visibility within this one organization, which is a permission-level concern (`knowledge/12-dashboard-security-controls.md`), not a second scoping key.

Approved artifacts are immutable; editing one creates a new draft version (`lock_version` prevents silent overwrites); every approval references an exact entity version — this is the base skill's own artifact-versioning discipline (`nodejs/knowledge/database/02-migrations-and-rollback.md`'s "reviewed like code" spirit, applied to content/design artifacts rather than schema migrations), unchanged.

---

## Audit events — genuinely new design, not an extension

The base skill's `project.json.audit_log` (append-only, `{timestamp, actor, actor_type, action, details}`) is the right **shape** but the wrong **lifecycle** for this project's audit requirement. Design `audit_events` as its own first-class entity, not a JSON blob:

```text
audit_events
  id                  UUID primary key
  event_type          controlled enum (login, permission_change, data_change, approval,
                       rejection, publish, release, rollback, backup, restore, security_exception,
                       scan_run, import_run, git_sync, webhook_processed, ...)
  actor_user_id        UUID nullable (null for system-initiated events)
  actor_type           human | system | service_account
  entity_type          the record type this event concerns
  entity_id            UUID
  entity_version       integer — the exact version this event concerns (never "the current version")
  action               the specific action taken
  before_state          JSONB nullable — omit or redact confidential fields per confidentiality rules
  after_state           JSONB nullable — same redaction rule
  reason               text nullable — required for rejections, revisions, overrides, security exceptions
  related_gate_or_approval_id  UUID nullable
  git_commit_sha       text nullable — where applicable (per knowledge/06's SHA-verification rule)
  retention_category   controlled value (see knowledge/11) — e.g. "audit-7y" for approval-related events
  legal_hold           boolean, default false
  legal_hold_reason    text nullable
  created_at           timestamptz (UTC) — immutable once written
```

**Immutability:** `audit_events` rows are never updated or hard-deleted by application code except through the retention/deletion job (`knowledge/11-retention-backup-and-operations.md`), which itself only deletes rows whose retention period has elapsed **and** `legal_hold = false`. No application code path performs an `UPDATE` on an existing audit event under any circumstance — a correction is a new event referencing the original, never an edit of history.

**What triggers an audit event** — every privileged action across the system: role/permission changes, confidential-field access changes, user activation/deactivation, approval-authority changes, production-release authority changes, emergency-account login/recovery (`06_Roles_and_Permissions.md §6`), every gate-equivalent workflow transition (`05_Workflow_State_Machines.md §12`), every GitHub/WordPress integration action that changes dashboard state (`knowledge/06`, `knowledge/07`), every backup/restore/retention-run event (`knowledge/11`).

---

## What this file does not cover

- Retention periods per category and the deletion-run job's own audit trail → `knowledge/11-retention-backup-and-operations.md`.
- Confidentiality-tier enforcement mechanics (DTO/serializer design) → `knowledge/12-dashboard-security-controls.md`.
- The `audit-event.schema.json` formalization of the shape above → `contracts/audit-event.schema.json`.
