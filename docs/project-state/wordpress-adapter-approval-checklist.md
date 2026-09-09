# WordPress Adapter — Approval Checklist

**Scope:** `packages/integrations` — `WordPressRestAdapter` (REST API adapter), `wp-cli-actions.ts`
(named WP-CLI action stubs), `wordpress-env.ts` (config loader). No `dashboard-api` wiring. See
`docs/implementation/wordpress-adapter.md` for the full as-built account.

## Validation

- 60/60 `packages/integrations` unit tests (mocked `fetch`/`WpCliExecutor`), typecheck, lint
  (`--max-warnings=0`), production build (dual ESM+CJS) — all clean.
- `pnpm boundaries:check` — 0 dependency-boundary violations from the new `@webdesk/validation`
  dependency.
- Live-verified end-to-end against the real local WordPress install (`http://localhost/wds/`)
  using a freshly-generated-then-revoked Application Password: `healthCheck`, `listPosts`,
  `createDraft`, `getPost`, `updateDraft`, `getPostMeta`, `getPublicationState`, the draft-only
  write guard, and (post-fix) `updateDraft`/`listPosts` against a nonexistent id/bogus post type
  both correctly throwing `WordPressApiError` instead of a confusing `ZodError`.

## Independent code review

This project's own `code-review` skill, high effort, 8 finder angles (line-by-line scan,
removed-behavior audit, cross-file tracer, reuse, simplification, efficiency, altitude,
CLAUDE.md conventions). 10 findings kept in the final report — **all 10 CONFIRMED, all 10
fixed**, re-verified via the full test suite and a second live smoke-test pass:

| #   | Finding                                                                                                                                                              | Fix                                                            |
| --- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------- |
| 1   | `createDraft`/`updateDraft`/`listPosts` didn't check for a 404 before Zod-parsing the response, throwing confusing `ZodError`s instead of clean `WordPressApiError`s | Added explicit 404 checks throwing a typed `WordPressApiError` |
| 2   | `getPostMeta`/`getPublicationState`/`updateDraft` had no `postType` param, hardcoding the built-in `post` REST route                                                 | Widened the interface to thread `postType` through uniformly   |
| 3   | `getPublicationState`'s inline schema required a non-nullable `link`, inconsistent with `wpPostSchema`                                                               | Made `link` nullable in both schemas                           |
| 4   | The error-body diagnostic fallback (`.text()` after `.json()` already threw) could never succeed                                                                     | Read raw text first, then attempt `JSON.parse` on it           |
| 5   | `checkCoreVersion` parsed `wp core version --extra`'s real multi-line output as one line                                                                             | Split into two separate `wp core version` / `wp eval` calls    |
| 6   | `getPostMeta`'s schema rejected WordPress's empty-meta-as-`[]` PHP-to-JSON quirk                                                                                     | Added `normalizeMeta()` treating an empty array as `{}`        |
| 7   | `WORDPRESS_BASE_URL` used a bare `z.string().url()` instead of the shared `safeHttpUrlSchema`                                                                        | Reused `safeHttpUrlSchema` from `@webdesk/validation`          |
| 8   | The `Retry-After`-derived delay was unclamped, risking a `setTimeout` overflow                                                                                       | Clamped to `MAX_RETRY_AFTER_SECONDS = 30`                      |
| 9   | `healthCheck()` inherited the full 429 retry/backoff instead of failing fast                                                                                         | Added a `retryOn429` option, `false` for `healthCheck()`       |
| 10  | `flushRewriteRules` silently swallowed a failed command                                                                                                              | Throws on a non-zero exit code                                 |

A pre-existing, unrelated defect (test files leaking into the ESM `dist/` build output, shared
with `vercel-blob-adapter.test.ts`) was also closed via a `tsconfig.json` `exclude` fix.

## Security-relevant surface

No separate `security-review` skill run. The independent code review above already covered the
security-relevant surface directly: credential handling (Basic Auth header construction, no
credential logging), URL-scheme validation (finding #7, now reusing the shared
`safeHttpUrlSchema` after a prior real stored-XSS finding on an identical bare-`.url()` pattern
elsewhere in this codebase), and boundary validation on every external response (NODE-005). No
new inbound endpoint or authentication mechanism exists — this package makes outbound calls only,
and has zero real consumers yet to expose any of it to an inbound request. `assertDraftOnly`'s and
`assertProductionWriteApproved`'s own doc comments were corrected during review to accurately
state what they do and do not guarantee (a single-file convention, not a verified tie to
WordPress-side role enforcement or a real reviewed deployment record).

## Sign-off

**Required second-role human review**: WebDesk Solution reviewed the findings above directly and
gave the explicit "Gate it and push the branch" instruction — accepted as-is, no disputes raised.

**Gate**: `G4-wordpress-adapter` — WebDesk Solution, decision **CONFIRM**, on branch
`wordpress-adapter`. This gate approval does not itself authorize opening a PR or merging — each
remains its own separate, not-yet-requested authorization, per this project's standing
"no auto-merge" rule.
