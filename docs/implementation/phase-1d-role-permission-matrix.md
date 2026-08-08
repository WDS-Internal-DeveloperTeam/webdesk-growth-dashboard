# Phase 1D (Expanded) — Role/Permission Matrix

**Status:** Draft, produced during implementation of
`docs/task-packages/phase-1d-rbac-permissions-expanded.md`. Reproduces the real, already-approved
matrix (`06_Roles_and_Permissions.md §3`, seeded by migration `00013`) and the new 43→21 module
registry mapping (migration `00015`), and classifies each permission group by the five categories
task package §29 requires: **system**, **project**, **confidential-field**, **approval**, and
**release** permissions.

## 1. Roles (7, migration `00013`)

| Key                          | Name                         |
| ---------------------------- | ---------------------------- |
| `super_admin`                | Super Admin                  |
| `owner_growth_approver`      | Owner / Growth Approver      |
| `marketing_editor`           | Marketing Editor             |
| `designer_creative_reviewer` | Designer / Creative Reviewer |
| `developer`                  | Developer                    |
| `qa_security_reviewer`       | QA / Security Reviewer       |
| `read_only`                  | Read-Only                    |

## 2. Permission groups (21, migration `00013`) — the real seeded matrix

Verbatim from `06_Roles_and_Permissions.md §3`, action letters expanded per
`docs/implementation/phase-1d-permission-catalog.md §1`. **Category** classifies each row per
task package §29's required distinction.

| Module (key)                                    | Category     | Super Admin  | Owner/Growth | Marketing | Designer | Developer | QA/Security | Read-Only |
| ----------------------------------------------- | ------------ | ------------ | ------------ | --------- | -------- | --------- | ----------- | --------- |
| `project_configuration`                         | Project      | VCEAM        | VEA          | V         | V        | V         | V           | V         |
| `business_knowledge`                            | System       | VCERAMX      | VCERAX       | VCES      | V        | V         | V           | V         |
| `website_strategy`                              | System       | VCERAMX      | VCERAX       | VCESR     | VCR      | V         | VR          | V         |
| `page_inventory`                                | System       | VCERAMX      | VCERAX       | VCES      | V        | VCE       | VR          | V         |
| `page_content`                                  | Approval     | VCERAPX      | VCERAPX      | VCESR     | VR       | V         | VR          | V         |
| `creative_design`                               | Approval     | VCERAPX      | VERAPX       | VR        | VCERAS   | V         | VR          | V         |
| `development_code`                              | Release      | VCERL        | VRL          | V         | V        | VCES      | VRA         | V         |
| `security_qa`                                   | Approval     | VCERAL       | VRL          | V         | V        | VR        | VCERAS      | V         |
| `case_studies`                                  | Approval     | VCERAPX      | VCERAPX      | VCESR     | VR       | V         | VR          | V         |
| `portfolio`                                     | Approval     | VCERAPX      | VCERAPX      | VCESR     | VR       | V         | VR          | V         |
| `service_persona_proof`                         | System       | VCERAMX      | VCERAX       | VCESR     | V        | V         | VR          | V         |
| `keyword_internal_links`                        | System       | VCERAMX      | VCERAX       | VCESR     | V        | V         | VR          | V         |
| `ready_for_claude`                              | System       | VCERAM       | VCERAM       | VCSE      | VCSE     | VCSE      | VCSE        | V         |
| `review_center`                                 | Approval     | VCERA        | VCERA        | VRA*      | VRA*     | VRA*      | VRA*        | V         |
| `scans`                                         | System       | VCERM        | VCR          | VR        | V        | VCER      | VCER        | V         |
| `change_center`                                 | Approval     | VCERA        | VCERA        | VRA*      | VRA*     | VRA*      | VRA*        | V         |
| `imports`                                       | System       | VCERAX       | VCERAX       | VCSEX*    | VCSEX*   | VCSEX*    | VCSEX*      | V         |
| `exports`                                       | System       | VX           | VX**         | VX**      | VX**     | VX**      | VX**        | V***      |
| `releases`                                      | Release      | VCERAL       | VCRAL*       | V         | V        | VCESR     | VRA         | V         |
| `users_roles`                                   | System       | VCERM        | VM****       | —         | —        | —         | —           | —         |
| `system_settings`                               | System       | VCERM        | VM*          | —         | —        | —         | —           | —         |
| Confidential fields (field-level, not a module) | Confidential | Configurable | Configurable | Denied    | Denied   | Denied    | Limited     | Denied    |

`*` = "assigned"/"limited" qualifiers from the source matrix (e.g. only on records assigned to
that user) — enforced at the business-workflow layer once those workflows exist; the seeded grant
itself is the same `role_permissions` row regardless. `**` = "subject to fields" (confidential
export still separately gated by `export_confidential`, not seeded — see
`docs/implementation/phase-1d-confidential-field-authorization.md`). `***` = "if allowed" — no
grant seeded for Read-Only on `exports`. `****` = "limited"/"assigned" — Owner/Growth holds a
narrower configure grant than Super Admin on `users_roles`/`system_settings`; both share the same
`VM` seeded actions in migration `00013`, with the narrowing itself intended as project/record
-level scoping the authorization framework supports (§3 of this doc) but no admin UI configures
yet.

