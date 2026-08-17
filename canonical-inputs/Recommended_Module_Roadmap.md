# Recommended Module Roadmap

**Source:** Supplied by the project owner on 2026-08-17, from
`/Users/admin/Downloads/webdesk-headless-v1.11.29/Recommended Module Roadmap.md` (WebDesk's own
`webdesk-headless` project tree, version `v1.11.29` — external to this repo, not itself under
version control here). Registered verbatim below.

**Status: recorded for future reference only. Not an authorization to build anything.** Per the
project owner's own explicit instruction at hand-off: _"keep this recorded for the future
conversations... Do not start building these for your knowledge, we will tell you when to start."_
No module listed here is started, scoped, or task-packaged as of this entry — each remains its own
separate, explicit, not-yet-requested authorization, unchanged from this project's standing
discipline for every phase and slice so far (see `CLAUDE.md`'s "Active tasks" / "Recent decisions"
history).

## Relationship to the existing dependency-computed roadmap

This document is **not** the same artifact as
`docs/phase-plans/module-implementation-roadmap.md` (the Phase 1F wave assignment mechanically
computed from `module_registry.dependencies` via Tarjan SCC + topological sort). That document
answers "what order does the _data model_ require"; this one is the project owner's own
**recommended build order and per-module special instructions**, supplied independently. The two
may agree or disagree on ordering for a given module — if they do disagree when a module is
actually proposed for authorization, that conflict should be surfaced and resolved with the
project owner directly at that time (per `knowledge/00-scope-and-precedence.md §3`'s
conflict-handling rule), not silently resolved in either direction by picking one document over
the other.

## The roadmap (verbatim)

### **Recommended module roadmap**

| Order | Module                               | Wave | Special instruction                                                                                                                                                                                                                  |
| ----- | ------------------------------------ | ---- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| 1     | **Projects**                         | 1    | **Start here.** Establish project context used by almost everything else. Do not create multi-tenancy just because two Workspace domains exist. Prevent destructive deletion when dependent records exist.                           |
| 2     | **Business Knowledge Center**        | 1    | Store/manage VTO, Persona, Marketing Profile, Service Bucket and approved business knowledge. **Git owns approved durable docs; PostgreSQL owns workflow/status/metadata. Pricing and confidential commercial rules stay excluded.** |
| 3     | **Service Library**                  | 1    | Stable Service IDs, categories, deliverables, platforms/technology and relationships. No pricing. Support versioning, approval and future imports.                                                                                   |
| 4     | **Persona Library**                  | 1    | Support ICP-1 through ICP-4 and future versions. The Growth Director may recommend changes but cannot silently modify approved personas.                                                                                             |
| 5     | **Proof & Claims Library**           | 1    | Evidence first. Every public claim needs source/verification/usage status. Never invent metrics. Confidential claims need separate access control.                                                                                   |
| 6     | **Website Strategy Center**          | 2    | Growth Director's main strategic workspace. Marketing plan + website strategy + service priorities + channel/search direction. Preserve versions when WebDesk changes business direction.                                            |
| 7     | **Page Inventory**                   | 2    | Canonical inventory of pages, URLs, status, template, page type, SEO state and classification: Keep/Optimize/Restructure/Redesign/Rebuild/Consolidate. Live/repo evidence must outrank roadmap claims.                               |
| 8     | **Keyword & Entity Library**         | 2    | Search data must record source, country, date, confidence and approval. Paid-search evidence must remain distinguishable from organic evidence. No outdated "LSI" concept.                                                           |
| 9     | **Internal Linking Library**         | 2    | Use stable Page IDs for relationships. Maintain Proposed → Approved → Implemented → Verified states. Do not silently create links to nonexistent pages.                                                                              |
| 10    | **Content Template Library**         | 2    | Templates are guidance, not keyword-stuffing mandates. Version and approve them. Search guidance cannot override editorial quality.                                                                                                  |
| 11    | **Review & Approval Center**         | 3    | **Build before Page Workspace.** Generic approval system for all future modules. Enforce separation of duties and preserve immutable approval events.                                                                                |
| 12    | **Page Workspace**                   | 3    | Implement the approved existing/new page workflows and stage gates. Claude receives only one authorized stage. No automatic progression through stages.                                                                              |
| 13    | **Brand Library**                    | 4    | Store approved brand rules/assets/references. Do not confuse website brand tokens with dashboard application CSS.                                                                                                                    |
| 14    | **Design Reference Library**         | 4    | Store examples, screenshots, references and design rationale with provenance/status. References are inspiration, not automatically approved patterns.                                                                                |
| 15    | **Asset Library**                    | 4    | Track ownership/licence/alt text/file status/usage. Private assets remain private until approved.                                                                                                                                    |
| 16    | **Design Token Library**             | 4    | Build canonical **WordPress website** design tokens. Keep completely isolated from dashboard UI tokens. Version changes.                                                                                                             |
| 17    | **Component Library**                | 4    | Every component needs design, PHP/HTML, SCSS, JS, responsive, accessibility, states, tests and version information.                                                                                                                  |
| 18    | **Section & Pattern Library**        | 4    | Compose approved components into reusable sections/patterns. Avoid uncontrolled page-specific copies.                                                                                                                                |
| 19    | **Page Template Library**            | 4    | Define reusable page architecture by page type. No Elementor/page-builder dependency.                                                                                                                                                |
| 20    | **Wireframe Library**                | 4    | Wireframes are structured planning artifacts and require approval before implementation.                                                                                                                                             |
| 21    | **Motion & Interaction Library**     | 4    | Respect reduced motion, keyboard access and accessibility. Motion must serve UX rather than decoration alone.                                                                                                                        |
| 22    | **Design Review Center**             | 4    | Independent creative/UX/design-system review. Designer should not automatically approve own controlled changes.                                                                                                                      |
| 23    | **Case Study Studio**                | 5    | Evidence + permissions workflow. Client-name, logo, testimonial, screenshot, metric and publication permissions tracked independently. Never invent results.                                                                         |
| 24    | **Case Study Library**               | 5    | Approved/structured case-study records. Preserve IDs, URLs and WordPress relationships when migration begins.                                                                                                                        |
| 25    | **Portfolio Library**                | 5    | Portfolio can exist without measurable results, but project facts still require evidence. Keep case study vs portfolio distinction.                                                                                                  |
| 26    | **Agent Directory**                  | 6    | Register the 15 approved agents and versions. **Agents are not dashboard user accounts.**                                                                                                                                            |
| 27    | **Agent Specification Library**      | 6    | Every agent uses the approved 19-section format. Specs are versioned and approval controlled.                                                                                                                                        |
| 28    | **Knowledge Library**                | 6    | Every source needs provenance, date, confidence, confidentiality and approval-for-agent-use status. Do not permanently feed unapproved SEO data or pricing into agent memory.                                                        |
| 29    | **Workflow & Task Template Library** | 6    | Store reusable approved workflows and Ready-for-Claude task packages. Templates never authorize execution by themselves.                                                                                                             |
| 30    | **Ready for Claude Queue**           | 7    | **Critical rule: V1 is manual Claude Code execution.** No Anthropic API automation. Task must define authorized stage, inputs, outputs, restrictions, branch and completion evidence.                                                |
| 31    | **Scan Center**                      | 8    | Scanner collects facts; Claude interprets them. Support live site/repo/WP scans and later AI-citation observations. No automatic repairs/deletions.                                                                                  |
| 32    | **Change Center**                    | 8    | Proposed changes only. Show old/new/source/confidence. Human can Accept/Reject/Merge/Defer/Assign. No silent overwrite.                                                                                                              |
| 33    | **Import/Export Center**             | 8    | Dry run first, mapping, validation, duplicate strategy, partial-success reporting, rollback limitations and idempotency. Broken relationships block final import.                                                                    |
| 34    | **Technical Center**                 | 9    | Technical configuration/status/evidence. Do not let it become a second source of business truth or secrets store.                                                                                                                    |
| 35    | **Release Center**                   | 9    | Exact Git SHAs, staging approval, production approval, deployment result and rollback version. Claude never automatically merges/deploys.                                                                                            |
| 36    | **Decision & Activity Log**          | 9    | Human-friendly decision/activity view. Keep distinct from immutable seven-year compliance audit records.                                                                                                                             |
| 37    | **Help Center**                      | 10   | Markdown-based module help. Module changes should require documentation updates.                                                                                                                                                     |
| 38    | **Notification Center**              | 10   | Reuse Phase 1E notification infrastructure. Distinguish Queued/Sent to SMTP/Accepted/Failed/Retrying/Permanently Failed. Never falsely say delivered.                                                                                |
| 39    | **Users / Roles / Permissions**      | 10   | Phase 1D already built the RBAC core. Build/administer the UI here; **do not redesign authorization architecture.**                                                                                                                  |
| 40    | **Integrations**                     | 10   | GitHub, WP, Google, etc. behind adapters, environment-specific identities and least privilege. Never display/store secret values.                                                                                                    |
| 41    | **System Settings**                  | 10   | Non-secret application configuration and references only. Secret values remain environment-managed.                                                                                                                                  |
| 42    | **Audit Logs & System Health**       | 10   | Read-only audit exploration + truthful health. Audit retention 7 years. `Not Configured/Unknown` must not appear as `Healthy`.                                                                                                       |
| 43    | **Home**                             | 10   | Build the real dashboard home **last**, after meaningful data exists. Do not fabricate traffic, SEO, leads, citation metrics or approval counts.                                                                                     |

