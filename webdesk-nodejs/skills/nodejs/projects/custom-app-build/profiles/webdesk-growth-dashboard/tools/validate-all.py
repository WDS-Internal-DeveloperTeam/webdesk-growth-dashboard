#!/usr/bin/env python3
"""ONE executable command running every check listed in the skill-build task's
verification checklist. Prints PASS/FAIL per check plus a final summary; exits
nonzero if anything failed. Its exact output is what docs/skill-build/
validation-report.md records — this script is the source of truth for that
report, not the other way around.

Design principle fixed during the 2026-08-05 remediation (see
docs/skill-build/validation-report.md "Fixed" section): forbidden-term
scanning is split by file role, not applied uniformly to every *.md file.
  - Structural/data files (contracts/*.json, templates/*.example) get a
    STRICT NEGATIVE scan — these must never contain a forbidden term as an
    actual configured value, and legitimately never do, so zero exceptions
    are needed.
  - Policy prose (knowledge/*.md, integrations/*/*.md, SKILL.md, README.md,
    CHANGELOG.md) is checked for RULE PRESENCE — does the required WDS-xxx
    rule exist and is it well-formed — never scanned for term ABSENCE, because
    correctly stating "never use X" necessarily contains the word X.
  - tests/*.md is EXCLUDED from literal forbidden-term scanning entirely, by
    design: its entire purpose is to describe anti-patterns as teaching
    content (e.g. "a task tries to add ACF... must be caught"), which no
    heuristic can reliably distinguish from a real violation by pattern-
    matching alone. tests/*.md is still checked for frontmatter validity and
    file-reference correctness like every other file.

Usage: python3 validate-all.py
(No arguments; always runs against this profile's own tree.)

Two distinct install shapes, detected automatically (added 2026-08-05, second
remediation pass — a lightweight review-package export was found to legitimately
lack two checks' prerequisites, which is NOT a profile defect and must not be
reported as one):
  - FULL install: this profile sits inside a complete `webdesk-nodejs/skills/`
    checkout (the real Phase-0 installation shape). All 14 checks run.
  - STANDALONE package: this profile was exported on its own (e.g. the
    package-root/{skills/...,docs/,canonical-inputs/,proposed-upstream-patches/}
    review-package shape) without the surrounding ~150-file base skill. Two
    checks that structurally require the base skill's own files (the
    frontmatter validator script, the base project-json.schema.json) cannot
    run at all in this shape — they are reported as SKIP, with an explanation,
    never as a silent FAIL that would misrepresent a packaging fact as a
    profile defect. SKIP does not affect the exit code; only FAIL does.
"""
from __future__ import annotations

import json
import re
import subprocess
import sys
from pathlib import Path

TOOLS_DIR = Path(__file__).resolve().parent
PROFILE_ROOT = TOOLS_DIR.parent
SKILLS_ROOT = PROFILE_ROOT.parents[4]  # .../skills, IF a full base-skill checkout surrounds this profile
WEBDESK_NODEJS_ROOT = SKILLS_ROOT.parent  # .../webdesk-nodejs, same condition

BASE_SKILL_PRESENT = (
    (WEBDESK_NODEJS_ROOT / "tools" / "scripts" / "validate-frontmatter.py").exists()
    and (SKILLS_ROOT / "_contracts" / "project-json.schema.json").exists()
)

RESULTS: list[tuple[str, str, str]] = []  # (name, status, detail) — status in {PASS, FAIL, SKIP}


def record(name: str, status, detail: str = "") -> None:
    # Accept either a bool (legacy call sites: True/False -> PASS/FAIL) or an
    # explicit status string ("PASS" | "FAIL" | "SKIP").
    if isinstance(status, bool):
        status = "PASS" if status else "FAIL"
    RESULTS.append((name, status, detail))
    print(f"[{status}] {name}")
    if detail:
        for line in detail.splitlines():
            print(f"       {line}")


def read_text(path: Path) -> str:
    return path.read_text(encoding="utf-8")


