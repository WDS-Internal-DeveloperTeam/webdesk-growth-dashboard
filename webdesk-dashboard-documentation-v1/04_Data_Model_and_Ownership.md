# Data Model and Ownership

## 1. Base entity standard

Every primary PostgreSQL entity should include:

```text
id                  UUID primary key
public_id           human-readable stable identifier, unique
project_id          UUID where project-scoped
version             integer, default 1
status              controlled enum or status reference
owner_user_id       UUID nullable
created_at          timestamptz
created_by          UUID
updated_at          timestamptz
updated_by          UUID
lock_version        integer for optimistic locking
deleted_at          timestamptz nullable
deleted_by          UUID nullable
retention_category  controlled value
confidentiality     public/internal/confidential/restricted
audit_context_id    UUID nullable
```

Use soft deletion where approved. Permanent deletion follows retention rules and legal-hold checks.

## 2. Core entities

### Projects and configuration

- `projects`
- `project_environments`
- `project_repositories`
- `project_users`
- `project_objectives`
- `roadmap_items`
- `operational_areas`
- `operational_contacts`

Key indexes: project status, environment, repository name, roadmap phase/status.

### Pages and artifacts

- `pages`
- `page_urls`
- `page_artifacts`
- `page_artifact_versions`
- `page_relationships`
- `page_component_usage`
- `page_deployments`

Unique constraints:

- active canonical URL per project;
- WordPress object ID per environment and object type;
- artifact type + page + version.

### Workflow, tasks, and approvals

- `workflow_definitions`
- `workflow_states`
- `workflow_transitions`
- `workflow_instances`
- `tasks`
- `task_dependencies`
- `task_attempts`
- `approvals`
- `review_assignments`
- `comments`

Indexes: status, assignee, due date, project, entity, priority, Ready-for-Claude status.

### Jobs and system execution

- `background_jobs`
- `background_job_attempts`
- `workflow_runs`
- `scheduled_jobs`
- `job_progress_events`
- `job_failures`

Job uniqueness uses `idempotency_key` plus job type and environment.

### Scans and changes

- `scan_definitions`
- `scan_runs`
- `scan_findings`
- `scan_evidence`
- `change_sets`
- `change_items`
- `change_decisions`

Indexes: scan type, status, severity, URL/entity, detected date, unresolved findings.

### Imports and exports

- `import_templates`
- `import_runs`
- `import_rows`
- `import_errors`
- `export_runs`

Idempotency: source file checksum, template version, and row external ID.

### Business and content libraries

- `service_categories`
- `services`
- `service_deliverables`
- `deliverables`
- `platforms_technologies`
- `service_platforms`
- `engagement_models`
- `service_engagement_models`
- `personas`
- `service_personas`
- `proof_claims`
- `claim_sources`
- `keywords`
- `entities`
- `keyword_entity_relationships`
- `page_keyword_assignments`
- `internal_links`
- `content_templates`
- `search_briefs`
- `schema_recommendations`

### Case studies and portfolio

- `case_studies`
- `case_study_sources`
- `case_study_claims`
- `case_study_assets`
- `case_study_consents`
- `case_study_approvals`
- `portfolio_items`
- `portfolio_assets`
- `portfolio_categories`
- `portfolio_item_categories`

### Brand and design

- `brand_assets`
- `design_references`
- `design_tokens`
- `design_token_versions`
- `components`
- `component_versions`
- `patterns`
- `page_templates`
- `wireframes`
- `motion_specs`
- `design_reviews`

### Agent and knowledge governance

- `agents`
- `agent_versions`
- `agent_permissions`
- `knowledge_sources`
- `agent_knowledge_sources`
- `task_templates`
- `agent_tests`

### Releases and technical assurance

- `pull_requests`
- `code_reviews`
- `security_findings`
- `qa_findings`
- `test_runs`
- `compatibility_reports`
- `releases`
- `release_artifacts`
- `deployments`
- `rollback_records`
- `smoke_tests`

### Users and authorization

- `users`
- `user_identities`
- `roles`
- `permissions`
- `role_permissions`
- `user_role_assignments`
- `project_role_assignments`
- `sessions`
- `account_recovery_requests`

### Notifications and integrations

- `notifications`
- `notification_recipients`
- `notification_delivery_events`
- `integrations`
- `integration_environments`
- `webhook_events`
- `secret_metadata`

### Operations, retention, and audit

- `audit_events`
- `retention_rules`
- `legal_holds`
- `deletion_runs`
- `backup_records`
- `restore_tests`
- `system_health_checks`
- `incident_records`
- `incident_updates`

## 3. Ownership matrix

| Data/artifact                   |              PostgreSQL |                      GitHub |               WordPress |                    Blob |                Env vars |
| ------------------------------- | ----------------------: | --------------------------: | ----------------------: | ----------------------: | ----------------------: |
| Users, roles, sessions          |                 Primary |                          No |                      No |                      No | SSO client secrets only |
| Task progress                   |                 Primary | Final task package snapshot |                      No |        Attachments only |                      No |
| Approved Markdown               |          Metadata/index |                     Primary | Optional published copy |      Large sources only |                      No |
| Code                            |     Deployment metadata |                     Primary |        Deployed runtime |                      No |                      No |
| Page publication state          |            Indexed copy |   Approved artifact/history |                 Primary |                      No |        Credentials only |
| Comments and review assignments |                 Primary |   Optional approved summary |                      No |                      No |                      No |
| Scans and progress              |                 Primary |      Final approved reports |                      No |                Evidence |      Provider keys only |
| Binary assets                   |                Metadata |     Public code assets only |         Published media | Primary private storage |                      No |
| Secrets                         | Reference metadata only |                       Never |                   Never |                   Never |                 Primary |
| Notifications                   |                 Primary |                          No |                      No |                      No |        SMTP secret only |
| Backups                         |                Metadata |        Procedures/manifests |           Source system |          Backup objects | Backup credentials only |

## 4. Indexing requirements

Mandatory indexes include:

- status + project for all workflow records;
- entity type + entity ID for artifacts, comments, approvals, audit events;
- created_at for retention queries;
- deleted_at for cleanup;
- normalized URL and canonical URL;
- full-text indexes for services, pages, knowledge, help, case studies;
- trigram indexes for title/name/URL fuzzy search;
- severity + unresolved for findings;
- idempotency keys for jobs, imports, webhooks, and notifications.

## 5. Versioning

- Approved artifacts are immutable.
- Editing an approved artifact creates a new draft version.
- `lock_version` prevents silent overwrites.
- Every approval references an exact entity version.
- Git-backed artifacts record repository, path, branch, commit SHA, and content checksum.

## 6. Confidentiality

Confidential and restricted fields must be column- or record-filtered in the API. Frontend hiding alone is insufficient.

Examples:

- commercial pricing;
- margin and internal cost;
- credentials;
- legal or security notes;
- confidential case-study sources;
- incident details.
