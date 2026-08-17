# Information Architecture

**Status:** Proposed, pending approval alongside the rest of this package.

**Ground rule (design prompt §6):** _"Do not change module scope simply to improve navigation."_
Nothing in this document changes which of the 43 modules exist, what they're called, or which of
the 10 approved navigation groups (`home`, `projects`, `pages`, `libraries`, `workflow`, `scans`,
`technical`, `releases`, `help`, `settings`) each one belongs to — those are already real, seeded,
production data (`packages/database/src/migrations/00035-populate-module-registry-fields.ts`), and
already match the approved wireframe's own sidebar list (`07_Low_Fidelity_Wireframes.md` §1)
exactly. This document proposes **display-layer organization only** — how that existing data gets
presented so it stays navigable, per §6's own instruction to avoid "one overwhelming list."

## 1. The primary navigation is already correct — keep it

| Group       | Modules | Notes                                                                                                                            |
| ----------- | ------- | -------------------------------------------------------------------------------------------------------------------------------- |
| `home`      | 1       | Home                                                                                                                             |
| `projects`  | 1       | Projects                                                                                                                         |
| `pages`     | 2       | Page Inventory, Page Workspace                                                                                                   |
| `libraries` | **25**  | See §2 — this group needs sub-organization, not re-grouping                                                                      |
| `workflow`  | 2       | Ready for Claude Queue, Review & Approval Center                                                                                 |
| `scans`     | 2       | Scan Center, Change Center                                                                                                       |
| `technical` | 2       | Import & Export Center, Technical Center                                                                                         |
| `releases`  | 1       | Release Center                                                                                                                   |
| `settings`  | 6       | Decision & Activity Log, Notification Center, Users/Roles/Permissions, Integrations, System Settings, Audit Logs & System Health |
| `help`      | 1       | Help Center                                                                                                                      |

43 total, confirmed. This 10-group structure is kept as-is — it's the approved wireframe's own
information architecture, not a design invention, and the existing `AppShell` component already
renders it correctly (re-ordered to the approved sequence, not the API's alphabetical default —
see `16-existing-shell-gap-analysis.md`).

## 2. The real problem: 25 modules in one `libraries` group

No source document (Master Spec, Module Inclusion Matrix, or the wireframes) subdivides
`libraries` further — its 25-module membership is real, but a flat 25-item list under one sidebar
label is exactly the "overwhelming list" the design prompt's §5 asks to avoid, and it's the
group's _display_, not its _membership_, that needs solving.

**Proposal: a visual sub-heading structure inside the expanded `libraries` group, using each
module's existing `navigationOrder` — no new data field required.** The 25 modules already have a
real, meaningful order (from `00035`'s seed data); grouping them into labeled visual clusters that
follow that existing order needs no schema change, only a client-side rendering convention:

- **Strategy & Business** — Business Knowledge Center, Website Strategy Center
- **Case Studies & Portfolio** — Case Study Studio, Case Study Library, Portfolio Library
- **Design System** — Brand Library, Design Reference Library, Asset Library, Design Token
  Library, Component Library, Section & Pattern Library, Page Template Library, Wireframe
  Library, Motion & Interaction Library, Design Review Center
- **Content & Search** — Service Library, Persona Library, Proof & Claims Library, Keyword &
  Entity Library, Internal Linking Library, Content Template Library
- **Agents & Knowledge** — Agent Directory, Agent Specification Library, Knowledge Library,
  Workflow & Task Template Library

These five cluster labels are a **UI convenience only** — not a new `module_registry` field, not
a change to any module's `navigationGroup`. They are rendered as non-interactive section headers
inside the sidebar's `libraries` group (see `04-navigation-system.md` for exact rendering), sourced
entirely from each module's existing `key` mapped through a small client-side lookup table — the
same category of client-side-only mapping the shell already does for `NAV_GROUP_LABELS`. If this
clustering is later found to warrant a real schema field (e.g., a future `library_category`
column), that's a separate, explicit backend change — not something this design task authorizes.

This clustering is derived from the module registry's actual seed order and each module's own
purpose (per `03_Detailed_Module_Specifications.md`), not invented independently — see
`04-navigation-system.md`'s cross-reference table for the full 25-module mapping.

## 3. Module inclusion classification affects presentation, not visibility

`02_Version_1_Module_Inclusion_Matrix.md` classifies every module as **Full V1**, **Simplified
V1**, or **Foundation Only** (2 modules — Agent Directory, Agent Specification Library — are
Foundation Only; the rest are Full or Simplified V1; none are Deferred). This classification is
**not** the same axis as `implementation_status` (build progress) or RBAC visibility (who can see
a module) — it describes the module's _intended V1 depth_, and the UI should reflect that honestly
rather than presenting a Foundation Only module identically to a Full V1 one:

- **Full V1 / Simplified V1** modules, once built, get the complete page-pattern treatment defined
  in `07-page-patterns.md`.
- **Foundation Only** modules (Agent Directory, Agent Specification Library) get records/views/
  governance UI but no automated-execution affordances — their detail screens should not offer
  actions the module isn't scoped to perform in V1 (e.g., no "Run agent" button; per the
  Recommended Module Roadmap's own instruction, "Agents are not dashboard user accounts").

Until a module is actually built, its nav entry links to a page rendering `packages/ui`'s existing
`FeatureUnavailableState` — showing the registry's real `implementation_status`/`feature_status`
string honestly (currently `not_started` for 42 of 43, `in_development` for Projects) rather than
a 404 or a fake placeholder screen. This is already the pattern Phase 1F established; this
document keeps it as the standing IA rule for all not-yet-built modules.

## 4. Permission-based visibility is already correctly server-side

Confirmed in `16-existing-shell-gap-analysis.md`: `GET /me/navigation` already returns only the
modules the caller's effective capabilities permit; the shell renders exactly that list with no
client-side re-filtering. This IA document does not change that model — it only affects how the
(already-filtered) list is _organized_ once it reaches the client. A Read-Only-role user who can
see only 30 of 43 modules still sees those 30 organized by the same 10-group/5-cluster structure
above, just with fewer entries in each.

## 5. Home's special role

Home is the one screen every one of the 7 roles reaches by default and returns to most often
regardless of which modules they otherwise use daily — it is the IA's root, not just one module
among 43. `07_Low_Fidelity_Wireframes.md` §1 already specifies its content shape (Project Health
widgets, My Work, Critical Findings, Git/Release Status) — see `15-representative-screen-specifications.md`
for the detailed screen spec, and `02-recommended-direction.md` §"What to take from B and C" for
why Home earns slightly more visual care than a routine module screen without changing the overall
direction.

## 6. Global search vs. module search (design prompt §16)

Two distinct search surfaces, not one:

- **Global navigation/search** (header) — finds modules and records _across_ the system by name/ID
  (e.g., typing a Ready for Claude task ID or a page URL jumps directly to that record regardless
  of which module it lives in). This does not exist in the current shell (see
  `16-existing-shell-gap-analysis.md`) — it is new IA surface, specified functionally here and
  visually in `04-navigation-system.md`, with its actual search backend left to each module's own
  future implementation (this design task does not build search infrastructure).
- **Module search** (in-page) — searches within one library/list screen only, using the filters/
  search pattern in `08-tables-and-filters.md`. This already exists in production today (the
  Projects list page's search box) and is kept as the standard pattern for every list screen.

Do not conflate the two in a single search box — a query for "homepage" in module search should
only ever search the Page Inventory rows on screen; the same query in global search should surface
matches across any module.
