# Business Knowledge Center — Rich Content & File Attachments — Approval Checklist

**Status:** Built and fully validated. Not yet code-reviewed, security-reviewed, second-role
human reviewed, gated, or merged.

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
| 8   | Exact branch/commit verified and recorded  | Branch `business-knowledge-center-rich-content-attachments`, off `main` at `31001fa`                                                                                                                                                 |

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

Not yet run.

## Independent security review

Not yet run. Given this branch is this project's first HTML-storage/rendering surface, the
review should treat the sanitization boundary (`sanitize-html.util.ts` / `lib/sanitize-html.ts`)
as its own explicit focus area, not one finding among many general ones.

## Required second-role human review

Not yet requested.

## Sign-off

Not yet requested.

## Merge

Not yet requested.
