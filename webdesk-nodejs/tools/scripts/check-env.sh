#!/usr/bin/env bash
# check-env.sh — verify local dev prerequisites for a Node.js delivery project.
# Run at session start (orchestrator 01-session-start-protocol Step 1) and before scaffolding.
set -uo pipefail
ok=0
need() {
  local name="$1" cmd="$2" min="${3:-}"
  if command -v "$cmd" >/dev/null 2>&1; then
    echo "  OK   $name ($($cmd --version 2>&1 | head -1))"
  else
    echo "  MISS $name — install required${min:+ (need $min)}"; ok=1
  fi
}
echo "Environment check:"
need "Node.js (>=22)" node "22+"
need "npm" npm
need "Docker" docker
need "Docker Compose" docker
need "jq" jq
need "git" git
# Node major version gate
if command -v node >/dev/null 2>&1; then
  maj=$(node -p "process.versions.node.split('.')[0]" 2>/dev/null || echo 0)
  if [ "${maj:-0}" -lt 22 ]; then echo "  WARN Node major $maj < 22 — upgrade per nodejs/knowledge/backend/02-node-lts-and-engines.md"; ok=1; fi
fi
[ "$ok" -eq 0 ] && echo "All prerequisites present." || echo "Missing prerequisites — resolve before proceeding."
exit "$ok"