def all_profile_files(pattern: str = "*") -> list[Path]:
    return [p for p in PROFILE_ROOT.rglob(pattern) if p.is_file()]


# ---------------------------------------------------------------------------
# 1. Frontmatter and file-size limits — reuse the base skill's own script
# ---------------------------------------------------------------------------

def _local_frontmatter_check(root: Path) -> list[str]:
    """Self-contained re-implementation of the base skill's own frontmatter/
    tier/size rule (CONVENTIONS.md §1-2), scoped to `root`. Used as a fallback
    when the base skill's own tools/scripts/validate-frontmatter.py isn't
    present to run (a standalone package export) — same rule, no external
    dependency, so this check never has to SKIP. Does not replace the base
    script when it IS available (that remains the authoritative run against
    the full skills/ tree, catching regressions elsewhere in the base skill
    too, which this profile-scoped fallback cannot see)."""
    caps = {0: 15 * 1024, 1: 25 * 1024, 2: 50 * 1024}
    violations = []
    for p in root.rglob("*.md"):
        text = read_text(p)
        if not text.startswith("---"):
            violations.append(f"{p.relative_to(root)}: missing frontmatter block")
            continue
        end = text.find("\n---", 3)
        if end == -1:
            violations.append(f"{p.relative_to(root)}: missing frontmatter block")
            continue
        block = text[3:end]
        fm = {}
        for line in block.strip("\n").splitlines():
            m = re.match(r"^([A-Za-z_][A-Za-z0-9_]*):\s*(.*)$", line)
            if m:
                fm[m.group(1)] = m.group(2).strip()
        required = ["name", "description", "version", "tier", "load_when", "tools", "model"] if p.name == "SKILL.md" else ["tier", "load_when"]
        for key in required:
            if key not in fm:
                violations.append(f"{p.relative_to(root)}: missing required key '{key}'")
        tier = None
        if "tier" in fm:
            try:
                tier = int(fm["tier"])
                if tier not in (0, 1, 2, 3):
                    violations.append(f"{p.relative_to(root)}: tier {tier} not in 0..3")
            except ValueError:
                violations.append(f"{p.relative_to(root)}: tier {fm['tier']!r} is not an integer")
        if tier == 0 and "always" not in fm.get("load_when", ""):
            violations.append(f"{p.relative_to(root)}: tier 0 must have load_when containing 'always'")
        if tier in caps and p.stat().st_size >= caps[tier]:
            violations.append(f"{p.relative_to(root)}: size exceeds tier {tier} cap {caps[tier]}B")
    return violations


def check_frontmatter() -> None:
    name = "Frontmatter and file-size limits"
    if BASE_SKILL_PRESENT:
        script = WEBDESK_NODEJS_ROOT / "tools" / "scripts" / "validate-frontmatter.py"
        result = subprocess.run(
            [sys.executable, str(script), str(SKILLS_ROOT)],
            capture_output=True, text=True,
        )
        passed = result.returncode == 0
        record(
            f"{name} (full: base skill's validate-frontmatter.py against the whole skills/ tree)",
            passed,
            result.stdout.strip().splitlines()[-1] if result.stdout.strip() else result.stderr.strip(),
        )
        return
    # Standalone package: no base skill present to shell out to. Run the same
    # rule locally, scoped to this profile only, rather than skipping.
    violations = _local_frontmatter_check(PROFILE_ROOT)
    record(
        f"{name} (standalone fallback: same CONVENTIONS.md §1-2 rule, self-contained, "
        f"scoped to this profile only — base skill not present to run the full-tree check)",
        len(violations) == 0,
        "\n".join(violations) if violations else f"{sum(1 for _ in PROFILE_ROOT.rglob('*.md'))} profile markdown files checked, 0 violations.",
    )


# ---------------------------------------------------------------------------
# 2. Manifest completeness (fixed — no path-prefix bug)
# ---------------------------------------------------------------------------

