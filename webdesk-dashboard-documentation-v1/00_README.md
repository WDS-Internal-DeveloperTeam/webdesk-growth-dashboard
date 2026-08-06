# WebDesk Website Growth Dashboard — Documentation Pack

**Version:** 1.0 Draft  
**Date:** 2026-08-04  
**Owner:** WebDesk Solution  
**Status:** Development-ready draft for leadership and technical review

## Purpose

This package converts the approved dashboard, workflow, WordPress, infrastructure, governance, security, and data-library decisions into a structured implementation specification.

The dashboard is a private WebDesk application for planning, reviewing, approving, building, scanning, releasing, and governing the WebDesk Solution website. Version 1 does not call Anthropic automatically. Claude Code is invoked manually by an authorized operator from a trusted development computer.

## Core operating model

1. The dashboard stores operational records in PostgreSQL.
2. Approved durable artifacts and code live in GitHub.
3. WordPress remains a separate PHP-based website.
4. The dashboard connects to WordPress through approved REST API actions, webhooks, GitHub deployments, and controlled WP-CLI operations.
5. Human approval is required at defined gates.
6. GitHub commit SHAs and deployment records prove implementation and release status.
7. Roadmap intent is never treated as proof that a page or feature is live.

## Files in this package

| File | Purpose |
|---|---|
| `01_Dashboard_Master_Specification.md` | Product scope, architecture, governance, and system-wide requirements |
| `02_Version_1_Module_Inclusion_Matrix.md` | Full, simplified, foundation-only, and deferred module scope |
| `03_Detailed_Module_Specifications.md` | Development specification for all dashboard modules |
| `04_Data_Model_and_Ownership.md` | PostgreSQL entities, relationships, indexes, retention, and source-of-truth ownership |
| `05_Workflow_State_Machines.md` | Legal status transitions, approvals, rejections, and activity logging |
| `06_Roles_and_Permissions.md` | Deny-by-default role and action matrix |
| `07_Low_Fidelity_Wireframes.md` | Operational screen layouts for key modules |
| `08_API_and_Integration_Contracts.md` | Next.js, NestJS, GitHub, WordPress, Vercel, SMTP, Blob, and queue contracts |
| `09_Security_Backup_Retention_Operations.md` | Security, backup, retention, monitoring, and incident operations |
| `10_WordPress_Integration_and_Migration.md` | Native WordPress architecture and Case Study/Portfolio migration |
| `11_Acceptance_Criteria_and_Test_Plan.md` | System acceptance criteria and test coverage |
| `12_Open_Items_and_Implementation_Inputs.md` | Items intentionally deferred until setup or implementation |

## Authority hierarchy

When information conflicts, use this order:

1. Current repository implementation
2. Production website
3. Approved page-state records
4. Approved component and design registries
5. Approved strategy documents
6. Roadmap
7. Conversation context

## Important exclusions

- No ACF or ACF Local JSON
- No Elementor or page-builder architecture
- No automatic Claude/API execution in Version 1
- No direct production file editing
- No direct commits to protected production branches
- No storage of secrets in code, logs, task descriptions, or dashboard records
- No automatic malware-clean claim until an external scanner is configured
- No production data copied into Development or Preview
