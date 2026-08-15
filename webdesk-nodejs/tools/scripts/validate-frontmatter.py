#!/usr/bin/env python3
"""Validate frontmatter + tier size caps across the WebDesk Node.js skill tree.

Rules (per _spine/shared-knowledge/CONVENTIONS.md):
- Every SKILL.md needs: name, description, version, tier, load_when, tools, model
- Every other *.md under skills/ needs: tier, load_when
- tier in {0,1,2,3}
- tier 0 must have load_when containing "always"
- size caps: tier0 < 15KB, tier1 < 25KB, tier2 < 50KB (tier3 uncapped)

Usage: python3 validate-frontmatter.py [skills_root]
Exits nonzero if any violation is found.
"""
import os
import sys
import re

CAPS = {0: 15 * 1024, 1: 25 * 1024, 2: 50 * 1024}
SKILL_KEYS = ["name", "description", "version", "tier", "load_when", "tools", "model"]
KB_KEYS = ["tier", "load_when"]


def parse_frontmatter(text):
    """Return dict of top-level frontmatter keys, or None if no frontmatter block."""
    if not text.startswith("---"):
        return None
    end = text.find("\n---", 3)
    if end == -1:
        return None
    block = text[3:end].strip("\n")
    data = {}
    for line in block.splitlines():
        m = re.match(r"^([A-Za-z_][A-Za-z0-9_]*):\s*(.*)$", line)
        if m:
            data[m.group(1)] = m.group(2).strip()
    return data


def parse_load_when(raw):
    return re.findall(r'"([^"]+)"|\'([^\']+)\'|([A-Za-z0-9_\-]+)', raw or "")


def main():
    root = sys.argv[1] if len(sys.argv) > 1 else os.path.join(os.path.dirname(__file__), "..", "..", "skills")
    root = os.path.abspath(root)
    if not os.path.isdir(root):
        print(f"ERROR: skills root not found: {root}")
        return 2

    violations = []
    checked = 0
    for dirpath, _, files in os.walk(root):
        for fn in files:
            if not fn.endswith(".md"):
                continue
            path = os.path.join(dirpath, fn)
            rel = os.path.relpath(path, root)
            with open(path, encoding="utf-8") as fh:
                text = fh.read()
            checked += 1
            fm = parse_frontmatter(text)
            if fm is None:
                violations.append(f"{rel}: missing frontmatter block")
                continue

            required = SKILL_KEYS if fn == "SKILL.md" else KB_KEYS
            for key in required:
                if key not in fm:
                    violations.append(f"{rel}: missing required key '{key}'")

            tier = None
            if "tier" in fm:
                try:
                    tier = int(fm["tier"])
                    if tier not in (0, 1, 2, 3):
                        violations.append(f"{rel}: tier {tier} not in 0..3")
                except ValueError:
                    violations.append(f"{rel}: tier '{fm['tier']}' is not an integer")

            if tier == 0:
                tags = [t for grp in parse_load_when(fm.get("load_when", "")) for t in grp if t]
                if "always" not in tags:
                    violations.append(f"{rel}: tier 0 must have load_when containing 'always'")

            if tier in CAPS:
                size = os.path.getsize(path)
                if size >= CAPS[tier]:
                    violations.append(
                        f"{rel}: size {size}B exceeds tier {tier} cap {CAPS[tier]}B — split it"
                    )

    print(f"Checked {checked} markdown files under {root}")
    if violations:
        print(f"\n{len(violations)} violation(s):")
        for v in violations:
            print(f"  - {v}")
        return 1
    print("All frontmatter + size checks passed.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
