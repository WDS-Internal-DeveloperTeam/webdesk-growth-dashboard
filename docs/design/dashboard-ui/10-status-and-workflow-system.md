# Status and Workflow System

**Status:** Proposed, pending approval. Design prompt §10's own instruction: _"Do not assign
arbitrary colors independently in every module. Create semantic status tokens."_ This document is
that mapping — every real status name found across `05_Workflow_State_Machines.md` and
`03_Detailed_Module_Specifications.md` (not an invented example list) mapped onto the 5 status
buckets from `05-dashboard-design-tokens.md` §1.2. **This mapping does not change any approved
workflow state machine** — it only assigns a visual bucket to states that already exist; no state
name, no transition, no permission is altered.

## 1. The five buckets, and what each means

| Bucket          | Meaning                                                             | Use for                                                                        |
| --------------- | ------------------------------------------------------------------- | ------------------------------------------------------------------------------ |
| `healthy`       | Successfully resolved, approved, or in a good terminal/active state | Approved, Published, Verified, Completed, Applied                              |
| `attention`     | Needs human action or is paused/awaiting something — not failed     | Under Review, Awaiting X, Revision Requested, Paused, Blocked-pending-decision |
| `blocked`       | Failed, rejected, or a hard stop                                    | Rejected, Failed, Apply Failed, Cancelled-due-to-error                         |
| `informational` | Actively in progress, not yet resolved either way                   | Running, In Progress, Applying, Validating, Claimed                            |
| `neutral`       | Not yet started, archived, unknown, or intentionally not configured | Draft, Archived, Unpublished, Not Configured, Unknown                          |

A given state name can map differently depending on its module's own semantics (e.g. "Cancelled"
is `neutral` when it's a routine withdrawal, but this system has no state named exactly that with
a failure connotation — see the per-workflow tables below for every actual case).

## 2. Generic artifact lifecycle (`05_Workflow_State_Machines.md` §2 — the base pattern most

library/content modules reuse)

| State              | Bucket        |
| ------------------ | ------------- |
| Draft              | neutral       |
| Submitted          | informational |
| Under Review       | attention     |
| Revision Requested | attention     |
| Approved           | healthy       |
| Rejected           | blocked       |
| Superseded         | neutral       |
| Archived           | neutral       |

## 3. Page lifecycle (Page Inventory / Page Workspace)

| State                 | Bucket        | State               | Bucket        |
| --------------------- | ------------- | ------------------- | ------------- |
| Proposed              | neutral       | Ready for Staging   | informational |
| Approved for Planning | healthy       | Staging Deployed    | informational |
| In Strategy           | informational | Staging Approved    | healthy       |
| Search Approved       | healthy       | Production Approved | healthy       |
| Content Approved      | healthy       | Production Deployed | informational |
| Design Approved       | healthy       | Verified            | healthy       |
| Ready for Development | informational | Revision Requested  | attention     |
| In Development        | informational | Blocked             | blocked       |
| Code Review           | attention     | Paused              | attention     |
| Security/QA           | attention     | Failed              | blocked       |
|                       |               | Rolled Back         | attention     |
|                       |               | Archived            | neutral       |

Note: the many "X Approved" intermediate states are each `healthy` at the moment they're reached
— this is intentional; a page's status badge always reflects "the most recent gate passed," so a
page sitting at "Design Approved" reads as a positive state, not a workflow midpoint colored
ambiguously.

## 4. Ready for Claude task (Ready for Claude Queue)

| State            | Bucket        | State             | Bucket    |
| ---------------- | ------------- | ----------------- | --------- |
| Draft            | neutral       | Awaiting Review   | attention |
| Ready for Claude | informational | Changes Requested | attention |
| Claimed          | informational | Approved          | healthy   |
| In Progress      | informational | Completed         | healthy   |
| Paused           | attention     | Failed            | blocked   |
| Cancelled        | neutral       |                   |           |

## 5. Case study workflow (Case Study Studio / Library)

| State                | Bucket    | State                      | Bucket        |
| -------------------- | --------- | -------------------------- | ------------- |
| Draft                | neutral   | Awaiting Internal Approval | attention     |
| Information Required | attention | Approved                   | healthy       |
| Fact Check           | attention | Scheduled                  | informational |
|                      |           | Published                  | healthy       |
|                      |           | Unpublished                | neutral       |
|                      |           | Archived                   | neutral       |

Portfolio workflow reuses this exact mapping (its state names are a subset: Draft, Under Review →
`attention`, Approved, Scheduled, Published, Unpublished, Archived).

## 6. Scan workflow (Scan Center)

| State                 | Bucket        |
| --------------------- | ------------- |
| Scheduled / Requested | neutral       |
| Queued                | informational |
| Running               | informational |
| Completed             | healthy       |
| Partially Completed   | attention     |
| Failed                | blocked       |
| Timed Out             | blocked       |
| Cancelled             | neutral       |

