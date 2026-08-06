# Unresolved Items — WebDesk Growth Dashboard Skill-Overlay Build

**Status:** Updated 2026-08-06. Per skill-build task §20, these are genuine unresolved items — none reopens a decision already resolved in the task brief or in this build's knowledge files. **B1 (WordPress Technical Discovery), B2 (Agent Specification Batch 1), and B3 (Service/SEO Library workbook) are now all RESOLVED — B1 and B2 were supplied and registered 2026-08-05; B3 was supplied and registered 2026-08-06 (a genuine `v4` file, directly supplied — see §D below). Nothing in §B remains open.**

---

## A. Permitted setup-time inputs (per skill-build task §20 — do not block this build)

| Item | Where it's referenced | Blocks |
|---|---|---|
| Exact Vercel Postgres Marketplace provider | `knowledge/01-approved-architecture.md` §"Database" stop-condition | G-Schema |
| Actual GitHub repository URLs | `templates/project.json.example` | Repository creation (Phase 0/1) |
| Actual Vercel project IDs | `templates/project.json.example` | Deployment configuration (Phase 1+) |
| Actual SMTP credentials | `knowledge/09-google-workspace-smtp.md` | Notification Center go-live |
| Actual operational owner names/contacts | `templates/CLAUDE.md.template`, `knowledge/11-retention-backup-and-operations.md` §"Monitoring ownership" | G5.5/G6 |
| Complete Service and SEO Library data | `knowledge/00-scope-and-precedence.md §6` | Phase 3 content population (explicitly post-launch-safe per the dashboard pack's own `12_Open_Items_and_Implementation_Inputs.md §4`) |
| Future malware-scanning provider | `knowledge/08-vercel-blob-and-file-handling.md` | Post-V1, explicitly deferred by the dashboard pack itself |

None of the above block completion of this skill-overlay build. They may block the relevant integration or production-launch gate later, exactly as the task brief states.

---

## B. Materials referenced in the task brief but not present in this repository

The skill-build task brief lists these as supplied inputs (#9–#11 in its materials list). A thorough search of the working directory at initial build time did not find any of them. **All three have since been supplied — B1 and B2 on 2026-08-05, B3 on 2026-08-06 — see §D for the resolution record. Nothing remains open in this section.**

### B3. Service and SEO Library spreadsheet template — RESOLVED (moved to §D4)

See §D4 below for the resolution record. This section is retained only as a historical note: two earlier, differently-named, differently-structured candidate files were found on disk on 2026-08-05 (`WebDesk_Service_SEO_Library_Templates_v1_internal.xlsx`, `..._v3_import_baseline.xlsx`) and were deliberately **not** registered at the time, since neither matched the `v2` filename referenced in that round's correspondence and picking one arbitrarily risked exactly the kind of unverified-assumption error this project's own precedence/escalation rules exist to prevent (`knowledge/00-scope-and-precedence.md §2`'s test: "if resolving it requires guessing what a human intended, it's a conflict to escalate"). A `v4` file was then directly supplied on 2026-08-06 and is the one actually registered — see §D4.

---

## D. Resolved during remediation (2026-08-05) — supplied and registered

### D1. Current WordPress Technical Discovery — RESOLVED

Supplied across two rounds. A fuller round (Part 2 in the registered document) was supplied and processed 2026-08-05, from a PDF (15 pages) at the time. A native Markdown version of Part 1 was then directly supplied 2026-08-06 and is now the source of record; the PDF is no longer bundled, since a native Markdown original exists. Registered at `canonical-inputs/Current_WordPress_Technical_Discovery.md`. Confirms real production/staging URLs, WordPress 7.0.2/PHP 8.4/WordPress.com Business Plan, the full 21-plugin active inventory, exact CaseStudy/Portfolio meta-key mappings, confirmed **Option A** selection, named security tooling, and backup cadence — all reflected in `knowledge/07-wordpress-integration.md` and `knowledge/11-retention-backup-and-operations.md`.

**One genuine conflict was found, not silently applied:** the document's ACF recommendation contradicted the Master Specification's "No ACF" exclusion. Surfaced to the project owner; resolved 2026-08-05 in favor of the Master Specification, with a further current-state clarification the same day. Full record, now in a separate file: `canonical-inputs/Owner_Clarifications_2026-08-05.md` and `knowledge/07-wordpress-integration.md` §"ACF conflict — resolved." **A further, independent difference was found 2026-08-06:** the 2026-08-05 PDF's plugin inventory listed ACF 6.8.6 as active; the 2026-08-06 Markdown's does not — preserved as a transparent historical note in the discovery document rather than silently resolved either way.

**Still open, per the document's own stated verification checklist** (not this build's gap — the document itself lists these as needing confirmation at implementation kickoff): REST API (`/wp-json/`) actual availability, WP-CLI/SSH actual provisioning, Application Password actual enablement, exact form/Podio field mapping, analytics property/container IDs, whether Wordfence/WPScan/UptimeRobot are actually installed, file-integrity check, plugin licensing. The **Theme Migration and Reconciliation Report** (a distinct, content-level audit of the *current* theme's templates/shortcodes/custom code) also remains not done — the Technical Discovery document is explicit that it doesn't replace this.

### D2. WebDesk Agent Specification Batch 1 — RESOLVED

Supplied 2026-08-05 (zip, 5 files). Registered at `canonical-inputs/agent-specifications-batch-1/`. Status per its own `00_README.md`: "Draft 1.0... ready for leadership and developer review... should not be treated as active production agent definitions until approved." Confirms the 19-section format and a precedence order consistent with this profile's own. No ACF-related content. Independently confirms (not just restates) the taxonomy-separation resolution for OQ-04.

**Still open:** Batches 2–4 (the remaining eleven of the fifteen total business agents) have not been supplied — narrower and non-blocking, tracked here for completeness only.

### D4. Service and SEO Library workbook — RESOLVED

Supplied 2026-08-06 (`.xlsm`, 17 sheets). Registered at `canonical-inputs/WebDesk_Service_SEO_Library_Templates_v4.xlsm`. Directly inspected before registration: file structure confirmed macro-free (no VBA project despite the `.xlsm` extension) and sheet contents confirmed to be normalized templates with a handful of realistic example rows (public case-study data only) — no pricing or confidential fields present. **Status: Under Review — advisory sample/import structure, not approved business truth, per WDS-014.** Full record: `knowledge/00-scope-and-precedence.md §4`.

---

## C. Genuinely new unresolved items surfaced by this build (not present in the prior review)

These emerged specifically from doing the skill-overlay build (as opposed to the prior compatibility review) — worth tracking separately since they're new, not carried forward.

| Item | Source | Severity |
|---|---|---|
| First-login provisioning model (JIT vs. pre-provisioned-only) for Google Workspace SSO | `knowledge/05-google-workspace-sso-and-local-admin.md` §"Subject-ID identity mapping" | Blocks Phase 1 auth implementation — needs a PM/client decision before user-record creation logic is written |
| Formal threat-modelling procedure | `knowledge/12-dashboard-security-controls.md` §"Threat modelling and CSRF/token-storage"; `gap-resolution-matrix.md` GAP-17 | The one item this build marks "Still Blocked" — genuinely new security work, correctly not fabricated here, scoped to Phase 0's Architect role |
| Dashboard-specific observability metrics catalog | `knowledge/11-retention-backup-and-operations.md`; `gap-resolution-matrix.md` GAP-16 | Needed before G5.5; not invented here because it requires knowing the actual operational profile of each job type, which doesn't exist until those job types are built |
| WordPress CI-safe testing strategy against the shared staging instance | `knowledge/13-testing-and-acceptance.md`; `gap-resolution-matrix.md` GAP-14 | Needed before WordPress integration tests run in CI — a destructive test against the one confirmed staging instance (`staging-7a61-wdsstage2.wpcomstaging.com`) would be a real operational risk if not isolated correctly |

---

## Summary

This skill-overlay build is **not blocked** by any item in this document — every item here either (a) is explicitly permitted to remain a setup-time input per the task brief, (b) is a forward-looking implementation decision correctly scoped to a later gate rather than invented now (§C), or (c) has been resolved during the 2026-08-05/2026-08-06 remediations by registering newly-supplied documents, including one real conflict found and resolved rather than silently applied (§D — now including the Service/SEO Library workbook, §D4). No supplied-but-missing document remains open as of 2026-08-06. See `docs/skill-build/approval-checklist.md` for what *is* required before Phase 0 begins.
