# Business Knowledge Center — Rich Content & File Attachments — Task Package

**Status:** Scoped, **not yet authorized to build**. Prepared directly on the explicit "go ahead
with the task package" instruction, following a feasibility question about file uploads
(docx/xlsx/pdf) for Business Knowledge Center records. A separate, explicit "begin this work"
instruction is required before any branch is created or any code is touched, per this project's
standing discipline (matching the Dashboard UI Foundation Alignment task package's own precedent).

## 0. Pre-implementation verification

| Check                                  | Result                                                                                                                                                                                                                                                                                                            |
| -------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Current gate state                     | `G4-dashboard-web-business-knowledge-center` (last approved gate, 2026-08-20)                                                                                                                                                                                                                                     |
| Module already live                    | Backend (PR #43) and `dashboard-web` UI (PR #44) are both merged and live in production — this package extends both, it does not start the module.                                                                                                                                                                |
| Vercel Blob policy exists and applies  | `knowledge/08-vercel-blob-and-file-handling.md` — DOCX, XLSX, PDF, and Markdown are all already **approved formats** (25 MB document ceiling), so no new format-policy exception is needed, only the implementation.                                                                                              |
| Object-storage adapter pattern exists  | `integrations/vercel/02-blob-and-postgres.md` mandates all Blob calls go through a `packages/integrations/vercel` `ObjectStorageAdapter` — confirmed via repo search that **no such adapter, and no Vercel Blob SDK usage, exists anywhere in this codebase today**. This would be the first real implementation. |
| Rich-text/HTML rendering exists        | Confirmed via repo search: **no rich-text editor, markdown renderer, docx/xlsx/pdf parser, or HTML sanitizer exists anywhere in this codebase.** Fully greenfield — no partial work to build on or conflict with.                                                                                                 |
| Related future module                  | `asset_library` is a separate, real, not-yet-built entry in `module_registry` (permission group `creative_design`, a dependency of `case_study_studio` per the roadmap) — the adapter this package builds is deliberately shared infrastructure that module will also need later (see D6).                        |
| No open Critical/High security finding | Confirmed — none recorded in `project.json`.                                                                                                                                                                                                                                                                      |
| Missing credential                     | A real Vercel Blob store and `BLOB_READ_WRITE_TOKEN` do not appear to be provisioned for either Vercel project yet — see §10 item 6.                                                                                                                                                                              |

## 1. Authorization

Not yet given. This document is a proposal, prepared per the explicit "go ahead with the task
package" instruction and the three requirements given alongside it (file-format support with
on-screen preview; an HTML editor with preview for the create form; formatted rendering — not raw
text — on the detail page, including formatted file content). Building it is a separate,
not-yet-requested next step.

## 2. Branch

Not yet created. Would branch off `main` at `f7b0d2d4466db9a401e6157c4ded3cd23cfb1177` (current
`HEAD` — the commit recording PR #44's merge as live in production) once authorized.

## 3. Scope

**In scope:**

- A rich-text HTML editor replacing the plain `<textarea>` for `content` in the create/edit form,
  with inherent live (WYSIWYG) preview — requirement 2.
- File attachment capability on a record: upload DOCX, XLSX, PDF, and Markdown files — all already
  on the org-wide approved-format list (`knowledge/08`) — via direct-to-Blob upload — requirement 1.
- Server-side preview generation per format (DOCX/XLSX/Markdown → sanitized HTML, cached; PDF →
  native embedded rendering, see D4), so both the create form (right after upload) and the detail
  page render the same formatted preview, not a bare filename/download link — requirements 1 and 3.
- The detail page renders `content` as sanitized formatted HTML instead of today's plain-text
  paragraph — requirement 3.
- The project's first real `ObjectStorageAdapter` (`packages/integrations/vercel`), built as
  reusable infrastructure per the profile's own adapter rule, not bespoke to this module.
- A new `business_knowledge_attachments` table, RBAC-aligned with the record's own existing
  confidentiality/redaction rule (no new grant).
- HTML sanitization on both the write path and the read path (a new dependency — see D3).

**Explicitly out of scope:**

- The Asset Library module itself — a separate, distinct, not-yet-authorized module with its own
  registry entry, dependencies, and UI. This package only builds the underlying storage adapter as
  shared infrastructure; it does not build a general asset-management surface.
- Malware scanning — deferred project-wide per `knowledge/08`. Every accepted attachment shows the
  honest interim status (`Uploaded` / `Scan Not Configured` / etc.); the dashboard must never claim
  a file is malware-free.
- Wiring the new adapter into any other business module.
- In-app editing of an uploaded file's own content (e.g. editing a DOCX's text inline) — re-upload
  replaces an attachment, it isn't a word processor.
- Any change to who can see confidential content — reuses the existing `restricted` /
  `view_confidential` mechanism exactly as it exists today.
- Image/video formats (JPEG/PNG/WebP/GIF/MP4) — allowed by the org-wide Blob policy but not part of
  what was asked for here; only DOCX/XLSX/PDF/Markdown.

## 4. Design decisions

**D1 — Content model: typed content and file attachments coexist, not either/or.**
A record keeps its existing `content` field (now rich HTML from the editor) **and** may additionally
carry zero or more file attachments. This is the more flexible reading of "user can add the content
or they can upload the file" — it supports mixing (a short written summary plus an attached
spreadsheet) rather than forcing a choice. A stricter either/or model is a real, simpler
alternative — flagged for confirmation in §10.

