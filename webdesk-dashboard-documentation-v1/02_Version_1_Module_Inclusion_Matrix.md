# Version 1 Module Inclusion Matrix

## Scope classifications

- **Full V1:** complete operational capability required for launch.
- **Simplified V1:** usable core capability, with advanced automation deferred.
- **Foundation Only:** records, views, and governance exist; automated execution is deferred.
- **Deferred:** not included beyond placeholders or integration contracts.

|   # | Module                             | V1 classification | Priority | Notes                                                               |
| --: | ---------------------------------- | ----------------- | -------- | ------------------------------------------------------------------- |
|   1 | Home                               | Full V1           | P0       | Project health, approvals, tasks, blockers, Git and release status  |
|   2 | Projects                           | Full V1           | P0       | WebDesk project configuration, roadmap, team, objectives, activity  |
|   3 | Business Knowledge Center          | Full V1           | P0       | Persona, marketing profile, service taxonomy, VTO, strategy inputs  |
|   4 | Website Strategy Center            | Full V1           | P0       | Navigation, page clusters, conversion, search, internal links       |
|   5 | Page Inventory                     | Full V1           | P0       | Canonical page registry and current/proposed status                 |
|   6 | Page Workspace                     | Full V1           | P0       | End-to-end page workflow and artifact history                       |
|   7 | Case Study Studio                  | Full V1           | P0       | Intake, missing information, proof, approvals, publishing workflow  |
|   8 | Case Study Library                 | Full V1           | P0       | Published/unpublished case-study records and relationships          |
|   9 | Portfolio Library                  | Full V1           | P0       | Portfolio records, categories, proof, publication state             |
|  10 | Brand Library                      | Simplified V1     | P1       | Brand assets, rules, versions, approvals                            |
|  11 | Design Reference Library           | Full V1           | P1       | Reference URL, screenshots, likes/dislikes, tags, approvals         |
|  12 | Asset Library                      | Full V1           | P0       | Private assets, permissions, metadata, usage, retention             |
|  13 | Design Token Library               | Full V1           | P1       | Approved tokens, versions, responsive/theme variants                |
|  14 | Component Library                  | Full V1           | P0       | Code/design links, states, usage, tests, deprecation                |
|  15 | Section and Pattern Library        | Full V1           | P1       | Reusable page patterns and supported page types                     |
|  16 | Page Template Library              | Full V1           | P1       | Page-type structures, required/optional sections                    |
|  17 | Wireframe Library                  | Full V1           | P1       | Mobile/desktop/tablet wireframes, versions, approvals               |
|  18 | Motion and Interaction Library     | Simplified V1     | P2       | Records and specs; advanced preview tooling deferred                |
|  19 | Design Review Center               | Full V1           | P1       | Creative, UX, responsive, accessibility, consistency review         |
|  20 | Service Library                    | Full V1           | P0       | Public/internal views, relationships, status, no pricing by default |
|  21 | Persona Library                    | Full V1           | P0       | ICPs, buyer roles, pains, triggers, messaging tracks                |
|  22 | Proof and Claims Library           | Full V1           | P0       | Claim-source linkage, verification, usage restrictions              |
|  23 | Keyword and Entity Library         | Full V1           | P0       | Research inputs, approval, page assignment, cannibalization         |
|  24 | Internal Linking Library           | Full V1           | P1       | Proposed, approved, implemented, verified links                     |
|  25 | Content Template Library           | Full V1           | P1       | Page-specific content and evidence requirements                     |
|  26 | Agent Directory                    | Foundation Only   | P1       | Agent metadata, versions, permissions, tests                        |
|  27 | Agent Specification Library        | Foundation Only   | P1       | Approved 19-section agent specs and history                         |
|  28 | Knowledge Library                  | Full V1           | P0       | Approved/advisory sources, ownership, confidentiality               |
|  29 | Workflow and Task Template Library | Full V1           | P0       | Standard manual Claude task packages                                |
|  30 | Ready for Claude Queue             | Full V1           | P0       | Manual execution queue, branch/PR/staging/production tracking       |
|  31 | Review and Approval Center         | Full V1           | P0       | Approve, revise, reject, compare, audit                             |
|  32 | Scan Center                        | Full V1           | P0       | Manual and scheduled website/repo/WordPress scans                   |
|  33 | Change Center                      | Full V1           | P0       | Before/after, source, severity, accept/reject/defer/apply           |
|  34 | Import and Export Center           | Full V1           | P0       | Versioned templates, dry run, row errors, rollback limits           |
|  35 | Technical Center                   | Full V1           | P0       | Code, lint, test, coverage, dependency, compatibility reports       |
|  36 | Release Center                     | Full V1           | P0       | Staging, production, hotfix, rollback, verification                 |
|  37 | Decision and Activity Log          | Full V1           | P0       | Business, content, design, PR, deployment, rollback, restore events |
|  38 | Help Center                        | Full V1           | P1       | Markdown help, screenshots, tutorials, versioning                   |
|  39 | Notification Center                | Full V1           | P0       | In-app and SMTP notifications, retries, failures                    |
|  40 | Users, Roles and Permissions       | Full V1           | P0       | SSO, local emergency accounts, deny-by-default RBAC                 |
|  41 | Integrations                       | Full V1           | P0       | GitHub, WordPress, Blob, SMTP, queues, Sentry, uptime               |
|  42 | System Settings                    | Full V1           | P0       | Configurable statuses, categories, limits, contacts, policies       |
|  43 | Audit Logs and System Health       | Full V1           | P0       | Immutable events, jobs, cron, scans, backups, health                |

## Deferred integrations

- Anthropic API execution
- automated agent orchestration from dashboard buttons
- mandatory malware-scanning provider
- continuous GA4/GSC performance ingestion
- public client portal
- billing and subscription management
- mobile application
- automated approval or production publishing
