# API and Integration Contracts

## 1. Application boundaries

### Next.js owns

- UI rendering;
- App Router navigation;
- presentation-level data fetching;
- authentication UI;
- frontend route guards;
- Markdown rendering;
- client interactions.

### NestJS owns

- business logic;
- database access;
- workflow rules;
- permission enforcement;
- integrations;
- job orchestration;
- audit logging;
- validation;
- file metadata;
- notifications.

Next.js must not create a competing database or business-logic layer.

## 2. API standards

- REST JSON APIs documented with OpenAPI.
- Zod/shared types for frontend contracts.
- NestJS validation for server enforcement.
- UUID entity IDs plus stable public IDs.
- cursor or page-based pagination for collections.
- consistent error envelope.
- idempotency key support for writes that may retry.
- `If-Match` or lock-version checks for optimistic concurrency.

## 3. Error format

```json
{
  "error": {
    "code": "WORKFLOW_TRANSITION_NOT_ALLOWED",
    "message": "The requested transition is not allowed.",
    "details": {},
    "request_id": "..."
  }
}
```

## 4. Core endpoint groups

```text
/auth
/users
/roles
/permissions
/projects
/pages
/artifacts
/workflows
/tasks
/approvals
/comments
/scans
/changes
/imports
/exports
/services
/personas
/claims
/keywords
/entities
/internal-links
/case-studies
/portfolio
/design
/agents
/knowledge
/releases
/deployments
/notifications
/integrations
/settings
/audit
/health
```

## 5. GitHub integration

Use a GitHub App with minimum repository permissions.

Functions:

- read repository metadata and commits;
- create/check branches where authorized;
- create or update PR metadata;
- receive webhook events;
- verify commit existence;
- record checks, reviews, merges, and deployments.

Webhook requirements:

- signature verification;
- event ID deduplication;
- idempotent handling;
- event timestamp and repository identity;
- retry-safe processing;
- audit event creation.

## 6. WordPress integration

### REST API

Allowed:

- read content and metadata;
- read terms/media/menus where approved;
- create or update approved drafts;
- read publication state;
- publish only when a separately approved workflow permits it.

Credentials:

- one dedicated least-privilege integration account per environment;
- Application Password stored only in environment variables;
- independent rotation and revocation.

### WP-CLI

Production allowed only through the deployment pipeline after approval:

- version/status checks;
- cache clearing;
- rewrite flushing;
- database checks;
- approved imports;
- approved migrations;
- approved search-and-replace;
- checksum verification.

All other production commands are blocked by default.

## 7. Vercel Blob

- private authenticated storage;
- direct browser upload authorization for large files;
- MIME, extension, and size validation;
- SHA-256 checksum;
- time-limited download links;
- environment isolation;
- metadata stored in PostgreSQL.

## 8. Queue and workflow adapters

Interfaces:

```text
JobQueueAdapter.enqueue()
JobQueueAdapter.cancel()
JobQueueAdapter.getStatus()
WorkflowAdapter.start()
WorkflowAdapter.signal()
WorkflowAdapter.cancel()
```

Primary implementation: Vercel Queues and Workflows.  
Fallback: Upstash QStash and Vercel Cron Jobs.

## 9. SMTP integration

Configurable Google Workspace SMTP.

The dashboard stores:

- provider name;
- sender/reply-to;
- host/port/encryption/auth method;
- secret reference, not secret value;
- allowed domains;
- test result;
- retry policy;
- last success/failure.

Multiple recipient emails and distribution lists are supported per operational area.

## 10. Authentication

- Google Workspace SSO for standard users;
- verified domain allowlist;
- TOTP local emergency accounts;
- session maximum seven days;
- backend permission checks on every protected request.

## 11. Webhook/event idempotency

Store:

- provider;
- event ID;
- event type;
- payload checksum;
- received time;
- processed time;
- status;
- failure;
- related audit event.

Unique index on provider + event ID.

## 12. Health endpoints

- `/health/live`
- `/health/ready`
- `/health/dependencies`

Dependency checks include database, Redis, GitHub, Blob, SMTP configuration, WordPress connectivity, queue/workflow status, and scheduled jobs.
