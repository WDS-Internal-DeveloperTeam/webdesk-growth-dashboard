# Dashboard Master Specification

## 1. Product name

**WebDesk Website Growth & Delivery System**  
Working short name: **Website Growth Dashboard**

## 2. Mission

Create one controlled system that allows WebDesk to audit, plan, write, design, build, review, secure, test, release, and maintain its WordPress website while preserving reliable project memory, approvals, version history, and implementation proof.

## 3. Business purpose

The system addresses the weaknesses of the prior Website 360 process:

- no persistent project memory;
- planned pages confused with built pages;
- disconnected stage outputs;
- duplicated HTML/CSS across pages;
- one agent performing creation and review;
- weak design consistency;
- insufficient proof that approved work reached staging or production.

## 4. Version 1 operating model

Version 1 is a private, multi-user, approval-driven dashboard.

- The dashboard does not call Claude automatically.
- An authorized operator marks a task **Ready for Claude**.
- The operator runs Claude Code manually from an authorized development machine.
- Claude reads the repository task package and approved project memory.
- Claude performs only the authorized stage.
- Claude produces the required artifacts, commits them, pushes them, and records the remote commit SHA.
- Human reviewers approve, request revision, reject, pause, or release.

## 5. Approved technology stack

| Area | Approved technology |
|---|---|
| Runtime | Node.js 24 LTS for dashboard applications |
| Language | TypeScript |
| Frontend | Next.js with App Router and React |
| Backend APIs | NestJS |
| Styling | Tailwind CSS with isolated dashboard design tokens |
| Database | PostgreSQL provisioned through Vercel in North America East Coast; Neon excluded |
| ORM and migrations | Sequelize ORM with version-controlled migrations |
| API documentation | OpenAPI/Swagger |
| Validation | Zod and NestJS validation |
| Search | PostgreSQL full-text search and `pg_trgm` |
| GitHub | GitHub App, webhooks, Octokit, GitHub Actions |
| WordPress | REST API, Application Passwords, WordPress.com GitHub Deployments, controlled WP-CLI |
| Markdown | `react-markdown`, `remark-gfm`, `rehype-sanitize` |
| Logging | Pino structured logs |
| Error tracking | Sentry |
| Testing | Vitest/Jest, Supertest, Playwright |
| Package manager | pnpm |
| Monorepo | Turborepo |
| Hosting | Vercel Pro, North America East Coast |
| Object storage | Private Vercel Blob, North America East Coast |
| Redis | Upstash Redis, North America East Coast |
| Primary background jobs | Vercel Queues, Workflows, Functions, Cron Jobs |
| Fallback background jobs | Upstash QStash plus Vercel Cron Jobs |
| Authentication | Google Workspace SSO plus restricted local emergency-admin accounts |
| Email | Configurable SMTP, initially Google Workspace/Gmail |

## 6. Repository structure

Two private repositories under the WebDesk GitHub organization:

```text
webdesk-growth-dashboard/
  apps/
    dashboard-web/
    dashboard-api/
    dashboard-worker/
  packages/
    database/
    shared-types/
    validation/
    ui/
    integrations/
    configuration/

webdesk-wordpress-website/
  webdesk-custom-theme/
```

Every release records the exact approved dashboard and WordPress commit SHAs.

## 7. Environments

- Development
- Preview
- Staging
- Production

Each environment must have separate:

- PostgreSQL database;
- queue/workflow configuration;
- Redis namespace or instance;
- Blob store or isolated prefix;
- environment variables;
- WordPress credentials;
- GitHub configuration;
- SMTP configuration;
- third-party integration credentials.

Production data must not be copied into Development or Preview. Development, Preview, and Staging data should be removed after 30 days of inactivity unless tied to an active test or release.

## 8. Source-of-truth boundaries

### PostgreSQL owns operational application data

- users and sessions;
- roles and permissions;
- task queue and execution progress;
- notifications and delivery state;
- comments and review assignments;
- scan progress and temporary findings;
- import dry runs and row-level errors;
- locks, retries, job progress, and system health;
- operational contact configuration;
- UI preferences and saved filters.

### GitHub owns durable versioned artifacts

- approved Markdown documents;
- agent specifications;
- approved strategy, content, design, code-review, QA, and release artifacts;
- theme and dashboard code;
- approved state snapshots;
- reusable registries where durable review history is required;
- handoff documents and release manifests.

### WordPress owns website publishing data

- posts, pages, terms, media, menus, and approved drafts;
- publication status and public URLs;
- native metadata used by the website.

### Vercel Blob owns private binary files

- uploads;
- screenshots;
- scan evidence;
- exports;
- documentation assets;
- case-study and portfolio source assets.

