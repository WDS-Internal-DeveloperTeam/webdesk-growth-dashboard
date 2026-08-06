# ADR-0016 — Operational Data Versus Git Artifact Ownership

**Status:** Accepted (formalizing an already-resolved decision — see below)

## Context

The dashboard produces two categories of output that are easy to conflate: operational/runtime data (scan results, audit events, notification history — living in the database) and Git-tracked artifacts (source code, ADRs, contracts, configuration — living in the repository). Without an explicit ownership rule, it becomes ambiguous whether a given piece of information belongs in the database, in a committed file, or both.

## Decision

- **Database-owned:** anything that changes at runtime as a result of normal system operation — scan results, audit events, notification records, user sessions, job execution history, project state that changes outside of a deliberate architectural decision.
- **Git-owned:** anything that represents a deliberate, reviewed decision or a static artifact — source code, ADRs, integration contracts, configuration templates, this Phase 0 documentation set itself.
- `project.json` (this project's own state file) is Git-tracked because its gate/decision history is itself a reviewed artifact, not runtime telemetry — but its `audit_log` array is expected to grow and should be periodically archived out of the live file rather than growing unboundedly in Git history (an operational convention, not redesigned here).
- Generated reports that summarize database content (e.g., a scan report) are database-owned in their source-of-truth form; a Git-committed copy, if one is ever produced, is explicitly a snapshot/export, not the source of truth.

## Alternatives considered

- **Treating all dashboard output as database-owned, including configuration and decisions** — rejected: loses Git's review/diff/blame capabilities for exactly the artifacts (ADRs, contracts) where that history matters most.
- **Committing runtime data to Git (e.g., scan results as JSON files)** — rejected: Git is not designed for high-frequency, high-volume operational data churn, and this would make the repository's history unusably noisy.

## Consequences

Every new dashboard feature must classify its outputs against this rule at design time — ambiguous cases (is this a "decision" or "runtime data"?) should be resolved by asking whether a human is expected to review/approve the specific value, not just its type.

## Security considerations

Database-owned operational data (which may include personal information from scan results or user activity) is subject to the data-classification rules in `docs/security/data-classification.md`, distinct from the access rules that apply to the Git repository itself.

## Operational considerations

Backup/retention policy differs by category: database backups follow `knowledge/11-retention-backup-and-operations.md`'s cadence; Git history has its own, separate durability model (the repository's own hosting/backup, once a remote exists).

## Validation method

Reviewed against profile `knowledge/10-data-ownership-and-audit.md`.

## Approval gate

G1 (architecture approval).

## Related dashboard requirements

`04_Data_Model_and_Ownership.md`.

## Related skill rules

Profile `knowledge/10-data-ownership-and-audit.md`.

## Open setup values

None.