def check_manifest() -> None:
    manifest_path = PROFILE_ROOT / "MANIFEST.txt"
    manifest_files = set()
    for line in read_text(manifest_path).splitlines():
        line = line.strip()
        if line.startswith("./"):
            manifest_files.add(line)
    actual_files = {
        f"./{p.relative_to(PROFILE_ROOT).as_posix()}"
        for p in all_profile_files()
    }
    missing_from_manifest = actual_files - manifest_files
    missing_from_disk = manifest_files - actual_files
    passed = not missing_from_manifest and not missing_from_disk
    detail_lines = []
    if missing_from_manifest:
        detail_lines.append(f"On disk but not in MANIFEST.txt: {sorted(missing_from_manifest)}")
    if missing_from_disk:
        detail_lines.append(f"In MANIFEST.txt but not on disk: {sorted(missing_from_disk)}")
    if passed:
        detail_lines.append(f"{len(actual_files)} files match exactly.")
    record("Manifest completeness (MANIFEST.txt == actual file tree)", passed, "\n".join(detail_lines))


# ---------------------------------------------------------------------------
# 3. No .DS_Store or platform metadata files
# ---------------------------------------------------------------------------

def check_no_platform_metadata() -> None:
    hits = [p for p in all_profile_files() if p.name in (".DS_Store",) or "__MACOSX" in p.parts]
    record("No .DS_Store / __MACOSX files", len(hits) == 0, f"Found: {hits}" if hits else "")


# ---------------------------------------------------------------------------
# 4/5/6. JSON syntax, JSON Schema validity, project example validation
# ---------------------------------------------------------------------------

def check_json_syntax() -> None:
    bad = []
    for p in all_profile_files("*.json"):
        try:
            json.loads(read_text(p))
        except json.JSONDecodeError as e:
            bad.append(f"{p.relative_to(PROFILE_ROOT)}: {e}")
    for p in all_profile_files("*.example"):
        if p.suffix == ".example" and "json" in p.name.lower() or p.name.endswith(".json.example"):
            try:
                json.loads(read_text(p))
            except json.JSONDecodeError as e:
                bad.append(f"{p.relative_to(PROFILE_ROOT)}: {e}")
    record("JSON syntax valid (all *.json, *.json.example)", len(bad) == 0, "\n".join(bad))


def check_schema_validation() -> None:
    name = "Project example validates against patched schema (tools/validate-project-profile.py)"
    script = TOOLS_DIR / "validate-project-profile.py"
    result = subprocess.run([sys.executable, str(script)], capture_output=True, text=True)
    output_tail = result.stdout.strip().splitlines()[-1] if result.stdout.strip() else result.stderr.strip()
    if result.returncode == 2:
        # Exit code 2 is validate-project-profile.py's own explicit signal for
        # "base schema not found at the expected relative path" — genuinely
        # inapplicable in a standalone package (no _contracts/ present to
        # validate against), not a defect in the example or the patch spec.
        record(
            name, "SKIP",
            "Base schema not present at this install location (standalone package export — "
            "see docs/skill-build/project-skill-build-report.md's package layout). This check "
            "validates the project.json example against the REAL base schema plus documented "
            "patches; it cannot meaningfully run without that real schema present, and "
            "deliberately does not fall back to a bundled copy that could silently drift from "
            "the actual base skill. Re-run inside a full base-skill install for this check.",
        )
        return
    record(name, result.returncode == 0, output_tail)


# ---------------------------------------------------------------------------
# 7. Profile loading contract (CLAUDE.md.template as the reference — see note)
# ---------------------------------------------------------------------------

