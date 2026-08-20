import { sanitizeRichTextHtml } from "@webdesk/validation";

/**
 * The render-time half of the sanitization boundary
 * (`business-knowledge-center-rich-content-attachments.md` D3) — defense-in-depth alongside
 * `dashboard-api`'s own write-time sanitization (`sanitize-html.util.ts`), applied here again
 * right before a Server Component renders record content or an attachment preview via
 * `dangerouslySetInnerHTML`. The allowlist itself now lives in `@webdesk/validation`'s
 * `sanitizeRichTextHtml()`, shared with `dashboard-api` rather than independently hand-maintained
 * (previously "kept in sync by hand" — a real duplication finding, the exact shape already fixed
 * once for `safeHttpUrlSchema`).
 *
 * Node-only (this package runs server-side); never import this from a `"use client"` file.
 */
export function sanitizeRenderedHtml(html: string): string {
  return sanitizeRichTextHtml(html);
}
