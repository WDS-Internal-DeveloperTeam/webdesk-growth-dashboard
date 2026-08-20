# Business Knowledge Center — Rich Content & File Attachments (as-built)

**Status:** Built, fully validated, independently code-reviewed (8 of 9 CONFIRMED/PLAUSIBLE
findings fixed, 1 left as accepted tracked debt — see §7 below), security-reviewed (0 findings
above threshold — see §8), and required second-role human reviewed (Jitesh D, "Approved as-is").
Not yet gated or merged. Branch `business-knowledge-center-rich-content-attachments`, off `main`
at `31001fa` (the commit recording this task package's own scoping), reviewed commit `359e9a9`.

## 1. Why this exists

Built directly on the explicit "go ahead and start building it" instruction, following
`docs/task-packages/business-knowledge-center-rich-content-attachments.md`'s own scoping —
itself prompted by a direct feasibility question about letting users type rich content or
upload DOCX/XLSX/PDF/Markdown files, previewable on both the create form and the detail page.
Two additional, explicitly requested items were folded into the same branch since both touch
the same two list pages this work already needed to revisit: a page-size selector
(10/20/30/50/100) on every paginated list, and a real, previously-reported bug where "Clear
filters" didn't actually reset the filter controls.

## 2. Pagination and the clear-filters bug (unrelated to attachments, bundled per the user's own request)

- **The bug**: a Next.js `<Link>` soft-navigation re-renders the same DOM node in place, and an
  uncontrolled `<select>`/`<input>`'s `defaultValue` is only honored on that node's first mount —
  clearing filters reset the URL and every other prop, but the browser kept showing whatever the
  reader had last picked. Fixed with a `key` tied to each field's own current value, forcing a
  remount whenever it changes — on both `/business-knowledge-center` (record type, status) and
  `/projects` (search, status), since both pages share the identical bug shape.
- **Page size**: a new shared `lib/pagination.ts` (`PAGE_SIZE_OPTIONS = [10, 20, 30, 50, 100]`,
  default `20`) and `components/page-size-select.tsx` (a small client island navigating on
  change, the same established pattern `ProjectSwitcher` already uses) — wired into both list
  pages' query parsing, href-building, and fetch `limit`. The previous fixed
  `PROJECTS_PAGE_SIZE`/`BUSINESS_KNOWLEDGE_PAGE_SIZE` constants (25) are gone; `pageSize` is now
  a real, validated query param.

## 3. Backend

### 3a. Schema (migration `00049`)

- `business_knowledge_records.content` relaxed to nullable — a record may now carry only file
  attachments, no typed content at all (the realistic create flow: a user either types content,
  or leaves it blank and attaches a file once the record exists — attachments need a real
  `record_id`, so "create empty, then attach" is the only order that works).
- New `business_knowledge_attachments` table: 1-to-many against a record, cascade delete,
  `filename`/`mime_type`/`size_bytes`/`checksum_sha256`/`blob_pathname`/
  `extracted_preview_html`/`scan_status` (the honest interim vocabulary from
  `knowledge/08-vercel-blob-and-file-handling.md`)/`uploaded_by`/`created_at`.
- The down-migration coerces any NULL `content` to `""` before re-adding the NOT NULL
  constraint — found by the test suite's own up/down round-trip check, not assumed; a genuine
  rollback of real NULL-content data can't recover the original content either way.

### 3b. The first real `BlobStorageAdapter` implementation (`packages/integrations`)

Phase 1A left `BlobStorageAdapter` as an interface-only placeholder
(`createUploadAuthorization`/`getSignedReadUrl`) with no implementation. Verified directly
against Vercel's own current documentation before writing any code (not guessed or recalled
from training data) that private-store client uploads and reads work nothing like that original
guess:

- **No "uploadUrl" concept** — direct-to-Blob client uploads go through
  `@vercel/blob/client`'s `handleUpload()` (server) / `upload()` (browser) two-phase
  token-then-PUT protocol.
- **No "signed read URL" concept for a private store** — every read requires an authenticated
  `get()` call, proxied through the consuming app's own route (Vercel's own documented
  "Delivering private blobs" pattern).