def check_loading_contract() -> None:
    full_text = read_text(PROFILE_ROOT / "templates" / "CLAUDE.md.template")
    # Scope the ordering check to the fenced ```markdown block (the actual routing
    # list) — the file's own prose ABOVE that block (explaining why the mechanism
    # works) legitimately mentions the profile path earlier in reading order than
    # the base custom-app-build path appears inside the routing list itself, which
    # would otherwise produce a false ordering failure.
    fence_start = full_text.find("```markdown")
    fence_end = full_text.find("```", fence_start + len("```markdown"))
    claude_md = full_text[fence_start:fence_end] if fence_start != -1 and fence_end != -1 else full_text
    checks = {
        "project_type: custom-app-build present": "custom-app-build" in claude_md,
        "project_profile: webdesk-growth-dashboard present": "webdesk-growth-dashboard" in claude_md,
        "custom-app-build SKILL.md path present": "nodejs/projects/custom-app-build/SKILL.md" in claude_md,
        "profile SKILL.md path present": "nodejs/projects/custom-app-build/profiles/webdesk-growth-dashboard/SKILL.md" in claude_md,
        "excluded-integrations statement present": "bigcommerce,shopify,erp" in claude_md,
    }
    base_idx = claude_md.find("nodejs/projects/custom-app-build/SKILL.md")
    profile_idx = claude_md.find("nodejs/projects/custom-app-build/profiles/webdesk-growth-dashboard/SKILL.md")
    integration_idx = claude_md.find("integrations/github")
    checks["ordering: custom-app-build SKILL.md before profile SKILL.md"] = 0 <= base_idx < profile_idx
    checks["ordering: profile SKILL.md before integration modules"] = 0 <= profile_idx < integration_idx if integration_idx >= 0 else False

    failed = [name for name, ok in checks.items() if not ok]
    record(
        "Profile loading contract (checked against templates/CLAUDE.md.template — "
        "no real project CLAUDE.md exists yet pre-Phase-0, so the template is the "
        "reference implementation; re-run this same check against the real file once created)",
        len(failed) == 0,
        "Failed sub-checks: " + ", ".join(failed) if failed else f"All {len(checks)} sub-checks passed.",
    )


# ---------------------------------------------------------------------------
# 8. Relative file references (backtick-quoted paths resolve)
# ---------------------------------------------------------------------------

def check_relative_references() -> None:
    broken = []
    link_pattern = re.compile(r"\]\((\.\./|\./)[^)\s]+\)")
    for p in all_profile_files("*.md"):
        text = read_text(p)
        for match in link_pattern.finditer(text):
            target = match.group(0)[2:-1]
            resolved = (p.parent / target).resolve()
            if not resolved.exists():
                broken.append(f"{p.relative_to(PROFILE_ROOT)} -> {target}")
    record("No broken markdown-syntax relative links", len(broken) == 0, "\n".join(broken))


# ---------------------------------------------------------------------------
# 9. Required files present
# ---------------------------------------------------------------------------

REQUIRED_TOP_LEVEL = [
    "SKILL.md", "README.md", "MANIFEST.txt", "CHANGELOG.md",
]
REQUIRED_KNOWLEDGE = [f"{i:02d}-" for i in range(16)]  # 00.. through 15..


def check_required_files() -> None:
    missing = []
    for f in REQUIRED_TOP_LEVEL:
        if not (PROFILE_ROOT / f).exists():
            missing.append(f)
    knowledge_files = {p.name for p in (PROFILE_ROOT / "knowledge").glob("*.md")}
    for prefix in REQUIRED_KNOWLEDGE:
        if not any(name.startswith(prefix) for name in knowledge_files):
            missing.append(f"knowledge/{prefix}*.md")
    for d in ["github", "wordpress", "google-workspace", "vercel"]:
        if not (PROFILE_ROOT / "integrations" / d).is_dir():
            missing.append(f"integrations/{d}/")
    for d in ["contracts", "templates", "tests", "tools"]:
        if not (PROFILE_ROOT / d).is_dir():
            missing.append(f"{d}/")
    record("Required files/directories present", len(missing) == 0, "\n".join(missing))


# ---------------------------------------------------------------------------
# 10. Duplicate rule IDs
# ---------------------------------------------------------------------------

def check_duplicate_rule_ids() -> None:
    text = read_text(PROFILE_ROOT / "knowledge" / "15-project-specific-forbidden-actions.md")
    ids = re.findall(r"^## (WDS-\d+)", text, re.MULTILINE)
    dupes = {i for i in ids if ids.count(i) > 1}
    record("No duplicate WDS-xxx rule IDs", len(dupes) == 0, f"{len(ids)} rules found; dupes: {dupes}" if dupes else f"{len(ids)} unique rules.")


