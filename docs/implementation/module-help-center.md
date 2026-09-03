# Help Center module

## Scope

Module #38 on the canonical spec (`03_Detailed_Module_Specifications.md §38`), built directly on
the explicit "start help center" instruction. The spec gives only a topics list — "onboarding,
project setup, WordPress publishing, review/approval, staging-to-production, import/export,
search/filtering, design libraries, Page Workspace, security/QA, backup/rollback, FAQ, videos,
known issues, feedback, version history" — no field-level schema, matching the same
"topics-only" spec-gap situation Business Knowledge Center/Knowledge Library/Section and Pattern
Library/Motion and Interaction Library each hit.

Three design forks confirmed directly with the project owner first (`AskUserQuestion`) before any
code was written:

1. **RBAC.** The module registry seeds Help Center's permission group as `system_settings`
   (`00015-seed-module-registry.ts:132`), which grants only `super_admin` ("VCERM": view, create,
   edit, review, configure) and `owner_growth_approver` ("VM": view, configure) any access at
   all — every other role (marketing_editor, designer, developer, QA, read_only) gets nothing, not
   even view. This is a real, surprising limitation for a help center specifically, since it's the
   one module meant to serve everyone. **Chosen: build with `system_settings` as-seeded**, matching
   this project's own precedent of building against the real seeded RBAC matrix rather than
   silently widening it. Recorded here as a real, deliberate limitation, not an oversight — a
   future RBAC migration to widen access is its own separate, not-yet-requested authorization.
2. **Data model.** Single generic table with a `category` discriminator covering the spec's own
   16-topic list verbatim, mirroring Business Knowledge Center's/Knowledge Library's own
   single-table precedent, over a two-table FAQ/article split. **Chosen: single table.**
3. **Workflow.** Simple `isPublished`/`publishedAt` only, no `approvalStatus`/`version`/
   `TRANSITIONS` governance — the spec frames this module as static reference documentation, not a
   governed content pipeline. **Chosen: no approval workflow** — the simplest content-library
   module built to date.

Backend-only pass, matching every prior module's own backend-first precedent — no `dashboard-web`
UI exists yet.

## As-built

