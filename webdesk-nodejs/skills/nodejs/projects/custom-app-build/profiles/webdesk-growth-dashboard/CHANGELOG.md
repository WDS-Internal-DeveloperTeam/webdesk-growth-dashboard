---
tier: 3
load_when: ["never"]
description: "Human-read version history for the WebDesk Growth Dashboard project profile. Not auto-loaded by any agent."
---

# Changelog — WebDesk Growth Dashboard Project Profile

All notable changes to this project profile are recorded here. Format loosely follows Keep a Changelog; versioning is independent of the base Node.js skill's own version (currently v0.2.4) and of the dashboard application's own future release versioning (`v1.0.0` etc. once launched).

## [1.3.0] — 2026-08-06 (source registration + document restructuring, following a third external verification review)

### Added — newly supplied and registered

- **`canonical-inputs/WebDesk_Service_SEO_Library_Templates_v4.xlsm`** — the Service and SEO Library workbook, directly supplied 2026-08-06. Inspected before registration (17 sheets, confirmed macro-free despite the `.xlsm` extension, sample rows checked for pricing/confidential content — none found). Registered with **Status: Under Review** — advisory sample/import structure, not approved business truth, per WDS-014. This resolves `docs/skill-build/unresolved-items.md §B3`, previously open because two earlier, differently-named candidate files found on disk in the 2026-08-05 remediation matched neither the filename nor structure referenced at the time; this `v4` file is the one actually supplied.
- **`canonical-inputs/Owner_Clarifications_2026-08-05.md`** — the ACF current-state clarification, previously recorded as an inline addendum inside the WordPress discovery document, is now a separate dated file. The discovery document and the later clarification are kept independently auditable rather than one being edited into the other. All references across `knowledge/00`, `knowledge/07`, `knowledge/15` (WDS-001), and this changelog now point to this file.

### Corrected — WordPress discovery source

- A native Markdown version of the Current WordPress Technical Discovery document (Part 1) was directly supplied 2026-08-06. This is now the registered source of record for Part 1. The PDF processed 2026-08-05 (whose additional Round-2 self-review and resolved CaseStudy/Portfolio Q&A are preserved as Part 2, since neither is contradicted by the new Part 1) is no longer bundled in this export — a native Markdown original now exists, so retaining the PDF as provenance evidence is no longer necessary. `canonical-inputs/WordPress-Technical-Discovery-source.pdf` removed accordingly.
- **A genuine difference between the two supplied source versions was found and preserved transparently, not silently resolved:** the 2026-08-05 PDF's plugin inventory listed ACF 6.8.6 as installed and active; the 2026-08-06 Markdown's plugin inventory does not list ACF at all. This is recorded as a historical note in the discovery document rather than picked one way or the other — and it independently corroborates, rather than contradicts, the Owner Clarifications file's "no confirmed ACF dependency" position.
- Removed a stray "ACF-to-native migration is the first confirmed Technical Debt Register entry" sentence and an "ACF inventory ... migration-away plan" table row, both of which still implied a migration was assumed. Replaced with "verify plugin presence once; no migration assumed either way."

### Packaging discrepancy — investigated, not silently accepted

- A third external review reported the exported package containing 281 files under a `webdesk-nodejs/` top-level prefix, including `webdesk-nodejs/.claude/settings.local.json`. Directly re-verified against the package actually built and delivered in the prior (2026-08-05) remediation: 86 files, no `webdesk-nodejs/` prefix, and `.claude/settings.local.json` was never included (the export only ever copied the profile subtree, never anything under `webdesk-nodejs/.claude/`). This points to the reviewed artifact being a raw zip of the entire local `webdesk-nodejs/` working directory, not the package this profile's tooling produces. See `docs/skill-build/validation-report.md` for the resolution and re-verification record, and the approval checklist for the packaging-shape question put to the project owner.

## [1.2.0] — 2026-08-05 (packaging correction + ACF current-state correction, following a second external verification review)

### Fixed — packaging

