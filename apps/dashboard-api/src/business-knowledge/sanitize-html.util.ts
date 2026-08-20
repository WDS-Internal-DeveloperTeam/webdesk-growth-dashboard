import { sanitizeRichTextHtml } from "@webdesk/validation";

/**
 * The write-time half of the task package's D3 sanitization boundary — the single most
 * consequential decision in `business-knowledge-center-rich-content-attachments.md`. Storing and
 * rendering arbitrary HTML (the Tiptap editor's own output, plus DOCX/XLSX/Markdown converted to
 * HTML server-side) is a genuinely new attack surface this project has never carried before —
 * every other page relies on React's automatic escaping specifically because
 * `dangerouslySetInnerHTML` was flagged as the thing to avoid in this project's own prior security
 * reviews (see the Project Detail page's confirmed HIGH stored-XSS finding on an unrestricted URL
 * scheme, `lib/safe-http-url.ts`). Applied here (write time, before the record ever reaches the
 * database) and again in `dashboard-web` right before render (defense-in-depth) — see that side's
 * own `lib/sanitize-html.ts`. The actual allowlist now lives in `@webdesk/validation`'s
 * `sanitizeRichTextHtml()`, shared by both apps rather than independently hand-maintained (a
 * previously-real duplication finding — the exact shape already fixed once for
 * `safeHttpUrlSchema`).
 */

/** Sanitizes rich-text HTML (the `content` field — typed via the editor, or a Markdown attachment
 *  converted to HTML) against the shared allowlist. */
export function sanitizeRecordContentHtml(html: string): string {
  return sanitizeRichTextHtml(html);
}

/** Sanitizes a generated file preview (DOCX/XLSX/Markdown converted to HTML) before it's cached on
 *  the attachment row — same shared allowlist, named separately since the two call sites have
 *  genuinely different inputs (user-typed vs. file-derived) even though the policy is identical
 *  today. */
export function sanitizeAttachmentPreviewHtml(html: string): string {
  return sanitizeRichTextHtml(html);
}
