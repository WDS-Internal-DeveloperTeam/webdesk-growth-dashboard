---
tier: 1
load_when: ["webdesk-growth-dashboard", "integration-work"]
description: "WordPress REST API, Application Password accounts, controlled WP-CLI allowlist, GitHub-based WordPress.com deployment, the no-ACF native structured-content architecture, and the Case Study/Portfolio migration sequencing. Pointer to integrations/wordpress/ for concrete adapter detail."
---

# 07 — WordPress Integration

> The base skill's ERP adapter pattern (`nodejs/integrations/erp/_erp-adapter-pattern.md`: pull/push/normalize/sync-state behind a common interface) is the strongest available structural template for this integration, even though no WordPress-specific module existed before this profile. The dashboard documentation pack already applies the base skill's verify-at-discovery discipline to WordPress independently (`10_WordPress_Integration_and_Migration.md §1, §12`) — this file operationalizes that alignment.

---

## Discovery status

**The Current WordPress Technical Discovery document is registered at `canonical-inputs/Current_WordPress_Technical_Discovery.md`**, supplied across two rounds (`knowledge/00-scope-and-precedence.md §4`): Part 1, a native Markdown file directly supplied 2026-08-06; Part 2, a fuller self-review round supplied and processed 2026-08-05 (from a PDF at the time — no longer bundled now that a native Markdown original exists for Part 1). It confirms more than the original dashboard pack alone (real plugin inventory, exact meta-key mappings, the CaseStudy/Portfolio migration decision, security tooling, backup cadence) — but it is **not** a complete implementation-readiness audit, and it says so itself: a "Remaining WordPress verification items" table lists 15 items still needing confirmation at development kickoff (REST API `/wp-json/` actual availability, WP-CLI/SSH actual provisioning, Application Password actual enablement, forms/Podio field mapping, analytics ownership, whether Wordfence/WPScan/UptimeRobot are actually installed, file-integrity status, plugin licensing). Treat every fact below as one of three tiers, exactly as the source document itself distinguishes:

- **Confirmed current fact** — reported directly (production/staging URLs, WordPress/PHP version, hosting plan, installed-and-active plugin list with versions).
- **Approved target architecture** — a decision, not yet verified as operational (theme structure, post-type/taxonomy registration approach, WP-CLI allowlist, build process, deployment pipeline, backup policy, security-tool selection).
- **Still requires verification at implementation kickoff** — explicitly flagged as open by the source document itself.

**One item in the source document directly conflicted with a higher-precedence source and was resolved — see "ACF conflict — resolved" below.** Everything else in the document is consistent with, or adds detail to, what was already established from `10_WordPress_Integration_and_Migration.md`.

The **Theme Migration and Reconciliation Report** (§ below) — the audit of the _current_ theme's templates, page-builder content, shortcodes, custom CSS/JS, etc. — remains **not yet done**; the Technical Discovery document is about environment/tooling/plugin facts, not that specific content-level audit, and it says as much ("Existing-theme migration is still required... This becomes a Theme Migration and Reconciliation Report... required before the new theme is implemented").

---

## Confirmed environment facts (from the registered Technical Discovery)

