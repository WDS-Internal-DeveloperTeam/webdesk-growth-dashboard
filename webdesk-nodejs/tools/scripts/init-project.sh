#!/usr/bin/env bash
# init-project.sh — scaffold a per-project workspace for the WebDesk Node.js Delivery System.
#
# Two modes:
#   GREENFIELD (default) — a new build starting at Discovery (G0.5).
#   ONBOARD-EXISTING (--onboard-existing) — take over an EXISTING repo, using
#       Graphify output to reconstruct governance docs, then run as maintenance.
#       See _spine/pm-agent/knowledge/10-onboard-existing-project.md.
#
# Usage (greenfield):
#   ./init-project.sh --client acme --type integration-middleware \
#       --targets "bigcommerce,erp:ddi-inform" --timezone America/Toronto \
#       [--build-context nodejs+bigcommerce] [--out ./projects]
#
# Usage (onboard existing):
#   ./init-project.sh --client acme --onboard-existing \
#       --repo /path/to/repo --graphify /path/to/repo/graphify-out \
#       --timezone America/Toronto [--type maintenance] [--out ./projects]
set -euo pipefail

CLIENT="" TYPE="" TARGETS="" TZ="UTC" BUILD_CTX="nodejs" OUT="./projects"
ONBOARD=0 REPO="" GRAPHIFY=""
while [[ $# -gt 0 ]]; do
  case "$1" in
    --client) CLIENT="$2"; shift 2;;
    --type) TYPE="$2"; shift 2;;
    --targets) TARGETS="$2"; shift 2;;
    --timezone) TZ="$2"; shift 2;;
    --build-context) BUILD_CTX="$2"; shift 2;;
    --out) OUT="$2"; shift 2;;
    --onboard-existing) ONBOARD=1; shift;;
    --repo) REPO="$2"; shift 2;;
    --graphify) GRAPHIFY="$2"; shift 2;;
    *) echo "Unknown arg: $1"; exit 2;;
  esac
done

[[ -z "$CLIENT" ]] && { echo "ERROR: --client is required"; exit 2; }
if [[ "$ONBOARD" -eq 1 ]]; then
  # Onboarding an existing codebase: type defaults to maintenance; repo required.
  [[ -z "$TYPE" ]] && TYPE="maintenance"
  [[ -z "$REPO" ]] && { echo "ERROR: --onboard-existing requires --repo <path to existing repo>"; exit 2; }
  STAGE="onboarding"; GATE="onboarding"
else
  [[ -z "$TYPE" ]] && { echo "ERROR: --type is required (or use --onboard-existing)"; exit 2; }
  STAGE="discovery"; GATE="G0.5"
fi

DIR="$OUT/$CLIENT"
mkdir -p "$DIR"/{integration-contracts,rfcs,decisions,architecture-tests,observability,qa-reports}
mkdir -p "$DIR"/operations/{incident-runbooks,queue-recovery,webhook-replay,db-restore,deploy-recovery}
mkdir -p "$DIR"/project.json.versions

# Build the integration_targets JSON array
IFS=',' read -ra T <<< "$TARGETS"
TARR=""
for t in "${T[@]}"; do [[ -n "$t" ]] && TARR="$TARR\"$t\","; done
TARR="[${TARR%,}]"

# Onboarding block (only when onboarding an existing repo)
ONBOARD_JSON="null"
if [[ "$ONBOARD" -eq 1 ]]; then
  ONBOARD_JSON="{ \"repo_path\": \"$REPO\", \"graphify_path\": \"${GRAPHIFY:-}\", \"docs_reconstructed\": false, \"client_validated\": false }"
fi

cat > "$DIR/project.json" <<JSON
{
  "project": {
    "id": "$(date +%Y%m%d)-$CLIENT",
    "name": "$CLIENT",
    "client_slug": "$CLIENT",
    "project_type": "$TYPE",
    "build_context": "$BUILD_CTX",
    "integration_targets": $TARR,
    "timezone": "$TZ",
    "tenant": { "mode": "per-client", "master": false },
    "stage": "$STAGE",
    "current_gate": "$GATE",
    "schema_version": "1.0.0"
  },
  "tech_stack": {
    "runtime": "node@22", "framework": "express",
    "database": "postgresql", "orm": "sequelize", "queue": "node-cron"
  },
  "onboarding": $ONBOARD_JSON,
  "gates": [],
  "budget": { "token_used": 0, "token_cap": 0, "hours_burned": 0, "hours_budget": 0 },
  "integration_contracts": [],
  "rfcs": [],
  "health_score": null,
  "runbooks_status": {
    "incident_runbooks": "missing", "queue_recovery": "missing",
    "webhook_replay": "missing", "db_restore": "missing", "deploy_recovery": "missing"
  },
  "audit_log_path": "audit-log.jsonl",
  "audit_log": [],
  "lock": { "locked": false, "locked_by": null }
}
JSON

