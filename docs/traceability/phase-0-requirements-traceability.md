# Phase 0 Requirements Traceability Matrix

**Status:** Draft. No requirement below is marked implemented — Phase 0 produces architecture and contracts, not code. Statuses used: Documented, Architecture Defined, Contract Defined, Deferred to Environment Setup, Deferred to Implementation, Requires Human Approval, Blocked.

| Req ID | Source | Phase | Owning App/Package | Delivery Role | Business Agent | ADR | Contract | Test Type | Gate | Status | Notes |
|---|---|---|---|---|---|---|---|---|---|---|---|
| REQ-001 | `01_Dashboard_Master_Specification.md` — overall architecture | 0 | apps/*, packages/* | Architect | — | ADR-0001, 0002 | — | N/A (structural) | G1 | Architecture Defined | Monorepo boundaries and Next.js/NestJS split |
| REQ-002 | `01_...md` — Vercel hosting | 0 | dashboard-api, dashboard-worker | Architect | — | ADR-0003, 0004, 0005 | vercel-background-jobs | Integration test | G1 | Architecture Defined | No permanent worker process (WDS-005) |
| REQ-003 | `01_...md` — PostgreSQL + Sequelize | 0 | packages/database | Architect, DBA | — | ADR-0006, 0007 | database | Migration test | G-Schema | Architecture Defined | Provider unconfirmed (blocked on setup input) |
| REQ-004 | `01_...md` — No ACF/ACF Local JSON | 0 | apps/dashboard-web (WordPress theme, separate repo) | Architect | WordPress Engineering Agent (taxonomy 2, product data) | ADR-0020 | wordpress-integration | N/A (policy) | G1 | Architecture Defined | Conflict resolved — see ADR-0020 |
| REQ-005 | `01_...md` — Google Workspace SSO | 0 | dashboard-api | Architect | — | ADR-0008, 0009 | google-workspace-auth | Auth flow test | G1 | Requires Human Approval | JIT vs. pre-provisioned decision open |
| REQ-006 | `01_...md` — Google Workspace SMTP only, no third-party email API | 0 | dashboard-api, dashboard-worker | Architect | — | ADR-0015 | google-workspace-smtp | Integration test | G1 | Architecture Defined | WDS-004 absolute rule |
| REQ-007 | `01_...md` — GitHub App integration | 0 | dashboard-api | Architect | Release and Memory Coordinator (taxonomy 2) | ADR-0011 | github-integration | Webhook signature test | G-Contracts | Architecture Defined | App creation is a setup-time input |
| REQ-008 | `01_...md` — Vercel Blob private storage | 0 | dashboard-api | Architect | — | ADR-0014 | vercel-blob | Access-control test | G-Contracts | Architecture Defined | Upload-size threshold deferred |
| REQ-009 | `02_Version_1_Module_Inclusion_Matrix.md` — V1 module scope | 1+ | apps/dashboard-web, dashboard-api | PM | (varies by module) | — | — | — | G1 | Documented | Module-by-module implementation deferred to Phase 1+ |
| REQ-010 | `03_Detailed_Module_Specifications.md` — Agent Directory / Agent Specification Library | 6+ | dashboard-api, dashboard-web | Backend, Frontend | Website Growth Director (owns the directory content, taxonomy 2) | ADR-0019 | — | Module test | G4 | Documented | Taxonomy separation resolved (ADR-0019); implementation deferred |
| REQ-011 | `03_...md` — Ready for Claude Queue | 5+ | dashboard-api, dashboard-web | Backend, Frontend, Delivery Head | — | ADR-0011, 0018 | github-integration | Module test | G4 | Documented | Manual-execution boundary fixed (ADR-0018) |
| REQ-012 | `03_...md` — Notification Center | 2+ | dashboard-worker, dashboard-api | Backend | — | ADR-0004, 0005, 0015 | google-workspace-smtp, vercel-background-jobs | Module test | G4 | Documented | |
| REQ-013 | `03_...md` — Scan Center | 6+ | dashboard-worker, dashboard-api | Backend | Site Intelligence and Inventory Agent (taxonomy 2) | ADR-0004, 0005 | vercel-background-jobs | Module test | G4 | Documented | |
| REQ-014 | `04_Data_Model_and_Ownership.md` — full data model | 0/1 | packages/database | Architect, DBA | — | ADR-0006, 0016, 0017 | database | Migration test | G-Schema | Architecture Defined | Full schema authored at G-Schema, Phase 1 |
| REQ-015 | `05_Workflow_State_Machines.md` — approval workflows | 1+ | dashboard-api | Backend | — | ADR-0010, 0018 | — | Module test | G4 | Documented | Implementation deferred |
| REQ-016 | `06_Roles_and_Permissions.md` — RBAC model | 0/1 | dashboard-api | Architect, Backend | — | ADR-0010 | — | Authz test | G1/G-Contracts | Architecture Defined | Full role-permission matrix implemented Phase 1 |
| REQ-017 | `06_...md` — separation of duties | 0 | dashboard-api | Architect | — | ADR-0010 | — | Authz test | G1 | Architecture Defined | Restated from skill's own security-controls rule |
| REQ-018 | `07_Low_Fidelity_Wireframes.md` — UI structure | 3+ | dashboard-web | Designer, Frontend | — | ADR-0002 | — | Visual/UX test | G4 | Documented | Implementation deferred |
| REQ-019 | `08_API_and_Integration_Contracts.md` — GitHub/WordPress/Google contracts | 0 | dashboard-api | Architect | — | ADR-0011, 0012, 0013, 0008, 0015 | all 7 contracts | Contract test | G-Contracts | Contract Defined | This Phase 0's own §7 deliverable |
| REQ-020 | `09_Security_Backup_Retention_Operations.md` — backup cadence | 0 | packages/database, WordPress theme repo | Architect, Security Owner | — | ADR-0007, 0017 | database | Backup restore test | G1/G5.5 | Architecture Defined | Cadence confirmed (35-day/1-year); execution deferred |
| REQ-021 | `09_...md` — audit logging | 0 | packages/database | Architect | — | ADR-0017 | database | Immutability test | G-Schema | Architecture Defined | |
| REQ-022 | `09_...md` — formal threat model | 0 | N/A (documentation) | Architect, Security Owner | — | — | — | N/A | G1 | Documented | See `docs/security/threat-model-plan.md` — this Phase 0's own §10 deliverable, resolves the previously-deferred item |
| REQ-023 | `10_WordPress_Integration_and_Migration.md` — REST/Application Passwords | 0 | dashboard-api (WordPress theme, separate repo) | Architect | — | ADR-0012 | wordpress-integration | Integration test | G-Contracts | Contract Defined | REST API availability unconfirmed |
| REQ-024 | `10_...md` — controlled production WP-CLI | 0 | N/A (operational policy) | Architect, DevOps | — | ADR-0013 | wordpress-integration | N/A (policy) | G-Contracts | Architecture Defined | |
| REQ-025 | `10_...md` — CaseStudy/Portfolio migration (Option A) | 5+ | WordPress theme repo | WordPress-role delivery agent | WordPress Engineering Agent (taxonomy 2) | ADR-0020 | wordpress-integration | Migration test | G4 | Documented | Meta-key mappings already confirmed; implementation deferred |
| REQ-026 | `11_Acceptance_Criteria_and_Test_Plan.md` — test strategy | 1+ | all apps | QA | — | — | — | (defines test types) | G4/G5 | Documented | WordPress CI-safe testing strategy gap still open, see `docs/skill-build/unresolved-items.md §C` |
| REQ-027 | `12_Open_Items_and_Implementation_Inputs.md` — setup inputs | 0 | N/A | PM | — | — | — | N/A | N/A | Documented | Captured in `docs/project-state/setup-input-register.md` — this Phase 0's own §12 deliverable |

## Coverage note

Every one of the 12 Dashboard Documentation Pack files has at least one row above; module-level detail (individual features within `03_Detailed_Module_Specifications.md`) is intentionally summarized at the module level for Phase 0 rather than exploded into dozens of rows — a finer-grained traceability matrix is a natural Phase 1+ artifact, built once implementation actually begins and real file paths/PRs exist to trace to.

## What Phase 0 does NOT claim

No row above is marked "Implemented" or "Tested" — Phase 0 produces architecture decisions, contracts, and plans. The earliest any row can move to an implementation-related status is Phase 1, gated on human approval of this Phase 0 foundation.
