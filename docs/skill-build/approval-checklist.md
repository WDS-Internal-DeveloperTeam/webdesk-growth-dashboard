# Approval Checklist — WebDesk Growth Dashboard Skill-Overlay Build

**Status:** Ready for human review, **remediated three times (2026-08-05 ×2, 2026-08-06 ×1).** V1 (2026-08-05) fixed four real blocking issues and registered two newly-supplied documents (one genuine conflict found and resolved, not silently applied — see below). V2 (2026-08-05) fixed a real packaging/export defect (12/14 on an exported package vs. 14/14 at the real install path) and an ACF current-state correction. V3 (2026-08-06) registered the Service/SEO workbook for real, reconciled a native-Markdown supply of the WordPress discovery source, moved the ACF clarification into its own file, added a package-level validator, and investigated (rather than silently accepted) a packaging-discrepancy claim that turned out not to describe this build's actual export — see `docs/skill-build/validation-report.md`'s "V3: packaging-discrepancy investigation" and "Fixed in the V3 remediation" sections. Nothing below has been self-approved — per this project's own separation-of-duties rule (`knowledge/12-dashboard-security-controls.md`), the agent that built and remediated this overlay does not also approve it. This checklist is what a human reviewer works through.

---

## Completion condition (skill-build task §22)

- [x] **1. The project-specific skill profile is fully created.** 51 files under `profiles/webdesk-growth-dashboard/` (48 at initial build + `tools/validate-all.py`, `tools/validate-project-profile.py`, `templates/setup-input-checklist.md` added during remediation).
- [x] **2. All required files exist.** Cross-checked mechanically — `tools/validate-all.py`'s manifest and required-files checks both pass; see `docs/skill-build/validation-report.md`.
- [x] **3. Validation checks pass — for real, not narrated.** `python3 tools/validate-all.py` → **14/14 checks pass, exit code 0** at the real install path (full base-skill checkout). Re-run against the actual exported zip (`webdesk-growth-dashboard-review-package-2026-08-06.zip`, extracted fresh) → **profile validator: 13/14 pass, 1 clearly-labeled SKIP, exit code 0** — the skip is a real, honest "cannot check this without the base schema present," not a failure or a fabricated pass — **plus a new package-level validator (`validate-package.py`): 10/10 pass, exit code 0.** All runs' full output captured directly in `docs/skill-build/validation-report.md` (no summarized/paraphrased results). Two independent sanity checks confirm the profile validator isn't tautological (it correctly fails on deliberately injected defects).
- [x] **4. Every supplied gap is mapped to a resolution status.** `docs/skill-build/gap-resolution-matrix.md` — all 17 gap-analysis areas plus the 4 original open questions, including the OQ-04 wording fix (no longer reads as self-contradictory).
- [x] **5. Proposed reusable base-skill changes are separated from project-specific rules.** `proposed-upstream-patches/` (now 12 files: README + 11 patches, repo root, outside the skill tree) vs. `knowledge/15-project-specific-forbidden-actions.md` (WDS-xxx, inside the profile) — no overlap, no ambiguity about which is which.
- [x] **6. No application code has been generated.** Confirmed — every file produced by this task (including the remediation) is Markdown, JSON Schema, or a validation script (Python, standard library only, no framework/application code); no `.ts`/`.tsx` source file, no real `package.json`, no migration file.
- [x] **7. An approval checklist has been produced.** This document.

---

## What changed in the 2026-08-05 remediations (read this before re-reviewing)

### V1 remediation

An external verification review found the profile "approximately 85–90% ready" with four blocking issues. All four are fixed, verified, and re-run — full detail in `docs/skill-build/validation-report.md`:

1. **Schema composition bug** (the `allOf`/`$ref` approach didn't actually work) — fixed with a patch-spec + offline validator (`tools/validate-project-profile.py`), reproduced the original failure first, then confirmed the fix.
2. **Profile routing undocumented honestly** — fixed; `SKILL.md`, `CLAUDE.md.template`, and `routing-validation.md` now state plainly that `CLAUDE.md` is the actual V1 mechanism, not the base orchestrator.
3. **Two documents were reported missing that had actually been supplied** — this specific claim was checked against this build's own history and found **not accurate at the time it was made** (a thorough filesystem search genuinely found neither document present before 2026-08-05); both were supplied in the same session as the review and are now registered for real, including resolving one genuine conflict (below). The Service/SEO Library workbook remains genuinely not supplied.
4. **Reports not included in an export** — not a defect in what's on disk (all three top-level pieces were confirmed present throughout); a packaging note now makes explicit what any future export must include.

### V2 remediation

A second external verification review reported 12/14 checks on an exported package (vs. 14/14 at the real install path) and required an ACF current-state correction. Both fixed — full detail in `docs/skill-build/validation-report.md`'s "Two install shapes" and "Other items fixed in the V2 remediation" sections:

1. **Packaging/export defect, confirmed and independently traced to its real cause.** The reviewed package's 12/14 was independently reproduced by building a correctly-structured standalone package (reports at package root, not nested — this build's own filesystem was already correctly shaped). The actual cause: `tools/validate-all.py` had hard dependencies on base-skill files that a lightweight package export doesn't include. Fixed with install-shape detection (FULL vs. STANDALONE) — see the validation report. `PACKAGE_MANIFEST.txt` now documents the correct export layout, and the actual zip was built and re-verified from the extracted file itself.
2. **ACF current-state language corrected** via a further, dated owner clarification (not a silent edit) — see below.
3. **`SKILL.md` frontmatter wording fixed** to no longer read as contradicting the routing explanation.
4. **Two items respectfully not changed, both documented rather than silently applied or silently ignored:** the WordPress Technical Discovery source is recorded as a PDF because this build has direct tool-call evidence it was; and the "v2" Service/SEO workbook was not registered because no file by that name was found (two differently-named, differently-structured candidates were found instead — see `unresolved-items.md §B3`).

### V3 remediation

A third external verification review reported a packaging discrepancy (281 files, `webdesk-nodejs/`-prefixed, containing local developer settings) and requested registering the Service/SEO workbook, correcting WordPress source provenance, separating the ACF clarification into its own file, and adding a package-level validator. Full detail in `docs/skill-build/validation-report.md`'s "V3: packaging-discrepancy investigation" and "Fixed in the V3 remediation" sections:

1. **Packaging discrepancy investigated, not silently accepted.** The described package (281 files, `webdesk-nodejs/` prefix, `.claude/settings.local.json` present) did not match this build's actual export (86 files at the time, no such prefix, no local settings — independently re-verified by MD5 immediately before the review arrived). Running the new package validator against the *raw working directory* (rather than the curated export) reproduced the review's exact complaints, since the raw directory genuinely contains those things. **Put to the project owner directly: keep the export lean, or bundle the full base skill.** Decision: **keep it lean** — matches the explicit V2 spec, and this folder has an independently-diagnosed disk-full/broken-iCloud-sync problem that a much larger bundle would aggravate.
2. **Service/SEO workbook registered for real.** A genuine `v4.xlsm` file was directly supplied, inspected (macro-free, no pricing/confidential content in its sample rows), and registered as Under Review per WDS-014.
3. **WordPress source reconciled, not overwritten.** A native Markdown version of the discovery document was directly supplied and is now the source of record for Part 1; the PDF is no longer bundled (a real Markdown original now exists). The earlier PDF-processed Round 2 content is preserved since it isn't contradicted. **One genuine difference between the two supplied source versions was found and preserved transparently rather than silently resolved:** the PDF's plugin list included ACF 6.8.6; the new Markdown's does not.
4. **ACF clarification moved to its own file**, `canonical-inputs/Owner_Clarifications_2026-08-05.md`, no longer an inline addendum inside the discovery document.
5. **Package-level validator added** (`validate-package.py`, repository root) — 10 checks distinct from the profile's own validator.

## A genuine conflict was found and resolved — not silently applied

Registering the newly-supplied **Current WordPress Technical Discovery** document surfaced a real conflict, resolved in two stages, neither silent: (1) the document originally proposed ACF + ACF Local JSON, contradicting `01_Dashboard_Master_Specification.md`'s "No ACF" exclusion — resolved in favor of the Master Specification for target architecture; (2) the document originally reported ACF 6.8.6 as installed and active — a further owner clarification then corrected this current-state reading too: no confirmed ACF dependency exists, and no migration workstream is assumed. Full two-stage record: `knowledge/07-wordpress-integration.md` §"ACF conflict — resolved." **A reviewer should specifically check both stages were applied correctly, and that no file still says ACF is "confirmed installed" or "must be migrated"** — it touches `knowledge/07`, `knowledge/15` (WDS-001), `knowledge/00-scope-and-precedence.md`, `SKILL.md`, `README.md`, `CHANGELOG.md`, and this checklist.