# CLAUDE.md differs slightly per mode (onboarding adds the onboarding procedure + repo/graphify pointers)
{
  echo "# Project: $CLIENT"
  echo ""
  echo "> Per-project context allow-list. The session loads ONLY the files listed below"
  echo "> at startup (see _spine/shared-knowledge/context-budget.md)."
  echo ""
  echo "- project_type: \`$TYPE\`"
  echo "- build_context: \`$BUILD_CTX\`"
  echo "- integration_targets: \`$TARGETS\`"
  echo "- timezone: \`$TZ\`"
  if [[ "$ONBOARD" -eq 1 ]]; then
    echo "- mode: \`onboard-existing\`"
    echo "- repo_path: \`$REPO\`  (the actual code — read scoped files on demand; NEVER load the whole repo)"
    echo "- graphify_path: \`${GRAPHIFY:-<none>}\`  (navigation index: query graph.json to FIND files; it is NOT auto-loaded into context and is NOT the source of truth)"
  fi
  echo ""
  echo "## Required skill files for this project (startup load set)"
  echo "1. _spine/persona.md"
  echo "2. _spine/shared-knowledge/CONVENTIONS.md"
  echo "3. _spine/shared-knowledge/context-budget.md"
  echo "4. _spine/shared-knowledge/model-policy.md"
  echo "5. _spine/orchestrator/SKILL.md"
  echo "6. nodejs/SKILL.md"
  echo "7. nodejs/projects/$TYPE/SKILL.md"
  if [[ "$ONBOARD" -eq 1 ]]; then
    echo "8. _spine/pm-agent/knowledge/10-onboard-existing-project.md  (the onboarding procedure)"
    echo "9. (integration modules listed in integration_targets ONLY)"
  else
    echo "8. (integration modules listed in integration_targets ONLY)"
  fi
  echo ""
  echo "## On session start"
  echo "Read CLAUDE.md → HANDOFF.md (if present) → spec.md (when it exists) → the files above."
  echo "Everything else loads on demand. Never load another project-type or an unlisted integration target."
  if [[ "$ONBOARD" -eq 1 ]]; then
    echo ""
    echo "## Onboarding not complete until"
    echo "PM Agent reconstructs spec.md + ADRs + project.json + integration-contracts from Graphify + code,"
    echo "the client/team **validates** the reconstructed spec, and \`onboarding.client_validated\` = true."
    echo "No maintenance ticket is worked until then. See file 8 above."
  fi
} > "$DIR/CLAUDE.md"

# HANDOFF.md
if [[ "$ONBOARD" -eq 1 ]]; then
  cat > "$DIR/HANDOFF.md" <<MD
# HANDOFF — $CLIENT

_Onboarding an existing repo. Update at the end of every session
(_spine/shared-knowledge/session-handoff-protocol.md)._

## Current stage
onboarding — reconstruct governance docs from Graphify + code, then validate with client.

## What's done
- Workspace scaffolded. Repo: $REPO. Graphify: ${GRAPHIFY:-<none>}.

## What's next
1. PM reads graph_report.md + graph.json → draft spec.md (mark "reconstructed from code — verify").
2. Draft ADRs for the architecture the code reveals; draft project.json tech_stack + integration_targets.
3. Populate integration-contracts from real call sites (external APIs = verify-at-discovery).
4. Client/team validates the reconstructed spec → set onboarding.client_validated=true → move to maintenance.

## Open questions / blockers

## Files in flight
MD
else
  cat > "$DIR/HANDOFF.md" <<MD
# HANDOFF — $CLIENT

_No handoff yet. Update at the end of every session per
_spine/shared-knowledge/session-handoff-protocol.md._

## Current stage
discovery (G0.5)

## What's done

## What's next

## Open questions / blockers

## Files in flight
MD
fi

touch "$DIR/audit-log.jsonl"

echo "Scaffolded workspace at: $DIR"
if [[ "$ONBOARD" -eq 1 ]]; then
  echo "Mode: onboard-existing. Next: PM Agent runs _spine/pm-agent/knowledge/10-onboard-existing-project.md"
  echo "      (reconstruct spec/ADRs/project.json from Graphify + code, then validate with the client)."
else
  echo "Next: run Discovery (G0.5) via the orchestrator."
fi
