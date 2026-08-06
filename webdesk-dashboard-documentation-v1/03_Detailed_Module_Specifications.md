# Detailed Module Specifications

Each module uses the same implementation standard:

- purpose;
- primary records;
- screens;
- actions;
- statuses;
- permissions;
- validation;
- notifications;
- audit events;
- acceptance criteria.

## 1. Home

**Purpose:** show current project condition and the user's next actions.

**Screens:** executive dashboard, personal work queue, system health summary.

**Widgets:** pages by stage, tasks Ready for Claude, approvals waiting, blocked work, critical scan findings, security blockers, staging status, latest production release, Git sync status, failed jobs, documentation drift.

**Acceptance:** values are permission-filtered, link to source records, and never infer deployment from roadmap status.

## 2. Projects

**Primary records:** project, objectives, phases, roadmap, project team, environments, repositories.

**Actions:** create/update project, assign users, define approvers, set active phase, pause project, archive project.

**Validation:** production release authority and confidential-field access must be explicit.

## 3. Business Knowledge Center

**Primary records:** company profile, persona/ICP, marketing profile, VTO, service taxonomy, engagement models, approved messaging, competitors, geographic scope, strategic priorities.

**Rules:** documents may be Mandatory, Advisory, Draft, Deprecated, or Restricted. Growth Director recommendations do not overwrite approved records automatically.

## 4. Website Strategy Center

**Primary records:** navigation plan, page clusters, pillar strategy, platform strategy, industry strategy, location strategy, conversion plan, search plan, internal-link plan.

**Actions:** create recommendation, compare versions, submit, approve, supersede.

## 5. Page Inventory

**Required fields:** page ID, page name, URL, WordPress page/post ID, page type, existing/proposed, index status, template, roadmap phase, workflow stage, target keyword, canonical, design version, repository files, last scan, last deployment.

**Filters:** page type, status, phase, indexability, template, owner, keyword, last scan, last release.

**Acceptance:** each URL has one canonical active page record unless an approved redirect or archive relationship exists.

## 6. Page Workspace

**Tabs:** Overview, Live Snapshot, Audit, Ideal Structure, Search, Content, Creative Direction, UX/Wireframe, UI Specification, Component Map, Implementation, Code Review, Security, QA, Deployment, History.

**Rules:** each tab contains versioned artifacts. Approval applies to an exact version. Reopening an approved stage creates a new version and records the reason.

## 7. Case Study Studio

**Flow:** Create → Intake → Upload → Completeness Review → Ready for Claude → Missing Information → Draft → Search Review → Fact/Confidentiality Review → Internal Approval → Client Approval if required → Scheduled → Published → Unpublished/Archived.

**Mandatory governance:** consent evidence, claim-source linkage, metric verification, asset licence, embargo, visibility, scheduled publishing, unpublish reason.

## 8. Case Study Library

**Statuses:** Draft, Information Required, Fact Check, Awaiting Internal Approval, Approved, Scheduled, Published, Unpublished, Archived.

**Visibility:** Public, Internal Only, Confidential, Client Approval Required.

**Relationships:** services, pages, technologies, industries, claims, assets, testimonials.

## 9. Portfolio Library

**Fields:** project/client, URL, primary category, additional categories, tags, industry, platform, service type, launch date, screenshots, proof, visibility, publication status.

## 10. Brand Library

**Records:** logos, colors, typography, photography, illustration, icon rules, tone, visual personality, dos/don'ts, deprecated assets.

**Acceptance:** every active asset has status, version, approval, file reference, and usage rules.

## 11. Design Reference Library

**Fields:** source URL, screenshot, page/section type, likes, dislikes, desktop behavior, mobile behavior, motion notes, accessibility concerns, performance concerns, tags, approval.

## 12. Asset Library

**Fields:** asset ID, file reference, MIME type, size, checksum, dimensions, duration, licence, consent, alt guidance, visibility, related records, retention, scan status.

**Rules:** direct authenticated upload to private Blob for files above function request limits. Secret URLs are time-limited.

