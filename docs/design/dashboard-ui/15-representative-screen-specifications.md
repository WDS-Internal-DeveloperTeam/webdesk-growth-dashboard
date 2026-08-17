# Representative Screen Specifications

**Status:** Proposed, pending approval. The 15 screens named in the design prompt (§30), each
specified as a composition of the archetypes (`07-page-patterns.md`), components
(`06-dashboard-component-system.md`), and status/approval systems already defined in this package.
**These are reference specifications, not implementation** — per design prompt §30's own
instruction, none of these screens' business functionality is being built by this design task.

## 1. Dashboard / Home shell

**Archetype:** H (Dashboard/overview). **Route:** `/home`, already live as a redirect target.
**Layout:** widget grid of `Card`s — Project Health (4 inline sub-widgets: Pages, Approvals, Ready
for Claude, Blockers), My Work (a short task list), Critical Findings, Git/Release Status —
exactly the approved wireframe's content shape (`07_Low_Fidelity_Wireframes.md` §1). Every widget
permission-filtered per role; every widget with no real data renders `EmptyState`, never a
fabricated number (`00-dashboard-design-principles.md` §2.7). This is the one screen given extra
editorial care per `02-recommended-direction.md`'s Direction C borrowing, without changing the
overall Direction A structure.

## 2. Projects list

**Archetype:** A (Library/list). **Already live** at `/projects` — this spec formalizes the
existing implementation as the reference pattern for every other list screen, not a redesign:
search + status filter, sortable columns, offset pagination via limit+1 fetch, `EmptyState` for
zero results and for past-the-last-page. See `08-tables-and-filters.md` for the canonical table
contract this screen already satisfies.

## 3. Project detail

**Archetype:** B (Record detail). **Already live** at `/projects/[projectId]` — sections (not
tabs, appropriately for its moderate field count) for Overview/Roadmap/Objectives/Environments/
Repositories, header `StatusBadge` + status actions (Pause/Resume/Archive) + Edit link. Kept as
the reference implementation for archetype B at moderate complexity — see `07-page-patterns.md`.

## 4. Service Library

**Archetype:** A → B → C (list, detail, editor — all three, since this is a full CRUD library
module). Fields per `03_Detailed_Module_Specifications.md`: canonical name, public name, category,
descriptions, audience, problems, capabilities, outcomes, exclusions, ICPs, platforms, engagement
models, related pages, related case studies, publication status, approval status. List screen:
standard `08-tables-and-filters.md` table (name, category, publication status, approval status,
last updated). Detail screen: sectioned by the field groups above (Identity, Positioning,
Relationships, Status) with `Approval block` since it has an approval status. **Note per the
module's own spec rule:** pricing/commercial fields are explicitly excluded from V1 by default —
the editor form does not include a pricing section at all, not a hidden/restricted one, since none
is specified to exist yet.

## 5. Record editor (generic reference)

**Archetype:** C. Not tied to one module — this is the canonical example showing every element of
`09-forms-and-validation.md` composed together: sectioned fields, required/error/confidential
states, Save draft vs. Submit for review, `beforeunload` guard, server-error mapping via
`issues[]`. Concretely instantiated using the already-live `ProjectForm` as the worked example
(owner picker via `Relationship picker`-equivalent `UserPicker`, `publicId` as a real read-only-
field example, `confidentiality` as a real select-field example) — kept as the reference
implementation, not redesigned.

## 6. Page Inventory

**Archetype:** A, using the `contentMaxWidthWide` exception (`08-tables-and-filters.md` §7).
Fields per `03_Detailed_Module_Specifications.md`: page ID, page name, URL, WordPress page/post ID,
page type, existing/proposed, index status, template, roadmap phase, workflow stage, target
keyword, canonical, design version, repository files, last scan, last deployment. Filters: page
type, status, phase, indexability, template, owner, keyword, last scan, last release — well past
the "always visible" filter budget in `08-tables-and-filters.md` §3, so only status + page type
show by default, the rest behind "More filters." Status column uses the Page lifecycle mapping
(`10-status-and-workflow-system.md` §3).

## 7. Page Workspace

**Archetype:** D (Workflow workspace) — the system's most structurally complex screen. `Tabs`
(16, per the module's own spec: Overview, Live Snapshot, Audit, Ideal Structure, Search, Content,
Creative Direction, UX/Wireframe, UI Specification, Component Map, Implementation, Code Review,
Security, QA, Deployment, History) + a `Stepper` showing overall stage progression, per
`07-page-patterns.md` archetype D. Each tab's content is itself a versioned artifact with its own
approval state where applicable (`Approval block`, reused per-tab, not per-record). Below `768px`
the stepper compresses per `13-responsive-behavior.md` §9; the 16 tabs scroll horizontally as a
single row (tab overflow, not table-style horizontal scroll — an accepted, standard tab-bar
pattern, distinct from the no-horizontal-scroll table rule).