# ---------------------------------------------------------------------------
# 11/12. No secret values, no pricing data — structural files + full sweep
#         (these never had the fixture-collision problem, so they still scan
#         everything; only the ACF/Neon/Resend/etc. category below is split)
# ---------------------------------------------------------------------------

SECRET_PATTERNS = re.compile(
    r"sk_live_|sk_test_|AKIA[0-9A-Z]{16}|ghp_[0-9A-Za-z]{36}|-----BEGIN (RSA )?PRIVATE KEY-----"
)
PRICING_PATTERN = re.compile(r"\$[0-9]+(,[0-9]{3})*(\.[0-9]{2})?\s*(/|\bper\b)|price list|pricing tier", re.IGNORECASE)


def check_no_secrets_and_pricing() -> None:
    secret_hits, pricing_hits = [], []
    for p in all_profile_files("*.md"):
        # tools/validate-all.py itself and any file whose job is to STATE the
        # detection pattern (this file, and the tests/*.md check-definitions)
        # legitimately contain the regex text — exclude by filename, not by
        # guessing at surrounding prose.
        if p.name in ("scenario-tests.md", "validate-all.py"):
            text = read_text(p)
            # still scan for an actual-looking secret value, just not the pattern definition itself
            for line in text.splitlines():
                if "grep" in line or "SECRET_PATTERNS" in line or "PRICING_PATTERN" in line:
                    continue
                if SECRET_PATTERNS.search(line):
                    secret_hits.append(f"{p.name}: {line.strip()[:80]}")
            continue
        text = read_text(p)
        if SECRET_PATTERNS.search(text):
            secret_hits.append(str(p.relative_to(PROFILE_ROOT)))
        if PRICING_PATTERN.search(text):
            pricing_hits.append(str(p.relative_to(PROFILE_ROOT)))
    record("No secret-looking values", len(secret_hits) == 0, "\n".join(secret_hits))
    record("No pricing data", len(pricing_hits) == 0, "\n".join(pricing_hits))


# ---------------------------------------------------------------------------
# 13. Structural negative scan — forbidden terms in DATA files only
# ---------------------------------------------------------------------------

FORBIDDEN_VALUES_IN_DATA = {"acf", "neon", "resend"}
# Keys whose VALUE is commentary/documentation, not configuration — a schema or
# example file legitimately DISCUSSES a forbidden term (e.g. "must never be
# 'neon'") inside these; only values under other keys are actual configuration.
COMMENTARY_KEYS = {"_note", "_comment", "description", "reason", "$comment", "why", "title"}


def _walk_for_forbidden_values(obj, path: str, hits: list[str]) -> None:
    if isinstance(obj, dict):
        for key, value in obj.items():
            if key in COMMENTARY_KEYS:
                continue  # don't inspect documentation-purpose fields at all
            _walk_for_forbidden_values(value, f"{path}.{key}", hits)
    elif isinstance(obj, list):
        for i, item in enumerate(obj):
            _walk_for_forbidden_values(item, f"{path}[{i}]", hits)
    elif isinstance(obj, str):
        if obj.strip().lower() in FORBIDDEN_VALUES_IN_DATA:
            hits.append(f"{path} = {obj!r}")


def check_structural_forbidden_terms() -> None:
    """JSON-structure-aware: only flags a forbidden term when it is an actual
    ASSIGNED VALUE under a non-commentary key (e.g. postgres_marketplace_provider
    = "neon"), never when it merely appears inside a description/comment field
    explaining why that value is excluded — the schema files legitimately
    contain such explanations throughout and a plain text search would treat
    every one of them as a false violation."""
    hits = []
    data_files = list((PROFILE_ROOT / "contracts").glob("*.json")) + list((PROFILE_ROOT / "templates").glob("*.example"))
    for p in data_files:
        try:
            data = json.loads(read_text(p))
        except json.JSONDecodeError:
            continue  # covered by the JSON syntax check separately
        _walk_for_forbidden_values(data, f"{p.relative_to(PROFILE_ROOT)}", hits)
    record(
        "No forbidden terms as actual configured VALUES in data files "
        "(contracts/*.json, templates/*.example — commentary fields like "
        "_note/description/reason are excluded from this scan by design)",
        len(hits) == 0,
        "\n".join(hits),
    )


