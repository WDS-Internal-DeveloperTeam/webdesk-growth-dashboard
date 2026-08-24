# Task Package — Review and Approval Center (module #11)

**Status: authorized to build.** Scoped directly (`AskUserQuestion`) on 2026-08-24, following the
explicit "Build a minimal, real approval system now" choice, itself following a real, flagged
conflict between `canonical-inputs/Recommended_Module_Roadmap.md` (which places this module at
Wave 3, "build before Page Workspace") and the mechanically-computed
`docs/phase-plans/module-implementation-roadmap.md` (Wave 5 — the module registry's own seeded
`dependencies` for `review_and_approval_center` names `page_workspace`, `case_study_studio`,
`ready_for_claude_queue`, `design_review_center`, none of which exist yet). Resolution: build the
**generic mechanism** the roadmap's own special instruction actually calls for — "Generic approval
system for all future modules" — against what exists today, not gated on those four unbuilt
modules. The registry's own `dependencies` field is left unmodified (it's authorization-scope
metadata for a different mechanical process, not something this task package overrides), but this
module's actual implementation deliberately does not wait on it.

## 1. Source

`canonical-inputs/Recommended_Module_Roadmap.md` row 11: _"Build before Page Workspace. Generic
approval system for all future modules. Enforce separation of duties and preserve immutable
approval events."_ `webdesk-dashboard-documentation-v1/03_Detailed_Module_Specifications.md §31`:
_"Functions: assigned reviews, version compare, comments, approve, approve with notes, request
revision, reject, pause, delegate where permitted."_ This is the thinnest spec of any module built
so far, and — unlike every prior module — it describes a cross-cutting **engine** that attaches to
records owned by other modules, not a single content-record library of its own.

Module registry (migration `00035`): `key: "review_and_approval_center"`,
`permissionGroupKey: "review_center"`, `route: "/review-and-approval-center"`,
`navigationGroup: "workflow"`, `navigationOrder: 2`, `iconReference: "clipboard-check"`,
`confidentialityLevel: null`. RBAC matrix (migration `00013`, `review_center` group):
`super_admin`/`owner_growth_approver`: `VCERA`; `marketing_editor`/`designer_creative_reviewer`/
`developer`/`qa_security_reviewer`: `VRA`; `read_only`: `V`. The matrix's own top-of-file doc
comment explicitly names this module: _"'(assigned)' qualifiers (Review Center, Change Center,
Imports) — object-level scoping ('only records assigned to me'), which is that future feature's
own responsibility to enforce once built, not something a role×module×action grant can express."_
`SeparationOfDutiesService`'s own doc comment likewise already names this module as an intended
future consumer.

**A real, flagged-not-resolved RBAC oddity**: only `super_admin`/`owner_growth_approver` hold `C`
(create) — the four mid-tier roles hold `V`/`R`/`A` but not `C`. In V1, with no other module
wired to auto-submit a review, this means only those two roles can manually submit a review
request through this module's own UI, even though those same mid-tier roles CAN review and
approve. This is the seeded matrix as-is, not something this task package resolves or works
around — flagged for whoever reviews this module, matching this project's standing practice of
surfacing (not silently routing around) RBAC-matrix oddities.

## 2. Design decisions

- **D1 — Three-table schema, polymorphic target, no FK on the target.** `reviews` (the workflow
  record), `review_comments` (a plain comment thread), `review_decisions` (an append-only,
  queryable action log — a review's own local history, distinct from the real, DB-trigger-enforced
  `audit_events` table, which also receives a copy of every genuine approval-shaped decision — see
  D5). `reviews.target_module_key` + `reviews.target_id` identify the reviewed record — no foreign
  key, since the target can live in any current or future module's own table, exactly the shape
  `icpIds`/`relatedPageIds`/etc. already established for a genuinely cross-module, not-yet-linkable
  reference. `target_label` is a plain, nullable text snapshot captured at submission time (no
  generic cross-module fetch mechanism exists to resolve a live label later).

