# Phase 1D (Expanded) Task Package — RBAC, Fine-Grained Permissions, Confidential-Field Access, and Separation of Duties

**Status: BLOCKED — not authorized to begin.** Received verbatim from the user 2026-08-07 as a
brief for "Phase 1D," recorded here rather than acted on immediately, per two explicit decisions
the user made when asked directly:

1. **Precondition:** the brief's own §2 requires Phase 1C to have "Completed security review" and
   "received human approval" before this work begins. Phase 1C's G4-1C gate was approved this same
   session (`docs/project-state/phase-1c-approval-checklist.md`), but as an explicit **OVERRIDE**,
   not a clean pass — the required second-role human review of
   `docs/security/threat-model-authentication-session-handling.md` has **not** happened. Asked
   whether to treat the override as sufficient or wait for the real review, the user chose **wait
   for the review to actually happen** before starting this brief's work. That review remains the
   blocking precondition — see `docs/project-state/setup-input-register.md`'s entry for it.
2. **Scope relationship to already-merged work:** a narrower "Phase 1D — RBAC and authorization"
   already exists, built, validated, and merged to `main` via
   [PR #8](https://github.com/WDS-Internal-DeveloperTeam/webdesk-growth-dashboard/pull/8) —
   see `docs/task-packages/phase-1d-rbac-authorization.md` and
   `docs/project-state/phase-1d-validation-report.md`. Asked how this much larger brief relates to
   that already-merged work, the user chose: **this brief supersedes/expands it** — the merged
   `AuthzModule` (deny-by-default `PermissionService`/`PermissionGuard`, the real seeded
   7-role/21-module/458-grant matrix, the "Users/roles" HTTP surface) is the first increment to
   build on, not throwaway work to redo from scratch.

**Do not begin implementing this brief until:**

- The second-role human review of `docs/security/threat-model-authentication-session-handling.md`
  has actually happened and is recorded (updating that document's own "Review status" section and
  `docs/project-state/phase-1c-approval-checklist.md`'s item 11 / "Open condition").
- Someone in this session or a future one confirms the precondition is now satisfied and gives
  explicit authorization to begin — the same discipline every prior phase in this project has
  followed (a task package existing is not itself authorization to execute).

**The `<INSERT APPROVED PHASE 1C REMOTE SHA>` placeholder in the original brief (§0) was left
unfilled by the user.** For the record: the actual approved Phase 1C remote SHA is
`102397d2f1aaf9fc5d374dd4bd58c764cb031ef9` (PR #7's merge commit, recorded in
`docs/project-state/phase-1c-approval-checklist.md`'s "Commit record" and `project.json`'s
`gates[]` entry `G4-1C`). Confirm this is the intended value (not, e.g., a different commit the
brief's author had in mind) before treating it as authoritative once work begins.

**Relationship to the existing `docs/task-packages/phase-1d-rbac-authorization.md`:** that document
remains the accurate scope-of-record for what PR #8 actually built and shipped — it is not
rewritten or superseded by this file. This document is the _next_ increment's scope-of-record, to
be executed only once authorized. When work begins, the eventual validation report and approval
checklist for this expanded scope should reference both task packages, not just this one, so the
full history of what "Phase 1D" ended up meaning is traceable.

---

## Original brief (verbatim, as received)

The following section is preserved exactly as supplied by the user — not paraphrased,
reformatted, or summarized — so that whoever executes it later works from the real source, not a
reconstruction.

---

# WebDesk Growth Dashboard — Phase 1D RBAC, Permissions & Separation of Duties

Phase 1C has been completed.

Do not begin this task until Phase 1C has:

- Passed all required validation
- Completed code review
- Completed security review
- Completed `phase-1c-validation-report.md`
- Received human approval
- Recorded the exact approved remote commit SHA
- Updated `HANDOFF.md`
- Confirmed there is no blocker preventing authorization work

Approved Phase 1C remote commit SHA:

`<INSERT APPROVED PHASE 1C REMOTE SHA>`

Authorization is limited to Phase 1D:

**Role-Based Access Control, Fine-Grained Permissions, Confidential-Field Access, and Separation of Duties**

Do not begin Phase 1E audit-log persistence, job infrastructure, business modules, integrations or production deployment.

---

## 1. Required context

Before implementation, read and follow in precedence order:

1. `CLAUDE.md`
2. `project.json`
3. `HANDOFF.md`
4. Approved Dashboard Master Specification
5. Relevant detailed Dashboard Documentation Pack files
6. `docs/06_Roles_and_Permissions.md` or the equivalent approved roles/permissions specification
7. Approved workflow-state and approval-gate documentation
8. Approved Phase 0 ADRs
9. Approved authentication/security/database contracts
10. Approved Phase 1A, 1B and 1C validation reports and approval checklists
11. `docs/phase-plans/phase-1-foundation-plan.md`
12. WebDesk Growth Dashboard project profile
13. WebDesk Node.js base skill

Relevant approved material must include:

- Authentication architecture
- Session model
- RBAC and separation-of-duties ADR
- Data classification
- Confidential-field requirements
- Approval workflow requirements
- Audit-event interface created in Phase 1C
- Database/repository architecture
- Threat model
- Security verification plan

If documents conflict, follow the approved precedence model.

Do not silently invent authorization behavior.

---

## 2. Pre-implementation verification

Before modifying application code, verify:

- Phase 1C is formally approved.
- The current work starts from the exact approved Phase 1C remote SHA.
- Authentication works for approved Google Workspace users.
- Emergency local administrator authentication works.
- Sessions are revocable and secure.
- Authentication and authorization remain separate concepts.
- No business role was automatically assigned during Phase 1C.
- Database migrations and repositories are healthy.
- No unresolved security issue blocks RBAC work.

Record the verification result.

---

## 3. Approved Version 1 roles

Implement the approved dashboard roles:

1. Super Admin
2. Owner / Growth Approver
3. Marketing Editor
4. Designer / Creative Reviewer
5. Developer
6. QA / Security Reviewer
7. Read-only

Do not rename or merge these roles unless a higher-precedence approved source explicitly does so.

Roles are dashboard user authorization constructs.

They are not:

- Website-growth agents
- Claude Code software-delivery roles
- Google Workspace groups
- GitHub repository roles
- WordPress roles

Keep these concepts separate.

---

## 4. Authorization philosophy

Authorization must be:

**Deny by default.**

A user receives access only when an approved permission grants it.

Do not implement:

- "Authenticated means allowed"
- "Missing permission means allowed"
- Broad administrator fallbacks
- Client-side-only authorization
- Hidden-button security as the primary control

Every protected action must be enforced server-side.

Frontend permission checks are for UX only.

Backend authorization is authoritative.

---

## 5. Permission model

Support separate permissions for at least:

- View
- Create
- Edit
- Delete where explicitly allowed
- Archive
- Submit
- Review
- Approve
- Reject
- Publish
- Unpublish
- Release
- Roll back
- Export
- Execute
- Configure
- View confidential fields
- Edit confidential fields

Use stable permission identifiers.

Recommended pattern:

```text
<resource>.<action>
```

Examples:

```
projects.view
projects.edit

pages.view
pages.create
pages.edit
pages.submit
pages.review
pages.approve
pages.publish
pages.unpublish

agents.view
agents.configure

tasks.view
tasks.create
tasks.execute
tasks.approve

releases.view
releases.approve
releases.execute
releases.rollback

confidential_fields.view
confidential_fields.edit
```

The exact final permission catalog must be derived from the approved 43-module specification and
workflow documents. Do not create arbitrary permission names without documenting their source.

---

## 6. Authorization scopes

Permissions must support the approved scopes:

- Project
- Module
- Action
- Confidential field

Where required by approved workflows, support record-level context as an evaluation input without
creating an uncontrolled ACL system.

The authorization engine should be able to answer: can user X perform action Y on resource Z
within project P under the current workflow context?

Do not hardcode authorization logic independently in every controller. Use a centralized
authorization service/policy layer.

---

## 7. Role-to-permission architecture

Implement:

- Roles
- Permissions
- Role-to-permission relationships
- User-to-role assignments
- Project-aware role assignment where required
- Permission evaluation
- Effective-permission calculation
- Role status
- Version/change metadata where applicable

Do not assume one global role is sufficient for every future project. The architecture must
support a user having different authorized responsibilities across projects if the approved data
model requires it.

Avoid duplicating permission strings in multiple applications. Permission definitions should live
in an approved shared boundary.

---

## 8. Initial role behavior

Use the approved roles/permissions documentation as authority. Do not make assumptions such as
"Super Admin can automatically do literally anything" unless documented.

At minimum, design toward these intent boundaries:

**Super Admin** — System-level administration. May manage approved system configuration, users
and authorization structures. Must still respect high-risk release/approval separation rules where
required. Super Admin must not automatically bypass immutable audit, security or production-release
controls.

**Owner / Growth Approver** — Leadership/business approval responsibility. May approve business
strategy, website-growth decisions, content/creative/release gates where authorized. Must not
automatically receive technical system-administration permissions.

**Marketing Editor** — Content, marketing and approved strategy-record editing. Must not release
production code or change system authorization.

**Designer / Creative Reviewer** — Design-system, creative and UX review responsibilities. Must
not modify system permissions or production infrastructure.

**Developer** — Authorized technical implementation. Must not approve its own controlled
development work where independent review is required.

**QA / Security Reviewer** — Independent QA/security review and gate participation. Must not
silently implement and approve the same controlled change.

**Read-only** — View approved non-confidential information only unless specifically granted
additional confidential-view permission.

Do not treat these descriptions as the complete matrix. Derive the exact matrix from approved
project documentation.

---

## 9. Separation of duties

This is a critical Phase 1D requirement.

The system must support policies preventing the same person from performing incompatible
controlled actions. Examples include:

- Developer who performed implementation ≠ required independent code reviewer
- Task executor ≠ task approver (where required)
- Production release executor ≠ production approval authority
- Emergency recovery subject ≠ sole recovery approver

Use actor identity, task/review records and policy evaluation to enforce separation. Do not rely
only on role names. A user may hold multiple roles, so authorization must evaluate whether the
same user performed the conflicting prior action.

---

## 10. Approval-policy foundation

Implement only the authorization foundation needed to enforce future approval gates.

The system must be able to represent:

- Required permission
- Required role/category where applicable
- Minimum approver count where approved
- Actor exclusion
- Prior-action exclusion
- Approval status
- Approval timestamp
- Approval actor
- Approval context

Do not build the complete Review & Approval Center UI unless explicitly required by Phase 1D. The
full workflow modules may come later. This phase establishes the reusable policy foundation.

---

## 11. Confidential-field authorization

Implement independent access controls for confidential fields.

A user may be allowed to view a record while being denied access to confidential fields inside
that record. Support:

- View record: Yes / View confidential fields: No
- View confidential fields: Yes / Edit confidential fields: No

Confidential data must be excluded server-side before the response is returned.

Do not:

- Send confidential values to the browser and merely hide them with CSS
- Serialize hidden confidential values into frontend state
- Include restricted fields in exports without explicit permission
- Include restricted values in logs

Use approved data-classification definitions.

---

## 12. Module-level authorization

The authorization system must be compatible with all 43 approved dashboard modules.

Create a canonical module/resource registry based on the approved module specification. Do not
implement every module during Phase 1D. Authorization should nevertheless support future resources
such as: Projects, Business Knowledge Center, Website Strategy Center, Page Inventory, Page
Workspace, Case Study Studio, Brand Library, Design libraries, Service Library, Persona Library,
Proof & Claims, Keyword & Entity Library, Internal Linking, Agent Directory, Agent Specification
Library, Ready for Claude Queue, Review & Approval Center, Scan Center, Change Center,
Import/Export, Technical Center, Release Center, Logs, Users/Roles/Permissions, Integrations,
Settings, Audit/System Health.

Use stable module IDs rather than display labels as authorization keys.

---

## 13. Authorization service architecture

Create a centralized policy/authorization service. It must:

1. Receive authenticated user identity.
2. Resolve active user status.
3. Resolve project/context.
4. Resolve role assignments.
5. Resolve permissions.
6. Resolve confidential-field permissions.
7. Evaluate workflow/policy constraints.
8. Evaluate separation-of-duties constraints.
9. Return allow/deny plus a safe machine-readable reason.
10. Emit an authorization-event interface where appropriate.

Do not expose sensitive policy details to unauthorized clients. Use safe external error responses
such as 403 Forbidden with a stable error code. Do not reveal internal role assignments or
confidential permission topology unnecessarily.

---

## 14. NestJS implementation

Implement authorization at appropriate NestJS boundaries. Expected patterns may include: Guards,
Decorators, Policy services, Permission constants/types, Request-user context, Resource-context
resolution.

Avoid controller-specific authorization duplication.

Example conceptual use: `@RequirePermission('pages.edit')` or a policy form when context is
required.

Do not make decorators the source of truth. The centralized policy evaluator remains authoritative.

---

## 15. Frontend authorization

`dashboard-web` may receive an effective capability model suitable for rendering UI. Use it to:
hide unavailable navigation, disable unavailable actions when useful, display approval/review
actions correctly, prevent confusing UX.

But frontend checks are never security enforcement. Every protected API endpoint must
independently verify permission. Do not expose the complete system authorization matrix
unnecessarily to the browser. Return only the current user's relevant capabilities/context.

---

## 16. Database scope

Phase 1D may create database structures needed for authorization. Likely structures include:
Roles, Permissions, Role permissions, User role assignments, Project role assignments where
required, Authorization-policy configuration where appropriate, Separation-of-duties policy
records if not defined statically, Permission/version metadata.

Follow the approved Phase 1B migration and repository architecture. Do not create unrelated
business-module data structures. Do not use production schema synchronization. All migrations must
be: version controlled, deterministic, tested on clean DB, tested as upgrade path, reviewed for
destructive behavior, reversible where technically safe.

---

## 17. Seed/reference data

The seven approved roles and core permission catalog may require controlled reference-data
seeding. If seed data is used:

- Make it version controlled.
- Make it idempotent.
- Give records stable identifiers.
- Do not overwrite human-modified production authorization silently.
- Separate system-defined permissions from user assignments.
- Do not automatically assign users to privileged roles.

Initial user-to-role assignment must require explicit approved setup data.

---

## 18. Super Admin bootstrap

A safe first-administrator bootstrap mechanism may be implemented only if required. It must:

- Require explicit environment/setup configuration.
- Work only when no authorized administrator exists or under approved controlled conditions.
- Be disabled or unusable after bootstrap where practical.
- Emit a security/audit event.
- Never assign privileged roles based only on matching an email domain.
- Never use a default password or hardcoded user.

If the approved documentation provides another bootstrap process, use that instead.

---

## 19. Emergency administrator authorization

Emergency local administrators authenticated in Phase 1C must not automatically become Super Admin
merely because they used emergency authentication. Authorization and authentication remain
separate. The account must have an explicit approved role/permission assignment. Emergency use may
additionally require elevated logging/monitoring. Do not weaken separation of duties simply
because an emergency account is being used.

---

## 20. User and role management API foundation

Implement only APIs needed to support Phase 1D authorization and controlled administration.
Possible endpoint categories: `/me/capabilities`, `/admin/users`, `/admin/roles`,
`/admin/permissions`, `/admin/role-assignments`, `/admin/policies`.

Exact paths must follow approved API conventions. Protect every administrative endpoint with
server-side authorization. Avoid allowing unrestricted role editing where system roles/permissions
are intended to be immutable or version controlled. Document OpenAPI contracts.

---

## 21. Prevent privilege escalation

Explicitly test and prevent:

- User assigning themselves a higher role
- Marketing user granting Developer access
- Developer granting themselves approval permission
- QA reviewer modifying authorization rules
- Read-only user accessing protected mutation endpoints
- Lower-privileged administrator editing Super Admin assignments without authorization
- Hidden-field extraction through API query parameters
- Mass-assignment attacks against role/permission fields
- Object-level authorization bypass
- Cross-project authorization bypass

Use allowlisted update schemas. Do not pass raw request bodies directly to ORM updates.

---

## 22. Authorization event interface

Phase 1D must use the existing shared audit/security event interface. Emit events for
security-relevant authorization activity, such as: Role assigned, Role removed, Permission grant
changed, Permission revoked, Privileged access denied, Confidential field accessed where logging
is required, Separation-of-duties denial, Super Admin bootstrap, Authorization configuration
changed.

Phase 1D must not create a competing final audit-log subsystem. Phase 1E will complete immutable
persistence and retention.

---

## 23. Caching and authorization freshness

If authorization/capabilities are cached:

- Cache keys must include the relevant user/project/version context.
- Privilege changes must invalidate or version-bust stale authorization.
- Revoked permissions must not remain effective until a long cache expires.
- Do not rely on browser caching as authorization state.
- Do not cache confidential record data across users.

Prefer correctness over premature authorization caching. Document the chosen approach.

---

## 24. Session interaction

If roles or permissions change while a user has an active session: the authorization system must
ensure that new permissions/revocations become effective safely. Do not require waiting seven days
for the session to expire. Use one of the approved approaches: resolve permissions server-side per
request, version authorization state and invalidate stale session capabilities, or revoke sessions
after high-risk privilege changes.

Document which strategy is implemented.

---

## 25. API authorization tests

At minimum test:

**General** — Unauthenticated request rejected; authenticated user without permission rejected;
authorized user accepted; disabled user rejected; revoked session rejected.

**Role behavior** — Test representative actions for all seven roles.

**Project scope** — Same user authorized in Project A; same user denied equivalent action in
Project B where no assignment exists.

**Confidential fields** — Record access without confidential-field permission; record access with
confidential-view permission; confidential-edit denial; export behavior.

**Separation of duties** — Executor cannot self-approve where prohibited; Developer cannot
independently satisfy required code-review gate; recovery subject cannot approve own recovery;
same-role different-user approval works where permitted.

**Privilege escalation** — Self-role assignment; unauthorized assignment of privileged role;
direct API manipulation; mass-assignment attempt; object-ID substitution.

---

## 26. Frontend tests

At minimum verify: navigation reflects current capabilities; unauthorized buttons/actions are
absent or appropriately disabled; direct URL access still receives backend denial; confidential
values are not present in frontend payloads; role changes are reflected without stale privilege
behavior; read-only experience cannot mutate data; forbidden responses render a safe UI state.

Do not treat visual hiding as proof of authorization security.

---

## 27. Security review

Phase 1D requires dedicated authorization/security review. Review against: approved RBAC
documentation, approved threat model, OWASP Top 10:2025, OWASP ASVS 5.0 authorization controls,
Broken Access Control risks, IDOR/object-level authorization, privilege escalation, mass
assignment, cross-project access, confidential data leakage, separation-of-duties bypass.

Critical or High unresolved authorization findings must block approval unless formally accepted
through the approved security-exception process.

---

## 28. Performance expectations

Authorization should be designed for efficient request-time evaluation. Avoid: large permission
table scans per request, N+1 permission queries, loading every system permission for simple
operations, repeated DB resolution inside the same request when safe request-scoped caching can be
used.

Do not compromise correctness or revocation freshness for performance. Document query/index
requirements.

---

## 29. Required documentation

Create:

- `docs/project-state/phase-1d-validation-report.md`
- `docs/project-state/phase-1d-approval-checklist.md`
- `docs/implementation/phase-1d-rbac-architecture.md`
- `docs/implementation/phase-1d-permission-catalog.md`
- `docs/implementation/phase-1d-role-permission-matrix.md`
- `docs/implementation/phase-1d-separation-of-duties.md`
- `docs/implementation/phase-1d-confidential-field-authorization.md`
- `docs/implementation/phase-1d-file-inventory.md`
- `docs/implementation/phase-1d-security-review.md`

Update: `HANDOFF.md`, `docs/traceability/phase-0-requirements-traceability.md`,
`docs/phase-plans/phase-1-foundation-plan.md`, `docs/project-state/setup-input-register.md`.

The role-permission matrix must clearly distinguish: system permissions, project permissions,
confidential-field permissions, approval permissions, release permissions.

**Note (added by this record, not the original brief):** `docs/project-state/phase-1d-validation-report.md`
already exists, documenting PR #8's narrower scope. When this expanded work begins, either extend
that report or clearly version it (e.g. a "Phase 1D expansion" addendum) — do not silently
overwrite the record of what PR #8 actually shipped and validated.

---

## 30. Acceptance criteria

Phase 1D is successful only when: all seven approved roles are represented; deny-by-default
authorization works; server-side permission enforcement works; project-scoped authorization works
where required; confidential-field access is independently enforced; separation-of-duties policies
work; privilege escalation protections work; role and permission changes take effect safely;
emergency administrator authentication remains separate from authorization; authorization event
interfaces work; no business modules beyond required authorization foundations are implemented; no
full immutable audit subsystem is created; tests pass; security review passes; documentation is
updated; exact remote commit SHA is recorded.

---

## 31. Git workflow

Use a dedicated Phase 1D feature branch. Do not push directly to a protected branch. When
implementation is complete: run database migration validation; run type checking; run linting; run
unit tests; run integration tests; run authorization security tests; run frontend authorization
tests; update documentation; update `HANDOFF.md`; produce the Phase 1D validation report; produce
the Phase 1D approval checklist; commit only authorized Phase 1D changes; push the feature branch;
verify the remote commit SHA; create/update the Pull Request when authorized; record PR URL, status
and remote SHA.

Do not merge automatically. Do not deploy production.

---

## 32. Explicitly out of scope

Do not implement: full immutable audit persistence; seven-year audit-retention implementation;
background-job infrastructure; Vercel Queues; Workflows; Cron; Ready for Claude Queue; Review &
Approval Center business UI; website-growth agent execution; GitHub App integration; WordPress
integration; Google Workspace SMTP delivery; Vercel Blob; Scan Center; Change Center;
import/export; production release workflows; full dashboard modules; production deployment.

These belong to later phases.

---

## 33. Forbidden actions

Do not: modify the base Node.js skill; change approved authentication architecture; grant
permissions based solely on email domain; automatically make Workspace users administrators;
automatically make emergency users Super Admin; create allow-by-default fallbacks; enforce
permissions only in frontend code; send confidential fields to unauthorized clients; allow
self-assignment of privileged roles; allow controlled work to self-approve where separation is
required; bypass authorization for Super Admin unless explicitly permitted; introduce a
third-party authorization platform without approval; begin Phase 1E automatically; deploy
production.

---

## 34. Completion condition

Phase 1D is complete only when:

1. RBAC implementation is complete within authorized scope.
2. Role/permission database migrations are complete.
3. Permission catalog is documented.
4. Role-permission matrix is documented.
5. Project-scoped authorization works where required.
6. Confidential-field authorization works.
7. Separation-of-duties enforcement works.
8. Privilege-escalation tests pass.
9. API authorization tests pass.
10. Frontend authorization tests pass.
11. Code review is complete.
12. Security review is complete.
13. Documentation and traceability are updated.
14. Phase 1D validation report is complete.
15. Phase 1D approval checklist is produced.
16. Exact remote commit SHA is verified and recorded.

Stop after Phase 1D. Wait for human approval before Phase 1E: Immutable Audit Logging, Operational
Job Records, and Core System Operations Foundation.

---

## Note from the user (added when this brief was supplied, not part of the numbered sections)

"One point I would emphasize to the development team: **Phase 1D should create the authorization
engine once and make future modules consume it.** We do not want each of the 43 dashboard modules
inventing its own role checks later."

This is directly consistent with §13 (centralized authorization service, decorators/guards as thin
callers, not the source of truth) — flagged here separately since it's a design principle worth
keeping visible on its own, not just embedded in one numbered section.
