---
tier: 2
load_when: ["webdesk-growth-dashboard", "skill-verification"]
description: "Structural validation checks for this profile — frontmatter, manifest completeness, broken links, size caps. Superseded (2026-08-05 remediation) by tools/validate-all.py as the single executable command; this file documents what that script's structural checks do and why."
---

# Profile Validation

> Structural checks — "is this profile well-formed," not "is this profile correct" (that's `scenario-tests.md` and `precedence-tests.md`). **As of the 2026-08-05 remediation, run `python3 ../tools/validate-all.py` from this directory — it is the single executable command covering every check below plus everything in `scenario-tests.md`'s forbidden-content sweep and `routing-validation.md`'s loading-contract check.** The sections below document what each of its structural checks does; they are no longer separate manual command sequences to run one at a time.

---

## 1. Frontmatter and tier-size caps

`tools/validate-all.py`'s first check shells out to the base skill's own unmodified `tools/scripts/validate-frontmatter.py`, run against the whole `skills/` tree. Enforces, per `_spine/shared-knowledge/CONVENTIONS.md §1–2`: every `SKILL.md` has `name/description/version/tier/load_when/tools/model`; every other knowledge `.md` has `tier/load_when`; tier ∈ {0,1,2,3}; tier-0 files declare `"always"`; size caps per tier (15KB/25KB/50KB for tiers 0/1/2).

**Known adjustment made during the initial build:** `README.md` and `CHANGELOG.md` initially had no frontmatter. Both were given `tier: 3, load_when: ["never"]` frontmatter (the same pattern as the base skill's `_decisions/decision-inventory.md`) to pass validation without changing their actual role.

## 2. Manifest completeness

`tools/validate-all.py`'s manifest check computes the actual file set with `pathlib.Path.rglob` and compares it against `MANIFEST.txt`'s own listed lines directly — no shell `find`/`sed`/`diff` pipeline, which is what caused the previous version's path-prefix bug (`sed 's/^/.\//'` on lines that already started with `./`, producing `././file` and never matching anything). `MANIFEST.txt` is regenerated whenever a file is added or removed; a mismatch means it wasn't.

## 3. No .DS_Store / platform metadata

Checked directly in `tools/validate-all.py` — fails if any `.DS_Store` file or `__MACOSX` path segment exists anywhere in the profile tree. Two `.DS_Store` files (created by Finder browsing, not by any write this profile performed) were found and removed during the 2026-08-05 remediation.

## 4. No broken relative links

Same regex-based markdown-link check as before, now inside `tools/validate-all.py`. This profile deliberately uses **path references in prose** (backtick-quoted paths) far more than markdown link syntax `[text](path)`, per `knowledge/00-scope-and-precedence.md §4`'s "referenced, not duplicated" rule — so this check has limited surface area by design. Where markdown link syntax _is_ used, it must resolve.

## 5. No duplicate rule IDs

Same regex extraction of `## WDS-\d+` headings, now inside `tools/validate-all.py`, asserting uniqueness.

## 6. Required files present

New in the 2026-08-05 remediation — `tools/validate-all.py` explicitly checks for the presence of all 16 numbered `knowledge/*.md` files, all four `integrations/*/` directories, and the `contracts/`, `templates/`, `tests/`, `tools/` directories, independent of the manifest check (so a manifest that was itself edited incorrectly wouldn't silently mask a missing required file).

## 7. Packaging note (for exporting this profile elsewhere)

Any export/zip of this work for external review must include **all three** top-level pieces, not just the profile directory: `skills/nodejs/projects/custom-app-build/profiles/webdesk-growth-dashboard/`, `proposed-upstream-patches/`, and `docs/skill-build/`. A prior export apparently included only the first, which meant an external reviewer could not check the gap-resolution matrix, validation report, or approval checklist against the actual repository — those aren't separate from the profile, they're the accompanying record of it.

---

## Results

See `docs/skill-build/validation-report.md` for the actual run output — captured directly from running `tools/validate-all.py`, not narrated.
