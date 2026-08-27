# Task package — `dashboard-web` Page Workspace UI

> **Status:** scoped and authorized. Built on the explicit "Start the dashboard-web Page Workspace
> UI" instruction (2026-08-26), with all four scoping forks below confirmed with the project owner
> before any code was written.

Closes the last named gap for module #12: the backend has been live in production since
2026-08-26 (PR #67, migrations `00068`/`00069` applied and verified), with no UI reaching it.
`module_registry.implementation_status` is `in_development` for exactly this reason.

## 0. Sourced design material

Unusually for this project, this screen is genuinely specified rather than inferred:

- `07_Low_Fidelity_Wireframes.md §3` — an approved wireframe: header (page, status, owner, latest
  commit, actions), a tab bar, a three-region body, and a footer action row.
- `docs/design/dashboard-ui/15-representative-screen-specifications.md §7` — archetype D
  (Workflow workspace), described there as "the system's most structurally complex screen":
  16 tabs plus a `Stepper` for stage progression, with the tab row scrolling horizontally below
  768px (an accepted tab-overflow pattern, explicitly distinct from the no-horizontal-scroll rule
  that applies to tables).

Where the wireframe names something the backend cannot support, this package says so plainly
rather than fabricating it — see §3.

## 1. Scope

**In:** a project-scoped page picker and list at `/page-workspace`; the workspace screen at
`/page-workspace/[pageId]` with all 16 tabs, per-tab artifact view and edit, version status
transitions, reopen, the lifecycle stepper and its transition control, and version history; and an
"Open workspace" link from the existing Page Inventory detail page.

**Out:** "Compare Version" (D3 below). No backend changes — every route this consumes is already
built, reviewed, gated, merged and migrated.

## 2. Decisions

**D1 — URL-driven server-rendered tabs, not the client `Tabs` component.** _(Confirmed.)_ The
design spec names `packages/ui`'s `Tabs`, which is a client component. Every detail page in this
app is deliberately a zero-client-JS Server Component, and that pattern is worth keeping here for
reasons beyond consistency: `?tab=content` makes each tab deep-linkable and shareable — genuinely
useful when someone is discussing one artifact — and it survives a refresh. Visually identical to
a tab bar; the deviation is in the mechanism, not the design.

**D2 — Bespoke per-tab status actions, not `ApprovalBlock`.** _(Confirmed.)_ `ApprovalBlock`
requires `submitter`, `submittedAt` and `requiredApprovers`. `page_artifact_versions` records none
of them — only `createdBy`, `updatedBy` and `approvedByUserId` — so adopting it would mean
labelling `createdBy` as "submitter" and `updatedAt` as "submitted at", presenting two fields as
something they are not. The same reasoning already excluded it from Service Library and Persona
Library. A status-actions component mirroring the backend's `VERSION_TRANSITIONS` is what all five
sibling modules use.

**D3 — "Compare Version" deferred.** _(Confirmed.)_ The wireframe names it and `packages/ui` has a
`DiffViewer`, so unlike most deferred items this one is genuinely buildable — versions carry real
content. It is deferred as scope, not as a limitation, and recorded here so it is not mistaken for
an oversight.

**D4 — Own route plus a link from Page Inventory.** _(Confirmed.)_ `/page-workspace` is the
module's own seeded `module_registry.route`, so it already has a sidebar entry; leaving it
unreachable would dead-end real navigation. The list mirrors Page Inventory's project-picker
pattern, and Page Inventory's detail page gains an "Open workspace" link.

**D5 — 16 tabs, of which 15 are stored artifacts and one is derived.** Matches the backend's own
D3: `history` is a view over `page_artifact_versions`, not a stored artifact type. The tab bar
shows all 16; History renders version history rather than an artifact.

**D6 — The lifecycle stepper shows the main path, compressed.** The lifecycle has 22 states, 16 on
the main path plus 6 alternative states (`revision_requested`, `blocked`, `paused`, `failed`,
`rolled_back`, `archived`). A literal 16-step stepper is unreadable at any width, so the stepper
renders the main path with the current stage and its immediate neighbours emphasised, and an
alternative state renders as a distinct badge rather than being forced onto the linear track —
those states are genuinely off-path, and drawing them inline would misrepresent the machine.

**D7 — Rich text.** Artifact `content` and `notes` are already stored as sanitized HTML by the
backend, so per the 2026-08-22 standing rule the edit form uses `RichTextEditor` and the read view
renders through the shared `SanitizedRichText` component. No backend change is needed — unlike
several prior modules, sanitization was wired when the backend was built.

## 3. What the wireframe shows that cannot be built

Recorded rather than silently omitted:

- **Comments.** The wireframe's right region lists comments. Page Workspace has no comment model;
  `review_comments` belongs to Review & Approval Center, which this module deliberately does not
  call into (backend D8 — `review_center` grants `create` to only two roles, so routing submission
  through it would 403 exactly the role the matrix intends to let submit).
- **Related records.** Artifacts carry no relationship fields.
- **Owner** in the header. `pages` has no owner column; `projects.ownerUserId` exists but is a
  different thing and would be misleading here.
- **Required approvers.** Not modelled anywhere for artifacts.

"Latest commit" IS buildable — `page_artifact_versions.commitSha` is real, though caller-supplied
and unvalidated until a GitHub adapter exists.

## 4. Acceptance criteria

- Every one of the 16 tabs is reachable, deep-linkable, and renders without client JS.
- A tab with no artifact yet offers creation; the required RBAC action is the artifact type's own
  group, so the control is only offered to a caller who can actually use it.
- Status transitions offer only those legal from the version's current status, and a reason is
  required where the backend requires one.
- An approved version cannot be edited in place; reopening is offered instead and records a reason.
- The lifecycle control offers only transitions legal from the page's current stage.
- Nothing advances a stage as a side effect of any other action.
- A caller authorized on one project cannot reach another project's workspace.