### Environment variables own secrets

The dashboard stores only secret metadata and verification status, never secret values.

## 9. Core page workflows

### Existing page

1. Context synchronization
2. Live and repository audit
3. Ideal page strategy and structure
4. Search strategy: SEO/AEO/GEO, entities, schema, internal links
5. Content
6. Creative direction and design
7. Build
8. Independent code review
9. QA, release, and memory update

### New page

1. Context synchronization
2. Opportunity analysis
3. Ideal page structure
4. Search strategy
5. Content
6. Creative direction and design
7. Build
8. Independent code review
9. QA, release, and memory update

## 10. Approval gates

- Audit and structure approval
- Search brief approval
- Content approval
- Creative/design approval
- Staging preview approval
- Code review, security, and QA approval
- Production release approval

A stage cannot be treated as complete merely because an artifact exists. The approved artifact version and reviewer identity must be recorded.

## 11. Git completion rule

A development or Claude task is not complete until:

- expected files exist;
- required tests pass;
- approved state/handoff files are updated;
- changes are committed;
- changes are pushed;
- the remote commit SHA is recorded;
- the dashboard confirms the SHA exists in the remote repository.

Claude must not merge to protected branches or deploy production automatically.

## 12. Infrastructure region policy

All dashboard production infrastructure must be in North America East Coast.

- Vercel applications: East Coast
- PostgreSQL: East Coast through Vercel
- Upstash Redis: East Coast
- Vercel Blob: East Coast
- WordPress.com: East Coast
- backup storage: East Coast

No production application data is intentionally stored in India or Singapore.

## 13. Background-job architecture

### Primary

- Vercel Queues for asynchronous job delivery
- Vercel Workflows for durable multi-step orchestration
- Vercel Cron Jobs for scheduled triggers
- Vercel Functions for execution

### Safeguards

- every job has a permanent PostgreSQL record;
- at-least-once delivery is assumed;
- all handlers are idempotent;
- retry count and backoff are recorded;
- timeouts and heartbeats are enforced;
- progress is stored in PostgreSQL;
- failures produce notifications and audit events;
- queue and workflow provider calls are hidden behind adapters;
- Upstash QStash and Cron are the documented fallback.

## 14. Authentication and access

- Standard users authenticate through verified Google Workspace domains: `webdesksolution.com` and `webdeskinc.com`.
- SSO users must use Google Workspace MFA.
- Emergency local administrators use TOTP.
- Local-account recovery requires identity verification and approval by another authorized administrator.
- Permissions are deny-by-default.
- Authorization is enforced at project, module, action, and confidential-field levels.

## 15. Upload rules

Allowed file types:

- JPEG, PNG, WebP, GIF
- PDF, DOCX, XLSX, CSV, TXT, Markdown
- MP4

Maximum sizes:

- images and documents: 25 MB
- MP4: 250 MB

Blocked:

- executables;
- SVG;
- archives;
- macro-enabled documents;
- unsupported or prohibited formats.

Malware scanning is deferred. Until configured, files may be marked `Scan Not Configured`; the system must not call them malware-free.

## 16. Version 1 exclusions

- Automatic Anthropic API execution
- Automatic Growth Director chat in the dashboard
- Continuous GA4/GSC monitoring
- Automated content publishing without approval
- Public client portal
- Multi-client SaaS billing
- Mobile application
- Mandatory malware-scanning integration
- Autonomous production release

## 17. Non-functional requirements

### Security

- deny-by-default permissions;
- least privilege;
- threat modelling;
- rate limiting;
- account lockout;
- secure recovery;
- dependency patching;
- incident response;
- security ownership;
- immutable audit events for critical actions.

### Reliability

- idempotent background jobs;
- retries and failure recovery;
- environment isolation;
- release manifests;
- backup verification;
- rollback capability;
- health monitoring.

### Accessibility

Dashboard UI should meet WCAG 2.2 AA for internal users.

### Performance

- server pagination for large tables;
- indexed filters;
- asynchronous long-running actions;
- optimized image previews;
- no full-library loads into the browser.

## 18. Governance

Every configurable policy must have:

- version;
- status;
- owner;
- approved by;
- approved at;
- effective date;
- change reason;
- audit-log reference.

## 19. Definition of done

The dashboard is ready for production when:

- all Full Version 1 modules meet acceptance criteria;
- simplified/foundation modules meet their stated scope;
- role permissions pass deny-by-default testing;
- backup and restore tests pass;
- staging and production deployment flows pass;
- GitHub and WordPress integrations pass;
- audit and retention jobs pass;
- security review has no unresolved critical findings;
- required help documentation is published;
- operational contacts and notification emails are configured.
