#!/usr/bin/env python3
"""Root-level validator for the WebDesk Growth Dashboard review/export package.

Checks the *package as a whole* (manifest accuracy, hygiene, canonical-input
presence) — distinct from tools/validate-all.py, which checks the project
profile itself. Run both; neither substitutes for the other.

Usage: python3 validate-package.py [package_root]
  package_root defaults to this script's own directory, since the script is
  meant to sit at the package root (see PACKAGE_MANIFEST.txt).

Exit code 0 only if every check PASSes. SKIP is a distinct, non-failing result
used when a check genuinely cannot run in the current install shape (documented
inline at the point it's used, if it's ever needed).
"""

from __future__ import annotations

import re
import sys
from pathlib import Path

RESULTS: list[tuple[str, str, str]] = []


def record(name: str, status: str, detail: str = "") -> None:
    RESULTS.append((name, status, detail))


def iter_actual_files(root: Path) -> list[Path]:
    return sorted(
        p for p in root.rglob("*")
        if p.is_file() and p.name != ".DS_Store" and "__MACOSX" not in p.parts
    )


def check_package_manifest(root: Path) -> None:
    manifest_path = root / "PACKAGE_MANIFEST.txt"
    if not manifest_path.exists():
        record("PACKAGE_MANIFEST.txt present", "FAIL", "File does not exist at package root.")
        return

    text = manifest_path.read_text(encoding="utf-8")
    listed = set()
    for line in text.splitlines():
        line = line.strip()
        if line.startswith("./"):
            listed.add(line[2:])

    actual = {
        str(p.relative_to(root)) for p in iter_actual_files(root)
    }

    missing_from_disk = sorted(listed - actual)
    missing_from_manifest = sorted(actual - listed)

    if missing_from_disk or missing_from_manifest:
        detail_lines = []
        if missing_from_disk:
            detail_lines.append(f"{len(missing_from_disk)} manifest-listed path(s) not found on disk, e.g.: " + ", ".join(missing_from_disk[:5]))
        if missing_from_manifest:
            detail_lines.append(f"{len(missing_from_manifest)} actual file(s) not listed in the manifest, e.g.: " + ", ".join(missing_from_manifest[:5]))
        record("PACKAGE_MANIFEST.txt matches actual package", "FAIL", " | ".join(detail_lines))
    else:
        record("PACKAGE_MANIFEST.txt matches actual package", "PASS", f"{len(actual)} files match exactly.")


def check_profile_manifest(root: Path) -> None:
    profile_dir = root / "skills" / "nodejs" / "projects" / "custom-app-build" / "profiles" / "webdesk-growth-dashboard"
    manifest_path = profile_dir / "MANIFEST.txt"
    if not profile_dir.exists():
        record("Profile MANIFEST.txt matches profile files", "FAIL", f"Profile directory not found: {profile_dir.relative_to(root) if profile_dir.is_relative_to(root) else profile_dir}")
        return
    if not manifest_path.exists():
        record("Profile MANIFEST.txt matches profile files", "FAIL", "Profile MANIFEST.txt does not exist.")
        return

    text = manifest_path.read_text(encoding="utf-8")
    listed = set()
    for line in text.splitlines():
        line = line.strip()
        if line.startswith("./"):
            listed.add(line[2:])

    actual = {
        str(p.relative_to(profile_dir)) for p in iter_actual_files(profile_dir)
    }

    missing_from_disk = sorted(listed - actual)
    missing_from_manifest = sorted(actual - listed)

    if missing_from_disk or missing_from_manifest:
        detail_lines = []
        if missing_from_disk:
            detail_lines.append(f"{len(missing_from_disk)} listed but not on disk: " + ", ".join(missing_from_disk[:5]))
        if missing_from_manifest:
            detail_lines.append(f"{len(missing_from_manifest)} on disk but not listed: " + ", ".join(missing_from_manifest[:5]))
        record("Profile MANIFEST.txt matches profile files", "FAIL", " | ".join(detail_lines))
    else:
        record("Profile MANIFEST.txt matches profile files", "PASS", f"{len(actual)} files match exactly (scoped to the profile only).")


def check_no_ds_store_macosx(root: Path) -> None:
    hits = [p for p in root.rglob("*") if p.name == ".DS_Store"]
    hits += [p for p in root.rglob("__MACOSX") if p.is_dir()]
    if hits:
        record("No .DS_Store / __MACOSX", "FAIL", f"{len(hits)} found, e.g.: {hits[0].relative_to(root)}")
    else:
        record("No .DS_Store / __MACOSX", "PASS")