- The exported review package apparently placed `docs/implementation/` and `docs/skill-build/` **inside** the profile directory (as `implementation/`/`skill-build/` subfolders), which is not how this working tree is actually laid out and caused real, explainable symptoms in the reviewing tool (a manifest mismatch; `docs/skill-build/project-overrides.md` failing the base skill's frontmatter check, because a report file landing inside `skills/` gets swept by that check even though it was never meant to carry skill frontmatter). Confirmed by direct inspection: this working tree's `docs/implementation/` and `docs/skill-build/` were already correctly at the `WDS-Dashboard` repository root the entire time — this was an export/packaging issue, not a defect in this profile. A `PACKAGE_MANIFEST.txt` and an actual built ZIP (not just instructions) are now provided at the repository root so the export structure is no longer ambiguous. `MANIFEST.txt` inside the profile continues to list only the 51 profile files, unchanged.
- `proposed-upstream-patches/` and the `canonical-inputs/` files were also apparently missing from the same export — same root cause, same fix (a real, verified ZIP now exists rather than relying on a manual copy step).

### Corrected — ACF current-state record (second stage of the same conflict, not a new one)

The 2026-08-05 registration of the Technical Discovery document recorded the ACF _target-architecture_ conflict correctly (Master Specification's "No ACF" exclusion wins). The **current-state** framing that followed it — "ACF 6.8.6 is confirmed installed and active" and "existing ACF content is tracked as a Technical Debt Register item requiring migration" — is now corrected per a further, same-day project-owner clarification: _"There will be no ACF. WebDesk is not currently using ACF in the WordPress system. Native meta objects and custom PHP will be used."_

**Handled as a dated addendum, not a silent rewrite** — `canonical-inputs/Current_WordPress_Technical_Discovery.md` preserves the original document's plugin-inventory line (ACF 6.8.6 "installed and active") exactly as supplied, with an ADDENDUM section explaining it is superseded for planning purposes, not evidence of a confirmed current dependency. Updated accordingly: `knowledge/00-scope-and-precedence.md`, `knowledge/07-wordpress-integration.md` (now a two-stage record), `knowledge/15-project-specific-forbidden-actions.md` (WDS-001), `README.md`, and the four `docs/skill-build/` reports that previously repeated the "confirmed installed, must migrate" framing. **No ACF migration workstream is assumed going forward** — the corrected instruction is: verify plugin presence once at implementation kickoff, and if ACF is found installed but unused, remove it via the approved plugin-cleanup process (not a content migration).

### Not changed

- The PDF-vs-Markdown question about the Technical Discovery source was raised in the same review and is **not** corrected here — a PDF was in fact supplied to and processed by this build (verifiable in this session's own tool-call record), and the source-of-record note in `canonical-inputs/Current_WordPress_Technical_Discovery.md` continues to say so accurately. If a Markdown-native version is separately supplied and intended to replace the PDF as the canonical source, that is a new registration to do explicitly, not a correction of an inaccurate claim.
- The Service and SEO Library workbook remains unregistered pending a filename/content clarification — two candidate files were found on disk (`WebDesk_Service_SEO_Library_Templates_v1_internal.xlsx`, `..._v3_import_baseline.xlsx`), neither matching the `v2` filename referenced in the review. See `docs/skill-build/unresolved-items.md`.

## [1.1.0] — 2026-08-05 (remediation pass, following external verification review)

### Fixed — real defects found by independent review

- **Schema composition bug:** `contracts/project-profile.schema.json` previously claimed a JSON Schema `allOf` + `$ref` against the base schema would compose successfully. It does not — `allOf` is an intersection of constraints, not an override, so it could never actually relax the base schema's `host_target`/`tech_stack.storage` enums, and `templates/project.json.example` failed real validation (6 errors: 2 enum violations, 4 numeric fields holding string placeholders). Rewritten as a patch-spec (`base_schema_patches`) applied by a new offline, dependency-free validator, `tools/validate-project-profile.py`, to an in-memory copy of the base schema — the base schema file itself is never touched.
- **`templates/project.json.example`** rewritten to be fully type/format-valid (no string placeholders in numeric/integer/boolean/date-time/email/uri-typed fields); a new `templates/setup-input-checklist.md` carries the "still needs a real value" markers instead.
- **Profile-routing honesty:** the base orchestrator does **not** auto-route on `project.project_profile` — this was previously implied more strongly than the (already-honest, but easy to miss) caveat in `tests/routing-validation.md` stated. `SKILL.md` §2 and `templates/CLAUDE.md.template` now state plainly that the V1 loading mechanism is the project's own root `CLAUDE.md` explicitly listing the profile's `SKILL.md` path — a documented convention, not orchestrator-automatic behavior. Generic auto-routing is proposed as upstream patch #11, not applied.
- **Forbidden-content validator false positives:** the original design grepped all prose (including `tests/scenario-tests.md`'s own worked "anti-pattern" examples) for forbidden terms, which meant the test file reporting its own teaching content as a violation. Redesigned: strict negative term-scanning now runs only over structural files (`contracts/*.json`, `templates/*.example`); policy prose (`knowledge/*.md`) is checked for rule-_presence_, not term-_absence_; `tests/*.md` is excluded from literal-term scanning by design, with the rationale documented in the validator itself.
- **Manifest diff command** in `tests/profile-validation.md` had a path-prefix bug (`sed 's/^/.\//'` on lines that already started with `./`, producing `././file`). Fixed.
- **Packaging hygiene:** removed two `.DS_Store` files that had been created by Finder browsing inside the profile tree; `MANIFEST.txt` regenerated; a packaging note added clarifying that any export/zip for external review must include all three top-level pieces (`profiles/webdesk-growth-dashboard/`, `proposed-upstream-patches/`, `docs/skill-build/`), since a prior export apparently included only the first.
- **OQ-04 wording:** the open-questions cross-check in `docs/skill-build/gap-resolution-matrix.md` phrased OQ-04 as simultaneously "resolved" and "deferred," reading as self-contradictory. Reworded: the taxonomy-separation decision is unambiguously resolved; only the unrelated, non-blocking detail of confirming the 19-section format against real content was ever open, and that is now independently confirmed by the registered Agent Specification Batch 1 (below).
- **Validation report** rebuilt from actual re-run command output rather than narrated "PASS" claims — see `docs/skill-build/validation-report.md`.

### Added — newly supplied and registered canonical documents

- **`canonical-inputs/Current_WordPress_Technical_Discovery.md`** (source PDF retained alongside it) — registered per `knowledge/00-scope-and-precedence.md §4`. Confirms real production/staging URLs, WordPress 7.0.2 / PHP 8.4 / WordPress.com Business Plan, the full 21-plugin active inventory, exact CaseStudy/Portfolio meta-key mappings (corroborating, not contradicting, `10_WordPress_Integration_and_Migration.md`), confirmed selection of **Option A** (register post types in the WebDesk Custom Theme), named security tooling (Wordfence Free, WPScan via GitHub Actions, UptimeRobot Free), and backup cadence (35-day operational, 1-year off-platform) — all now reflected in `knowledge/07-wordpress-integration.md` and `knowledge/11-retention-backup-and-operations.md`.
- **`canonical-inputs/agent-specifications-batch-1/`** (5 files) — registered. Draft 1.0, awaiting final approval per its own `00_README.md`. Independently confirms the 19-section specification format and a precedence order consistent with this profile's own.

### A genuine conflict was found and resolved, not silently applied

The Technical Discovery document's "ACF version and field groups" entry directly contradicted `01_Dashboard_Master_Specification.md`'s "No ACF or ACF Local JSON" exclusion (which `knowledge/15`'s WDS-001 was built on) — it proposed free-tier ACF + ACF Local JSON as the approved field-group mechanism, and confirmed ACF 6.8.6 is already installed and active on the live site. Per `knowledge/00-scope-and-precedence.md`'s own conflict-handling rule, this was surfaced to the project owner rather than resolved automatically. **Decision (2026-08-05): the Master Specification's exclusion stands.** WDS-001 is updated to cite this resolution; the currently-installed ACF 6.8.6 is tracked as the first confirmed entry in the Technical Debt Register the Discovery document itself calls for, not extended with new field groups. Full record: `knowledge/07-wordpress-integration.md` §"ACF conflict — resolved."

### Still not supplied

Service and SEO Library workbook — remains unregistered; see `docs/skill-build/unresolved-items.md`.

## [1.0.0] — 2026-08-05

### Added

- Initial project-profile build: `SKILL.md`, `README.md`, `MANIFEST.txt`.
- Sixteen knowledge files (`knowledge/00`–`15`) resolving every architecture decision identified as open in `docs/implementation/architecture-validation.md` and `docs/implementation/open-questions.md`: Turborepo boundaries, NestJS-on-Vercel adaptation, the resolved serverless job-execution model (no permanent worker process), Google Workspace SSO + local TOTP admin, GitHub App integration, WordPress REST/WP-CLI integration, Vercel Blob file handling, Google Workspace SMTP, data/Git ownership, retention/backup/operations, dashboard-specific security controls, testing/acceptance mapping, the 10-phase implementation plan pointer, and project-specific forbidden actions.
- Four integration knowledge directories (`integrations/github`, `integrations/wordpress`, `integrations/google-workspace`, `integrations/vercel`), loaded only when the active task needs them, per context-budget discipline.
- Five contract schemas (`contracts/*.schema.json`) formalizing the job-record, release-manifest, audit-event, webhook-event, and project-profile shapes referenced throughout the knowledge files.
- Six templates (`templates/*`) for `project.json`, `CLAUDE.md`, `HANDOFF.md`, architecture ADRs, integration contracts, and Ready-for-Claude task packages, pre-filled with this project's resolved defaults so Phase 0 does not re-derive them.
- Five test/validation documents (`tests/*`) covering profile structure, routing, precedence, context-loading scope, and worked scenarios.
- `docs/skill-build/` report suite: build report, file inventory, gap-resolution matrix, base-skill reuse map, project overrides, proposed-upstream-patches summary, validation report, unresolved items, and approval checklist.
- `proposed-upstream-patches/` (outside the skill tree, at the repository root) — ten proposed generic improvements to the base skill, none merged.

### Resolved in this version (previously open questions)

- `docs/implementation/open-questions.md` OQ-02 (Vercel execution model) — resolved: no permanent worker process; all background work runs as Vercel Function handlers behind Vercel Queues/Workflows/Cron Jobs, with Upstash QStash + Vercel Cron as documented fallback. See `knowledge/04-serverless-queues-workflows-and-cron.md`.
- OQ-03 (relationship between `webdesksolution.com` and `webdeskinc.com`) — resolved: both domains belong to one WebDesk organization; no tenant separation is created on email-domain grounds alone. See `knowledge/05-google-workspace-sso-and-local-admin.md`.
- OQ-04 (Agent Directory / Agent Specification Library scope) — resolved: the dashboard's fifteen business/delivery agents are a distinct taxonomy from the Node.js skill's software-delivery roles, governed by the dashboard's own Agent Directory using the approved nineteen-section specification format. See `SKILL.md` §6.
- OQ-01 (Postgres provisioning path vs. Neon exclusion) — **not fully resolved by this profile**; carried forward as a setup-time environment decision with an explicit stop-and-escalate rule if Vercel cannot offer a qualifying East Coast option without violating the Neon exclusion. See `knowledge/01-approved-architecture.md` §"Database" and `docs/skill-build/unresolved-items.md`.

### Not included in this version

- No application code, Turborepo scaffold, package installation, database migration, WordPress connection, or deployment. This is a skill-overlay build only.
- Agent Specification Batch 1, WordPress Technical Discovery, and Service/SEO Library content are registered as canonical-document pointers only where actually supplied to this build; where not supplied, they are tracked in `docs/skill-build/unresolved-items.md` as setup-time/discovery inputs rather than fabricated.
