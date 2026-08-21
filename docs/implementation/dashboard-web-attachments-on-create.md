# `dashboard-web` — file upload on the Business Knowledge Record create form

**Status: built, fully validated. Not yet reviewed, gated, or merged.**

## 1. Why this exists

File attachments (`business-knowledge-center-rich-content-attachments.md`) shipped upload
capability only on the record's detail page (`BusinessKnowledgeAttachmentsSection`) — a
deliberate scope decision at the time (§6 of that doc), since an attachment's `record_id` is a
real database foreign key and can't be created before the record itself exists. The user then
asked directly for upload to also be available on the **New** (create) form, not only after the
record exists on the detail page.

## 2. Approach

An attachment still can't be created before its parent record exists, so this doesn't call the
upload endpoints any earlier than before — it only changes _when the user is asked to pick
files_. Files chosen on the create form are staged client-side (kept as real `File` objects in
component state, never touched over the network) until `handleSubmit` successfully creates the
record and learns its real id. At that point every staged file is uploaded via the exact same
`uploadAttachment()` flow the detail page's own upload control already uses — direct-to-Blob
`upload()` through the record's same-origin `upload-route` proxy, then `confirm()` — so the
create form's file picker adds no new backend surface at all.

## 3. Shared attachment helpers extracted

`BusinessKnowledgeAttachmentsSection` (the detail page's upload control) previously hand-rolled
its own MIME/size allowlist and its own `upload()`-then-`confirm()` sequence inline. Both would
otherwise be duplicated a second time for the create form, so they're extracted into a new
`lib/business-knowledge-attachments.ts` (zero non-type imports beyond `@vercel/blob/client` and
this app's own `parseApiErrorMessage`/`getApiBaseUrl` — a plain client-safe module, not a
`"use client"` component):

- `ALLOWED_ATTACHMENT_MIME_TYPES` / `ALLOWED_ATTACHMENT_EXTENSIONS` / `MAX_ATTACHMENT_SIZE_BYTES`
  — the same allowlist/size cap `business-knowledge.constants.ts` enforces server-side; this
  client-side copy is UX only, kept in sync by hand (the same approach every other
  backend-DTO-mirroring file in this app already uses).
- `validateAttachmentFile(file)` — returns a human-readable error or `null`.
- `formatAttachmentSize(bytes)`.
- `uploadAttachment(recordId, file)` — the real `upload()` + `confirm()` sequence, returning the
  created `BusinessKnowledgeAttachment`.
- `AttachmentUploadApiError` — thrown by `uploadAttachment()` only for a well-formed non-OK
  response from `confirm()`. Its `message` is already the safe, curated string
  `parseApiErrorMessage()` produced (real backend detail for an allowlisted error code, or that
  helper's own generic fallback otherwise) — safe to show a caller's user directly. Any other
  failure (the Blob PUT itself, a network-level rejection, a malformed response body) throws a
  plain `Error` instead, so callers can tell the two apart and never show a raw, uncurated message
  verbatim (this project's standing rule). Both consumers below branch on
  `instanceof AttachmentUploadApiError` to preserve that distinction — a subtlety the first pass
  at this refactor missed and a test caught (see §5).

`BusinessKnowledgeAttachmentsSection` was updated to import all of the above instead of its own
copies — a pure refactor, no behavior change (re-validated by its own existing test suite, all
still passing unchanged).

## 4. The create form's file picker

`BusinessKnowledgeRecordForm` (create mode only — edit mode still has no file picker of its own;
attachments already have their dedicated control on the detail page):

- A file input (`multiple`) styled with the same `uploadButton`/`fileInput` classes the detail
  page's own control uses (`composes:` from that CSS Module — no duplicated CSS).
- Each newly selected file is validated with `validateAttachmentFile()`; valid files are appended
  to a `pendingFiles: readonly File[]` state array; invalid ones surface an inline error naming
  the file and the reason, without being staged.
- Staged files render as a small list (name + size), each with its own "Remove" button.
- On submit, the record is created first (unchanged from before). Once its real id is known, if
  any files are staged, each is uploaded via `uploadAttachment(recordId, file)` — all in parallel
  via `Promise.allSettled`, since the files are independent of each other.
  - If every upload succeeds (or none were staged), the form navigates to the new record's detail
    page exactly as it did before this change.
  - If one or more uploads fail, the form does **not** navigate. It shows which file(s) failed
    and says the record itself was still created and the failed file(s) can be retried from the
    detail page's own upload control — the record must never be silently lost just because an
    attachment didn't make it.

### A real bug this design has to guard against: duplicate record creation

Once the record is successfully created, the form must never let a second submit fire
`POST /business-knowledge/records` again — that would create a second, duplicate record with the
same title, and the user has no way to know that happened. This matters specifically because a
partial-failure outcome (record created, some attachments failed) leaves the form still mounted
and visible, with nothing else preventing a confused user from clicking "Create record" again.

Fixed with a `createdRecordId` state, set as soon as the record creation `POST` succeeds
(regardless of what happens to any staged attachments after). Once set, the submit button is
replaced entirely by a "View record" link pointing at the real, already-created record — there is
no code path left that can re-invoke `handleSubmit`'s record-creation branch.

## 5. A refactor pitfall caught by the existing test suite

The first version of this refactor had `uploadAttachment()` throw a plain `Error` for every
failure, including a well-formed non-OK `confirm()` response. That collapsed a distinction the
original, pre-refactor `BusinessKnowledgeAttachmentsSection` code relied on: a real backend error
message (via `parseApiErrorMessage()`) was previously shown to the user directly, while a generic
unexpected exception got a fixed, generic fallback message. Re-running the pre-existing
`business-knowledge-attachments-section.test.tsx` suite caught this immediately — one test
(`"shows the backend's error message when confirm() fails"`) failed because the real message had
been replaced by the generic fallback. Fixed with the `AttachmentUploadApiError` class described
in §3, restoring the original distinction in both consumers. Left as a concrete reminder that a
"pure" extraction of duplicated logic can still silently drop a behavioral nuance that lived only
in how the original callers handled a shared dependency's result.

## 6. Validation

- **264/264** `dashboard-web` unit tests (5 new: staging a file and removing it before submit;
  rejecting an invalid staged file inline; uploading every staged file after record creation and
  then navigating; a partial upload failure keeping the record, showing the failure, and replacing
  the submit button with a "View record" link instead of navigating or allowing resubmission; edit
  mode confirmed to render no file picker at all).
- `business-knowledge-attachments-section.test.tsx`'s existing 10 tests re-run unchanged and still
  pass against the refactored shared-helper implementation.
- typecheck (`tsc --noEmit`), lint (`eslint`), `check-css-tokens.mjs`, `next build`, and
  `pnpm exec prettier --check` all clean.
- Live-rendered in the Browser pane: an unauthenticated visit to `/business-knowledge-center/new`
  correctly redirects to `/auth/sign-in`, zero console/server errors. No local `dashboard-api` was
  available in this environment, so the authenticated create-form file picker's actual rendering
  wasn't visually confirmed — the same limitation the Projects list page's and the Business
  Knowledge Center UI's own as-built records already noted for themselves.

## 7. Deliberately not built

- No drag-and-drop — a plain `<input type="file" multiple>`, matching the detail page's own
  control exactly.
- No upload-progress UI for the staged-file batch (uploads run in parallel with a single
  "Saving…" state on the submit button) — a real per-file progress bar is a bigger UI investment
  disproportionate to this slice's scope; the existing detail-page control has never had one
  either.
- No retry-in-place for a failed staged upload — the user is told to retry from the detail page's
  own upload control, which already exists and is already reviewed/live, rather than building a
  second, parallel retry mechanism on the create form.
