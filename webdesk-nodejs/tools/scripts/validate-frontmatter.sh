#!/usr/bin/env bash
# Thin wrapper around validate-frontmatter.py. Run from anywhere.
set -euo pipefail
DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
python3 "$DIR/validate-frontmatter.py" "${1:-$DIR/../../skills}"