---

## Reviewer's own pre-Phase-0 checklist

- [ ] **Re-run the profile validator yourself, installed at the real path.** `cd webdesk-nodejs/skills/nodejs/projects/custom-app-build/profiles/webdesk-growth-dashboard/tools && python3 validate-all.py` — confirm 14/14, exit code 0 (FULL install shape).
- [ ] **Separately, re-run both validators from the actual exported zip.** `unzip webdesk-growth-dashboard-review-package-2026-08-06.zip -d review-package && cd review-package && python3 validate-package.py .` — confirm 10/10, exit code 0. Then `cd skills/nodejs/projects/custom-app-build/profiles/webdesk-growth-dashboard/tools && python3 validate-all.py` — confirm 13/14 pass, 1 SKIP, exit code 0 (STANDALONE install shape; the SKIP is expected and explained, not a failure). `PACKAGE_MANIFEST.txt` at the repository root is the authoritative record of what this zip should contain (88 files) — cross-check `unzip -l` against it if anything looks off. **This package is deliberately lean — it does not include the full base Node.js skill**, per the packaging-shape decision recorded in `PACKAGE_MANIFEST.txt` and `docs/skill-build/validation-report.md`.
- [ ] **Spot-check the ACF conflict resolution.** Read `knowledge/07-wordpress-integration.md` §"ACF conflict — resolved" and `canonical-inputs/Owner_Clarifications_2026-08-05.md` (now a separate file from the discovery document). Confirm both match your actual decisions, and confirm no file still says ACF is "confirmed installed and active" or "must be migrated."
- [ ] **Confirm the Service/SEO Library workbook (`canonical-inputs/WebDesk_Service_SEO_Library_Templates_v4.xlsm`) is the correct, current one** — this is the file actually supplied 2026-08-06; two earlier, differently-named candidates found on disk during the V1 remediation were never registered (see `docs/skill-build/unresolved-items.md §D4` for the history).
- [ ] **No dashboard decision was silently changed.** Spot-check `docs/skill-build/project-overrides.md` against the skill-build task brief §3–§13.
- [ ] **The base Node.js skill remains intact.** No git history exists in this working directory as of this build (confirmed at session start) — the base-skill-unmodified claim rests on `docs/skill-build/base-skill-reuse-map.md`'s tool-use audit (every base-skill file only ever `Read`, never `Write`/`Edit`) rather than a diff. **Recommend initializing git before Phase 0** so this question has a mechanical answer going forward.
- [ ] **Any upstream patch is separately reviewed.** Confirm none of the 12 files in `proposed-upstream-patches/` were applied to any base-skill file.
- [ ] **Before Phase 0 begins, confirm the Dashboard Documentation Pack (`webdesk-dashboard-documentation-v1/`, 12 files + README) is present in the Phase 0 workspace at the path this profile's knowledge files reference.** It is intentionally not bundled inside this skill-overlay export (it's a separately-versioned input, not this build's output) — but Phase 0 cannot proceed without it actually present at that path.

---

## What is explicitly NOT required for this approval

- Setup-time inputs tracked in `docs/skill-build/unresolved-items.md §A` (Postgres provider, repo URLs, Vercel project IDs, SMTP credentials, operational contacts, complete Service/SEO Library data, malware-scanning provider) — by design.
- Complete, full Service and SEO Library data — the workbook itself is now registered (`canonical-inputs/WebDesk_Service_SEO_Library_Templates_v4.xlsm`, Under Review), but it's still advisory sample/import structure per WDS-014, not the complete production dataset.
- None of the 12 `proposed-upstream-patches/` require acceptance — independent of this project's own path forward.
- The one "Still Blocked" item in `gap-resolution-matrix.md` (formal threat modelling) — correctly scoped to Phase 0's Architect role.

---

## Sign-off

| Role | Name | Decision | Date |
|---|---|---|---|
| Reviewer (Tech Lead / Architect) | | ☐ Approved ☐ Changes requested | |
| PM | | ☐ Approved ☐ Changes requested | |

**On approval:** the next task is **Phase 0 only** — project state, architecture ADRs, integration contracts, repository plan. Not the full application. Not a scaffold. See `docs/skill-build/project-skill-build-report.md §10`.
