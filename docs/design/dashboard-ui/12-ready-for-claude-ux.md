# Ready for Claude UX

**Status:** Proposed, pending approval. Covers design prompt §14 (Ready for Claude task UX) and
§15 (AI-related UX generally), grounded in `03_Detailed_Module_Specifications.md`'s real field
list for this module and the Recommended Module Roadmap's explicit constraint: _"V1 is manual
Claude Code execution. No Anthropic API automation."_

## 1. The one rule everything else follows from

**This is a task-tracking and evidence UI for work a human operator runs manually — not an
"Execute AI Automatically" console.** Design prompt §14's own instruction is explicit: _"Do not
create an 'Execute AI Automatically' experience in Version 1."_ Concretely, this means:

- No "Run" or "Execute" button anywhere in this module that would trigger Claude directly from the
  dashboard.
- The `Ready for Claude` status (per `10-status-and-workflow-system.md` §4) means "this task is
  ready for an operator to manually hand to Claude Code," not "queued for automatic execution" —
  the label itself, and every surrounding UI element, must not imply the latter.
- "Claimed" and "In Progress" states are recorded by the operator's own actions (claiming a task,
  marking it started), not by a system-initiated job.

## 2. List screen (archetype A)

Standard library/list pattern (`07-page-patterns.md` archetype A, `08-tables-and-filters.md`),
with the `contentMaxWidthWide` exception (per `05-dashboard-design-tokens.md` §6) since this
module's real column set — ID, title, priority, agent, project, stage, PR status, reviewer, due
date — is wide enough to warrant it. Status column uses the scoped `Progress`/`Stepper` treatment
from `02-recommended-direction.md`'s Direction B borrowing only where a task is actively
`In Progress` or `Applying`-equivalent; every other row shows the standard `StatusBadge` alone.

## 3. Task detail screen — the full field set, organized into sections

Per `03_Detailed_Module_Specifications.md`'s real field list, organized (per
`09-forms-and-validation.md`'s sectioning rule — this record easily exceeds the ~6-field
threshold) into four sections on the record-detail archetype (B):

**Identity & scope**
Task ID (`fontFamilyMono`), Title, Project (linked via `Relationship picker` display), Module/
record it targets, Authorized stage (the _one_ stage Claude is scoped to — see §1), Dependencies
(linked tasks, if any), Priority, Due date.

**Assignment**
Agent, Agent version, Operator (the human running the session), Developer (if distinct from
operator).

**Execution evidence**
Feature branch, Source commit, PR ID/URL/status — all `fontFamilyMono` — Required inputs, Expected
outputs, Restrictions (explicit text, e.g. "must not modify migration files").

**Review & release**
Reviewer, Code-review result, Staging commit/deployment/URL, Dashboard review outcome, Changes
requested (if any), Production approval/approver/commit/deployment/verification, Rollback version
(if applicable), Failure reason (if applicable), Retry count.

Every one of these fields is **read-only display, not an editable form** on the detail page except
where the module's own workflow explicitly names an editable transition (e.g. an operator marking
a task Complete) — this record is primarily an evidence trail, not a general-purpose editor.

## 4. Status vocabulary, exact per §14

Draft, Ready for Claude, Claimed, In Progress, Paused, Awaiting Review, Changes Requested,
Approved, Completed, Failed, Cancelled — every one mapped to a bucket in
`10-status-and-workflow-system.md` §4, rendered via the standard `StatusBadge`, never a bespoke
per-task color.

## 5. AI-related UX (design prompt §15) — applies beyond this one module

AI-generated or Claude-generated output must be visibly distinguishable from approved business
truth, human-authored content, and published content — this rule applies everywhere AI-originated
content can appear (a Claude-drafted field value, a scan-suggested fix, a generated case-study
summary), not only inside Ready for Claude records:

- **Label vocabulary:** "AI Draft," "Proposed," "Awaiting Human Review" — a small, consistently-
  styled inline badge (not the same visual weight as a `StatusBadge`, since this is a provenance
  marker, not a workflow state) attached directly to the field or content block it describes.
- **Never implies authority.** Design prompt's own instruction: _"Do not create visual language
  suggesting AI output is automatically authoritative."_ An AI-drafted value is visually
  _quieter_, not louder, than an approved human value — e.g. slightly muted text color or a dashed
  border, the opposite of how this system highlights an approved/healthy state. The moment content
  is approved, the AI-Draft marker is removed entirely — it does not linger as a permanent
  provenance tag once a human has taken ownership of the value through approval.
- **Field-level, not just record-level** (per `02-recommended-direction.md`'s Direction B
  borrowing): if a record has 5 fields and only 2 were AI-drafted, only those 2 carry the marker —
  a record-level banner would either over- or under-state which specific content actually needs
  review.

## 6. Completion requires real evidence, not a self-report

`05_Workflow_State_Machines.md` §4's own rule: _"Completion requires remote commit verification
when the task changes Git artifacts."_ The UI's "Complete" action is disabled (with an explanatory
message, not silently hidden — this is a workflow-readiness gate, not a permission gate, so the
"disabled implies an action exists" concern from `11-approval-patterns.md` §4 doesn't apply the
same way here) until the required evidence field (a verified commit reference) is actually
present — the button does not trust an operator's unverified claim that work is done.
