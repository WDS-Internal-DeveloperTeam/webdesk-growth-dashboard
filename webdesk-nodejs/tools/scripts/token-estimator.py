#!/usr/bin/env python3
"""Estimate the cached-token load of a project's CLAUDE.md required-file set.

Reads a project's CLAUDE.md, finds the "Required skill files" list, resolves
each against the skills root, and reports an approximate token total (~4B/token).
Catches context bloat before a session starts.

Usage: python3 token-estimator.py <path/to/project/CLAUDE.md> [--root ../../skills]
"""
import argparse, os, re, sys

def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("claude_md")
    ap.add_argument("--root", default=os.path.join(os.path.dirname(__file__), "..", "..", "skills"))
    a = ap.parse_args()
    root = os.path.abspath(a.root)
    with open(a.claude_md, encoding="utf-8") as fh:
        text = fh.read()
    refs = re.findall(r'^\s*\d+\.\s+([A-Za-z0-9_./-]+\.md)', text, re.M)
    total = 0
    print("Resolved required files:")
    for r in refs:
        p = os.path.join(root, r)
        if os.path.isfile(p):
            sz = os.path.getsize(p); total += sz
            print(f"  {sz/1024:6.1f}KB  {r}")
        else:
            print(f"  (missing) {r}")
    print(f"\nTotal ~{total/1024:.1f}KB  (~{total//4} tokens)")
    if total > 180*1024:
        print("WARNING: startup set is large — trim or defer to on-demand.")
        return 1
    return 0

if __name__ == "__main__":
    sys.exit(main())