## 13. Design Token Library

**Token groups:** colors, semantic statuses, approved combinations, light/dark themes, font family/size/weight/line-height/letter-spacing, spacing, grids, gutters, margins, containers, breakpoints, borders, radii, shadows, opacity, z-index, icon sizes/strokes, image/video ratios, component sizes, motion, focus, form, interactive states.

**Fields:** token ID, name, value, unit, group, semantic purpose, responsive variation, theme variation, status, version, approval, usage references.

## 14. Component Library

**Components include:** navigation, heroes, buttons, cards, forms, proof bars, service grids, case-study/portfolio cards, accordions, testimonials, comparisons, CTAs, breadcrumbs, alerts, search, filters, sorting, pagination, statistics, pricing cards, team cards, content cards, author blocks, social sharing, media, galleries, tables, lists, badges, tooltips, dropdowns, consent banner, errors, empty/loading states, back-to-top, skip links.

**Record fields:** name, category, status, Figma/design reference, tokens, HTML structure, PHP path, SCSS classes/path, JS dependencies, states, responsive behavior, browser support, accessibility, schema, analytics, tests, approval, last review, replacement ID, changelog.

## 15. Section and Pattern Library

**Patterns include:** homepage storytelling, service, industry, location, landing conversion, portfolio showcase, social proof, results/metrics, engagement models, team/expertise, content hub, article, lead capture, download, multi-step form, search/filter, trust, objection handling, cross-sell, error/no-results.

## 16. Page Template Library

**Templates include:** homepage, service, platform, industry, location, case study, portfolio, landing, article, About, Contact, Team, Careers, archive/category, confirmation, 404, campaign/event.

**Fields:** required sections, optional sections, supported components, content requirements, search requirements, conversion goal, wireframes, PHP template relationship.

## 17. Wireframe Library

**Fields:** page/module, viewport, version, file/image, annotations, interaction notes, related template, status, reviewer, approval.

## 18. Motion and Interaction Library

**Records:** page transitions, focus/active/selected/disabled states, form feedback, menus, modals/drawers, tooltips, sticky behavior, content reveal, loaders, progress, success/error, notifications, media controls, filters/search, pagination, copy/share, anchors, parallax, cursor, dismissal, screen-reader announcements, timing, interruption, analytics, no-JS fallback.

## 19. Design Review Center

**Review types:** creative direction, UX, conversion, UI, accessibility by design, responsive behavior, component consistency, motion, performance impact.

**Actions:** approve, approve with notes, request revision, reject, supersede.

## 20. Service Library

**Views:** public, internal, restricted commercial.

**Core fields:** canonical name, public name, category, descriptions, audience, problems, capabilities, outcomes, exclusions, ICPs, platforms, engagement models, pages, case studies, publication status, approval status.

**Rule:** pricing and commercial fields are excluded by default and require restricted owner-only configuration if added later.

## 21. Persona Library

**Fields:** persona ID, buyer type, company size, roles, industries, geography, goals, pains, triggers, objections, decision criteria, services, bad-fit signals, messaging track, CTA preferences, status, version.

## 22. Proof and Claims Library

**Fields:** claim, claim type, source, source URL/file, before/after values, verification, approved wording, restrictions, expiry/review date, related services/cases/pages.

**Rule:** public content cannot use an unverified claim.

## 23. Keyword and Entity Library

**Fields:** keyword/query, type, intent, funnel, country/location, metrics, tool/source, research date, entity, service/page assignments, cannibalization, approval, confidence.

**Rule:** SEO-team data is advisory until Search Strategy and Growth Director review, followed by human approval.

## 24. Internal Linking Library

**Fields:** source, target, relationship, anchor, context, link type, priority, status, detector, approver, implementation date, verification date.

## 25. Content Template Library

**Fields:** page type, purpose, required/optional sections, proof rules, SEO/AEO/GEO requirements, schema, CTA rules, content-depth guidance, approval, version.

## 26. Agent Directory

**Fields:** agent name, mission summary, version, status, permissions, knowledge libraries, outputs, approval gates, test status, last reviewed.

