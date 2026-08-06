# ADR-0017 — Audit-Event Immutability and Retention

**Status:** Accepted (formalizing an already-resolved decision — see below)

## Context

Separation-of-duties (ADR-0010), emergency-admin access (ADR-0009), and RBAC changes all depend on a trustworthy audit trail — an audit log that can itself be silently altered provides no real accountability.

## Decision

Audit events are append-only: no update or delete operation is ever performed on a recorded audit event, enforced at the database layer (no application code path exposes an update/delete on the audit table), not merely by convention. Every audit event includes: actor, action, target, timestamp, and (where applicable) the before/after state relevant to the action.

**Retention is 7 years**, per `09_Security_Backup_Retention_Operations.md §6`'s retention matrix — this applies specifically to: audit records, immutable approval audit events, and deployment approvals/audit events (all three rows in that matrix are 7 years). This is corrected from an earlier draft of this ADR, which incorrectly applied the *database backup* cadence (35-day daily / 1-year monthly, §4's "Database" backup policy) to audit-record retention — those are two different things in the source document: §4 governs how the underlying database itself is backed up for disaster recovery; §6 governs how long individual record categories are retained before deletion. An audit event's 7-year retention is independent of, and much longer than, the database's own 35-day/1-year backup-copy cadence — a 7-year-old audit record must still be queryable from the live table, not merely recoverable from an expired backup.

## Alternatives considered

- **Mutable audit log with a separate "audit of the audit log"** — rejected: adds complexity without closing the fundamental gap; an append-only table with no delete/update code path is simpler and structurally prevents the tampering concern rather than trying to detect it after the fact.
- **Third-party audit-logging SaaS** — rejected: no requirement calls for an external audit service, and keeping audit data in the project's own PostgreSQL database keeps it within the already-established data-ownership and backup model (ADR-0016).

## Consequences

Any legitimate need to "correct" an audit event (e.g., a data-entry mistake in the recorded target) must be handled by appending a correcting event, never by editing the original — this is a deliberate constraint, not an oversight.

## Security considerations

This is the mechanism that makes RBAC/separation-of-duties enforceable after the fact — without immutable audit events, a compromised admin account could cover its own tracks.

## Operational considerations

An append-only table grows without bound absent the retention policy above — the retention/archival job itself is a background job per ADR-0004's serverless handler pattern (a `dashboard-worker` handler triggered by Vercel Cron), not a persistent process. At 7 years, this table is expected to grow large; partitioning or archival-to-cold-storage strategy (rather than deletion, since 7 years is the retention *floor*, not a deletion trigger to execute eagerly) is a Phase 1+ implementation detail, not designed here. Separately, the underlying database itself is still backed up on the 35-day daily / 1-year monthly cadence (§4) for disaster-recovery purposes — this is a different mechanism from, and does not substitute for, the audit table's own 7-year live retention.

## Validation method

Reviewed against profile `knowledge/10-data-ownership-and-audit.md` and `knowledge/11-retention-backup-and-operations.md`.

## Approval gate

G1 (architecture approval) and G-Schema (once the audit-event table schema is finalized).

## Related dashboard requirements

`04_Data_Model_and_Ownership.md`, `09_Security_Backup_Retention_Operations.md`.

## Related skill rules

Profile `knowledge/10-data-ownership-and-audit.md`; `contracts/audit-event.schema.json`.

## Open setup values

None — retention numbers are already confirmed per the registered Technical Discovery document; no unconfirmed input blocks this decision.