**D2 — Rich-text editor: Tiptap.**
No editor exists in this codebase today. **Tiptap** (ProseMirror-based, first-class React
19/Next.js support, MIT-licensed, actively maintained, produces clean semantic HTML) is the
concrete recommendation. Because it's a WYSIWYG editor, "preview" (requirement 2) is inherent to
typing — there's no separate preview pane needed for typed content, only for uploaded files.
Output is HTML, stored in the existing `content` `TEXT` column (already correctly typed).

**D3 — Sanitization is mandatory on both write and read — the most consequential decision here.**
Every other page in this project renders user-influenced data as plain JSX text, auto-escaped by
React, specifically because this project's own prior security reviews have repeatedly treated
`dangerouslySetInnerHTML` as the one thing to avoid — see the Project Detail page's own confirmed
HIGH stored-XSS finding on an unrestricted URL scheme, fixed by building `isSafeHttpUrl()`
(`lib/safe-http-url.ts`). Storing and rendering arbitrary HTML is a genuinely new attack surface
this project has never carried before. Mitigation: sanitize server-side at write time against a
strict allowlist (headings, bold/italic/underline, lists, blockquote, table, and `<a href>` gated
through the same `isSafeHttpUrl()` scheme guard already built for exactly this bug class — no
`<script>`, no `on*` attributes, no `style`, no `javascript:`/`data:` URLs), using a well-vetted
library (e.g. `sanitize-html`), and sanitize again at render time as defense-in-depth before any
`dangerouslySetInnerHTML` call. **This needs its own dedicated, high-effort security review before
merge, called out separately from the general code-review pass** — not folded in as one finding
among many.

**D4 — Preview strategy differs by format; PDF is embedded, not extracted.**

