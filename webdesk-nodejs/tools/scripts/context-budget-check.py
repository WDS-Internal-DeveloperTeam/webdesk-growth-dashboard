#!/usr/bin/env python3
"""Context-budget guard — the automated check for the 200K-error rule.

Given a project_type and integration_targets, list the skill files that WOULD
load at session start (tier 0 + the active agent + the nodejs arm entry + the
project-type SKILL + only the named integration modules) and warn if the
estimated cached-token load exceeds a budget.

This mirrors _spine/shared-knowledge/context-budget.md Rule 1: load by
project_type + integration_targets ONLY.

Usage:
  python3 context-budget-check.py --type integration-middleware \
      --targets bigcommerce erp:ddi-inform [--budget-kb 180] [--root ../../skills]
"""
import argparse
import os
import glob

# rough token estimate: ~4 bytes/token
BYTES_PER_TOKEN = 4
DEFAULT_BUDGET_KB = 180  # generous startup budget; full window is ~200K tokens


def kb(n):
    return f"{n/1024:.1f}KB"


def collect_startup_set(root, project_type, targets):
    files = []

    def add(pattern):
        for p in glob.glob(os.path.join(root, pattern), recursive=True):
            if os.path.isfile(p) and p not in files:
                files.append(p)

    # Tier 0 always-loaded
    add("_spine/persona.md")
    add("_spine/shared-knowledge/CONVENTIONS.md")
    add("_spine/shared-knowledge/context-budget.md")
    add("_spine/shared-knowledge/model-policy.md")
    add("_spine/orchestrator/SKILL.md")

    # nodejs arm entry
    add("nodejs/SKILL.md")

    # active project-type SKILL only
    add(f"nodejs/projects/{project_type}/SKILL.md")

    # only the named integration modules
    for t in targets:
        if t.startswith("erp:"):
            name = t.split(":", 1)[1]
            add(f"nodejs/integrations/erp/{name}.md")
            add("nodejs/integrations/erp/_erp-adapter-pattern.md")
        else:
            # store integration: load its entry files
            add(f"nodejs/integrations/{t}/01-*.md")
    return files


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--type", required=True)
    ap.add_argument("--targets", nargs="*", default=[])
    ap.add_argument("--budget-kb", type=int, default=DEFAULT_BUDGET_KB)
    ap.add_argument("--root", default=os.path.join(os.path.dirname(__file__), "..", "..", "skills"))
    args = ap.parse_args()
    root = os.path.abspath(args.root)

    files = collect_startup_set(root, args.type, args.targets)
    total = sum(os.path.getsize(f) for f in files)
    tokens = total // BYTES_PER_TOKEN

    print(f"Startup load set for project_type={args.type} targets={args.targets}:")
    for f in sorted(files):
        print(f"  {kb(os.path.getsize(f)):>8}  {os.path.relpath(f, root)}")
    print(f"\nTotal: {kb(total)}  (~{tokens} tokens, ~{BYTES_PER_TOKEN}B/token)")
    print(f"Budget: {args.budget_kb}KB")

    if total > args.budget_kb * 1024:
        print("\nWARNING: startup set exceeds budget. Trim CLAUDE.md required-file list, "
              "split oversized KB, or defer files to on-demand (tier 2).")
        return 1
    print("OK: within startup budget. (Tier-2 on-demand files load later, as needed.)")
    return 0


if __name__ == "__main__":
    import sys
    sys.exit(main())