## 7. Change Center workflow

| State                 | Bucket        |
| --------------------- | ------------- |
| Detected              | informational |
| Under Review          | attention     |
| Accepted              | healthy       |
| Rejected              | blocked       |
| Deferred              | neutral       |
| Manual Merge Required | attention     |
| Applying              | informational |
| Applied               | healthy       |
| Apply Failed          | blocked       |
| Verified              | healthy       |

## 8. Import workflow (Import and Export Center)

| State                       | Bucket                                                                                                    |
| --------------------------- | --------------------------------------------------------------------------------------------------------- |
| Uploaded                    | neutral                                                                                                   |
| Validating                  | informational                                                                                             |
| Dry Run Complete            | attention                                                                                                 |
| Ready for Approval          | attention                                                                                                 |
| Applying                    | informational                                                                                             |
| Applied / Partially Applied | healthy / attention (partial reads `attention`, not `healthy` — it's a signal to check what didn't apply) |
| Validation Failed           | blocked                                                                                                   |
| Apply Failed                | blocked                                                                                                   |
| Cancelled                   | neutral                                                                                                   |
| Rolled Back                 | attention                                                                                                 |

## 9. Release workflow (Release Center)

| State                | Bucket        | State                   | Bucket        |
| -------------------- | ------------- | ----------------------- | ------------- |
| Proposed             | neutral       | Production Approval     | attention     |
| Checks Running       | informational | Production Deployed     | informational |
| Checks Failed        | blocked       | Production Verification | informational |
| Ready for Staging    | informational | Completed               | healthy       |
| Staging Deployed     | informational | Deployment Failed       | blocked       |
| Staging Verification | informational | Verification Failed     | blocked       |
| Staging Approved     | healthy       | Hotfix Required         | attention     |
|                      |               | Rolled Back             | attention     |

## 10. Security finding workflow

| State                  | Bucket        |
| ---------------------- | ------------- |
| Open                   | blocked       |
| Triaged                | attention     |
| Assigned               | informational |
| In Remediation         | informational |
| Ready for Verification | attention     |
| Verified Closed        | healthy       |
| False Positive         | neutral       |
| Accepted Risk          | attention     |
| Deferred with Expiry   | attention     |

## 11. Internal Linking Library states

Proposed (`neutral`) → Approved (`healthy`) → Implemented (`informational`) → Verified (`healthy`).

## 12. Notification delivery states (Phase 1E infrastructure, already built)

Queued (`neutral`) → Sent to SMTP (`informational`) → Accepted (`healthy`) → Failed (`blocked`) →
Retrying (`attention`) → Permanently Failed (`blocked`). Design prompt's own instruction applies
directly here: _"Never falsely say delivered"_ — "Accepted" (by the SMTP relay) is the honest
terminal-success label; this system never claims a message was read or delivered to an inbox, only
what its own infrastructure can actually confirm.

## 13. System health states (Phase 1E infrastructure, already built as `statusTokens`)

`healthy` → `healthy` bucket. `degraded` → `attention` bucket. `unavailable` → `blocked` bucket.
`notConfigured` / `unknown` → `neutral` bucket — and per the Recommended Module Roadmap's explicit
instruction, **never** rendered as `healthy`: _"Not Configured/Unknown must not appear as
Healthy."_ This is the one rule in this entire mapping treated as a hard invariant rather than a
default, precisely because getting it wrong is actively misleading in an operational tool.

## 14. Activity vs. Audit (design prompt §13)

Two genuinely different views over the same underlying events, never conflated into one feed:

- **Activity** — a human-friendly timeline (the `Timeline` component,
  `06-dashboard-component-system.md` §6) showing only the events an ordinary user needs to
  understand a record's own history: Created, Edited, Submitted, Reviewed, Approved, Published —
  plain-language, one line per event, actor + relative timestamp. This is what renders on every
  record detail page (`07-page-patterns.md` archetype B) by default.
- **Audit** — the full, detailed, compliance-grade record (this project's own already-built
  ADR-0017 `audit_events` subsystem — immutable, database-trigger-enforced). Rendered only in the
  dedicated Audit Logs & System Health module, never inline on an ordinary record's detail page.
  Design prompt's own instruction: _"Do not make ordinary users read raw audit events for routine
  workflow understanding."_ A record detail page may link out to "View full audit history" for
  that specific record, but the default view is always Activity, never Audit.

## 15. Approval status is a subset, not a separate system

Every "Approved"/"Under Review"/"Rejected"-class state above is simultaneously the record's
workflow status _and_ its approval status where the two coincide — this system does not maintain
two separate status displays for the same record. Where a record can be independently versioned
and approved (e.g. "the record's overall status is Published, but a newer draft version is
Awaiting Approval"), the version-level approval state renders via the `Version indicator` +
`Approval block` components (`11-approval-patterns.md`), scoped to that specific version, while the
record's own `StatusBadge` continues to reflect its current published state.
