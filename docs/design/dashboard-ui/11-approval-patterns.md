# Approval Patterns

**Status:** Proposed, pending approval. Human approval is this system's central interaction
pattern, not an edge case — `05_Workflow_State_Machines.md`'s general rules (§1) already establish
that every transition is permission-checked server-side, requires evidence/approvals where
applicable, and is fully audited; this document is the **UI** contract for that reality, reused
identically by the Review & Approval Center, the Design Review Center, and every module's own
inline submit-for-review flow (`07-page-patterns.md` archetypes C and E).

## 1. The Approval block — one composed component, reused everywhere

Every approval surface in the system, regardless of module, shows the same fields in the same
order (design prompt §11's own list):

1. **Current version** — what's live/approved right now (if anything).
2. **Proposed version** — what's being reviewed (via the `Diff viewer` where both exist).
3. **Submitter** — who proposed this version, when.
4. **Reviewer** — who is reviewing, or who reviewed it.
5. **Required approver(s)** — resolved from RBAC (a record may require a specific role, e.g.
   Security Owner for a security exception, per `06_Roles_and_Permissions.md` §4).
6. **Approval status** — one of the workflow-status buckets from `10-status-and-workflow-system.md`.
7. **Comments** — threaded, tied to this specific approval cycle (not the record's whole lifetime
   history — that's Activity, §14 of `10-status-and-workflow-system.md`).
8. **Date/time** of the current state.
9. **Previous approvals** — a compact list (version, approver, date, decision) below the current
   cycle, collapsed by default (progressive disclosure, Principle 2.4) once more than 2–3 exist.

This is the single component `07-page-patterns.md` archetype E ("Review screen") is built around,
and the same component appears in-line, in a smaller form, on any archetype-C record editor once
that record enters a review state — so a user editing a draft sees exactly the same approval
vocabulary they'd see reviewing someone else's.

## 2. The four actions, and why they're visually distinct from routine editing

**Approve · Request Revision · Reject · (Approve with notes, where the module allows it)** —
design prompt §11's explicit instruction: _"Do not make approval actions visually equivalent to
normal editing actions."_ Concretely:

- These four actions render as a clearly separated action group — visually set apart from the
  page's routine action row (per `04-navigation-system.md` §3's primary/secondary action
  placement), typically directly below or beside the Approval block itself, not mixed into the
  page header's action row alongside "Edit" or "Export."
- **Approve** uses the `success` core-palette button treatment (not the muted `healthy`
  status-badge tint — this is an _action_, not a status display, and needs the same attention-
  getting weight as any primary commit action).
- **Reject** uses the `danger` button treatment and is treated as a destructive action per
  `07-page-patterns.md`'s destructive-action policy — a confirmation `Modal` stating the real
  consequence (e.g. "This will return the record to Draft and notify the submitter"), never a
  bare "Are you sure?"
- **Request Revision** is visually distinct from both — an outline/secondary-weight button, since
  it's neither a final commit nor a hard rejection; it always requires a reason (a required
  `Textarea`, matching `05_Workflow_State_Machines.md`'s own rule: _"rejection/revision require a
  reason"_).
- No approval action is ever a single unconfirmed click with irreversible effect for
  production-impacting decisions specifically — see §3.

## 3. Dangerous/high-impact approvals require deliberate confirmation

Design prompt §11: _"Dangerous/high-impact approval actions should require deliberate
confirmation."_ Not every approval needs a confirmation dialog — approving a routine content draft
doesn't need the same ceremony as a production release approval. The distinguishing signal, applied
consistently: **does this approval action have an immediate, hard-to-reverse external effect**
(a production deployment, a published/live content change, a security-exception grant)? If yes, it
gets a confirmation `Modal` naming the real consequence before the action fires; if the approval
only changes an internal workflow state with no external effect yet (e.g. moving a page from
"Content Approved" to "Design Approved" — more internal gates still remain before anything goes
live), a single clear click is sufficient. This mirrors the same reasoning
`07-page-patterns.md`'s destructive-action policy already applies to Archive vs. Pause/Resume — a
proven, not speculative, pattern in this system.

## 4. Delegation and separation of duties

Where a module's spec allows delegating a review (Review & Approval Center, per
`03_Detailed_Module_Specifications.md`), the Approval block shows who a review is currently
assigned to and offers a "Delegate to…" action only to users the RBAC layer actually permits to
delegate — never a delegate picker that lets a user route around a required-approver rule. Per
`06_Roles_and_Permissions.md` §4's separation-of-duties rules ("a developer cannot approve their
own code review," "a content author should not be the sole final approver of the same content"),
**the Approve/Reject/Request Revision buttons themselves are simply absent (not disabled-and-
visible) for a user the server would reject anyway** — matches this project's own established
"disabled implies an action exists" concern already avoided elsewhere in this design system (see
`07-page-patterns.md`'s empty-state policy for the same reasoning applied here).

## 5. What this pattern does not do

It does not implement a new approval engine or change any workflow state machine — every
transition this component triggers already exists and is already server-validated per
`05_Workflow_State_Machines.md`. It is presentation only: making an already-real approval decision
legible, safe to act on, and consistent across all 43 modules.