**V1 rule:** no automatic execution. Directory governs manual Claude usage.

## 27. Agent Specification Library

Stores the approved 19-section agent specifications, drafts, version comparison, approval, tests, and dependencies.

## 28. Knowledge Library

**Fields:** source type, title, URL/file, owner, date, confidentiality, approved for agent use, mandatory/advisory, related entities, version, last review.

## 29. Workflow and Task Template Library

**Templates:** existing-page audit, new-page opportunity, search brief, content, case study, design, development, code review, security, QA, release.

**Fields:** authorized stage, required inputs, expected outputs, restrictions, agent, validation, required approvals.

## 30. Ready for Claude Queue

**Fields:** task ID, title, description, priority, agent, agent version, project, record, stage, dependencies, operator, developer, feature branch, source commit, PR ID/URL/status, reviewer, code-review result, staging commit/deployment/URL, dashboard review, changes requested, production approval/approver/commit/deployment/verification, rollback version, failure reason, retry count, due date, timestamps, audit reference.

**Actions:** draft, mark Ready for Claude, claim, start, pause, fail, submit for review, request revision, approve, cancel, complete.

## 31. Review and Approval Center

**Functions:** assigned reviews, version compare, comments, approve, approve with notes, request revision, reject, pause, delegate where permitted.

## 32. Scan Center

**Scan types:** full website, selected page, repository, WordPress health, theme/plugin/core currency, security indicators, accessibility, performance, links, metadata, structured data.

**Modes:** manual and scheduled.

**Rule:** scans discover facts; they do not silently overwrite records or automatically repair production.

## 33. Change Center

**Categories:** theme, plugin, core, database, integration, SEO/metadata, analytics/tracking, security, accessibility, performance, redirects/URLs, assets, conflicts/failed sync, rollback history.

**Actions:** accept, reject, merge manually, defer, assign, apply, verify.

## 34. Import and Export Center

**Requirements:** versioned schemas, template versions, dry-run preview, row-level errors, duplicate policy, idempotency, file limits, partial success rules, rollback limitations, history, permissions.

## 35. Technical Center

**Reports:** coding standards, linting, automated tests, coverage, dependencies, vulnerabilities, WordPress compatibility, PHP compatibility, code review, security, accessibility, performance, browser and visual regression.

## 36. Release Center

**Release types:** staging, production, hotfix, rollback.

**Fields:** release ID, repositories and SHAs, PRs, approvals, deployments, smoke tests, verification, rolled-back SHA, reason, replacement release.

## 37. Decision and Activity Log

**Events:** business decisions, content decisions, design approvals, staging approvals, production approvals, rollback, failed deployment, backup/restore, code review, PR, scan, import, Git sync, security exception.

## 38. Help Center

**Topics:** onboarding, project setup, WordPress publishing, review/approval, staging-to-production, import/export, search/filtering, design libraries, Page Workspace, security/QA, backup/rollback, FAQ, videos, known issues, feedback, version history.

## 39. Notification Center

**Channels:** in-app and SMTP.

**Statuses:** queued, sent to SMTP, accepted, failed, retrying, permanently failed.

**Recipients:** supports multiple addresses and distribution lists per operational area.

## 40. Users, Roles and Permissions

**Functions:** SSO users, emergency local admins, roles, project access, module permissions, action permissions, confidential fields, release authority, sessions, MFA status, audit history.

## 41. Integrations

**Integrations:** GitHub, WordPress, Vercel Blob, PostgreSQL, Upstash, SMTP, Sentry, uptime, vulnerability scan, future malware scanner.

## 42. System Settings

**Configurable:** statuses, categories, taxonomies, file limits, scan schedules, Git rules, backup rules, retention, contacts, escalation SLAs, documentation rules, environments.

## 43. Audit Logs and System Health

**Health:** login events, permission changes, data changes, Git sync, webhook status, jobs, queues, scans, malware-scan placeholder status, failed jobs/retries, cron/WP-Cron, backups, storage, application errors, security events, agent execution status.
