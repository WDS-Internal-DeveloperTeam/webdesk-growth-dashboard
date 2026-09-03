# `dashboard-web` Help Center UI — Approval Checklist

## Scope

Closes the Help Center module's last named gap, following the backend's own build-to-production
arc (PR #118, merge commit `6a8cbcd`). Four routes (list, detail, create, edit) under
`app/(shell)/help-center/`, file-for-file mirroring Content Template Library's UI structure (the
closest sibling — a real `isPublished` mechanism), simplified further since this module has no
`approvalStatus` at all. New `packages/shared-types` `HelpArticleCategory`/`HelpArticle`.

## Independent verification

- `@webdesk/shared-types` build clean.
- `dashboard-web`/`dashboard-api`/`dashboard-worker` typecheck clean.
- `eslint --max-warnings=0` clean (one pre-existing, unrelated warning in
  `scripts/check-css-tokens.mjs`, confirmed via `git stash` to predate this branch).
- CSS token check clean (107 files).
- `next build` clean, all 4 new routes present.
- `prettier --check` clean.
- 1964/1964 `dashboard-web` unit tests overall (36 new); 1852/1852 `dashboard-api` unit tests
  (unaffected).
- Live-rendered in the Browser pane against a local dev server: all four routes confirmed to
  redirect an unauthenticated visitor to `/auth/sign-in` cleanly, zero server errors (one stale
  console error from before `.env.local` was configured was ruled out via a fresh navigation and
  server-log check, not a real defect).
- **Not visually confirmed**: the authenticated success path (the create/edit form, the publish
  toggle) — no local `dashboard-api` was available in this environment, the same limitation
  several prior slices in this session have noted for themselves.

## Review

**Reviewed at light tier**, per the 2026-08-27 "right-size the review pipeline" standing rule — a
small, frontend-only UI slice consuming an already-reviewed, already-gated backend with no new
endpoint. A direct read-through pass verified:

- The create/edit field contract against the real backend `createHelpArticleSchema`/
  `updateHelpArticleSchema` (title/content length caps match exactly: 255/40,000).
- The publish-toggle payload shape (`{ isPublished: boolean }` via `POST .../:id/update`) against
  the real backend route and its `.refine()` non-empty-patch guard.
- `category`'s immutability — omitted from the update schema and shown read-only on the edit form.
- Reuse of every established shared helper (`postMutation`, `isEmptyRichTextHtml`,
  `findOverLongRichTextField`, `useSyncedState`, `detail-section-styles`, `list-filter-styles`,
  `list-table-styles`, `SanitizedRichText`) rather than re-implementing any of them.

**0 findings.**

No separate security review — no new backend endpoint, no new RBAC action, no new sink; the one
rich-text render site routes exclusively through the existing, already-audited `SanitizedRichText`
component.

## Sign-off

**Pending** — required second-role human review (ADR-0010, the implementing agent cannot also be
its own reviewer), a gate decision, and push/PR/merge authorization each remain separate,
not-yet-requested next steps, per this project's standing "no auto-merge" rule.