`BlobStorageAdapter` was revised to match reality: `handleClientUploadRequest()` wraps
`handleUpload()`, taking the same `onBeforeGenerateToken`/`onUploadCompleted` callbacks Vercel's
API expects but letting the _caller_ (the owning business module, never this adapter) supply
them, since only the caller knows its own auth/RBAC rules; `getObject()`/`deleteObject()` wrap
the private-store `get()`/`del()` pair. `VercelBlobAdapter` is the concrete implementation —
8 unit tests, `@vercel/blob`/`@vercel/blob/client` calls mocked, confirming the translation
between this project's callback shape and the SDK's own.

Given the dual-build lesson already recorded in this project's own `CLAUDE.md` Cautions section
(a missing CommonJS export once caused a full production outage, since Vercel's Function
bundler `require()`s workspace packages rather than inlining them), `@webdesk/integrations`
gets the same dual ESM+CJS build (`dist/` + `dist-cjs/`) as `@webdesk/database`/
`configuration`/`shared-types`/`validation` now that it has a real implementation `dashboard-api`
actually imports — verified directly (`node -e "require('./dist-cjs/index.js').VercelBlobAdapter"`
resolves to a real function), not assumed from the ESM build alone.

### 3c. `dashboard-api`: attachment endpoints

`BusinessKnowledgeAttachmentsController`/`Service`, under
`/business-knowledge/records/:id/attachments`:

- `POST .../upload-route` — the Blob client-token endpoint. Real RBAC (`edit` grant), format
  allowlist, and the 25 MB size ceiling are all enforced in `onBeforeGenerateToken`, the only
  phase a real authenticated browser call reaches. `onUploadCompleted` — Vercel's own
  server-to-server completion webhook — is a deliberate no-op: this route stays behind
  `SessionGuard`/`OriginCheckGuard`, so the webhook phase (no session cookie, no matching Origin)
  simply gets rejected and Vercel retries a few times, harmlessly. This app's real "the upload
  actually happened" signal is the browser's own `upload()` call resolving, which only occurs
  once the raw PUT to Blob storage genuinely completed — the client then calls `confirm()`
  itself, directly, right after.
- `POST .../confirm` — downloads the real object via `getObject()`, re-verifies its actual
  content type and size server-side (never trusting the client's claims — the two fields the
  client _can_ send, `pathname` and `filename`, are the two things it can't fabricate a useful
  lie about), computes a real SHA-256 checksum, generates the format-specific preview, and
  persists the row. Rejects and deletes the object if the real content type/size fail
  re-validation — defense-in-depth beyond what the Blob token already enforced.
- `GET .../attachments` / `GET .../:attachmentId/content` — list and content-proxy routes.
  The content route streams the real bytes through this app's own auth (matching Vercel's
  documented private-blob delivery pattern exactly — `Content-Type`/`Cache-Control: private,
no-cache`/`X-Content-Type-Options: nosniff`), never a direct Blob URL.
- `DELETE .../:attachmentId` — deletes the Blob object and the row.