## 8. Review & Approval Center

**Archetype:** E (Review screen). Queue view (archetype A — assigned reviews, filterable by
module/status) → review detail: `Diff viewer` (proposed vs. current approved version) +
`Approval block` with Approve / Approve with notes / Request Revision / Reject, per
`11-approval-patterns.md`. This screen is the primary consumer of the Approval block component
and the pattern every module's own inline review flow (e.g. Service Library's approval status)
ultimately routes through or mirrors.

## 9. Ready for Claude Queue

**Archetype:** F (Operations), list view. Fully specified in `12-ready-for-claude-ux.md` §2 — the
`contentMaxWidthWide` table, scoped progress indicators only for actively-running rows, standard
`StatusBadge` otherwise.

## 10. Ready for Claude task detail

**Archetype:** F (Operations) detail view, fully specified in `12-ready-for-claude-ux.md` §3 —
the four-section field layout (Identity & scope, Assignment, Execution evidence, Review &
release), the AI-Draft provenance marker where applicable (§5), and the evidence-gated Complete
action (§6).

## 11. Case Study Studio

**Archetype:** D (Workflow workspace) — a staged flow (Create → Intake → Upload → Completeness
Review → Ready for Claude → Missing Information → Draft → Search Review → Fact/Confidentiality
Review → Internal Approval → Client Approval if required → Scheduled → Published →
Unpublished/Archived, per `03_Detailed_Module_Specifications.md`), rendered via the same
`Stepper` + tabbed-or-sectioned content pattern as Page Workspace, sized to this module's own
(shorter, ~14-state) flow. Mandatory governance fields — consent evidence, claim-source linkage,
metric verification, asset licence, embargo, visibility, scheduled-publish date, unpublish reason
— render as a dedicated "Governance" section, always visible (not progressively disclosed), since
these are compliance-relevant on every record, not advanced/optional detail. **Discrepancy note
carried forward from research** (see `16-existing-shell-gap-analysis.md`'s source-canon research):
this module's own state list, the Case Study Library's status list, and
`05_Workflow_State_Machines.md` §5's case-study workflow use three overlapping-but-not-identical
vocabularies — this design spec renders whichever state list the eventual module implementation
authoritatively adopts; reconciling the three source documents themselves is a content/spec
question for that module's own task package, not a design-system decision.

## 12. Scan Center

**Archetype:** F (Operations). List (scan type, mode, status, requested/completed timestamps) →
detail (findings list, using `StatusBadge` per finding severity if the module defines one, plus
the Security finding workflow mapping from `10-status-and-workflow-system.md` §10 where findings
reach that lifecycle). Per the module's own rule — _"scans discover facts; they do not silently
overwrite records or automatically repair production"_ — no finding ever shows an "Auto-fix"
action; remediation is always a separate, explicit, human-initiated action in whatever module owns
the affected record.

## 13. Release Center

**Archetype:** F (Operations), using the scoped `Stepper` treatment (per
`02-recommended-direction.md`) for its 10-stage lifecycle. Fields per
`03_Detailed_Module_Specifications.md`: release ID, repositories and SHAs, PRs, approvals,
deployments, smoke tests, verification, rolled-back SHA, reason, replacement release — all
SHA/ID-class fields in `fontFamilyMono`. Production Approval is the screen's own instance of
`11-approval-patterns.md` §3's "deliberate confirmation" rule — this is close to the canonical
example of a high-impact approval in the whole system.

## 14. Users, Roles and Permissions

**Archetype:** G (Settings/admin). Per the Recommended Module Roadmap's own instruction — _"Phase
1D already built the RBAC core. Build/administer the UI here; do not redesign authorization
architecture"_ — this screen is purely a UI layer over the already-built, already-live RBAC system
(`AuthorizationService`, the seeded 7-role matrix, project-scoped role assignment). List of users
(archetype A) → user detail showing assigned roles, project access, MFA status, session list
(archetype B) → role-assignment as a `Relationship picker`-style action, gated by the same
separation-of-duties rules already enforced server-side (self-role-assignment already blocked at
the API layer — the UI simply never offers that action to a user viewing their own record, per
`11-approval-patterns.md` §4's "absent, not disabled" rule).

## 15. System Health

**Archetype:** H-adjacent (an operational overview, structurally closer to Home than to a record
list) — built on Phase 1E's already-live `system_events`/`system_components`/
`system_health_checks` infrastructure. A grid of component-status `Card`s (one per monitored
system component), each showing the `healthy`/`degraded`/`unavailable`/`notConfigured`/`unknown`
bucket via `StatusBadge` — with `10-status-and-workflow-system.md` §13's hard rule enforced
visibly: an unconfigured/unknown component never renders as healthy. Below the component grid, a
recent-events `Table` (archetype A pattern, scoped to system events rather than a business
record) for operational history.