def check_no_local_settings(root: Path) -> None:
    hits = [p for p in root.rglob("settings.local.json")]
    if hits:
        record("No local Claude settings (settings.local.json)", "FAIL", f"{len(hits)} found, e.g.: {hits[0].relative_to(root)}")
    else:
        record("No local Claude settings (settings.local.json)", "PASS")


def check_workbook_present(root: Path) -> None:
    hits = list((root / "canonical-inputs").glob("WebDesk_Service_SEO_Library_Templates*")) if (root / "canonical-inputs").exists() else []
    if not hits:
        record("Service/SEO workbook present", "FAIL", "No WebDesk_Service_SEO_Library_Templates* file under canonical-inputs/.")
    else:
        record("Service/SEO workbook present", "PASS", f"Found: {hits[0].name}")


def check_wordpress_source(root: Path) -> None:
    md_path = root / "canonical-inputs" / "Current_WordPress_Technical_Discovery.md"
    if not md_path.exists():
        record("WordPress discovery Markdown source present", "FAIL", "canonical-inputs/Current_WordPress_Technical_Discovery.md not found.")
        return
    record("WordPress discovery Markdown source present", "PASS")

    stray_pdfs = list((root / "canonical-inputs").glob("*.pdf")) if (root / "canonical-inputs").exists() else []
    if stray_pdfs:
        record("No stray WordPress-discovery PDF bundled", "FAIL", f"Found: {', '.join(p.name for p in stray_pdfs)}")
    else:
        record("No stray WordPress-discovery PDF bundled", "PASS")


def check_owner_clarifications(root: Path) -> None:
    path = root / "canonical-inputs" / "Owner_Clarifications_2026-08-05.md"
    if not path.exists():
        record("Owner Clarifications file present", "FAIL", "canonical-inputs/Owner_Clarifications_2026-08-05.md not found.")
    else:
        record("Owner Clarifications file present", "PASS")


def check_top_level_dirs(root: Path) -> None:
    required = ["docs/implementation", "docs/skill-build", "proposed-upstream-patches", "canonical-inputs"]
    missing = [d for d in required if not (root / d).is_dir()]
    if missing:
        record("Required top-level directories present", "FAIL", f"Missing: {', '.join(missing)}")
    else:
        record("Required top-level directories present", "PASS", ", ".join(required))


def check_no_secrets(root: Path) -> None:
    secret_pattern = re.compile(
        r"(sk-[A-Za-z0-9]{20,}|AKIA[0-9A-Z]{16}|-----BEGIN [A-Z ]*PRIVATE KEY-----|ghp_[A-Za-z0-9]{30,})"
    )
    hits = []
    for p in iter_actual_files(root):
        if p.suffix.lower() in (".md", ".json", ".txt", ".example"):
            try:
                text = p.read_text(encoding="utf-8", errors="ignore")
            except Exception:
                continue
            if secret_pattern.search(text):
                hits.append(p)
    if hits:
        record("No secret-looking values", "FAIL", f"{len(hits)} file(s) matched a secret-like pattern, e.g.: {hits[0].relative_to(root)}")
    else:
        record("No secret-looking values", "PASS")


def main() -> int:
    root = Path(sys.argv[1]).resolve() if len(sys.argv) > 1 else Path(__file__).resolve().parent

    print(f"Validating package at: {root}\n")

    check_package_manifest(root)
    check_profile_manifest(root)
    check_no_ds_store_macosx(root)
    check_no_local_settings(root)
    check_workbook_present(root)
    check_wordpress_source(root)
    check_owner_clarifications(root)
    check_top_level_dirs(root)
    check_no_secrets(root)

    passed = failed = skipped = 0
    for name, status, detail in RESULTS:
        tag = {"PASS": "[PASS]", "FAIL": "[FAIL]", "SKIP": "[SKIP]"}[status]
        print(f"{tag} {name}")
        if detail:
            print(f"       {detail}")
        if status == "PASS":
            passed += 1
        elif status == "FAIL":
            failed += 1
        else:
            skipped += 1

    total = len(RESULTS)
    print()
    if skipped:
        print(f"{passed}/{total} checks passed, {skipped} skipped, {failed} failed.")
    else:
        print(f"{passed}/{total} checks passed.")

    if failed:
        print("\nFAILED CHECKS:")
        for name, status, detail in RESULTS:
            if status == "FAIL":
                print(f"  - {name}: {detail}")

    return 1 if failed else 0


if __name__ == "__main__":
    raise SystemExit(main())