Every route is scoped to its own `recordId` on every read/write (an attachment can't be
fetched/deleted through a different record's route — a real IDOR guard, e2e-tested directly),
and a `restricted` record's attachments are redacted (an empty list, a 404 on content) for a
caller without `view_confidential` — exactly the same mechanism, and the same zero-seeded grant,
already protecting `content`/`notes`.

`blobPathname` — the Blob object's own internal storage key — is stripped from every API
response (`toPublicAttachment()`), matching this app's existing `UserSummary`-style
response-narrowing precedent; the client only ever reads content through the
cookie-authenticated content-proxy route.

### 3d. Preview generation and sanitization

- **DOCX** → `mammoth.convertToHtml()`.
- **XLSX** → a hand-built HTML table from a real `ExcelJS`-parsed workbook (200-row/50-column
  cap, stated in the output when truncated — never silent). `exceljs` was chosen over the `xlsx`
  npm package after `pnpm audit` flagged two real HIGH-severity vulnerabilities (prototype
  pollution, ReDoS) in the only version actually published to the standard npm registry — a
  concrete, not theoretical, concern given this parses untrusted user uploads.
- **Markdown** → `markdown-it`, chosen over `marked` (the more commonly reached-for choice),
  which is ESM-only (`"type": "module"`, no `require` export) — using it from `dashboard-api`
  (CommonJS, per its own `nest build` output) would have reproduced the exact
  openid-client-class ESM-interop failure already documented once in this project's own
  `CLAUDE.md`.
- **PDF** → no extracted preview, by design (task package D4) — rendered as the real file via
  the content-proxy route in an `<embed>`, not lossy-extracted.

Every generated preview, and the typed `content` field itself, is sanitized
(`sanitize-html.util.ts`) against a strict allowlist (headings, bold/italic/underline/strike,
lists, blockquote, code, table, `<a href>` restricted to `http`/`https`) before ever being
stored — the single most consequential decision in the task package, since storing/rendering
arbitrary HTML is a genuinely new attack surface this project has never carried before (every
other page relies on React's automatic escaping specifically because `dangerouslySetInnerHTML`
was flagged as the thing to avoid in this project's own prior security review, on the Project
Detail page's confirmed HIGH stored-XSS finding). `dashboard-web` applies the identical
allowlist again at render time (`lib/sanitize-html.ts`) as defense-in-depth for the
already-server-rendered initial page load; a same-session freshly-confirmed upload's preview
renders trusting the backend's write-time sanitization alone (a browser-safe sanitizer would be
needed to close that one remaining gap — flagged, not silently skipped, in the component's own
doc comment).

`content`'s max length rose from `50_000` to `100_000` characters on both create and update
schemas — HTML from the editor carries real markup overhead over the equivalent plain text.

## 4. Frontend

- **`RichTextEditor`** (`components/rich-text-editor.tsx`) — Tiptap's `starter-kit`
  (bold/italic/underline/strike, headings, lists, blockquote, code, link, undo/redo — exactly the
  tag set the backend's sanitizer allows, so nothing typed here is ever silently stripped
  server-side). `immediatelyRender: false` (required for Next.js SSR — Tiptap explicitly doesn't
  support server rendering without it). Being WYSIWYG, "preview" (requirement 2) needs no
  separate pane — what's shown while typing is what gets saved. Wired into
  `BusinessKnowledgeRecordForm` in place of the previous plain `<textarea>`; `content` is now
  genuinely optional there too (an empty editor omits `content` from the create payload entirely,
  landing as the new nullable-column `null`, not a stored empty string).
- **`BusinessKnowledgeAttachmentsSection`** (`components/business-knowledge-attachments-section.tsx`)
  — a new client island on the Project Detail page's sibling, the Business Knowledge Center
  detail page. Upload via `@vercel/blob/client`'s `upload()` pointed at the record's own
  `upload-route`; once it resolves, calls `confirm()` directly (not relying on Vercel's own
  webhook, matching the backend's own design). Each attachment renders its real preview inline —
  a PDF as a real `<embed>` via the content-proxy route, a DOCX/XLSX/Markdown attachment as its
  cached `extractedPreviewHtml` — never just a filename and a download link. Delete removes both
  the row and, server-side, the Blob object.
- **Detail page**: `content` now renders as sanitized formatted HTML (`dangerouslySetInnerHTML`,
  double-sanitized per §3d) instead of a plain `<p>` of raw text; a record with no content at
  all shows an honest "see this record's attachments below" message instead of an empty
  paragraph.
- **`packages/shared-types`**: `BusinessKnowledgeRecord.content` widened to `string | null |
undefined` (three real, distinct states — redacted / genuinely empty / real content, not two);
  new `BusinessKnowledgeAttachment` / `BusinessKnowledgeAttachmentScanStatus` types, matching the
  backend's public (post-`toPublicAttachment()`) response shape exactly — no `blobPathname`.

## 5. Validation

- **`packages/database`**: 149/149 integration tests (7 new — attachment CRUD, the cross-record
  IDOR guard, cascade delete verified at the DB layer via a raw `DELETE`, the real ENUM
  constraint on `scan_status`) + 28/28 unit tests, against a real disposable PostgreSQL 17
  database. Migration `00049` up/down round-trip verified clean.
- **`packages/integrations`**: 8/8 unit tests (new package test coverage — the adapter's
  translation logic between this project's callback shape and `@vercel/blob`'s own).
- **`dashboard-api`**: 427/427 unit tests (52 new — sanitizer allowlist, preview generation
  including a real `ExcelJS`-written workbook and truncation, the attachments service's full
  confirm/list/content/delete logic, content-sanitization on create/update) + 132/132 e2e tests
  (19 new — the full attachment lifecycle over real HTTP against a real disposable database,
  with an in-memory `BlobStorageAdapter` fake substituted for the real one — no real Vercel Blob
  store/token is provisioned in this environment or, per the task package's own §10, in
  production yet either). `pnpm audit`: 0 vulnerabilities.
- **`dashboard-web`**: 258/258 unit tests (34 new — the rich-text editor rendering/toolbar/sync
  behavior in real jsdom, the attachments section's upload/reject/delete/preview logic with
  `@vercel/blob/client`'s `upload()` mocked, the render-time sanitizer, the form's new
  content-optional behavior). 15/15 Playwright tests (unchanged routes, all still passing).
  `next build`/typecheck/lint/`check-css-tokens.mjs`/prettier all clean.
- **Live-rendered**: the dev server was started and both `/business-knowledge-center/new` and
  `/business-knowledge-center/:id` were confirmed to redirect an unauthenticated visitor to
  `/auth/sign-in` cleanly, with zero server errors — the same limitation every prior slice in
  this project has noted for itself applies here too: no local `dashboard-api` is available in
  this environment, so the authenticated success-path rendering (the editor/attachments UI
  actually mounted) wasn't visually confirmed live, only through the real jsdom component tests
  above.

## 6. Deliberate scope decisions (flagged, not silently made)

- **Attachments upload from the detail/edit page, not the create form.** The task package's own
  D5 imagined "the same component serving both the create form and the detail page" — in
  practice, an attachment needs a real `record_id`, which doesn't exist until after the record is
  created, so upload only ever happens once a record exists. D5's actual underlying intent (one
  shared preview component, reused for the immediate-preview-after-upload case) is still
  satisfied — just realized within the one detail-page component rather than split across two
  pages.
- **PDF is embedded, not extracted** (D4) — a real, considered choice, not a shortcut: true
  PDF→HTML text extraction is lossy and unreliable across authoring tools; embedding the actual
  file is both more honest and materially less work.
- **`onUploadCompleted` is a no-op** — Vercel's own webhook is real but not load-bearing for this
  app's correctness; relying on it would mean trusting unverifiable server-to-server delivery in
  an environment where it can't even be tested (no real Blob store exists here or in production
  yet).
