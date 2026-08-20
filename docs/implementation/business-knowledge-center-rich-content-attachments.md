# Business Knowledge Center — Rich Content & File Attachments (as-built)

**Status:** Built, fully validated (real disposable database, real HTTP e2e, real component
tests, a full `next build`, live-rendered unauthenticated-redirect checks). Not yet
code-reviewed, security-reviewed, gated, or merged. Branch
`business-knowledge-center-rich-content-attachments`, off `main` at `31001fa` (the commit
recording this task package's own scoping).

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
