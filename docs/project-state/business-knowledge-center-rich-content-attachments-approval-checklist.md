# Business Knowledge Center — Rich Content & File Attachments — Approval Checklist

**Status:** Built, fully validated, independently code-reviewed (8 of 9 findings fixed, 1
accepted as tracked debt — see `docs/implementation/business-knowledge-center-rich-content-attachments.md`
§7), security-reviewed (0 findings above threshold), required second-role human reviewed
(Jitesh D, "Approved as-is"), and gated (G4-bkc-rich-content-attachments, WebDesk Solution,
CONFIRM). Not yet merged.

## Completion condition

| #   | Item                                       | Status                                                                                                                                                                                                                               |
| --- | ------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| 1   | Closes the requested feature               | ✅ DOCX/XLSX/PDF/Markdown attachments with formatted preview on both the create form (via the rich-text editor's inherent WYSIWYG) and the detail page; plus the explicitly bundled pagination/page-size and clear-filters-bug fixes |
| 2   | Real, verified Vercel Blob integration     | ✅ `BlobStorageAdapter`'s shape was revised to match Vercel's actual documented mechanics, verified directly against current docs before implementation — not guessed                                                                |
| 3   | Required tests pass                        | ✅ 149/149 `packages/database` integration + 28/28 unit, 8/8 `packages/integrations` unit, 427/427 `dashboard-api` unit + 132/132 e2e, 258/258 `dashboard-web` unit, 15/15 Playwright                                                |
| 4   | Full validation clean                      | ✅ typecheck/lint/`check-css-tokens.mjs`/`next build`/`nest build`/prettier all clean across every touched package; `pnpm audit` 0 vulnerabilities                                                                                   |
| 5   | Sanitization boundary explicitly addressed | ✅ Write-time (`dashboard-api`) and render-time (`dashboard-web`) sanitization both implemented and tested — flagged as needing a dedicated, high-effort security review pass, not folded into the general review                    |
| 6   | Known, deliberate scope decisions flagged  | ✅ Recorded in `docs/implementation/business-knowledge-center-rich-content-attachments.md` §6 — upload location, PDF-as-embed, the no-op webhook, the one same-session sanitization gap                                              |
| 7   | Documentation updated                      | ✅ `docs/implementation/business-knowledge-center-rich-content-attachments.md`                                                                                                                                                       |
| 8   | Exact branch/commit verified and recorded  | Branch `business-knowledge-center-rich-content-attachments`, off `main` at `31001fa`, [PR #45](https://github.com/WDS-Internal-DeveloperTeam/webdesk-growth-dashboard/pull/45)                                                       |

## Forbidden-actions check

- No malware-free claim anywhere — every accepted attachment carries the honest
  `scan_not_configured` interim status (`knowledge/08`'s honesty rule).
- No public Blob URL ever reaches the client — every read goes through the cookie-authenticated
  content-proxy route; `blobPathname` is stripped from every API response.
- No RBAC grant added — attachment actions reuse the record's own existing `view`/`edit` actions
  exactly.
- A `restricted` record's attachments are redacted using the exact same `view_confidential`
  mechanism already protecting its `content`/`notes` — no new or weaker mechanism.
- Every attachment read/write is scoped to its own `recordId` — a real IDOR guard, e2e-tested
  directly (an attachment cannot be fetched or deleted through a different record's route).

## Independent code review

Run at high effort (8 finder angles, 1-vote verification). 9 candidates survived dedup and
verification (7 CONFIRMED, 2 PLAUSIBLE). Most severe: the file-attachment upload flow pointed
`@vercel/blob/client`'s `handleUploadUrl` directly at `dashboard-api`, a genuinely cross-origin
request the session cookie could never reach (no `credentials` option on the Blob SDK, and
browsers forbid scripts from setting `Cookie` manually) — every real upload would have 401'd in
production. Fixed with a new same-origin `dashboard-web` proxy Route Handler. 8 of 9 findings
fixed in total (also: an edit-mode content-clearing bug that stored `'<p></p>'` instead of
`null`; a missing try/catch in `confirm()` that orphaned the Blob object on a corrupt-file crash;
a silent editor/state desync on the length-limit guard; a sequential-fetch efficiency gap; a
redundant `router.refresh()`; a duplicated sanitization allowlist now promoted to
`packages/validation`; and a real reverse-tabnabbing gap closed via the same promotion). 1
CONFIRMED finding (no cleanup mechanism for a Blob object orphaned by an interrupted upload)
left as accepted, tracked debt — a real fix means a cron/reconciliation job, out of proportion
for a review-fix pass. See `docs/implementation/business-knowledge-center-rich-content-attachments.md`
§7 for the full account.

## Independent security review

Run against reviewed commit `359e9a9`, with the sanitization boundary
(`sanitize-html.util.ts` / `lib/sanitize-html.ts`, now the shared `packages/validation`
`sanitizeRichTextHtml()`) treated as its own explicit focus area, per this project's first
HTML-storage/rendering surface. **0 findings above the confidence threshold (≥ 8/10).**
Confirmed: correct IDOR scoping on every attachment read/write; correct `restricted`-record
redaction (list/content both gated on `view_confidential`); the new same-origin upload proxy
route is not an open proxy or SSRF vector; the sanitizer allowlist and `transformTags` rel
enforcement hold; `markdown-it` runs with `html: false` and XLSX cell text is HTML-escaped before
table assembly; Blob pathnames are prefix-checked identically at token-mint and confirm time with
the real storage key stripped from every response; the content-proxy route's `Content-Type` is
always one of 4 fixed values and its filename is `encodeURIComponent`-escaped. One sub-threshold
observation recorded, not raised as a finding: a doc comment in
`business-knowledge-attachments-section.tsx` claims a render-time sanitization pass that
`getBusinessKnowledgeAttachments()` doesn't actually call — not independently exploitable, since
`extractedPreviewHtml` has exactly one write path and it's already sanitized before persisting;
worth a doc-comment correction, not a security fix.

## Required second-role human review

A review packet (published as a Claude artifact — code review findings/fixes, the security
review, validation evidence, and a decision section) was prepared for the required second-role
human review, since the implementing agent cannot also be its own reviewer (ADR-0010).
**Jitesh D reviewed it and returned "Approved as-is,"** accepting the one open CONFIRMED
code-review finding (no cleanup mechanism for a Blob object orphaned by an interrupted upload) as
tracked debt rather than requesting a fix before merge.

## Sign-off

**Jitesh D — Approved as-is.** No disputes raised. A gate decision and merge authorization
remain separate, not-yet-requested next steps, per this project's standing "no auto-merge" rule.

## Gate

**The gate (G4-bkc-rich-content-attachments) was separately requested and approved** — WebDesk
Solution, decision **CONFIRM** (a clean pass, not an override, since the required second-role
human review was already complete before the gate was requested), approved commit `359e9a9` on
branch `business-knowledge-center-rich-content-attachments` — see
`outputs/webdesk-growth-dashboard/project.json`'s `gates[]` (`current_gate` now
`G4-bkc-rich-content-attachments`) and `audit_log`. **This gate approval does not itself
authorize merging PR #45 or a production deployment** — merge remains its own separate,
not-yet-requested authorization, per this project's standing "no auto-merge" rule.

## Merge

Not yet requested.