Field-level `view_confidential`/`edit_confidential` actions exist in the grant vocabulary for
every module row above but are **seeded with zero grants** for every role — see
`docs/implementation/phase-1d-confidential-field-authorization.md`.

## 3. Module registry (43, migration `00015`) — mapped to the 21 permission groups above

Real dashboard modules from `02_Version_1_Module_Inclusion_Matrix.md`, each gated by exactly one
of the 21 permission-group rows above (`module_registry.permission_group_id`). No independent
grants exist at this granularity — see
`docs/implementation/phase-1d-permission-catalog.md §3` for why.

| Registry key                         | Name                               | Gated by (permission group) |
| ------------------------------------ | ---------------------------------- | --------------------------- |
| `home`                               | Home                               | `project_configuration`     |
| `projects`                           | Projects                           | `project_configuration`     |
| `business_knowledge_center`          | Business Knowledge Center          | `business_knowledge`        |
| `website_strategy_center`            | Website Strategy Center            | `website_strategy`          |
| `page_inventory`                     | Page Inventory                     | `page_inventory`            |
| `page_workspace`                     | Page Workspace                     | `page_content`              |
| `case_study_studio`                  | Case Study Studio                  | `case_studies`              |
| `case_study_library`                 | Case Study Library                 | `case_studies`              |
| `portfolio_library`                  | Portfolio Library                  | `portfolio`                 |
| `brand_library`                      | Brand Library                      | `creative_design`           |
| `design_reference_library`           | Design Reference Library           | `creative_design`           |
| `asset_library`                      | Asset Library                      | `creative_design`           |
| `design_token_library`               | Design Token Library               | `creative_design`           |
| `component_library`                  | Component Library                  | `creative_design`           |
| `section_and_pattern_library`        | Section and Pattern Library        | `creative_design`           |
| `page_template_library`              | Page Template Library              | `creative_design`           |
| `wireframe_library`                  | Wireframe Library                  | `creative_design`           |
| `motion_and_interaction_library`     | Motion and Interaction Library     | `creative_design`           |
| `design_review_center`               | Design Review Center               | `review_center`             |
| `service_library`                    | Service Library                    | `service_persona_proof`     |
| `persona_library`                    | Persona Library                    | `service_persona_proof`     |
| `proof_and_claims_library`           | Proof and Claims Library           | `service_persona_proof`     |
| `keyword_and_entity_library`         | Keyword and Entity Library         | `keyword_internal_links`    |
| `internal_linking_library`           | Internal Linking Library           | `keyword_internal_links`    |
| `content_template_library`           | Content Template Library           | `page_content`              |
| `agent_directory`                    | Agent Directory                    | `ready_for_claude`          |
| `agent_specification_library`        | Agent Specification Library        | `ready_for_claude`          |
| `knowledge_library`                  | Knowledge Library                  | `business_knowledge`        |
| `workflow_and_task_template_library` | Workflow and Task Template Library | `ready_for_claude`          |
| `ready_for_claude_queue`             | Ready for Claude Queue             | `ready_for_claude`          |
| `review_and_approval_center`         | Review and Approval Center         | `review_center`             |
| `scan_center`                        | Scan Center                        | `scans`                     |
| `change_center`                      | Change Center                      | `change_center`             |
| `import_and_export_center`           | Import and Export Center           | `imports` *                 |
| `technical_center`                   | Technical Center                   | `development_code`          |
| `release_center`                     | Release Center                     | `releases`                  |
| `decision_and_activity_log`          | Decision and Activity Log          | `system_settings` **        |
| `help_center`                        | Help Center                        | `system_settings`           |
| `notification_center`                | Notification Center                | `system_settings`           |
| `users_roles_permissions`            | Users, Roles and Permissions       | `users_roles`               |
| `integrations`                       | Integrations                       | `system_settings`           |
| `system_settings`                    | System Settings                    | `system_settings`           |
| `audit_logs_and_system_health`       | Audit Logs and System Health       | `system_settings` **        |

`*` — source module #34 covers both import and export in one 43-row entry; kept as one registry
row gated by `imports` — export-specific checks reference `exports` directly (a distinct
permission-group row), not through this registry entry. `**` — Decision/Activity Log and Audit
Logs/System Health are audit-log-subsystem territory (ADR-0017, Task 7); provisionally gated by
`system_settings` until Task 7 defines its own permission model — not a claim that this is their
final, approved gate.

## 4. Confidential-field permissions

Not a module row — a cross-cutting field-level axis (`06_Roles_and_Permissions.md §5`) enforced
independently of module-level grants via `view_confidential`/`edit_confidential` actions on the
_same_ module a confidential field belongs to. See
`docs/implementation/phase-1d-confidential-field-authorization.md`.
