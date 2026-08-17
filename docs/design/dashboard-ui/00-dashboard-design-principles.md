# Dashboard Design Principles

**Status:** Proposed — part of the dashboard UI/UX design-system deliverable, awaiting human review
per `17-dashboard-ui-approval-checklist.md`. Not yet approved, not yet implemented.

**Scope:** The internal WebDesk Growth Dashboard application only (`apps/dashboard-web`). This
document does not apply to, reference, or reuse anything from the public WebDesk Solution
marketing website. See `16-existing-shell-gap-analysis.md` for why that separation is enforced at
the tooling level, not just by convention.

## 1. What this application actually is

The dashboard is an **operational, approval-driven system of record** for 43 business modules —
strategy, content, design, proof, agents, workflow, technical, and administrative. It is used by
a small number of named roles (7, per `06_Roles_and_Permissions.md`) who work in it daily, not by
first-time visitors. Every principle below follows from that one fact.

It is not a marketing site, not a public-facing product, and not a general-purpose admin
scaffold. It exists to make a small number of true things visible at a glance — **where am I,
what am I looking at, what state is it in, what can I do next, what happened before** — across a
data model that is deep (16-tab Page Workspace, 15-field Ready for Claude tasks) rather than wide.

## 2. The seven principles

### 2.1 Clarity over decoration

A screen succeeds if a user can answer, without hunting: _where they are, what record they're
viewing, its current status, what action is available to them specifically, what requires
approval, and what happened previously._ Every decorative choice (color, shadow, illustration,
animation) is judged against whether it helps answer one of those five questions. If it doesn't,
it's cut.

This is not a minimalism aesthetic for its own sake — `packages/ui`'s existing token set already
leans this direction (a neutral slate/blue palette, system fonts, no illustration system), and
that restraint is a genuine asset carried forward, not a limitation to design around. See
`02-recommended-direction.md` for how this shaped the visual-direction choice.

### 2.2 Information density without clutter

Real screens in this system are structurally dense: Page Workspace has 16 tabs of versioned
artifacts; Ready for Claude tasks carry ~30 fields spanning branch/commit/PR/reviewer/deployment
state; the Review & Approval Center must show a proposed version, the current approved version,
their diff, and a full comment/evidence trail simultaneously. Density is not a defect to hide —
it's the actual content. The job is **structuring** density (sections, tabs, progressive
disclosure, a disciplined table system) rather than **suppressing** it into a falsely simple
surface that hides the information a reviewer or approver actually needs before they act.

### 2.3 Consistency

A user moving from Scan Center to Release Center to the Review & Approval Center should never need
to relearn how a status badge, a table, a filter bar, or an approve/reject action works. One table
system (`08-tables-and-filters.md`), one form system (`09-forms-and-validation.md`), one status
vocabulary (`10-status-and-workflow-system.md`), one approval pattern (`11-approval-patterns.md`)
— applied identically across all 43 modules, not reinvented per module. This is the single
highest-leverage principle for a system this size: 43 modules built by different task packages
over time will only feel like one product if the underlying patterns are genuinely shared, not
just visually similar.

### 2.4 Progressive disclosure

Do not surface every field, every advanced option, every historical record at once. Use tabs
(Page Workspace's 16), sections (a long record editor split into named groups), drawers (quick
preview without leaving a list), and accordions (secondary metadata) so the default view stays
legible and the full depth stays one interaction away, not zero and not three.

### 2.5 Evidence and traceability

Nothing in this system is “just data” — every meaningful record is a claim that carries **who**
made it, **when**, **what version**, **what it's based on**, and **whether it's been approved**.
`05_Workflow_State_Machines.md`'s general rule is explicit: approved versions are immutable, every
transition is audited, rejection/revision requires a reason. The UI's job is to make that evidence
chain visible without requiring a click into a separate audit log for routine understanding — see
§2.6 and `13-status-and-workflow-system.md`'s Activity vs. Audit split.

### 2.6 Human approval visibility

This system is approval-driven by design, not incidentally. Pending review, approved, rejected,
blocked, and revision-required states must be immediately legible, and the action to change that
state must never look like a routine edit. A "Publish to production" button and a "Rename this
draft" button must not be visually interchangeable. See `11-approval-patterns.md`.

### 2.7 Honesty over polish

Two rules the source documents state directly and that this design system treats as load-bearing,
not optional:

- **Never fabricate.** The Recommended Module Roadmap's own instruction for Home is explicit: _"Do
  not fabricate traffic, SEO, leads, citation metrics or approval counts."_ This generalizes: a
  metric, a status, or a count that isn't real must render as an honest empty/unknown state, never
  a plausible-looking placeholder number. `packages/ui`'s existing `NotConfiguredState` and
  `FeatureUnavailableState` components already encode this instinct — extend it, don't undermine
  it with fake demo content once real modules ship.
- **Unknown is not healthy.** Per the roadmap's Audit Logs & System Health instruction: _"Not
  Configured/Unknown must not appear as Healthy."_ A status system that defaults an unset value to
  a green badge is actively misleading in an operational tool. See `10-status-and-workflow-system.md`.

## 3. Accessibility as a first-order requirement, not a checklist

Target: **WCAG 2.2 AA**, matching Phase 1F's own stated target (`docs/task-packages/phase-1f-application-shell.md`
§17–18) and its automated `@axe-core/playwright` baseline (currently 3 unauthenticated routes —
see `16-existing-shell-gap-analysis.md` for the coverage gap this design phase inherits and must
close as real pages ship). Status must never be communicated by color alone — every status token
in this system pairs color with text and, where space allows, shape (see `10-status-and-workflow-system.md`).
This is not a separate workstream from the visual design; it is a constraint the tokens, the
status system, and the component contracts are built against from the start.

## 4. What this document does not do

It does not select colors, define tokens, or specify components — see `01-visual-directions.md`
onward for that. It does not change the 43-module architecture, RBAC, or any approved workflow
state machine — those are out of scope for this task per the design prompt's own forbidden-actions
list (§35). It does not implement anything — see `17-dashboard-ui-approval-checklist.md` for the
human review gate this whole deliverable stops at.
