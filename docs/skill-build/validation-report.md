# Validation Report — WebDesk Growth Dashboard Skill-Overlay Build

**Status:** Rebuilt three times. V1 (2026-08-05) followed an external verification review that found real defects in the prior version of this report (a schema-composition claim that didn't actually work, and narrated "PASS" statements not backed by an executable command). V2 (2026-08-05) followed a second review that found a real, independently-reproduced packaging problem — see "Two install shapes" below. V3 (2026-08-06) followed a third review reporting a 281-file, `webdesk-nodejs/`-prefixed package containing local developer settings — investigated and found **not to match the package this build actually produces** (see "V3: packaging-discrepancy investigation" below) — plus independently-actionable items (the Service/SEO workbook, WordPress source reconciliation, a separate owner-clarification file, a new package-level validator), all completed. **Everything below is the literal output of running the validators, captured directly** — nothing here is summarized, rounded, or reconstructed from memory of what the checks were supposed to do.

---

## V3: packaging-discrepancy investigation (2026-08-06)

A third external review reported the exported package containing **281 files** under a **`webdesk-nodejs/`** top-level prefix, including **`webdesk-nodejs/.claude/settings.local.json`**, and claimed the full base Node.js skill was bundled. None of this matched the package this build's tooling actually produces (verified moments earlier in the same session: 86 files at the time, no `webdesk-nodejs/` prefix, `skills/nodejs/...` at package root, no `.claude/` directory anywhere in the export — re-confirmed by MD5 and a fresh `unzip -l` immediately before this review arrived).

Rather than assume either side was simply wrong, this was tested directly: running the newly-built `validate-package.py` against the **raw `webdesk-nodejs/` working directory** (as opposed to this build's curated export) reproduces the review's exact complaints — `.claude/settings.local.json` present, hundreds of extra files, manifest mismatches — because the raw working directory genuinely contains those things (it's a full base-skill checkout with normal developer-machine artifacts). This is strong evidence the reviewed artifact was a raw zip of the whole working folder, not the package this build's own export tooling produces.

**Put to the project owner directly rather than resolved silently:** keep the export lean (profile + reports + canonical inputs only, matching the shape explicitly specified in the V2 remediation) or bundle the complete base skill under `webdesk-nodejs/` (the shape the V3 review assumed). **Decision: keep it lean.** Reasoning given: matches prior explicit spec; this exact folder has an independently-diagnosed disk-full/broken-iCloud-sync problem (12GB free of 245GB, `brctl status` reporting sync failures), and a much larger bundle increases the risk of the same file-loss problem recurring. `PACKAGE_MANIFEST.txt` now states this decision explicitly.

---

## Two install shapes — fixed in the V2 remediation

The V2 external review reported 12/14 checks passing on an exported review package (vs. 14/14 in a full base-skill install), and attributed this to `docs/implementation/`/`docs/skill-build/` being nested inside the profile directory in their reviewed ZIP. That packaging shape was checked against this build's own filesystem and found **not** to be how this build is actually structured (the profile directory has only ever contained `tools/, contracts/, tests/, integrations/, knowledge/, templates/` — confirmed by `find`). Building and testing a correctly-structured standalone package directly (reports at package root, not nested — exactly matching `docs/skill-build/project-skill-build-report.md`'s layout diagram and this package's own `PACKAGE_MANIFEST.txt`) still reproduced 12/14 — for a **different, independently-discovered reason**: `tools/validate-all.py` and `tools/validate-project-profile.py` had hard dependencies on relative paths reaching into the surrounding base-skill tree (`webdesk-nodejs/tools/scripts/validate-frontmatter.py` and `skills/_contracts/project-json.schema.json`), neither of which exists in a lightweight, profile-only export.

**Fix:** `tools/validate-all.py` now detects which install shape it's running in and behaves accordingly, rather than hard-failing:

- **FULL** (the profile installed inside a real base-skill checkout, base scripts and base schema present) — all 14 checks run for real, exactly as before.
- **STANDALONE** (a package-only export like the one built for this review — see `PACKAGE_MANIFEST.txt` at the export root) — 13 of 14 checks still run for real against this package's own content, using a self-contained fallback implementation of the frontmatter/size rule (`_local_frontmatter_check`, a full re-implementation of `CONVENTIONS.md §1-2`, not a stub). The 1 remaining check (project.json validated against the real, patched base schema) genuinely cannot run without the real base schema present — it **SKIPs**, with an explicit reason printed, rather than reporting a misleading FAIL or silently passing against a bundled copy that could drift from the real schema. `SKIP` is a distinct result from `FAIL` and does not affect the exit code.

Both shapes are demonstrated with real captured output below.

## Other items fixed in the V2 remediation

| Defect found by V2 external review                                                                                                                                                                                                                                               | Fix                                                                                                                                                                                                                                                                                                            |
| -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Packaging: reports and canonical inputs needed to sit at package root, not nested inside the profile, in any export.                                                                                                                                                             | `PACKAGE_MANIFEST.txt` (repository root) now documents and enforces this layout; the profile's own `MANIFEST.txt` stays scoped to only its 51 files, unchanged. The actual exported zip was built and independently re-verified against this layout (see below).                                               |
| ACF current-state language ("confirmed installed," "must migrate," "Technical Debt Register item") needed correcting per a further owner clarification: no confirmed ACF dependency exists; verify once at kickoff; remove-if-found-unused is a cleanup action, not a migration. | Applied as a dated addendum (not a silent edit) across the 9 named files — see `CHANGELOG.md [1.2.0]` and `knowledge/07-wordpress-integration.md` §"ACF conflict — resolved (2026-08-05, in two stages)" for the full record. Original Part 1 discovery content preserved unchanged; the addendum is additive. |
| `SKILL.md` frontmatter `description` wording ("Loaded when...") read as contradicting the routing explanation that no such automatic behavior exists.                                                                                                                            | Reworded to "Intended for projects where... loaded through the project root CLAUDE.md's explicit skill-path list, not automatically by the base orchestrator."                                                                                                                                                 |
| Claim that the WordPress Technical Discovery source was Markdown, not a 15-page PDF.                                                                                                                                                                                             | Not corrected — this build has direct tool-call evidence a PDF was supplied and processed in this session. Documented as a point of respectful disagreement in `CHANGELOG.md [1.2.0]`, not silently applied.                                                                                                   |
| Register "WebDesk_Service_SEO_Library_Templates_v2.xlsx" as newly supplied.                                                                                                                                                                                                      | Not registered — no file by that name was found; two differently-structured, differently-named candidates were found instead and are documented, unregistered, in `docs/skill-build/unresolved-items.md §B3`, pending owner clarification.                                                                     |

---

## Fixed in the V3 remediation (2026-08-06)

| Item from the V3 external review                                                                         | Result                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| -------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Register the newly-supplied Service/SEO workbook.                                                        | Done for real this time — a genuine `v4.xlsm` file was directly supplied. Inspected before registration (17 sheets, confirmed macro-free, sample rows checked for pricing/confidential content — none found). Registered at `canonical-inputs/WebDesk_Service_SEO_Library_Templates_v4.xlsm`, Status: Under Review, per WDS-014. See `knowledge/00-scope-and-precedence.md §4` and `docs/skill-build/unresolved-items.md §D4`.                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| Root package manifest incorrect / package contains 281 files under `webdesk-nodejs/`.                    | Investigated, not silently accepted — see "V3: packaging-discrepancy investigation" above. The actual package (86 files at the time of the claim) did not match the description. `PACKAGE_MANIFEST.txt` regenerated mechanically regardless, now 88 files reflecting this round's additions.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                |
| Remove local Claude settings (`webdesk-nodejs/.claude/settings.local.json`) from the export.             | Confirmed this file was never in any export this build produced (it only ever copies the profile subtree). New `validate-package.py` check added so a regression would be caught mechanically going forward.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                |
| Correct WordPress source provenance; remove the PDF; separate the owner clarification into its own file. | A native Markdown version of the discovery document (Part 1) was directly supplied 2026-08-06 and is now the registered source of record; the PDF is no longer bundled. The earlier PDF-processed content (Round 2 self-review, resolved CaseStudy/Portfolio Q&A) is preserved as Part 2, since none of it is contradicted. **One genuine difference between the two supplied versions was found and preserved transparently, not silently resolved:** the PDF's plugin inventory listed ACF 6.8.6 as active; the new Markdown's does not — documented as a historical note, and read as corroborating rather than contradicting the current-state clarification. The ACF clarification itself moved to a new, separate file, `canonical-inputs/Owner_Clarifications_2026-08-05.md`, per the review's request — no longer an inline addendum inside the discovery document. |
| Add a package-level validator.                                                                           | `validate-package.py` (repository root) — 10 checks: package manifest accuracy, profile manifest accuracy, no `.DS_Store`/`__MACOSX`, no `settings.local.json`, workbook present, WordPress Markdown present with no stray PDF, owner clarification present, required top-level directories present, no secret-looking values.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| Confirm Dashboard Documentation Pack availability before Phase 0.                                        | Not bundled in this export (by design — it's a large, separately-versioned pack, not this build's output) and not silently assumed present either. Recorded as a Phase 0 setup precondition in `docs/skill-build/approval-checklist.md`'s reviewer checklist rather than added to this validator, since it lives outside anything this skill-overlay build produces or controls.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            |

---

## Fixed since the V1 external verification review

| Defect found by external review                                                                                                                                                                                                                                                                                                                                                                                    | Fix                                                                                                                                                                                                                                                                                                                                                                     |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `contracts/project-profile.schema.json` claimed `allOf` + `$ref` composition works against the base schema. It does not — `allOf` is an intersection of constraints, not an override, so the base schema's restrictive `host_target`/`tech_stack.storage` enums could never actually be relaxed that way. `templates/project.json.example` failed real validation (6 errors reproduced independently — see below). | Rewritten as a patch-spec (`base_schema_patches`) applied by a new offline validator, `tools/validate-project-profile.py`, to an in-memory deep copy of the base schema. Base schema file never touched.                                                                                                                                                                |
| `templates/project.json.example` held string placeholders (`"<SETUP-TIME>"` etc.) inside fields typed as integer/number/date-time/email/uri by the base schema.                                                                                                                                                                                                                                                    | Rewritten to be fully type/format-valid; a new `templates/setup-input-checklist.md` tracks which values are still placeholders and what should replace them, separately from the JSON itself.                                                                                                                                                                           |
| Routing documentation implied the base orchestrator auto-loads `project.project_profile`. It does not — that field and that behavior don't exist in the base skill.                                                                                                                                                                                                                                                | `SKILL.md §2`, `templates/CLAUDE.md.template`, and `tests/routing-validation.md` now state plainly that the V1 mechanism is the project's own root `CLAUDE.md` explicitly listing the profile's path — a file-content convention, checked by an executable test, not orchestrator-automatic behavior. Generic auto-routing proposed as upstream patch #11, not applied. |
| The forbidden-content scan grepped all prose (including `tests/scenario-tests.md`'s own worked "must be caught" anti-pattern examples) for literal terms, so the test file reported its own teaching content as a violation.                                                                                                                                                                                       | Redesigned: strict negative term-scanning now runs only over structural/data files (`contracts/*.json`, `templates/*.example`), is JSON-structure-aware (skips `_note`/`description`/`reason` commentary fields, only flags an actual assigned value), and never runs over `tests/*.md` at all. Policy prose is checked for rule _presence_, never term _absence_.      |
| Manifest-diff command in the prior test doc had a path-prefix bug (`sed 's/^/.\//'` on lines already starting with `./`).                                                                                                                                                                                                                                                                                          | `tools/validate-all.py`'s manifest check compares path sets directly in Python, no shell pipeline.                                                                                                                                                                                                                                                                      |
| Two `.DS_Store` files existed inside the profile tree (Finder artifacts, not created by any write this profile performed).                                                                                                                                                                                                                                                                                         | Removed. Check added to the master validator so a regression would be caught.                                                                                                                                                                                                                                                                                           |
| `docs/skill-build/`, `proposed-upstream-patches/`, and the profile itself were apparently not all included together in an export used for external review, so several reports couldn't be checked.                                                                                                                                                                                                                 | Not a defect in what's on disk (confirmed present and correct throughout this remediation) — a packaging note is now explicit in `tests/profile-validation.md §7`: any export must include all three top-level pieces.                                                                                                                                                  |
| `gap-resolution-matrix.md`'s OQ-04 row read as simultaneously "resolved" and "deferred," self-contradictory.                                                                                                                                                                                                                                                                                                       | Reworded — the taxonomy decision is unambiguously resolved; only an unrelated, non-blocking detail (confirming remaining agent batches) was ever open.                                                                                                                                                                                                                  |

---

## Reproduction: the schema bug, confirmed and then fixed

Before rewriting `project.json.example`, the broken version was re-validated to confirm the external review's finding independently rather than taking it on faith:

```
$ python3 tools/validate-project-profile.py   # run against the OLD project.json.example
FAIL — 8 error(s):
  - $.project.client.primary_contact.email: '<SETUP-TIME>' is not a valid email
  - $.project.repository.url: '<SETUP-TIME: real webdesk-growth-dashboard GitHub URL>' is not a valid uri
  - $.project.created_at: '<SETUP-TIME: ISO 8601>' is not a valid date-time
  - $.project.updated_at: '<SETUP-TIME: ISO 8601>' is not a valid date-time
  - $.budget.token_cap: expected type 'integer', got str ('<SETUP-TIME>')
  - $.budget.token_alert_threshold: expected type 'integer', got str ('<SETUP-TIME>')
  - $.budget.hours_budget: expected type 'number', got str ('<SETUP-TIME: from the G1 estimate ticket>')
  - $.budget.cost_estimate_usd: expected type 'number', got str ('<SETUP-TIME>')
```

(8 errors, not 6 — the new validator additionally checks `format: email/uri/date-time`, which the reviewer's tooling may not have. The two `enum` violations the review specifically named, `host_target = "vercel"` and `tech_stack.storage = "vercel-blob"`, did **not** appear here because the patch-application mechanism itself was already correct at this point — only the base-schema-typed placeholder fields were still broken. This confirms the patch mechanism and isolates the actual remaining defect precisely.)

After the rewrite:

```
$ python3 tools/validate-project-profile.py
PASS — instance validates against the patched schema, 0 errors.
```

## Sanity checks — confirming the validators aren't trivially passing

Two deliberate-breakage tests were run and reverted, to confirm neither validator is a tautology:

```
$ python3 -c "... set host_target='neon-was-never-a-host-target', budget.token_cap='not-a-number' ..."
$ python3 validate-project-profile.py /tmp/broken-project.json
FAIL — 2 error(s):
  - $.project.host_target: value 'neon-was-never-a-host-target' not in enum [...]
  - $.budget.token_cap: expected type 'integer', got str ('not-a-number')

$ python3 -c "... set vercel_execution.postgres_marketplace_provider='neon' in project.json.example ..."
$ python3 validate-all.py | grep -A2 "forbidden terms as actual"
[FAIL] No forbidden terms as actual configured VALUES in data files (...)
       templates/project.json.example.vercel_execution.postgres_marketplace_provider = 'neon'
# reverted; re-run confirms 14/14 PASS again
```

Both validators correctly failed on injected defects and correctly passed once reverted.

---

## Full run, FULL install shape — `tools/validate-all.py`, 2026-08-05

Run at the real, intended install path, inside the full base-skill checkout:

```
$ cd webdesk-nodejs/skills/nodejs/projects/custom-app-build/profiles/webdesk-growth-dashboard/tools
$ python3 validate-all.py

Install shape: FULL (base skill present)

[PASS] Frontmatter and file-size limits (base skill's validate-frontmatter.py)
       All frontmatter + size checks passed.
[PASS] Manifest completeness (MANIFEST.txt == actual file tree)
       51 files match exactly.
[PASS] No .DS_Store / __MACOSX files
[PASS] JSON syntax valid (all *.json, *.json.example)
[PASS] Project example validates against patched schema (tools/validate-project-profile.py)
       PASS — instance validates against the patched schema, 0 errors.
[PASS] Profile loading contract (checked against templates/CLAUDE.md.template — no real
       project CLAUDE.md exists yet pre-Phase-0, so the template is the reference
       implementation; re-run this same check against the real file once created)
       All 7 sub-checks passed.
[PASS] No broken markdown-syntax relative links
[PASS] Required files/directories present
[PASS] No duplicate WDS-xxx rule IDs
       14 unique rules.
[PASS] No secret-looking values
[PASS] No pricing data
[PASS] No forbidden terms as actual configured VALUES in data files (contracts/*.json,
       templates/*.example — commentary fields like _note/description/reason are
       excluded from this scan by design)
[PASS] Required WDS-xxx policy rules present and well-formed
[PASS] Correct architecture facts stated (Node 24, custom-app-build, project_profile, region)

14/14 checks passed.
```

Exit code: `0`.

---

## Full run, STANDALONE install shape — the actual exported review package (2026-08-06)

Run from inside `webdesk-growth-dashboard-review-package-2026-08-06.zip`, extracted fresh to a clean directory (not the pre-zip staging copy) — proving the built zip itself, not just a working directory, produces this result. **Two validators now run: the package-level validator first, then the profile validator.**

```
$ unzip webdesk-growth-dashboard-review-package-2026-08-06.zip -d review-package
$ cd review-package
$ python3 validate-package.py .

Validating package at: .../review-package

[PASS] PACKAGE_MANIFEST.txt matches actual package
       88 files match exactly.
[PASS] Profile MANIFEST.txt matches profile files
       51 files match exactly (scoped to the profile only).
[PASS] No .DS_Store / __MACOSX
[PASS] No local Claude settings (settings.local.json)
[PASS] Service/SEO workbook present
       Found: WebDesk_Service_SEO_Library_Templates_v4.xlsm
[PASS] WordPress discovery Markdown source present
[PASS] No stray WordPress-discovery PDF bundled
[PASS] Owner Clarifications file present
[PASS] Required top-level directories present
       docs/implementation, docs/skill-build, proposed-upstream-patches, canonical-inputs
[PASS] No secret-looking values

10/10 checks passed.
```

Exit code: `0`.

```
$ cd review-package/skills/nodejs/projects/custom-app-build/profiles/webdesk-growth-dashboard/tools
$ python3 validate-all.py

Validating profile at: .../review-package/skills/nodejs/projects/custom-app-build/profiles/webdesk-growth-dashboard
Install shape: STANDALONE (base skill not present — 2 checks use fallback/skip behavior, see module docstring)

[PASS] Frontmatter and file-size limits (standalone fallback: same CONVENTIONS.md §1-2 rule,
       self-contained, scoped to this profile only — base skill not present to run the
       full-tree check)
       40 profile markdown files checked, 0 violations.
[PASS] Manifest completeness (MANIFEST.txt == actual file tree)
       51 files match exactly.
[PASS] No .DS_Store / __MACOSX files
[PASS] JSON syntax valid (all *.json, *.json.example)
[SKIP] Project example validates against patched schema (tools/validate-project-profile.py)
       Base schema not present at this install location (standalone package export — see
       docs/skill-build/project-skill-build-report.md's package layout). This check
       validates the project.json example against the REAL base schema plus documented
       patches; it cannot meaningfully run without that real schema present, and
       deliberately does not fall back to a bundled copy that could silently drift from
       the actual base skill. Re-run inside a full base-skill install for this check.
[PASS] Profile loading contract (checked against templates/CLAUDE.md.template — no real
       project CLAUDE.md exists yet pre-Phase-0, so the template is the reference
       implementation; re-run this same check against the real file once created)
       All 7 sub-checks passed.
[PASS] No broken markdown-syntax relative links
[PASS] Required files/directories present
[PASS] No duplicate WDS-xxx rule IDs
       14 unique rules.
[PASS] No secret-looking values
[PASS] No pricing data
[PASS] No forbidden terms as actual configured VALUES in data files (contracts/*.json,
       templates/*.example — commentary fields like _note/description/reason are
       excluded from this scan by design)
[PASS] Required WDS-xxx policy rules present and well-formed
[PASS] Correct architecture facts stated (Node 24, custom-app-build, project_profile, region)

13/14 checks passed, 1 skipped (not applicable to this install shape).
SKIPPED CHECKS (not failures — see each one's detail above for why):
  - Project example validates against patched schema (tools/validate-project-profile.py)
```

Exit code: `0` (not `1` — a SKIP does not fail the run; only a real FAIL would).

Package file count independently verified two ways: `unzip -l` lists 88 non-directory entries, and a fresh `find . -type f` on the extracted contents also counts 88 — matching `PACKAGE_MANIFEST.txt`'s stated total.

---

## Mapping to the skill-build task's §18 checklist

| §18 item                                                                                                                                          | Covered by                                                                                                                         |
| ------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------- |
| Valid YAML frontmatter                                                                                                                            | Check 1                                                                                                                            |
| Complete manifest                                                                                                                                 | Check 2                                                                                                                            |
| No broken relative file references                                                                                                                | Check 7                                                                                                                            |
| No duplicate/conflicting rules                                                                                                                    | Check 9                                                                                                                            |
| No `.DS_Store`/platform metadata                                                                                                                  | Check 3                                                                                                                            |
| JSON syntax                                                                                                                                       | Check 4                                                                                                                            |
| JSON Schema validity + project example validation                                                                                                 | Check 5 (delegates to `validate-project-profile.py`)                                                                               |
| Profile loading contract                                                                                                                          | Check 6                                                                                                                            |
| Required files                                                                                                                                    | Check 8                                                                                                                            |
| No real secret values                                                                                                                             | Check 10                                                                                                                           |
| No pricing data                                                                                                                                   | Check 11                                                                                                                           |
| No unsupported ACF architecture / no Neon / no Resend / no India-Singapore / no permanent-worker / no auto-merge-deploy / no autonomous execution | Check 12 (structural data-file scan) + Check 13 (policy rule presence in `knowledge/15`, covering WDS-001/002/003/004/005/007/009) |
| Correct Node.js 24 runtime, correct `custom-app-build` type, correct `project_profile`, correct North America East Coast requirement              | Check 14                                                                                                                           |

Every item in the task's §18 checklist has a corresponding automated check with real, reproducible output above — none is a narrated claim.

---

## What remains manually reasoned, not mechanically checked

- **Precedence-resolution correctness** (`tests/precedence-tests.md`'s five worked scenarios) — these are reasoning exercises, not greppable facts; they're reviewed by a human reading the scenarios against `knowledge/00-scope-and-precedence.md`, not run as a script.
- **Scenario tests A–D** (`tests/scenario-tests.md`) — worked examples of what an agent should do in specific situations (e.g., catching a proposed BullMQ `Worker` for `dashboard-worker`). These describe expected agent behavior, which isn't independently executable without an actual agent session to test against; they remain manually-reasoned reference scenarios, clearly labeled as such.
- **The ACF conflict resolution itself** — a human decision (project owner, 2026-08-05), not a validator output. See `knowledge/07-wordpress-integration.md` §"ACF conflict — resolved" for the record.

Both of the above are inherently non-mechanical (they involve human/agent judgment, not a checkable fact), unlike the schema and structural issues the external review caught — those genuinely were checkable and are now actually checked.

---

## Overall result

**FULL install shape (profile validator): 14/14 automated checks passed, exit code 0, re-run and reproduced.** **STANDALONE package shape (the actual exported zip, `webdesk-growth-dashboard-review-package-2026-08-06.zip`): package validator 10/10 passed, exit code 0; profile validator 13/14 passed, 1 SKIP (not a failure, explicitly explained), exit code 0 — both re-run and reproduced against the built zip itself, not just a working directory.** Two independent sanity checks confirm the profile validator fails correctly on injected defects. See `docs/skill-build/approval-checklist.md` for what this means for the human-approval gate.
