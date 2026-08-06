# File Inventory — WebDesk Growth Dashboard Skill-Overlay Build

**Status:** Updated 2026-08-05 (remediation pass). Cross-checks mechanically against `profiles/webdesk-growth-dashboard/MANIFEST.txt` via `tools/validate-all.py`'s manifest check (see `docs/skill-build/validation-report.md`), not a manual diff.

---

## 1. Project profile (inside the base skill tree, additive only)

`webdesk-nodejs/skills/nodejs/projects/custom-app-build/profiles/webdesk-growth-dashboard/` — **51 files**

| Directory                        | File count | Purpose                                                                                                                                                                                                                |
| -------------------------------- | ---------: | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| (root)                           |          4 | `SKILL.md`, `README.md`, `MANIFEST.txt`, `CHANGELOG.md`                                                                                                                                                                |
| `knowledge/`                     |         16 | Numbered 00–15, per the required structure in the skill-build task §14                                                                                                                                                 |
| `integrations/github/`           |          3 | GitHub App auth/Octokit, webhooks/events, doc pointers                                                                                                                                                                 |
| `integrations/wordpress/`        |          3 | REST/App Passwords, WP-CLI/deployment, doc pointers                                                                                                                                                                    |
| `integrations/google-workspace/` |          3 | OIDC SSO, SMTP, doc pointers                                                                                                                                                                                           |
| `integrations/vercel/`           |          3 | Functions/Queues/Workflows/Cron, Blob/Postgres, doc pointers                                                                                                                                                           |
| `contracts/`                     |          5 | `job-record`, `release-manifest`, `audit-event`, `webhook-event`, `project-profile` schemas                                                                                                                            |
| `templates/`                     |          7 | `project.json.example`, `setup-input-checklist.md` (added in remediation), `CLAUDE.md.template`, `HANDOFF.md.template`, `architecture-adr-template.md`, `integration-contract-template.md`, `task-package-template.md` |
| `tests/`                         |          5 | `profile-validation`, `routing-validation`, `precedence-tests`, `context-loading-tests`, `scenario-tests`                                                                                                              |
| `tools/`                         |          2 | **New in remediation:** `validate-all.py` (master executable validator), `validate-project-profile.py` (offline JSON Schema patch-and-validate tool)                                                                   |

Matches the required structure in skill-build task §14, extended with a `tools/` directory (not in the original required list) to hold the executable validators the remediation required — a structural addition, explained here per §14's "you may improve the structure when technically justified, but explain every change" allowance.

## 2. Proposed upstream patches (outside the skill tree entirely)

`proposed-upstream-patches/` (WDS-Dashboard repo root) — **12 files**

`README.md` (index) + 11 numbered patch proposals (`01`–`11`), per skill-build task §16. Patch 11 (generic `project_profile` auto-routing) added during the 2026-08-05 remediation.

## 3. Build reports

`docs/skill-build/` (WDS-Dashboard repo root) — **9 files**

`project-skill-build-report.md`, `file-inventory.md` (this file), `gap-resolution-matrix.md`, `base-skill-reuse-map.md`, `project-overrides.md`, `proposed-upstream-patches.md`, `validation-report.md`, `unresolved-items.md`, `approval-checklist.md` — per skill-build task §19. All updated 2026-08-05 to reflect the remediation.

## 4. Canonical inputs (new, outside the skill tree — supplied 2026-08-05 and 2026-08-06)

`canonical-inputs/` (WDS-Dashboard repo root) — **8 files**

`Current_WordPress_Technical_Discovery.md` (native Markdown, supplied 2026-08-06 for Part 1; a PDF processed 2026-08-05 for Part 2's additional content is no longer bundled, since a native Markdown original now exists); `Owner_Clarifications_2026-08-05.md` (the ACF current-state clarification, kept as a separate file); `WebDesk_Service_SEO_Library_Templates_v4.xlsm` (supplied 2026-08-06); `agent-specifications-batch-1/` (5 files: `00_README.md` + 4 agent specs). Registered per `knowledge/00-scope-and-precedence.md §4`.

## 5. Base skill — confirmed unmodified

`webdesk-nodejs/skills/` outside the `profiles/webdesk-growth-dashboard/` directory — **0 files changed**, throughout both the initial build and the remediation. Verification method: only the `Write`/`Edit` tools were used, and only ever targeted files under the profile directory or the three root-level directories above — no `Edit` call touched any file under `_spine/`, `nodejs/knowledge/`, `nodejs/projects/*` (other than the `profiles/` subdirectory), `nodejs/integrations/`, `nodejs/templates/`, or `_contracts/`. See `docs/skill-build/base-skill-reuse-map.md`.

## 6. Prior-task inputs (read, not modified)

- `webdesk-dashboard-documentation-v1/` — 12 documents + README + manifest.
- `docs/implementation/` — 6 files (the compatibility review).

## 7. Materials referenced in the task brief — resolution status

- Current WordPress Technical Discovery — **supplied and registered** (Part 1: 2026-08-06; Part 2: 2026-08-05; see §4 above).
- WebDesk Agent Specification Batch 1 — **supplied and registered 2026-08-05** (see §4 above).
- Service and SEO Library spreadsheet template — **supplied and registered 2026-08-06** (`WebDesk_Service_SEO_Library_Templates_v4.xlsm`; see §4 above and `docs/skill-build/unresolved-items.md §D4`).

---

## Total file count

**Initial build:** 48 (profile) + 11 (proposed patches) + 9 (reports) = 68 files, 0 base-skill files modified.
**V1/V2 remediation (2026-08-05):** +3 profile files (`tools/validate-all.py`, `tools/validate-project-profile.py`, `templates/setup-input-checklist.md`) + 1 proposed patch (`11-generic-project-profile-routing.md`) + 7 canonical-inputs files = 79 total new files, plus substantive edits to ~15 existing files.
**V3 remediation (2026-08-06):** canonical-inputs net +1 file (removed the PDF, added the workbook and the Owner Clarifications file: 7 → 8) + 1 new root-level tool (`validate-package.py`) + 1 root-level manifest (`PACKAGE_MANIFEST.txt`, regenerated) = **81 total new files since initial build**, plus edits to `knowledge/00`, `knowledge/07`, `README.md`, `CHANGELOG.md`, and this report suite. **0 base-skill files modified, still.**
