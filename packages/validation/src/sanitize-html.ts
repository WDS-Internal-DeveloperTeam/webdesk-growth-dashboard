import sanitizeHtml from "sanitize-html";

/**
 * Shared HTML sanitization allowlist for the Business Knowledge Center's rich-text content
 * (`business-knowledge-center-rich-content-attachments.md` D3) — consumed identically by
 * `dashboard-api`'s write-time pass (before a record is ever stored) and `dashboard-web`'s
 * render-time pass (defense-in-depth, right before `dangerouslySetInnerHTML`). Previously declared
 * independently in both apps (byte-identical `ALLOWED_TAGS`/`allowedAttributes`, "kept in sync by
 * hand"), the exact duplication shape this project already found and fixed once for
 * `safeHttpUrlSchema` below (`module-projects-backend-closeout` — moved a locally-duplicated
 * schema into this package specifically so both sides validate against the same definition).
 *
 * Allowlist matches what Tiptap's `starter-kit` actually emits (headings, bold/italic/underline/
 * strike, lists, blockquote, code/pre, horizontal rule, hard break) plus a table shape for the
 * XLSX preview and `<a href>` for both the editor's link mark and Markdown-source links —
 * `allowedSchemes` restricts every `href` to `http`/`https`, closing the same
 * `javascript:`/`data:` class of bug `safeHttpUrlSchema` already closes for plain URL fields. No
 * `style` attribute, no `class` (nothing here needs bespoke styling), no `id` (would let uploaded/
 * typed content collide with real page anchors).
 *
 * A `target` attribute survives on `<a>` (Tiptap's own Link extension sets `target="_blank"` by
 * default via its toolbar UI, with a safe `rel` alongside it) — but a raw HTML paste can carry a
 * `target="_blank"` with no safe `rel`, a reverse-tabnabbing vector (the new tab gets a live
 * `window.opener` back to this authenticated app). `transformTags` forces a safe `rel` onto any
 * `<a>` that carries a `target`, regardless of what `rel` (if any) the source HTML supplied —
 * closing that gap at the sanitizer itself rather than trusting every producer of `target` to also
 * produce a correct `rel`.
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

const SAFE_TARGETED_LINK_REL = "noopener noreferrer nofollow";

const RICH_TEXT_HTML_SANITIZE_OPTIONS: sanitizeHtml.IOptions = {
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
  transformTags: {
    a: (tagName, attribs) => {
      if (attribs.target) {
        return { tagName, attribs: { ...attribs, rel: SAFE_TARGETED_LINK_REL } };
      }
      return { tagName, attribs };
    },
  },
};

/** Sanitizes rich-text HTML (record content, notes, or a generated file-attachment preview)
 *  against the shared allowlist above. Both `dashboard-api` and `dashboard-web` call this same
 *  function directly rather than re-declaring the allowlist — see the module doc comment. */
export function sanitizeRichTextHtml(html: string): string {
  return sanitizeHtml(html, RICH_TEXT_HTML_SANITIZE_OPTIONS);
}

/**
 * Sanitizes a rich-text field's incoming value before it's ever written, preserving its
 * three-way nullish contract (`undefined` = not provided/leave unchanged, `null` = explicitly
 * cleared, a string = real HTML to sanitize) — `null`/`undefined` pass through unchanged.
 * Previously declared independently, byte-for-byte identical, in multiple `dashboard-api`
 * services (`business-knowledge-records.service.ts`'s own `sanitizeContentOrNull`, then
 * `project.service.ts`/`services.service.ts` each re-declaring the same wrapper — code-review
 * finding, `rich-text-editor-long-fields` branch) — the same duplication shape `safeHttpUrlSchema`
 * and `sanitizeRichTextHtml` were each promoted here to close.
 */
export function sanitizeNullableRichText(
  value: string | null | undefined,
): string | null | undefined {
  return typeof value === "string" ? sanitizeRichTextHtml(value) : value;
}

/**
 * Same contract as `sanitizeNullableRichText()`, but skips the real HTML parse entirely when the
 * incoming value is identical to what's already stored — the common case for any form that
 * resends full record state on every save. `ProjectService.update()`/`ServicesService.update()`
 * previously re-sanitized every rich-text field on every save regardless of whether it changed
 * (code-review finding, efficiency).
 */
export function sanitizeNullableRichTextIfChanged(
  value: string | null | undefined,
  current: string | null,
): string | null | undefined {
  if (typeof value === "string" && value === current) {
    return value;
  }
  return sanitizeNullableRichText(value);
}