- **Same-session freshly-uploaded preview HTML isn't re-sanitized client-side** — the render-time
  defense-in-depth pass covers the already-server-rendered initial page load; closing this one
  remaining gap would need a browser-safe HTML sanitizer, a real but deferred hardening item.

## 7. Independent code review

Run at high effort (8 finder angles, 1-vote verification). 9 candidates survived dedup and
verification (7 CONFIRMED, 2 PLAUSIBLE), reported via `ReportFindings`, then all but one fixed
per the explicit "fix the confirmed findings" instruction.

**Most severe, and the review's own most important catch**: the file-attachment upload flow
called `@vercel/blob/client`'s `upload()` with `handleUploadUrl` pointing directly at
`dashboard-api` — a genuinely cross-origin request (the two apps are separate `*.vercel.app`
deployments, isolated as distinct sites). The Blob client SDK has no `credentials` option and
browsers forbid scripts from setting a `Cookie` header manually, so that request could never
carry the session cookie `dashboard-api`'s `SessionGuard`/`OriginCheckGuard`/`PermissionGuard`
require — **every real upload attempt would have 401'd in production**, the entire feature this
branch was built to deliver. Verified directly against `@vercel/blob@2.8.0`'s own source
(`retrieveClientToken()`'s `fetch()` call passes no `credentials` override, defaulting to
`"same-origin"`, and resolves a relative `handleUploadUrl` against the current page's own
origin). Fixed with a new same-origin `dashboard-web` Route Handler
(`app/(shell)/business-knowledge-center/[recordId]/attachments/upload-route/route.ts`) that
proxies the request server-to-server, forwarding the incoming `Cookie` header and an explicit
`Origin` header — the same forwarding pattern `app/auth/session/route.ts` already established;
`handleUploadUrl` now points at this relative, same-origin path instead.

Also fixed:

