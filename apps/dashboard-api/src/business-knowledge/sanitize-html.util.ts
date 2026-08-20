import sanitizeHtml from "sanitize-html";

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
 * own `lib/sanitize-html.ts`.
 *
 * Allowlist matches what Tiptap's `starter-kit` actually emits (headings, bold/italic/underline/
 * strike, lists, blockquote, code/pre, horizontal rule, hard break) plus a table shape for the
 * XLSX preview and `<a href>` for both the editor's link mark and Markdown-source links —
 * `allowedSchemes` restricts every `href` to `http`/`https`, closing the exact
 * `javascript:`/`data:` class of bug the Project Detail page fix already exists for. No `style`
 * attribute, no `class` (nothing here needs bespoke styling — the renderer applies its own), no
 * `id` (would let uploaded/typed content collide with real page anchors).
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

const SANITIZE_OPTIONS: sanitizeHtml.IOptions = {
  allowedTags: ALLOWED_TAGS,
  allowedAttributes: {
    a: ["href", "rel", "target"],
  },
  allowedSchemes: ["http", "https"],
  // A relative/scheme-less href (e.g. from a pasted fragment) is not a real navigation target in
  // this context and is more plausibly a mistake or a probe than a legitimate link — dropped
  // rather than resolved against some assumed base.
  allowProtocolRelative: false,
  disallowedTagsMode: "discard",
};

/** Sanitizes rich-text HTML (the `content` field — typed via the editor, or a Markdown attachment
 *  converted to HTML) against the shared allowlist above. */
export function sanitizeRecordContentHtml(html: string): string {
  return sanitizeHtml(html, SANITIZE_OPTIONS);
}

/** Sanitizes a generated file preview (DOCX/XLSX/Markdown converted to HTML) before it's cached on
 *  the attachment row — same allowlist, named separately since the two call sites have genuinely
 *  different inputs (user-typed vs. file-derived) even though the policy is identical today. */
export function sanitizeAttachmentPreviewHtml(html: string): string {
  return sanitizeHtml(html, SANITIZE_OPTIONS);
}