| Item                                                                                                   | Value                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      | Tier                                                                                                       |
| ------------------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------- |
| Production URL                                                                                         | `https://webdesksolution.com/`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             | Confirmed current fact                                                                                     |
| Staging URL                                                                                            | `https://staging-7a61-wdsstage2.wpcomstaging.com/`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         | Confirmed current fact                                                                                     |
| WordPress version                                                                                      | 7.0.2                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      | Confirmed current fact                                                                                     |
| PHP version                                                                                            | 8.4                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        | Confirmed current fact                                                                                     |
| Hosting                                                                                                | WordPress.com Business Plan                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                | Confirmed current fact                                                                                     |
| Node.js for the WP theme build                                                                         | 22 LTS (separate from the dashboard's own Node 24 — see `knowledge/01-approved-architecture.md`)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           | Approved target architecture, matches prior source                                                         |
| Active plugins (21 total, per the directly-supplied 2026-08-06 Markdown, the current source of record) | Includes CaseStudy 0.1, Portfolio 0.1, Contact Form 7 6.1.6 + CFDB7 + spam/reCAPTCHA add-ons, WDS Podio API 1.0, Yoast SEO 28.1, Jetpack (+Boost), WP Mail SMTP, Redirection, IndexNow, All-in-One WP Migration and Backup. **Does not list ACF.** The earlier-supplied 2026-08-05 PDF version's inventory did list ACF 6.8.6 — this difference is preserved transparently, not silently resolved by picking one, and independently corroborates rather than contradicts `canonical-inputs/Owner_Clarifications_2026-08-05.md` (no confirmed ACF dependency exists). See §"ACF conflict — resolved" below. | Confirmed current fact                                                                                     |
| REST API (`/wp-json/`)                                                                                 | **Could not be verified during the external check**                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        | Still requires verification                                                                                |
| Security tooling                                                                                       | Wordfence Free, WordPress.com CDN/platform security, WPScan via GitHub Actions, UptimeRobot Free — **approved target**, not confirmed installed/configured                                                                                                                                                                                                                                                                                                                                                                                                                                                 | Approved target architecture; installation status still requires verification                              |
| Backup policy                                                                                          | Automatic daily WordPress.com backups; 35-day operational retention; encrypted monthly off-platform backup, 1 year; extra backup before every production deployment; quarterly restore test on staging                                                                                                                                                                                                                                                                                                                                                                                                     | Approved target architecture; whether actually configured still requires verification                      |
| Forms/CRM                                                                                              | Contact forms → Podio CRM                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  | Confirmed current fact (integration exists); exact form/webhook/retry mechanics still require verification |
| Analytics                                                                                              | GA4, Microsoft Clarity, Google Tag Manager present on the public site                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      | Confirmed current fact; property/container IDs and consent handling still require verification             |

Full detail, including the complete plugin-version list and the three-tier classification in the source document's own words: `canonical-inputs/Current_WordPress_Technical_Discovery.md`.

---

## Authentication and access

- **Dedicated Application Password accounts**, one per environment (Development/Preview/Staging/Production), each a **least-privilege integration role** — not the WordPress administrator account, and not a shared human account's Application Password.
- Credentials stored only as environment variables / secret-manager references (`nodejs/knowledge/security/03-secrets-and-config.md`) — the dashboard's `secret_metadata` table stores reference/status only, never the credential value, per `04_Data_Model_and_Ownership.md §6`.
- Independent rotation and revocation per environment — rotating the Staging credential never requires touching Production.

---

## REST API — allowed operations

**Availability is still unconfirmed** — the registered Technical Discovery document states the public `/wp-json/` endpoint "could not be verified during the external check," and lists "whether it is enabled, restricted or protected" as an open verification item for implementation kickoff. Everything below is the target architecture (what's allowed once confirmed reachable), not a statement that it's reachable today.

- **Read** content, metadata, terms, media, menus where approved.
- **Create or update approved drafts** — never publish directly through the REST integration unless a separately approved workflow explicitly permits it (`08_API_and_Integration_Contracts.md §6`). Publication remains a WordPress-side or dashboard-approval-gated action, not a side effect of a routine content sync.
- **Read publication state** to keep the dashboard's Page Inventory and Case Study/Portfolio Library records accurate, without treating the dashboard's own roadmap/workflow status as proof of what's actually live (`01_Dashboard_Master_Specification.md`'s "Roadmap intent is never treated as proof" rule, restated in `knowledge/10-data-ownership-and-audit.md`).

---

## Controlled WP-CLI — production allowlist

Production WP-CLI access is permitted **only through the approved deployment pipeline**, never ad hoc/interactive. The allowlist:

```
✓ Version and status checks       (wp core version, wp plugin status, ...)
✓ Cache clearing                  (wp cache flush)
✓ Rewrite flushing                (wp rewrite flush)
✓ Database checks                 (wp db check, non-mutating)
✓ Approved imports                (scoped to the specific migration command, per §"Migration requirements")
✓ Approved migrations              (the version-controlled Case Study/Portfolio migration command, see below)
✓ Approved search-and-replace      (scoped, reviewed command only — never an open-ended wp search-replace
                                    invocation with operator-supplied patterns)
```

**All other production WP-CLI commands are blocked by default.** This is an allowlist, not a denylist — a new command is not permitted merely because it isn't explicitly forbidden; it must be explicitly added to this list through the same approval process as any other production-pipeline change.

Non-production environments (Development, Preview, Staging) may permit a broader WP-CLI surface for legitimate development/testing needs, but that broader surface is itself scoped and documented per environment, not assumed to inherit "anything goes" simply because it isn't production.

---

## GitHub-based WordPress.com deployment

```text
feature branch → Pull Request → automated PHP/JS/SCSS/security/build checks
  → staging branch/deployment → QA and stakeholder approval
  → exact approved commit to production → smoke tests
```

Direct SFTP deployment and manual production editing are prohibited (`10_WordPress_Integration_and_Migration.md §11`) — this is a harder constraint than the base skill's general "no direct production file editing" rule (`00_README.md` "Important exclusions"), stated explicitly for WordPress because SFTP/manual-edit access is a common WordPress operational habit this project deliberately closes off. The Custom Theme repository's build system (Dart Sass, Vite, PostCSS, Node.js 22 LTS **for the WordPress theme build specifically** — note this is a different, older Node line than the dashboard's own Node 24, and that's intentional: the two repositories' build systems are fully isolated per `10_WordPress_Integration_and_Migration.md §10`) is independent of the dashboard's own Turborepo build pipeline.

---

## Webhook and synchronization security

Whether WordPress itself emits any inbound webhook to the dashboard (as opposed to being entirely poll/push via REST) is unresolved — see `docs/implementation/gap-analysis.md` item 6. **Do not assume a WordPress webhook exists and build against it speculatively.** If a discovery finds one (e.g., a custom REST hook firing on publish), it is verified at discovery (NODE-008) and secured per the same HMAC-verification/replay-protection/idempotent-processing pattern as the GitHub integration (`knowledge/06-github-app-integration.md` §"Webhook security"), using `contracts/webhook-event.schema.json` with `provider: "wordpress"`.

The default assumption for the dashboard-initiated direction (dashboard → WordPress writes, and dashboard reads of WordPress state) is **poll/pull via REST on a schedule**, following the base skill's own default sync pattern for poll-only sources (`nodejs/knowledge/intelligence/integration-intelligence.md`: "ERP/CRM poll-only... continuous cron-scheduled sync" — here adapted to WordPress via Vercel Cron Jobs rather than node-cron, per `knowledge/04-serverless-queues-workflows-and-cron.md`).

---

## Retry and failure recovery

Same job-record discipline as every other background job (`knowledge/04-serverless-queues-workflows-and-cron.md`): capped retries with backoff, terminal-vs-retryable failure classification (a WordPress REST 401/403 is terminal — the credential or permission is wrong, retrying won't help; a 502/503/timeout is retryable), and a DLQ-equivalent surfaced on the dashboard's Integrations module for operator visibility and manual retry.

---

## Staging verification, production approval, release SHA tracking

Every WordPress content/theme change destined for production passes through Staging verification and an explicit production approval, mirroring the GitHub integration's release-gating (`knowledge/06-github-app-integration.md` §"Release SHA pairing") — a WordPress-repository release is recorded with its exact approved commit SHA, paired with the dashboard's own SHA when a release spans both repositories.

---

## Native structured content — no ACF

**The WordPress implementation does not use ACF, ACF Local JSON, or any ACF-based architecture, ever, in any new development.** This is an absolute project rule, not a default preference — see `knowledge/15-project-specific-forbidden-actions.md` WDS-001. Use instead:

- **Native post meta** via `register_post_meta()` for every custom field, with each field's key, data type, default, single/multiple behavior, sanitization, validation, authorization callback, REST visibility, confidentiality, version, migration behavior, and retention/deletion behavior documented (`10_WordPress_Integration_and_Migration.md §4`).
- **Native WordPress meta boxes** and **custom PHP administrative interfaces** for editorial UI, not a third-party field-builder plugin.
- **Custom taxonomies**, **WordPress attachment IDs** for media, **native post relationships**.
- **Approved custom REST fields and endpoints** exposing the native meta to the dashboard.
- **Custom database tables only when post meta is technically unsuitable** for volume, querying, relational complexity, or performance — a deliberate escalation, not a default.

No third-party custom-field framework of any kind is permitted, ACF or otherwise, without a new approved decision superseding this rule.

### ACF conflict — resolved (2026-08-05, in two stages)

**Stage 1 — target architecture.** The **Current WordPress Technical Discovery** document (`canonical-inputs/Current_WordPress_Technical_Discovery.md`), supplied after this profile's initial build, directly contradicted the rule above. Its "ACF version and field groups" row stated: _"Use the free version of ACF. Create project-specific field groups for global settings, page sections, services, case studies, testimonials, FAQs, team members and reusable calls to action. Store field-group definitions using ACF Local JSON in the theme's `acf-json/` folder."_ Its plugin inventory also **originally reported** ACF 6.8.6 as installed and active on the live production site. This was a genuine conflict between two approved sources — `01_Dashboard_Master_Specification.md` (precedence level 1, "No ACF or ACF Local JSON") versus the Technical Discovery document (precedence level 2). Per `knowledge/00-scope-and-precedence.md §1–3`, this was not silently resolved — it was surfaced to the project owner, who confirmed: **the Master Specification's exclusion stands for target architecture.**

**Stage 2 — current-state correction, same day.** The project owner then issued a further clarification revising the _current-state fact itself_, not just the architecture choice: _"There will be no ACF. WebDesk is not currently using ACF in the WordPress system. Native meta objects and custom PHP will be used."_ This is recorded in the separate file `canonical-inputs/Owner_Clarifications_2026-08-05.md` (not edited into the discovery document itself — the two remain independently auditable). Independently corroborated by the 2026-08-06 Markdown supply of the discovery document's Part 1, whose own plugin inventory does not list ACF either — see `§"Confirmed environment facts"` above.

**What this means concretely, per both stages together:**

- The WebDesk Custom Theme's field groups (global settings, page sections, services, case studies, testimonials, FAQs, team members, CTAs) are implemented with `register_post_meta()` + native meta boxes, per the rule above — never ACF.
- **No ACF data migration is assumed or planned.** Unlike the initial reading (which treated the originally-reported ACF 6.8.6 installation as a confirmed dependency requiring migration to native structured content), the corrected position is: no confirmed ACF field-group or content dependency exists. Do not create a migration workstream for data that isn't confirmed to exist.
- **Verification, once, at implementation kickoff:** confirm the actual plugin inventory as part of the routine kickoff verification (`§"Confirmed environment facts"` above already lists plugin-related items as needing reconfirmation). If ACF is found installed but unused, remove it through the approved plugin-cleanup process after staging verification — a cleanup action, not a content-migration project. If ACF is found installed _and_ in active use for real content, that is new information contradicting this addendum and should itself be escalated as a fresh conflict, not silently absorbed back into a migration plan.
- This resolution does not touch anything else in the Technical Discovery document — the theme folder structure, post-type/taxonomy registration approach (Option A, confirmed independently — see below), build process, deployment pipeline, backup policy, and security tooling all stand as documented.

---

## Case Study and Portfolio migration

The existing `CaseStudy` and `Portfolio` post types/taxonomies/meta (documented in full in `10_WordPress_Integration_and_Migration.md §5–§6`, and independently re-confirmed with exact meta-key mappings in `canonical-inputs/Current_WordPress_Technical_Discovery.md`'s "Resolved: CaseStudy/Portfolio plugin conflict" section — same field list, same slugs, same taxonomy structure, no discrepancy between the two sources) are **currently plugin-dependent** (CaseStudy 0.1, Portfolio 0.1, both confirmed active in the plugin inventory) and must be migrated to the native structured-content architecture (§ above) **before those plugins are retired**. The registered Technical Discovery confirms both plugins **will be migrated** (not retained, not retired-without-migration) and that current content **does depend on them**. The approved sequence (**Option A — register the required post types/taxonomies in the WebDesk Custom Theme itself — confirmed independently in both source documents**):

1. Inventory complete.
2. Staging migration succeeds.
3. Counts and URLs verified (before/after counts match exactly).
4. Templates render correctly on staging.
5. Rollback documented.
6. Migration approved (a distinct approval, separate from and in addition to G-Contracts for the WordPress integration generally).
7. Production cutover scheduled.

**Preserve exactly:** existing post IDs, slugs, dates, statuses, authors, URLs, taxonomy terms and relationships, all mapped meta keys (converted from upload-result arrays to WordPress attachment IDs), gallery order, and the repeatable Case Study content-block order. The migration command is version-controlled, supports dry run, backs up database and uploads before running, is idempotent where possible, logs exceptions, and reports before/after counts (`10_WordPress_Integration_and_Migration.md §8`). **Old and new registrations must never compete in production** — the existing plugins remain active and authoritative until every step above passes; there is no partial/gradual cutover where both the plugin and the native architecture are simultaneously live for the same content type in production.

---

## Theme Migration and Reconciliation Report — a hard prerequisite

Per `10_WordPress_Integration_and_Migration.md §9`: **custom-theme development must not begin** until the current site is audited for templates, page-builder content, shortcodes, custom CSS/JavaScript, header/footer, menus/widgets, reusable blocks, theme options, hardcoded content, page-specific templates, structured data, forms, redirects, and tracking scripts — each item classified as Migrate / Rebuild / Replace / Retain / Retire.

**This is still not done.** The registered Technical Discovery document (§"Discovery status" above) confirms _environment and tooling_ facts (versions, plugins, hosting, build process) — it explicitly does not replace this content-level audit, and says so in its own words: _"Existing-theme migration is still required... This becomes a Theme Migration and Reconciliation Report... it is not necessary before [writing] the dashboard documents, but it is required before the new theme is implemented."_ Remains scheduled as its own gated deliverable in `docs/implementation/phased-implementation-plan.md` Phase 5.

Also confirmed by the same document, the modified-core/plugin/vendor-file integrity check uses `wp core verify-checksums` plus a Git comparison and plugin checksum checks where supported — add this to the "Database checks (non-mutating)" line of the production WP-CLI allowlist above as the specific command for that allowlisted category.

---

## What this file does not cover

- Concrete REST client setup, exact endpoint paths, and WP-CLI invocation mechanics → `integrations/wordpress/` (loaded only when implementing this integration).
- GitHub-side deployment-status webhook handling → `knowledge/06-github-app-integration.md`.
- Retention/backup for WordPress content and the migration's own database/upload backups → `knowledge/11-retention-backup-and-operations.md`.