# ---------------------------------------------------------------------------
# 14. Policy rule PRESENCE checks (not absence — see module docstring)
# ---------------------------------------------------------------------------

REQUIRED_WDS_RULES = {
    "WDS-001": "ACF",
    "WDS-002": "Neon",
    "WDS-003": "India, Singapore",
    "WDS-004": "Resend",
    "WDS-005": "permanent process",
    "WDS-007": "auto-merge",
    "WDS-009": "Anthropic API",
}


def check_policy_rule_presence() -> None:
    text = read_text(PROFILE_ROOT / "knowledge" / "15-project-specific-forbidden-actions.md")
    missing = []
    for rule_id, expect_snippet_word in REQUIRED_WDS_RULES.items():
        if f"## {rule_id}" not in text:
            missing.append(f"{rule_id} heading missing")
            continue
        # crude section slice: from this heading to the next '## '
        start = text.index(f"## {rule_id}")
        end = text.find("\n## ", start + 1)
        section = text[start: end if end != -1 else None]
        for word in expect_snippet_word.split(", "):
            if word.lower() not in section.lower():
                missing.append(f"{rule_id} section does not mention {word!r}")
    record("Required WDS-xxx policy rules present and well-formed", len(missing) == 0, "\n".join(missing))


# ---------------------------------------------------------------------------
# 15. Correct Node 24 runtime / custom-app-build / project_profile / region
# ---------------------------------------------------------------------------

def check_architecture_facts() -> None:
    arch = read_text(PROFILE_ROOT / "knowledge" / "01-approved-architecture.md")
    skill = read_text(PROFILE_ROOT / "SKILL.md")
    checks = {
        "Node.js 24 LTS stated as this project's dashboard runtime": "Node.js 24 LTS" in arch,
        "custom-app-build stated as project_type": "custom-app-build" in skill,
        "webdesk-growth-dashboard stated as project_profile": "webdesk-growth-dashboard" in skill,
        "North America East Coast region policy stated": "North America East Coast" in arch,
    }
    failed = [k for k, v in checks.items() if not v]
    record("Correct architecture facts stated (Node 24, custom-app-build, project_profile, region)", len(failed) == 0, "\n".join(failed))


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------

def main() -> int:
    print(f"Validating profile at: {PROFILE_ROOT}")
    print(f"Install shape: {'FULL (base skill present)' if BASE_SKILL_PRESENT else 'STANDALONE (base skill not present — 2 checks use fallback/skip behavior, see module docstring)'}\n")
    check_frontmatter()
    check_manifest()
    check_no_platform_metadata()
    check_json_syntax()
    check_schema_validation()
    check_loading_contract()
    check_relative_references()
    check_required_files()
    check_duplicate_rule_ids()
    check_no_secrets_and_pricing()
    check_structural_forbidden_terms()
    check_policy_rule_presence()
    check_architecture_facts()

    total = len(RESULTS)
    passed = sum(1 for _, status, _ in RESULTS if status == "PASS")
    failed = sum(1 for _, status, _ in RESULTS if status == "FAIL")
    skipped = sum(1 for _, status, _ in RESULTS if status == "SKIP")
    print(f"\n{passed}/{total} checks passed" + (f", {skipped} skipped (not applicable to this install shape)" if skipped else "") + ".")
    if failed:
        print("FAILED CHECKS:")
        for name, status, detail in RESULTS:
            if status == "FAIL":
                print(f"  - {name}")
        return 1
    if skipped:
        print("SKIPPED CHECKS (not failures — see each one's detail above for why):")
        for name, status, detail in RESULTS:
            if status == "SKIP":
                print(f"  - {name}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
