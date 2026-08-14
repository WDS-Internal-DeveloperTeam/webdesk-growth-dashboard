# Module Implementation Roadmap

**Status:** Planning artifact only (Phase 1F brief §42–§44). Produced, not executed — this
document sequences future work; it does not authorize any of it. Building any module's real
business functionality remains a separate, explicit authorization, same as every phase before it.

## 1. Purpose and scope

Phase 1F builds the application shell, the canonical 43-module registry, and permission-aware
navigation — but deliberately builds **zero** business functionality for any of the 43 modules
(`module_registry.implementation_status = 'not_started'` for all 43, see
`docs/implementation/phase-1f-module-registry.md`). This document answers the next question that
raises: **in what order should the 43 modules actually be built**, once each is separately
authorized? It is derived entirely from the real `dependencies` field seeded in migration
`00035-populate-module-registry-fields.ts` — not a fresh judgment call — so it stays consistent
with what the registry itself already declares.

## 2. Method

`module_registry.dependencies` is a per-module list of other module keys it depends on. Treating
this as a directed graph (edge: module → the modules it depends on) and computing strongly
connected components (Tarjan's algorithm) plus a topological sort of the condensed graph produces
a wave assignment: every module in wave _N_ has all of its dependencies satisfied by modules in
waves `1..N-1` (or by other modules in the same wave, for modules that are mutually dependent —
see §4).

This is a mechanical computation over already-approved data, not a new design decision. The full
computation (including the raw dependency list transcribed directly from the migration) is
reproducible — see the appendix script reference in §6.

## 3. The waves

**A wave is not a build schedule.** Modules within the same wave have no dependency ordering
between them and can be authorized/built in any order, or in parallel across independent efforts —
"wave" means "everything this module needs is available no later than this point," not "must
happen at this exact moment." Wave 1 in particular is large (24 of 43 modules) precisely because
most modules have no real prerequisite.

### Wave 1 — no dependencies (24 modules)

| Module key                           | Display name                       | Nav group |
| ------------------------------------ | ---------------------------------- | --------- |
| `agent_specification_library`        | Agent Specification Library        | libraries |
| `asset_library`                      | Asset Library                      | libraries |
| `audit_logs_and_system_health`       | Audit Logs and System Health       | settings  |
| `brand_library`                      | Brand Library                      | libraries |
| `business_knowledge_center`          | Business Knowledge Center          | libraries |
| `content_template_library`           | Content Template Library           | libraries |
| `decision_and_activity_log`          | Decision and Activity Log          | settings  |
| `design_reference_library`           | Design Reference Library           | libraries |
| `design_token_library`               | Design Token Library               | libraries |
| `help_center`                        | Help Center                        | help      |
| `import_and_export_center`           | Import and Export Center           | technical |
| `integrations`                       | Integrations                       | settings  |
| `knowledge_library`                  | Knowledge Library                  | libraries |
| `motion_and_interaction_library`     | Motion and Interaction Library     | libraries |
| `notification_center`                | Notification Center                | settings  |
| `page_inventory`                     | Page Inventory                     | pages     |
| `portfolio_library`                  | Portfolio Library                  | libraries |
| `projects`                           | Projects                           | projects  |
| `scan_center`                        | Scan Center                        | scans     |
| `section_and_pattern_library`        | Section and Pattern Library        | libraries |
| `system_settings`                    | System Settings                    | settings  |
| `technical_center`                   | Technical Center                   | technical |
| `users_roles_permissions`            | Users, Roles and Permissions       | settings  |
| `workflow_and_task_template_library` | Workflow and Task Template Library | libraries |

### Wave 2 — depends only on Wave 1 (12 modules, one co-dependent pair — see §4)

| Module key                   | Depends on                                                |
| ---------------------------- | --------------------------------------------------------- |
| `agent_directory`            | `agent_specification_library`, `knowledge_library`        |
| `case_study_library`\*       | `case_study_studio`                                       |
| `case_study_studio`\*        | `proof_and_claims_library`, `asset_library`               |
| `change_center`              | `scan_center`                                             |
| `component_library`          | `design_token_library`                                    |
| `internal_linking_library`\* | `page_inventory`, `website_strategy_center`               |
| `page_workspace`             | `page_inventory`                                          |
| `persona_library`\*          | `service_library`                                         |
| `proof_and_claims_library`\* | `case_study_studio`, `service_library`                    |
| `ready_for_claude_queue`     | `workflow_and_task_template_library`                      |
| `service_library`\*          | `persona_library`, `case_study_library`, `page_inventory` |
| `website_strategy_center`\*  | `page_inventory`, `internal_linking_library`              |

\* — member of a co-dependent group; see §4.

### Wave 3 — depends on Wave 1/2 (3 modules)

| Module key                   | Depends on                                                              |
| ---------------------------- | ----------------------------------------------------------------------- |
| `keyword_and_entity_library` | `website_strategy_center`, `page_inventory`                             |
| `page_template_library`\*    | `section_and_pattern_library`, `component_library`, `wireframe_library` |
| `wireframe_library`\*        | `page_template_library`                                                 |

### Wave 4 — `design_review_center`

Depends on `component_library`, `design_token_library`, `section_and_pattern_library`,
`page_template_library`, `wireframe_library`, `motion_and_interaction_library`.

### Wave 5 — `review_and_approval_center`

Depends on `page_workspace`, `case_study_studio`, `ready_for_claude_queue`, `design_review_center`.

### Wave 6 — `release_center`

Depends on `ready_for_claude_queue`, `technical_center`, `review_and_approval_center`.

### Wave 7 — `home`

Depends on `page_inventory`, `ready_for_claude_queue`, `review_and_approval_center`, `scan_center`,
`release_center`, `notification_center`, `audit_logs_and_system_health` — the executive-summary
module, correctly last: it has the widest fan-in of any module in the registry.

## 4. Co-dependent groups (real cycles in the seeded data — flagged, not resolved)

The dependency graph as seeded in migration `00035` contains three genuine cycles — pairs/clusters
of modules whose specs reference each other's data model. This is expected for a module inclusion
matrix authored per-module rather than as a strict build DAG (a case study genuinely references
proof/claims, and a claim genuinely references the case study that substantiates it — the
relationship is real and bidirectional, not a documentation error). Rather than picking an
arbitrary order between them, each group is treated as a single unit for scheduling purposes —
build the whole group together, in one authorization, or in a tightly-coordinated sequence within
the same wave:

1. **`case_study_studio` ↔ `proof_and_claims_library` ↔ `service_library` ↔ `persona_library` ↔
   `case_study_library`** (5 modules) — the largest cluster, all in the "libraries" nav group's
   proof/service/persona/case-study family.
2. **`page_template_library` ↔ `wireframe_library`** — a template references its wireframe and a
   wireframe references the template it implements.
3. **`website_strategy_center` ↔ `internal_linking_library`** — strategy references planned
   internal links and internal-link records reference the strategy that justified them.

Whoever authorizes work inside one of these groups should treat the group as the real unit of
scope, not any single module in it — building `case_study_studio` alone without
`proof_and_claims_library`, for example, would leave its own real dependency unmet.

## 5. How this roadmap should actually be used

1. When a module (or a co-dependent group) is proposed for authorization, check this document for
   its wave and confirm every dependency it lists is either already built or is included in the
   same authorization.
2. This roadmap does not itself authorize anything — per this project's established pattern (every
   phase and slice so far), building a module's real business functionality still needs its own
   explicit "begin module X" instruction, its own task package (see
   `docs/task-packages/templates/module-implementation-task-template.md`), and its own gate
   approval before merge.
3. If a future change to `module_registry.dependencies` (a new migration) changes any module's
   dependency list, this document should be regenerated from the new data — it is a snapshot of
   migration `00035`'s dependency graph, not an independently-maintained plan that can drift from
   the registry.

## 6. Reproducing this computation

The wave assignment above was computed by transcribing `module_registry.dependencies` from
`packages/database/src/migrations/00035-populate-module-registry-fields.ts` into an adjacency
list, then running Tarjan's SCC algorithm followed by a topological sort of the condensed graph.
No module or dependency edge was added, removed, or reinterpreted in that transcription — this
document's wave/group structure is a direct, mechanical consequence of the already-approved
registry data, not a new judgment call about module priority or business value.