- Markdown → parsed to HTML server-side, sanitized identically to typed content.
- DOCX → converted to HTML server-side (e.g. `mammoth`), sanitized identically.
- XLSX → converted to an HTML table server-side (e.g. `xlsx`/SheetJS), first sheet by default.
- PDF → rendered as the real file via a signed, time-limited Blob download URL in an
  `<embed>`/`<iframe>` (the browser's native PDF viewer) — **not** parsed into HTML. Real PDF→HTML
  text extraction is lossy (loses layout, unreliable across authoring tools); embedding the actual
  file is both more honest and materially less work. "Formatted" could reasonably mean either —
  flagged for confirmation in §10.
- Generated previews (DOCX/XLSX/Markdown) are computed once at upload-confirmation time and cached
  on the attachment row, not regenerated on every page view.

**D5 — One shared preview component, not two.**
The same rendering component serves both the create/edit form (showing what was just uploaded) and
the detail page (showing the stored record), matching this project's own established
shared-component precedent (`Fact`, `formatTimestamp`, `list-table-styles.ts`).

**D6 — Object-storage adapter, not ad hoc Blob calls.**
Per `knowledge/08`'s explicit rule, all Blob calls go through a new
`packages/integrations/vercel` `ObjectStorageAdapter`
(`getUploadAuthorization`/`confirmUpload`/`getSignedDownloadUrl`/`delete`) — this project's first
real implementation of that interface, deliberately built as shared infrastructure since the
separate, future Asset Library module will need the identical mechanism.

**D7 — Upload path: direct-to-Blob, not proxied through a Function.**
Per the same knowledge doc, files use the client-upload-token direct-to-Blob mechanism rather than
routing the full file body through `dashboard-api` — the approved 25 MB document ceiling would sit
uncomfortably close to a Vercel Function's request-body limit.

**D8 — Redaction extends to attachments.**
A `restricted` record's attachments (signed URLs and cached preview HTML alike) are omitted from
the API response under the exact same `canViewConfidential()` check that already redacts
`content`/`notes` today — mirroring the existing `redactIfRestricted()` pattern in
`business-knowledge-records.controller.ts`, not a new mechanism.

**D9 — No malware-free claim anywhere.**
Per `knowledge/08`'s honesty rule, every accepted attachment surfaces one of the defined interim
statuses (`Uploaded` / `Validation Passed` / `Scan Not Configured` / etc.) somewhere in the UI.

## 5. Data model

- **Alter** `business_knowledge_records.content`: `allowNull: false` → `true` (a record may now
  carry only attachments, no typed content) — the actual "must have content or an attachment"
  invariant is enforced at the application layer (Zod), matching this project's existing pattern of
  splitting real invariants between a DB constraint and app-layer validation.
- **New table** `business_knowledge_attachments`: `id` (UUID PK), `record_id` (FK →
  `business_knowledge_records`, cascade delete), `filename`, `mime_type`, `size_bytes`,
  `checksum_sha256`, `blob_pathname` (the asset's Blob key, never a raw public URL),
  `extracted_preview_html` (`TEXT`, nullable), `scan_status` (ENUM, per the interim vocabulary in
  `knowledge/08`), `uploaded_by` (FK → `users`, nullable), `created_at`.
- Indexes: `(record_id)`; `(scan_status)` if useful operationally later.

## 6. Permissions

No new RBAC grant. Attachment create/view/delete reuse the record's own existing
`business_knowledge` permission-group actions (`create`/`edit`/`view`) exactly as they already gate
`content` today — no separate "attachment" action. Confidential redaction reuses the existing
`view_confidential` check (D8).

## 7. API surface (indicative — finalized during implementation)

- `POST /business-knowledge/records/:id/attachments/upload-authorization` — issues a short-lived
  direct-to-Blob upload token (gated on `edit`).
- `POST /business-knowledge/records/:id/attachments/:attachmentId/confirm` — verifies checksum,
  runs format/size/MIME validation, generates and caches the format-appropriate preview, sets the
  interim scan status.
- `GET /business-knowledge/records/:id` — response gains an `attachments[]` array (redacted per D8).
- `DELETE /business-knowledge/records/:id/attachments/:attachmentId` — gated on `edit`.
- `content` in the `create`/`update` request and response bodies becomes sanitized HTML instead of
  plain text — a real contract change; `packages/shared-types` and the Zod schemas both need
  updating.

## 8. Testing

- Unit: the sanitizer's allowlist (script/`on*`/`javascript:`/`data:` all stripped, safe tags/attrs
  preserved), each format's preview generator, the adapter's mocked interface (this project's
  standard "mock behind the adapter" convention), the content-or-attachment app-layer validation.
- Integration (real disposable database): the attachment table's FK/cascade-delete behavior,
  redaction of attachments on a `restricted` record for a caller without `view_confidential`.
- e2e: upload-authorization → confirm → preview-generation round trip against a real, small fixture
  file per format (DOCX/XLSX/MD/PDF); 403 paths for a viewer without `edit`.
- Playwright: the new editor renders and accepts input with zero new axe-core WCAG violations; an
  attachment preview renders with no console error.
- A dedicated, high-effort **security review scoped specifically to the sanitization boundary**
  (D3) — called out separately from the general code-review pass, since this is the project's first
  HTML-storage/rendering surface.

## 9. Documentation deliverables

`docs/implementation/business-knowledge-center-rich-content-attachments.md` (as-built record,
matching every prior slice's pattern) — written once the work is actually built.

## 10. Open items requiring a decision before implementation begins

1. **D1** — content and attachments coexisting on one record, vs. strictly either/or. _Recommend:
   coexist._
2. **D2** — Tiptap as the editor library (a new, real dependency with its own footprint).
   _Recommend: yes._
3. **D4** — PDF previewed via native embed (visually exact, no extraction) rather than converted to
   HTML text (lossy, unreliable). _Recommend: embed._
4. **Attachment count** — one attachment per record, or many (1-to-many). _Recommend: many — no
   harder to build correctly the first time, and more flexible._
5. **Existing records' plain-text `content`** — no bulk backfill is proposed; legacy plain text
   renders as-is inside the new formatted container (newlines aside), and gains full rich-text
   formatting the next time it's opened in the new editor and saved. Confirm this is acceptable, or
   say if a backfill pass is wanted.
6. **Credential/environment gap** — a real Vercel Blob store and `BLOB_READ_WRITE_TOKEN` do not
   appear to exist yet for either Vercel project. Provisioning that is the same "you provision, I
   never touch the real credential" pattern as `DATABASE_URL` — needed before this can go live even
   after the code itself is merged.

---

This is a task package only — no branch, no code, no dependency has been added. Building it
requires a separate, explicit "begin this work" instruction.