- **Edit-mode content clearing stored the literal string `'<p></p>'` instead of `null`.** The
  create-mode payload builder already had an `isContentEmpty` guard omitting `content` when
  nothing was typed; the edit-mode builder had no equivalent, so emptying the editor and saving
  sent Tiptap's own empty-document output as real content. The detail page's `record.content ?
<rich block> : <p>No content</p>` check then rendered a visually blank rich-content block
  instead of the honest empty state. Fixed at both layers: `updateBusinessKnowledgeRecordSchema`
  widened from `.optional()` to `.nullish()` (matching `notes`'s own existing shape) so an
  explicit `null` is a real, distinct client intent from omission (which still means "leave
  unchanged"); `BusinessKnowledgeRecordsService.update()` now branches on `patch.content ===
null` to pass `null` straight through rather than sanitizing it; the edit-mode payload now sends
  `content: isContentEmpty ? null : content`.
- **`confirm()` had no try/catch around `generateAttachmentPreviewHtml()`**, unlike the two
  content-type/size validation checks immediately above it, which both call
  `this.blob.deleteObject()` before throwing a clean `BadRequestException`. A structurally
  invalid file of an otherwise-allowed MIME type (a truncated upload, a mislabeled file) makes
  `mammoth`/`ExcelJS` genuinely throw — verified directly against the installed libraries, not
  assumed — which previously propagated to a raw 500 with the already-uploaded Blob object left
  permanently orphaned. Fixed by wrapping the call in the same clean-up-before-throw pattern.
- **The rich-text editor's length-limit guard silently desynced from Tiptap's own internal
  document.** `onChange={(html) => setContent(html.length <= MAX ? html : content)}` rejected an
  over-limit update by calling `setContent` with the _unchanged_ value — a React no-op
  (`Object.is`-equal `setState` never re-renders), so `RichTextEditor`'s own `useEffect` (keyed
  on `[value, editor]`, the only mechanism correcting Tiptap's document back down) never re-fired.
  Once triggered, Tiptap silently went uncontrolled with zero feedback. Fixed by removing the
  guard entirely (`onChange={setContent}`, a plain passthrough — structurally eliminating the
  divergence, not just patching one symptom of it) and enforcing the real length limit once,
  clearly, at submit time instead.
- **A narrow, real reverse-tabnabbing gap** (PLAUSIBLE — the review correctly found the
  underlying sanitizer gap real but initially misattributed it to Tiptap's own Link toolbar
  button, which turned out already safe by construction; the actual vector is a raw-HTML paste
  carrying `target="_blank"` with no safe `rel`). Fixed by adding a `transformTags` rule to the
  shared sanitizer (see below) that forces `rel="noopener noreferrer nofollow"` onto any `<a>`
  that carries a `target`, regardless of what `rel` the source HTML supplied.
- **The Record Detail page fetched the record and its attachments sequentially**, even though
  the attachments fetch only needs `recordId` (already known from route params) and has no
  genuine data dependency on the record's own response — the identical shape this project already
  found and fixed once for the Project Detail page's sub-resource fetches (PR #27). Fixed by
  firing both concurrently, with the same `tolerateDiscard()` technique (now exported from
  `lib/business-knowledge.ts`) so a nonexistent record's incidental attachments-fetch rejection
  stays silenced rather than surfacing as an unhandled-rejection warning.
- **`BusinessKnowledgeAttachmentsSection` called `router.refresh()` after every mutation**
  alongside an already-sufficient local state update — the exact redundant-refresh shape this
  project has now found and fixed multiple times in sibling components (items 12 and 27). No
  other section of the parent page reads attachment data, so nothing goes stale without the
  refresh. Removed both calls (and the now-unused `useRouter` import).
- **The two HTML sanitization allowlists (`dashboard-api` write-time, `dashboard-web` render-time)
  were byte-identical but independently hand-maintained**, the exact duplication shape this
  project already found and fixed once for `safeHttpUrlSchema` (`module-projects-backend-closeout`).
  `packages/validation` already exists, is already consumed by both apps, and already exists
  specifically to hold definitions both sides must validate identically against. Promoted the
  allowlist into a new `sanitizeRichTextHtml()` export there (also where the tabnabbing fix above
  lives, closing both findings with one shared implementation); both apps' own
  `sanitize-html.util.ts`/`lib/sanitize-html.ts` now just delegate to it. `dashboard-web` gained
  `@webdesk/validation` as a real dependency (previously missing) and dropped its now-unused
  direct `sanitize-html`/`@types/sanitize-html` dependencies.

**1 CONFIRMED finding left as accepted, tracked debt**: Vercel Blob's own server-to-server
`onUploadCompleted` webhook is a genuine no-op (by design — it's called with no session cookie
and 401s, so this app's real "upload confirmed" signal is the client's own `confirm()` call
instead), and there is no cleanup/reconciliation mechanism anywhere for a file that finishes
uploading to Blob storage but whose subsequent `confirm()` call never completes (a closed tab, a
dropped network connection) — the object sits orphaned in storage indefinitely with zero
operator visibility. A real fix means building a cron job, TTL-based sweep, or admin tool — a
materially larger scope than a review-fix pass, matching this project's own established
precedent for deferring this class of gap (e.g. `POST /auth/exchange`'s accepted-debt
origin-guard gap in the session-exchange work).

Re-validated after fixes: 430/430 `dashboard-api` unit tests (3 new), 132/132 `dashboard-api` e2e
tests (real disposable database, unchanged count — every existing test still passes against the
widened DTO/service signatures), 9/9 `packages/validation` unit tests (5 new, covering the shared
sanitizer including the new `rel`-forcing behavior), 258/258 `dashboard-web` unit tests (updated
assertions for the new same-origin upload URL and the removed `router.refresh()` calls),
typecheck/lint/`next build`/`nest build`/`check-css-tokens.mjs`/prettier all clean across every
touched package, `pnpm audit` 0 vulnerabilities.

## 8. Independent security review

Run separately from the code review, against reviewed commit `359e9a9`. Given this branch is
this project's first HTML-storage/rendering surface, the sanitization boundary
(`sanitize-html.util.ts` / `lib/sanitize-html.ts`, now the shared `packages/validation`
`sanitizeRichTextHtml()`) was treated as its own explicit focus area, not one finding among many
general ones.

**0 findings above the confidence threshold (≥ 8/10).** Confirmed correct on every pattern that
usually goes wrong in this shape of feature:

- **IDOR scoping** — every attachment lookup/delete matches on `(id, recordId)` at the repository
  layer (`findByIdForRecord`/`deleteForRecord`); no cross-record access via a guessed UUID.
- **`restricted`-record redaction** — `canSeeAttachments()` correctly gates `list()` and
  `content()` on `AuthorizationService.canViewConfidential()`, mirroring the records controller's
  own pattern; a redacted caller gets an empty list / a 404, never a leak.
- **The new same-origin upload proxy** — fixed destination host (server config, not user input),
  forwards only the browser's own incoming cookie, sets a correct `Origin` header for
  `OriginCheckGuard`. Not an open proxy or SSRF vector — `recordId` only parameterizes a path
  segment on a fixed, already-guarded internal API.
- **Sanitizer allowlist** — tight tag list, `allowedSchemes: ["http", "https"]`,
  `allowProtocolRelative: false`, no `style`/`class`/`id`, and the `transformTags` rule correctly
  forces safe `rel` onto any `target`-carrying `<a>` regardless of source.
- **Preview generation** — `markdown-it` runs with `html: false` (blocks raw-HTML-in-Markdown
  injection); XLSX cell text is manually HTML-escaped before table assembly; all generated preview
  HTML passes through the same sanitizer before caching.
- **Blob pathnames** — prefix-checked identically at token-mint and confirm time,
  `addRandomSuffix: true` prevents predictable keys, and `blobPathname` is stripped from every API
  response.
- **Content-proxy route** — `Content-Type` is always one of 4 fixed, server-validated MIME
  strings; the `Content-Disposition` filename is `encodeURIComponent`-escaped, closing header
  injection via a malicious filename.
- No SQL/command injection, no `eval`/`Function`/`child_process`, no hardcoded secrets anywhere in
  the diff.

**One sub-threshold observation, not raised as a finding**: a doc comment in
`business-knowledge-attachments-section.tsx` claims the initial server-rendered attachment list
passes through a `dashboard-web` render-time sanitization pass "called from
`getBusinessKnowledgeAttachments()`" — but that function never actually calls
`sanitizeRenderedHtml()`. Not independently exploitable: `extractedPreviewHtml` has exactly one
write path (`confirm()` → `generateAttachmentPreviewHtml()` → `sanitizeAttachmentPreviewHtml()`),
which always sanitizes before persisting, so there's no way to get unsanitized HTML into that
field today. Worth a doc-comment correction, not a security fix.

## 9. Required second-role human review

A review packet (published as a Claude artifact — code review findings/fixes from §7, the
security review from §8, and validation evidence, with a decision section) was prepared for the
required second-role human review, since the implementing agent cannot also be its own reviewer
(ADR-0010). **Jitesh D reviewed it and returned "Approved as-is,"** accepting the one open
CONFIRMED code-review finding (no cleanup mechanism for a Blob object orphaned by an interrupted
upload — §7) as tracked debt rather than requesting a fix before merge. A gate decision and merge
authorization remain separate, not-yet-requested next steps.
