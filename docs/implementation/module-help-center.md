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
transition to `isPublished = true`, via a Postgres `COALESCE(published_at, NOW())` literal bound
as a real parameterized `fn()` argument — never overwritten once first set, never cleared on
unpublish, mirroring `content_templates.published_at`'s own "stamp once" contract),
`createdBy`/`updatedBy`, timestamps. Indexes on `category`, `is_published`, `updated_at`, and a
`pg_trgm` GIN trigram index on `title` for the `search` filter — wired from day one, not added
later as a review-round fix (the gap Knowledge Library's own review found and closed once for
itself).

Reuses the seeded `system_settings` RBAC group verbatim — no new RBAC migration. Since that group
carries no `P` (Publish/Unpublish) letter, `isPublished` is toggled through the ordinary
`POST /help-center/articles/:id/update` route (gated on `edit`) rather than a dedicated
publish/unpublish action — `review`/`configure` (the group's other two grants) go unwired, matching
Scan Center's own precedent for a deliberately-unused seeded action.

`content` is sanitized at write time via the shared `sanitizeRichTextHtml()` (`@webdesk/validation`)
on both `create()` and `update()` (only re-sanitized on `update()` when the patch actually changes
the value, mirroring `sanitizeNullableRichTextIfChanged()`'s own skip-if-unchanged optimization,
adapted here for a required rather than nullable field) — wired ahead of the eventual
`RichTextEditor` UI, matching Section and Pattern Library's/Motion and Interaction Library's own
precedent of sanitizing before any frontend exists to produce the HTML.

Files: `packages/database/src/help-center/{entities,models,entity-mapping,help-article.repository,
index}.ts`; `apps/dashboard-api/src/help-center/{help-center.constants,help-center.dto,
database.providers,help-articles.service,help-articles.controller,help-center.module}.ts` +
`help-articles.service.spec.ts` (10 tests). Both `packages/database` barrel files
(`index.ts`/`index.cjs.ts`) updated. `HelpCenterModule` wired into `app.module.ts`.

### Validation

Independently re-run, not trusted from a single pass: `@webdesk/database` build clean, `dashboard-api`
typecheck clean, `nest build` clean, `eslint --max-warnings=0` clean, `prettier --check` clean,
`boundaries:check` 0 errors (10 pre-existing, unrelated warnings), 1841/1841 `dashboard-api` unit
tests (10 new, all mocked-repository — no DB dependency).

**No local PostgreSQL instance was available in this environment** — `validate:module-registry`,
a real migration up/down round-trip, and any `packages/database` integration or `dashboard-api`
e2e test could not be run here, the same limitation several prior slices in this session have
noted for themselves. The migration content, RBAC decorator placement, and repository CAS/stamp
logic were all read directly and cross-checked against `content_templates`'/`knowledge_library_
records`' own already-reviewed equivalents rather than assumed. This gap should be closed by
running the DB-backed suites against a real disposable database before merge.
