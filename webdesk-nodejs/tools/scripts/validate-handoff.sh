#!/usr/bin/env bash
# validate-handoff.sh — confirm a project's HANDOFF.md is real, not an empty placeholder.
# Per _spine/shared-knowledge/session-handoff-protocol.md. Run at session start.
set -uo pipefail
HF="${1:-HANDOFF.md}"
[ -f "$HF" ] || { echo "No HANDOFF.md at: $HF (fresh project is fine; otherwise investigate)"; exit 0; }
fail=0
require_section() {
  if ! grep -qiE "^#+.*$1" "$HF"; then echo "  MISS section: $1"; fail=1; fi
}
require_nonempty() {
  # section heading must be followed by at least one non-blank, non-placeholder line
  awk -v pat="$1" '
    $0 ~ pat {f=1; next}
    f && /^#/ {f=0}
    f && NF && $0 !~ /_No .*yet/ && $0 !~ /^<!--/ {found=1}
    END{exit found?0:1}' "$HF" || { echo "  EMPTY: $1"; fail=1; }
}
echo "Validating $HF:"
require_section "Current stage"
require_section "next"
require_nonempty "[Ww]hat'?s done|Where we left off|Current stage"
[ "$fail" -eq 0 ] && echo "  HANDOFF is valid." || echo "  HANDOFF incomplete — update before continuing (session-handoff-protocol)."
exit "$fail"
