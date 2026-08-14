# [Module Display Name] — task package (template)

> **How to use this template:** Copy this file to
> `docs/task-packages/module-<key>-<short-slug>.md`, replace every `[bracketed]` placeholder with
> real content, and delete this instructions block. Do not fill in a section with a placeholder,
> an assumption, or an invented value — if the real answer isn't known yet, write "Not yet
> confirmed — see §N" and treat it as an open item, the same honesty discipline every prior phase
> in this project has followed (see `CLAUDE.md`). This template itself authorizes nothing; a real
> task package only exists once a real authorization to build the module has actually been given.

## 0. Pre-implementation verification (do this before writing any code)

Confirm each of the following against the **current** state of the repository — not memory, not
this template's own defaults — before starting:

- [ ] `docs/phase-plans/module-implementation-roadmap.md`'s wave for `[module_key]` — confirm
      every module it depends on (`module_registry.dependencies` for this key) is either already
      built (`implementation_status` beyond `not_started`) or is included in this same
      authorization. If `[module_key]` is part of a co-dependent group (roadmap §4), confirm the
      whole group's scope, not just this one module.
- [ ] The real `module_registry` row for `[module_key]` — `route`, `navigation_group`,
      `navigation_order`, `view_permission_action`, `action_permissions`, `confidentiality_level`,
      `documentation_reference`. Read the live row, don't assume it matches what's written
      elsewhere — the registry is the source of truth (Phase 1F,
      `docs/implementation/phase-1f-module-registry.md`).
- [ ] The permission group `[module_key]` maps to (the 21-row `modules` table,
      `docs/implementation/phase-1d-permission-catalog.md`) and its real seeded grants
      (`06_Roles_and_Permissions.md §3`) — confirm which roles actually have `view` (and any other
      real action this module needs) before assuming a role can use this module.
- [ ] The module's real field/workflow spec — `03_Detailed_Module_Specifications.md`'s entry for
      this module, plus any cross-references it names (data model doc, workflow state machine
      doc, API/integration contract). Do not invent fields, statuses, or workflow states beyond
      what the spec actually states.
- [ ] Whether this module's spec references any integration not yet built (WordPress, GitHub,
      SMTP, Blob business use, Queues/Workflows/Cron) — if so, treat that integration surface as
      its own explicitly out-of-scope item (§3 below), not something to build inline.
- [ ] The current gate state (`outputs/webdesk-growth-dashboard/project.json`'s `gates[]`) —
      confirm the most recent phase/slice gate is actually approved before starting new work on
      top of it, same check every prior phase package has run.
- [ ] No open Critical/High security finding blocks this module (`docs/security/` threat models,
      most recent security review) — confirm, don't assume clean.
- [ ] No production secret or credential needed for this module is missing —
      `docs/project-state/setup-input-register.md` — if one is missing, that's a blocker to flag
      before starting, not something to fake with a fixture value in real code paths.

## 1. Authorization

**Authorized by:** [exact instruction/decision that authorized this work, quoted or closely
paraphrased, with date]

**Scope:** [module key(s) — a single module, or a co-dependent group per roadmap §4]

## 2. Branch

Off `main` at commit `[SHA]`, branch `[branch-name]` — following this project's established
one-branch-per-slice pattern (never build multiple unrelated modules on one branch without a
specific reason to bundle them, e.g. a co-dependent group).

## 3. Scope

### In scope

- [Real business functionality this module package will build — CRUD surface, workflow states,
  specific fields, specific endpoints — enumerated concretely, not "full module support."]

### Explicitly out of scope

- [Any integration this module's spec references but that isn't separately authorized yet —
  name it and say so plainly, don't silently build a stub that looks real.]
- [Any adjacent module this one's spec cross-references but that is a separate roadmap wave/
  authorization.]
- [Anything the spec itself marks as post-V1, deferred, or "Simplified V1" scope — confirm the
  exact simplification, don't build the full version by default.]

## 4. Design decisions

[One numbered entry per non-obvious design choice this module's implementation requires — same
shape as every prior phase's task package "Design decisions" section (see e.g.
`docs/task-packages/phase-1e-operational-contacts.md`). Each entry should state the decision,
why it was made this way (which source document or prior precedent it follows), and what
alternative was rejected and why. Do not skip this section by writing "standard CRUD" — even a
simple module has at least one real choice (confidentiality handling, workflow states, permission
action naming) worth recording.]

## 5. Data model

[New tables/columns this module needs, referencing the real field list from
`03_Detailed_Module_Specifications.md`'s entry for this module — not a paraphrase, the actual
field names and types where the spec states them. Note explicitly which fields are Version 1 and
which the spec marks deferred.]

## 6. Permissions

- **View:** [confirm real permission-group grant this module's `view_permission_action` maps to —
  from the live registry row, not assumed]
- **Action permissions:** [any beyond plain `view` — confirm each maps to a real action already
  present, or is itself a change to the central authorization catalog requiring its own review,
  per the standing rule "no module may invent authorization outside the central catalog without
  an approved migration/change"]
- **Confidential fields:** [if `confidentiality_level` is non-null on the registry row, state
  exactly which fields are confidential and how `view_confidential`/`edit_confidential` (Phase
  1D-expanded) applies — or confirm no confidential-field mechanism is needed]

## 7. API surface

[Real endpoint list: method, path, request/response shape, which guard(s) apply. Follow the
`ApiSuccessResponse<T>`/`ApiErrorResponse` envelope and correlation-ID conventions already
established across every existing module.]

## 8. UI surface

[Real page(s)/route(s) in `dashboard-web`, using the shared page-shell components and UI states
from `packages/ui` (Phase 1F) rather than one-off markup. Confirm the route matches the registry
row's `route` field exactly.]

## 9. Tests

- [ ] Unit tests for new services
- [ ] Real-database integration tests for new repositories/migrations
- [ ] e2e/controller tests for new endpoints, including at least one permission-denied case
- [ ] Playwright coverage for the new UI surface, if it changes user-facing behavior
      meaningfully enough to warrant it (not required for every trivial page)

## 10. Validation checklist (run before requesting a gate)

- [ ] Fresh disposable database migration up/down round-trip
- [ ] `pnpm typecheck` / `pnpm lint` / `pnpm format` clean across every touched package
- [ ] Full unit + integration + e2e suite passing (not just the new module's own tests — the
      whole monorepo, since a shared file may have been touched)
- [ ] `pnpm audit` clean (or any new finding explicitly triaged)
- [ ] Module-registry and permission-mapping validation still passes
      (`pnpm --filter @webdesk/database validate:module-registry`)
- [ ] `module_registry.implementation_status` for this module updated to reflect real, current
      status — never left at `not_started` once real functionality exists, never advanced past
      what's actually true

## 11. Documentation deliverables

- [ ] `docs/implementation/[module-key]-[topic].md` — as-built record, same shape as every prior
      phase's implementation docs
- [ ] Validation report
- [ ] Updates to `docs/traceability/phase-0-requirements-traceability.md` if this module closes
      a traceability item
- [ ] `outputs/webdesk-growth-dashboard/HANDOFF.md` update

## 12. Git workflow

Commit incrementally per logical slice (same discipline as every prior phase). Push the branch.
**Do not merge without explicit authorization.** Do not deploy. Do not start the next module or
wave automatically — each is its own separate authorization, same as this one was.
