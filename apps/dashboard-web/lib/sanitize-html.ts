import sanitizeHtml from "sanitize-html";

/**
 * The render-time half of the sanitization boundary
 * (`business-knowledge-center-rich-content-attachments.md` D3) — defense-in-depth alongside
 * `dashboard-api`'s own write-time sanitization (`sanitize-html.util.ts`), applied here again
 * right before a Server Component renders record content or an attachment preview via
 * `dangerouslySetInnerHTML`. Identical allowlist to the backend's — kept in sync by hand, same
 * approach every other backend-DTO-mirroring file in this app already uses.
 *
 * Node-only (this package runs server-side); never import this from a `"use client"` file.
 */
const ALLOWED_TAGS = [
  "p",
  "br",
  "hr",
  "h1",
  "h2",
  "h3",
  "h4",
  "h5",
  "h6",
  "strong",
  "b",
  "em",
  "i",
  "u",
  "s",
  "strike",
  "code",
  "pre",
  "blockquote",
  "ul",
  "ol",
  "li",
  "a",
  "table",
  "thead",
  "tbody",
  "tr",
  "th",
  "td",
];

export function sanitizeRenderedHtml(html: string): string {
  return sanitizeHtml(html, {
    allowedTags: ALLOWED_TAGS,
    allowedAttributes: { a: ["href", "rel", "target"] },
    allowedSchemes: ["http", "https"],
    allowProtocolRelative: false,
    disallowedTagsMode: "discard",
  });
}
