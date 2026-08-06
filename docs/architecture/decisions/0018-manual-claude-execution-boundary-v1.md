# ADR-0018 — Manual Claude Code Execution Boundary for Version 1

**Status:** Accepted (formalizing an already-resolved decision — see below)

## Context

The dashboard's Ready for Claude Queue module involves Claude Code performing implementation work against approved task packages. The degree of autonomy this involves — fully autonomous end-to-end execution versus human-triggered, human-reviewed execution — has significant safety and quality implications and must be fixed explicitly for Version 1, not left ambiguous.

## Decision

For Version 1, Claude Code execution against the Ready for Claude Queue is manually triggered and human-reviewed at each stage — no autonomous, unattended end-to-end execution (no automatic task pickup, no automatic merge, no automatic deployment). This restates and formalizes what is already an absolute rule set in this project's forbidden-actions list (no auto-merge, no auto-deploy, no autonomous Claude/Anthropic API execution — WDS-006/WDS-007/WDS-009-class rules) and in this Phase 0 task's own explicit instructions (no automatic Phase 1 start).

## Alternatives considered

- **Fully autonomous task pickup and execution** — rejected for V1: the dashboard's own module specs describe an approval-gated workflow (task package → human trigger → implementation → human review → approve/reject/revise), and this project's standing forbidden-action rules already prohibit autonomous execution. Revisiting this for a future version would require a new approved decision explicitly superseding this one.
- **Semi-autonomous with auto-merge but human-gated deploy** — rejected: still crosses the no-auto-merge line this project treats as absolute, not a matter of degree.

## Consequences

The Ready for Claude Queue module's UI/workflow must make each manual trigger point explicit and visible — task pickup, task completion, and any merge/deploy action all require a distinct human action, not a single "go" button that chains them.

## Security considerations

Manual gating at each stage is itself a security control — it bounds the blast radius of any single Claude Code execution to what a human explicitly reviewed and approved before the next stage proceeds.

## Operational considerations

This is a deliberate throughput constraint accepted for V1 in exchange for safety and review quality — revisit only via an explicit future ADR if the team's risk tolerance and review capacity change.

## Validation method

Reviewed against this project's forbidden-actions list (`knowledge/15-project-specific-forbidden-actions.md`) and the skill-build task's own standing instruction to never begin implementation phases automatically.

## Approval gate

G1 (architecture approval); any future change to this boundary requires its own explicit ADR and human approval, not an incremental drift.

## Related dashboard requirements

`03_Detailed_Module_Specifications.md` (Ready for Claude Queue), `08_API_and_Integration_Contracts.md`.

## Related skill rules

Profile `knowledge/15-project-specific-forbidden-actions.md` (no auto-merge, no auto-deploy, no autonomous execution rules).

## Open setup values

None.