## Notable specific instructions worth surfacing early

A few rows carry constraints that are directly relevant to work already done or standing rules
already in this repo, worth flagging now rather than only at build time:

- **Row 1 (Projects) — "Do not create multi-tenancy... Prevent destructive deletion when dependent
  records exist."** Both already satisfied by the live Projects module: this project's single-tenant
  model is unchanged (`project.json`'s `tenant.mode: "per-client"`), and `projects` has no
  hard-delete endpoint at all (archive-only, per ADR-0016) with `RoadmapItemsService.remove()`
  rejecting removal of a project's active phase until reassigned.
- **Row 11 (Review & Approval Center) — "Build before Page Workspace."** An explicit sequencing
  dependency stronger than "same wave" — Page Workspace (row 12) should not be authorized before
  Review & Approval Center (row 11) even though the dependency-computed roadmap's own wave
  structure doesn't necessarily enforce that same order.
- **Row 30 (Ready for Claude Queue) — "V1 is manual Claude Code execution. No Anthropic API
  automation."** A standing architectural constraint for that module's eventual build, consistent
  with this project's own established "no automated merge/deploy" discipline elsewhere.
- **Row 39 (Users / Roles / Permissions) — "do not redesign authorization architecture."** Directly
  reiterates this project's own standing caution (`CLAUDE.md`'s Cautions section) that Phase 1D's
  `AuthorizationService`/RBAC core is the settled mechanism; this module is UI/admin surface only.

## What this does not do

- Does not authorize building any module.
- Does not supersede or amend `docs/phase-plans/module-implementation-roadmap.md`.
- Does not change any already-approved architecture, gate, or Cautions entry in `CLAUDE.md`.