Table `help_articles` (migration `00115`), organization-wide (no `project_id`). Fields: `id`,
`category` (16-value enum, create-only — immutable, mirroring every sibling discriminator field),
`title`, `content` (required, unlike Business Knowledge Center's now-optional `content` — no
attachment mechanism exists here, so an article's content is always its entire substance),
`isPublished` (plain boolean, default `false`), `publishedAt` (server-stamped once, on the first
transition to `isPublished = true` — never overwritten once first set, never cleared on unpublish,
mirroring `content_templates.published_at`'s own "stamp once" contract), `createdBy`/`updatedBy`,
timestamps. Indexes on `category`, `is_published`, `updated_at`, and a `pg_trgm` GIN trigram index
on `title` for the `search` filter — wired from day one, not added later as a review-round fix
(the gap Knowledge Library's own review found and closed once for itself).

Reuses the seeded `system_settings` RBAC group verbatim — no new RBAC migration. Since that group
carries no `P` (Publish/Unpublish) letter, `isPublished` is toggled through the ordinary
`POST /help-center/articles/:id/update` route (gated on `edit`) rather than a dedicated
publish/unpublish action — `review`/`configure` (the group's other two grants) go unwired, matching
Scan Center's own precedent for a deliberately-unused seeded action.

`content` is sanitized at write time via the shared `sanitizeRichTextHtml()` (`@webdesk/validation`)
on both `create()` and `update()` — wired ahead of the eventual `RichTextEditor` UI, matching
Section and Pattern Library's/Motion and Interaction Library's own precedent of sanitizing before
any frontend exists to produce the HTML.

Files: `packages/database/src/help-center/{entities,models,entity-mapping,help-article.repository,
index}.ts`; `apps/dashboard-api/src/help-center/{help-center.constants,help-center.dto,
database.providers,help-articles.service,help-articles.controller,help-center.module}.ts` +
`help-articles.service.spec.ts`/`help-center.dto.spec.ts` (21 tests). Both `packages/database`
barrel files (`index.ts`/`index.cjs.ts`) updated. `HelpCenterModule` wired into `app.module.ts`.

### Independent code review

This project's own `code-review` skill (medium effort, 8 finder angles run in parallel, 1-vote
self-verification) surfaced 8 kept findings, **all 8 fixed**:

- **`create()` never stamped `publishedAt`** even when the article was created with
  `isPublished: true`, contradicting the entity's own "stamped on first publish" contract — fixed
  by stamping `NOW()` directly on an already-published create (no `COALESCE` needed for a fresh
  row).
- **`update()`'s pre-fetch of the current row was a stale-read race** (audit classification diffed
  `patch.isPublished` against a `findById()` read taken before the write committed) and an
  avoidable extra DB round trip — fixed by dropping the pre-fetch entirely: `content` is now
  unconditionally re-sanitized when present (cheap and idempotent), and the audit `eventType` is
  derived purely from the caller's own requested `isPublished` value rather than an observed
  transition, so there is no stale-state window to race at all.
- **The audit `afterState` for an ordinary content edit recorded only `isPublished`**, dropping
  title/content changes from the trail entirely — fixed to record the real patch, matching
  `ContentTemplatesService.update()`'s own convention.
- **`updateHelpArticleSchema` hand-duplicated fields from `createHelpArticleSchema`** instead of
  deriving via `.omit({category:true}).partial()` — fixed, closing the same length-cap drift risk
  Content Template Library's own update schema was refactored to close.
- **No `.refine()` rejected a genuinely empty patch** — fixed, so a no-op save 400s cleanly instead
  of issuing a real DB write and a spurious audit event.
- **The `publishedAt` stamp-once `COALESCE` was built via `fn()`/`col()`/`literal("NOW()")`
  composition**, diverging from every sibling repository's single `literal('COALESCE(...)')`
  idiom — fixed to match.
- **The removed content-diff logic (`shouldReplaceContent`) reimplemented
  `sanitizeNullableRichTextIfChanged()`'s shape inline** for a required field with no named
  helper — resolved by elimination: dropping the pre-fetch (above) removed the need for the
  comparison entirely, so there's nothing left to reimplement.
- **`isPublished ?? false` defaulting was duplicated** across both the service's `create()` and the
  repository's `create()` — fixed by making the repository the sole owner of the default.

No separate `security-review` skill run, per the 2026-08-27 "right-size the review pipeline"
standing rule — a new backend module, but one reusing only already-vetted mechanisms throughout
(the shared, already-audited `sanitizeRichTextHtml()`, the existing `PermissionGuard`/
`OriginCheckGuard`/`RequirePermission` machinery, `escapeLikePattern()` for search) with no new
sink or endpoint class beyond standard CRUD. Directly confirmed: `@RequirePermission` is
method-level on every route (never class-level, the recurring bug class this project's own history
flags), `OriginCheckGuard` is present on both mutating routes, `category` is immutable (omitted
from the update schema, matching every sibling discriminator field), and no confidential-field
mechanism was fabricated (the module registry's own seeded `confidentialityLevel` for `help_center`
is `null`).

### Validation

Independently re-run, not trusted from a single pass: `@webdesk/database` build clean,
`dashboard-api` typecheck clean, `nest build` clean, `eslint --max-warnings=0` clean, `prettier
--check` clean, `boundaries:check` 0 errors (10 pre-existing, unrelated warnings), 1852/1852
`dashboard-api` unit tests overall (21 new for this module, all mocked-repository — no DB
dependency, re-run clean after every fix round).

**No local PostgreSQL instance was available in this environment** — `validate:module-registry`,
a real migration up/down round-trip, and any `packages/database` integration or `dashboard-api`
e2e test could not be run here, the same limitation several prior slices in this session have
noted for themselves. The migration content, RBAC decorator placement, and repository stamp-once
logic were all read directly and cross-checked against `content_templates`'/`knowledge_library_
records`' own already-reviewed equivalents rather than assumed. This gap should be closed by
running the DB-backed suites against a real disposable database before merge.

## As-built — `dashboard-web` UI

Closes this module's last named gap, built directly on the explicit "Start the dashboard-web UI
for it" instruction, following the backend's own build-to-production arc (PR #118, merge commit
`6a8cbcd`). No approved wireframe exists for this module — sections mirror
`03_Detailed_Module_Specifications.md §38`'s own field grouping (Identity, Content, Status),
matching every prior unsourced-screen module's own "smallest honest reading" precedent. File-for-
file mirrors Content Template Library's UI structure (the closest sibling — a real `isPublished`
mechanism), simplified further since Help Center has no `approvalStatus` at all.

New `packages/shared-types` `HelpArticleCategory`/`HelpArticle`, mirroring
`packages/database/src/help-center/entities.ts` exactly.
`lib/help-center-query.ts`/`lib/help-center.ts` mirror `lib/content-template-library-query.ts`/
`lib/content-template-library.ts`'s own zero-non-type-import-file split. `category` is create-only
(shown read-only on edit); `content` uses `RichTextEditor` per the 2026-08-22 standing rule — this
module's one REQUIRED rich-text field, checked client-side via `isEmptyRichTextHtml()` before
submit (mirroring `ProofAndClaimsLibraryForm`'s own `claim` field, this app's only other required
rich-text field).

`HelpCenterPublishActions` is genuinely simpler than every sibling `*PublishActions` component
(`ContentTemplatePublishActions`/`DesignReferenceLibraryPublishActions`): there is no
`approvalStatus` to gate publish against and no dedicated `/publish`/`unpublish` routes — the
seeded `system_settings` RBAC group carries no `P` letter at all — so `isPublished` is a plain
field toggled through the same generic `POST .../:id/update` route the create/edit form itself
uses. No terminal/archived state exists either, so unlike `ContentTemplatePublishActions`'s own
irreversible-unpublish confirmation, neither transition here ever needs a `window.confirm()`. Uses
the shared `useSyncedState()` hook from the start (this project's own 2026-08-27 standing
convention for every module built after that date).

Four routes under `app/(shell)/help-center/` (list, detail, create, edit) at the module registry's
own seeded `route` field (`/help-center`).

### Validation

Independently re-run: `@webdesk/shared-types` build clean; `dashboard-web`/`dashboard-api`/
`dashboard-worker` typecheck clean; `eslint --max-warnings=0` clean (one pre-existing, unrelated
warning in `scripts/check-css-tokens.mjs`, confirmed via `git stash` to predate this branch); CSS
token check clean (107 files); `next build` clean with all 4 new routes present; `prettier --check`
clean; 1964/1964 `dashboard-web` unit tests overall (36 new), 1852/1852 `dashboard-api` unit tests
(unaffected). Live-rendered in the Browser pane against a local dev server: all four routes
(`/help-center`, `/help-center/new`, `/help-center/:id`, `/help-center/:id/edit`) confirmed to
redirect an unauthenticated visitor to `/auth/sign-in` cleanly, zero server errors (one stale
console error from before a local `.env.local` was configured was ruled out via a fresh navigation
and server-log check, not a real defect). No local `dashboard-api` was available in this
environment, so the authenticated success-path rendering (the form, the publish toggle) wasn't
visually confirmed — the same limitation several prior slices in this session have noted for
themselves.

**Reviewed at light tier**, per the 2026-08-27 "right-size the review pipeline" standing rule — a
small, frontend-only UI slice consuming an already-reviewed, already-gated backend with no new
endpoint. A direct read-through pass verified the create/edit field contract against the real
backend `createHelpArticleSchema`/`updateHelpArticleSchema`, the publish-toggle payload shape
against the real backend `update()` route, `category`'s immutability (omitted from the update
schema and the edit form), and reuse of every established shared helper
(`postMutation`/`isEmptyRichTextHtml`/`findOverLongRichTextField`/`useSyncedState`/
`detail-section-styles`/`list-filter-styles`/`list-table-styles`/`SanitizedRichText`) — **0
findings**. No separate security review — no new backend endpoint, no new RBAC action, no new
sink; the one rich-text render site routes exclusively through the existing, already-audited
`SanitizedRichText` component.