- **D2 — Two orthogonal axes: `status` and `is_paused`**, mirroring Content Template Library's
  already-reviewed `approvalStatus`/`isPublished` split rather than inventing a new shape.
  `status ∈ {submitted, revision_requested, approved, rejected}` — `approved`/`rejected` terminal,
  `submitted`/`revision_requested` open. `is_paused` is an independent boolean flag toggled by
  `pause`/`resume` actions, orthogonal to `status` — "paused" is advisory ("temporarily on hold"
  for UI purposes), not a blocking gate on other transitions, since the spec names it as one of
  several peer actions, not a distinct lifecycle stage. `resume` itself is not named in the spec
  but is a necessary corollary of `pause` — flagged as an inferred, not spec-sourced addition.
  `approve` and `approve_with_notes` are the SAME `status` transition (`→ approved`); the
  distinction lives entirely in the recorded action/notes on the decision row, not as two separate
  statuses — a decision detail, not a workflow state.

- **D3 — Version compare stays opaque labels, not a real diff.** `version_a_label`/
  `version_b_label` (nullable text) let a submitter record what's being compared (e.g. "v3 →
  v4", a commit SHA, a record's own `updatedAt`) — no generic per-module version-fetch/diff
  mechanism exists anywhere in this codebase (only Website Strategy Center has real multi-row
  version history, and it's the sole module with that shape). Building a real diff engine against
  arbitrary target types is out of proportion for a first pass with zero real consumers yet.

- **D4 — Separation of duties via the existing `SeparationOfDutiesService`.** Every approval-shaped
  decision (`approve`/`approve_with_notes`/`reject`/`request_revision`) calls
  `assertDistinctActors(actorId, review.submittedByUserId, "review approver", {entityType:
"review", entityId: review.id, retentionCategory: "approval"})` before applying — reusing the
  exact mechanism this service's own doc comment already names Review Center as an intended
  consumer of, rather than a new hand-rolled check.

- **D5 — Immutable approval events via the existing `audit_events` mechanism, not a new one.**
  Every approval-shaped decision also calls `AuditService.record({eventType: "approval", ...})` —
  `audit_events`'s own event-type-to-retention-category map already has `approval → "approval"`
  wired (no change needed). `pause`/`resume`/`delegate` are recorded only in `review_decisions`
  (the queryable local history), not routed through `audit_events` — the roadmap's own instruction
  says "preserve immutable **approval** events," not "immutable everything"; process-management
  actions aren't approval decisions.

- **D6 — `targetModuleKey` validated against the real module registry; `targetId` is not.** Adds
  one new narrow, read-only delegating method, `AuthorizationService.isValidModuleKey(key):
Promise<boolean>` (backed by the already-existing `ModuleRegistryRepository.findByKey()`, not
  currently exported from `AuthzModule`) — deliberately NOT exporting the repository itself across
  the module boundary, per the already-established "narrow delegating method, not a raw repository
  export" fix pattern from Persona Library's own security review. `targetId` existence is not
  checked — no generic cross-module lookup capability exists to check it against.

- **D7 — Organization-wide, not project-scoped.** No `project_id` column — the module registry's
  own `dependencies` list and RBAC group carry no per-project qualifier, and a review can
  legitimately target a record in a module that has no project concept at all (e.g. a future
  Business Knowledge Center record).

- **D8 — No confidentiality mechanism** (`confidentialityLevel: null`, matching Persona Library's
  and Proof and Claims Library's own precedent for the same seeded value).

- **D9 — No hard delete.** Reviews are immutable workflow records once decided; nothing in the spec
  calls for deleting one.

- **D10 — RBAC action mapping** (per the legend: V=view, C=create, E=edit, R=review, A=approve):
  `list`/`findOne` → `view`; submit a new review → `create`; approve/approve-with-notes/reject →
  `approve`; request-revision/pause/resume/comment → `review`; delegate (reassigning
  `assignedToUserId`) → `edit` (an administrative action, matching that only `super_admin`/
  `owner_growth_approver` hold `E`).

## 3. Schema (migration `00066`)

```
reviews
  id                    uuid PK
  target_module_key     varchar(64) NOT NULL
  target_id             uuid NOT NULL
  target_label          text NULL
  status                enum('submitted','revision_requested','approved','rejected') NOT NULL DEFAULT 'submitted'
  is_paused             boolean NOT NULL DEFAULT false
  submitted_by_user_id  uuid NOT NULL REFERENCES users(id)
  assigned_to_user_id   uuid NULL REFERENCES users(id)
  decided_by_user_id    uuid NULL REFERENCES users(id)
  decided_at            timestamptz NULL
  version_a_label       text NULL
  version_b_label       text NULL
  created_at            timestamptz NOT NULL
  updated_at            timestamptz NOT NULL
  INDEX (target_module_key, target_id)
  INDEX (assigned_to_user_id)
  INDEX (status)

review_comments
  id             uuid PK
  review_id      uuid NOT NULL REFERENCES reviews(id)
  author_user_id uuid NOT NULL REFERENCES users(id)
  body           text NOT NULL  -- capped .max(2000), plain text (no RichTextEditor — no dashboard-web UI yet)
  created_at     timestamptz NOT NULL
  INDEX (review_id)

review_decisions
  id                    uuid PK
  review_id             uuid NOT NULL REFERENCES reviews(id)
  action                enum('approve','approve_with_notes','request_revision','reject','pause','resume','delegate') NOT NULL
  actor_user_id         uuid NOT NULL REFERENCES users(id)
  notes                 text NULL
  delegated_to_user_id  uuid NULL REFERENCES users(id)  -- set only when action = 'delegate'
  decided_at            timestamptz NOT NULL DEFAULT now()
  INDEX (review_id)
```

Migration `00067` marks `review_and_approval_center` `implementation_status = 'in_development'`,
matching every prior module's own two-migration (schema, then registry-status) precedent.

## 4. Service layer

- `ReviewsService.create()` — validates `targetModuleKey` via
  `AuthorizationService.isValidModuleKey()`; RBAC action `create`.
- `ReviewsService.list()`/`findById()` — RBAC action `view`. `list()` supports `?assignedToMe=true`
  (the "(assigned)" object-level scoping the RBAC matrix's own doc comment calls out as this
  module's responsibility) plus `?status=`/`?targetModuleKey=` filters.
- `ReviewsService.decide()` — one method handling `approve`/`approve_with_notes`/`reject`/
  `request_revision`, atomic CAS on `expectedStatus`, calls `SeparationOfDutiesService` first (D4),
  writes both `review_decisions` and `audit_events` (D5); RBAC action `approve` for
  approve/approve_with_notes/reject, `review` for request_revision (per D10 — two different RBAC
  actions gate the same method depending on which action is requested).
- `ReviewsService.setPaused()` — atomic CAS on `expectedIsPaused` AND `status` not terminal; RBAC
  action `review`.
- `ReviewsService.delegate()` — atomic CAS on `status` not terminal, writes `assigned_to_user_id`;
  RBAC action `edit`.
- `CommentsService.create()`/`list()` — RBAC action `review`/`view` respectively.

`@RequirePermission` on every controller method individually (never class-level — the established,
previously-regressed-and-fixed convention across this codebase).

## 5. Explicitly out of scope for this pass

- No `dashboard-web` UI — backend only, matching every prior module's own backend-first precedent.
- No automatic review creation from any other module (Page Workspace, Case Study Studio, etc. don't
  exist yet) — `POST /reviews` is called directly by whoever is submitting, human or (later)
  another service.
- No real version-diff rendering (D3).
- No cross-module `targetId` existence validation (D6).
