# Help Center — Approval Checklist

## Scope

Module backend: `help_center` (module #38). A single generic `help_articles` table with a
16-value `category` discriminator taken verbatim from the canonical spec's own topic list, no
approval workflow (a plain `isPublished`/`publishedAt` field pair instead), organization-wide.
Reuses the already-seeded `system_settings` RBAC permission group verbatim — no new RBAC
migration. Migrations `00115`/`00116`.

Design forks confirmed directly with the project owner before building (`AskUserQuestion`):

1. RBAC — keep the seeded `system_settings` grants as-is (chosen; only `super_admin`/
   `owner_growth_approver` get any access at all, a real and deliberate limitation for a module
   meant to serve everyone) vs. widen the seeded grants via a new RBAC migration.
2. Data model — a single generic table with a `category` discriminator (chosen) vs. a two-table
   FAQ/article split.
3. Workflow — simple `isPublished`/`publishedAt` only, no governed approval pipeline (chosen) vs.
   the standard 8-value `ArtifactApprovalStatus` workflow.

Built directly by the orchestrating session (not delegated to a background agent).

## Independent verification

- `@webdesk/database` build clean; `dashboard-api` typecheck clean; `nest build` clean.
- `eslint --max-warnings=0` clean; `prettier --check` clean.
- `boundaries:check` — 0 errors (10 pre-existing, unrelated warnings).
- 1852/1852 `dashboard-api` unit tests overall (21 new for this module, all mocked-repository —
  re-run clean after every fix round).
- Confirmed every `@RequirePermission` decorator is method-level, never class-level.
- Confirmed `OriginCheckGuard` is present on both mutating routes (`create`, `update`).
- Confirmed both `packages/database/src/index.ts` and `index.cjs.ts` (the separately-maintained
  CommonJS barrel) were updated together.
- **Not independently re-run**: `validate:module-registry`, a real migration up/down round-trip,
  and any `packages/database` integration or `dashboard-api` e2e test — no local PostgreSQL
  instance was available in this environment. The migration content and repository stamp-once
  logic were read directly and cross-checked against `content_templates`'/`knowledge_library_
records`' own already-reviewed equivalents rather than assumed. **This gap should be closed by
  running the DB-backed suites against a real disposable database before merge.**

## Independent code review

(this project's own `code-review` skill, medium effort, 8-angle finder pass, 1-vote
self-verification)

8 candidates kept in the final report, **all 8 CONFIRMED/PLAUSIBLE, all 8 fixed** — see
`docs/implementation/module-help-center.md`'s "Independent code review" section for the full
account. Most severe: `create()` never stamped `publishedAt` when an article was created already
published, contradicting the entity's own documented contract; `update()`'s pre-fetch of the
current row created a stale-read audit-classification race and an avoidable DB round trip (fixed
by removing the pre-fetch entirely and deriving the audit event purely from caller intent); the
audit `afterState` for a plain content edit recorded only `isPublished`, dropping title/content
changes from the trail. No open findings remain — every candidate that survived verification was
fixed, not accepted as debt.

## Security review

No separate `security-review` skill run, per the 2026-08-27 "right-size the review pipeline"
standing rule — reuses only already-vetted mechanisms throughout (the shared, already-audited
`sanitizeRichTextHtml()`, the existing `PermissionGuard`/`OriginCheckGuard`/`RequirePermission`
machinery, `escapeLikePattern()` for search) with no new sink or endpoint class beyond standard
CRUD. Directly confirmed: RBAC decorator placement, `OriginCheckGuard` coverage, `category`
immutability (omitted from the update schema), and no fabricated confidential-field mechanism
(the module registry's own seeded `confidentialityLevel` for `help_center` is `null`).

## Sign-off

**Pending** — required second-role human review (ADR-0010, the implementing agent cannot also be
its own reviewer), a gate decision, and merge authorization each remain separate,
not-yet-requested next steps, per this project's standing "no auto-merge" rule. The one open,
disclosed gap (no DB-backed validation run in this environment) should be weighed as part of that
review.
