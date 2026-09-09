# WordPress Adapter (`packages/integrations`)

## Scope

Built directly on the explicit "start the WordPress adapter in packages/integrations"
instruction, following the earlier local-WordPress-environment setup/verification work
(2026-09-09) that confirmed Application Password auth and draft creation work end-to-end
against a real WordPress install.

Two genuine design decisions confirmed directly with the user first (`AskUserQuestion`):

1. **Credential env-var shape**: split `WORDPRESS_APP_USERNAME`/`WORDPRESS_APP_PASSWORD` vars
   (chosen) over a single `WORDPRESS_APP` combined string. The one real credential this project
   has provisioned so far (a staging Application Password set as `WORDPRESS_APP` on Vercel,
   per `docs/project-state/setup-input-register.md`) will need to be reconfigured into the split
   shape before it can be used with this adapter — that reconfiguration is not done by this
   build, since no real consumer exists yet to need it live.
2. **Build scope**: the REST API adapter itself, plus the WP-CLI named-action stubs (both
   selected) — explicitly **not** wiring a NestJS DI provider into `dashboard-api`, since no
   business module reads from or writes to WordPress today; wiring one now would be speculative
   code ahead of a real consumer, which this project's own standing discipline avoids elsewhere.

## As-built

### REST API adapter (`wordpress-adapter.ts`, `WordPressRestAdapter`)

Implements the revised `WordPressAdapter` interface (`adapters.ts`) — `getPost`, `listPosts`,
`getPostMeta`, `getPublicationState`, `createDraft`, `updateDraft`, `healthCheck`. Every method
that names a specific post takes `postType` uniformly (a deliberate widening beyond the profile
spec's own bare-`postId` shape for three of these methods — see "Independent code review"
below for why). Basic Auth built from `{baseUrl, username, password}` constructor params.
`createDraft`/`updateDraft` enforce "approved-draft-only, never direct publish"
(`assertDraftOnly`) at the type level (`status?: "draft"`) and at runtime (throws on any other
explicit value) — a single-file guard, not a substitute for the WordPress-side least-privilege
role ADR-0012 actually requires as the real backstop.

429 responses get an exponential-backoff retry (`Retry-After`-aware, clamped, capped at 3
attempts) via a shared private `request()` method; `healthCheck()` opts out of retrying so a
readiness probe fails fast instead of blocking for seconds under rate limiting. Every response
is validated with a local Zod schema before being trusted (NODE-005 boundary validation) —
`wpPostSchema` tolerates WordPress's own quirks (a `meta` field serialized as `[]` instead of
`{}` when empty). A 404 is a distinct, typed "no data" signal (`null`/`{status:"not_found"}`),
never conflated with a genuine failure (`WordPressApiError`, carrying `status`+`body`).

### WP-CLI named actions (`wp-cli-actions.ts`)

`checkCoreVersion`, `clearCache`, `flushRewriteRules`, `checkDatabase`, `runCaseStudyMigration` —
the entire surface of WP-CLI access from the dashboard, each a named, parameterized function
invoking a hardcoded command, never a free-text command field (per
`02-wp-cli-and-deployment.md`). `WpCliExecutor` is the seam a real SSH-backed implementation
plugs into once WP-CLI/SSH provisioning is confirmed (still an open setup-input-register row);
`NotConfiguredWpCliExecutor` is the only implementation today and throws rather than fabricating
a result, mirroring `UnconfiguredNotificationDeliveryAdapter`'s own "the one real adapter
physically cannot claim work it never did" discipline. `runCaseStudyMigration`'s production
`--apply` path requires an explicit `{approved: true}` — documented honestly as a basic safety
net, not a verified tie to a real reviewed deployment record.

### Config (`wordpress-env.ts`)

`wordpressEnvSchema`/`loadWordPressEnv()`, mirroring `apps/dashboard-api/src/auth/config/auth-env.ts`'s
own `loadEnv()`-based pattern rather than the cross-cutting `packages/configuration`
`get*Config()` pattern (Sentry's), since WordPress credentials are integration-specific and
owned solely by this package (the contract's own "Trust boundary" clause). `WORDPRESS_BASE_URL`
is built on the shared `safeHttpUrlSchema` (`@webdesk/validation`), not a bare `z.string().url()`.

### Live verification

Beyond the 60 mocked unit tests, every adapter method was exercised against the real local
WordPress install (`http://localhost/wds/`, see the 2026-09-09 local-environment setup/fix work)
using a real, freshly-generated-then-revoked Application Password: `healthCheck`, `listPosts`,
`createDraft`, `getPost`, `updateDraft`, `getPostMeta`, `getPublicationState`, the draft-only
guard rejecting an explicit non-draft status, and (post-fix) `updateDraft`/`listPosts` against a
nonexistent id/bogus post type both throwing a clean `WordPressApiError` instead of a confusing
`ZodError`. Every test draft was deleted and every test Application Password revoked afterward.

### Independent code review

This project's own `code-review` skill (high effort, 8 finder angles) surfaced 10 findings kept
in the final report, **all 10 CONFIRMED and all 10 fixed**. Most severe: the profile spec's own
`getPostMeta`/`getPublicationState`/`updateDraft` interface shape (bare `postId`, no `postType`)
would have hardcoded all three to the built-in `post` REST route with no compile-time signal —
widened the interface to thread `postType` through uniformly before any real caller existed to be
broken by widening it later. Also fixed: `createDraft`/`updateDraft`/`listPosts` not checking for
a 404 before Zod-parsing the response (threw confusing `ZodError`s instead of clean
`WordPressApiError`s); `getPublicationState`'s inline schema requiring a non-nullable `link`,
inconsistent with `wpPostSchema`'s own nullable `link`; the error-body diagnostic fallback
(`response.text()` after `response.json()` already threw) that could never actually succeed,
since `json()` consumes the body via `text()` internally; `checkCoreVersion` parsing `wp core
version --extra`'s real multi-line output as if it were one line of two space-separated tokens
(fixed with two separate `wp core version` / `wp eval` calls); `getPostMeta`'s schema rejecting
WordPress's own empty-meta-as-`[]` PHP-to-JSON quirk; `WORDPRESS_BASE_URL` not reusing the shared
`safeHttpUrlSchema`; an unclamped, server-controlled `Retry-After` delay that could overflow
Node's `setTimeout` limit; `healthCheck()` inheriting the full 429 retry/backoff instead of
failing fast; and `flushRewriteRules` silently swallowing a failed command instead of throwing.
A pre-existing, unrelated defect (test files leaking into the ESM `dist/` build output — shared
with `vercel-blob-adapter.test.ts`) was also closed as a low-risk, package-wide fix.

No separate `security-review` skill run — the review above already covered the credential
handling, URL-scheme validation, and boundary-validation surface directly, and no new endpoint
or authentication mechanism was introduced (this package makes outbound calls only, and has zero
real consumers yet to expose any of this to an inbound request).

**Not yet done**: second-role human review, a gate decision, and push/PR/merge — each remains
its own separate, not-yet-requested next step, matching this project's standing discipline.
