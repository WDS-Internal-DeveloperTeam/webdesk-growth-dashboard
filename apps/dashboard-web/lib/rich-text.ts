/**
 * Shared conventions for every `RichTextEditor` (Tiptap) consumer in this app — previously
 * hand-duplicated per form (code-review finding, `rich-text-editor-long-fields` branch: the
 * `"<p></p>"` empty-document literal was copy-pasted into `service-library-form.tsx`, and
 * `project-form.tsx` had no equivalent check at all, which is exactly how that duplication let a
 * real bug through).
 *
 * Zero non-type imports — safe to import from both a `"use client"` form component and a server
 * component (`sanitized-rich-text.tsx`).
 */

/** Tiptap's own serialization for an editor with nothing typed into it. */
export const EMPTY_RICH_TEXT_HTML = "<p></p>";

/** True for both a genuinely blank string and Tiptap's own empty-document output — the two forms
 *  "nothing was entered" can take in a `RichTextEditor` field. */
export function isEmptyRichTextHtml(value: string): boolean {
  const trimmed = value.trim();
  return trimmed === "" || trimmed === EMPTY_RICH_TEXT_HTML;
}

// A value that already starts with one of the block/inline tags `@webdesk/validation`'s
// `sanitizeRichTextHtml()` allowlist accepts — i.e. real output from this app's own
// `RichTextEditor` (or already-sanitized HTML loaded back from the API), not plain text that
// happens to be stored in the same string field.
const LOOKS_LIKE_RICH_TEXT_HTML =
  /^\s*<(p|h[1-6]|ul|ol|li|blockquote|pre|table|a|strong|b|em|i|u|s|strike|code|br|hr)[\s/>]/i;

function escapeHtml(text: string): string {
  return (
    text
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      // A plain-text value's newlines carry real line-structure the old <textarea>'s `pre-wrap`
      // rendering preserved visually. A bare escaped string wrapped in one <p> has no equivalent —
      // code-review finding (persona-library-rich-text-editor): a legacy multi-line value silently
      // collapsed onto one run-on line once this <p>-wrap replaced the old pre-wrap rendering.
      // Converting to <br> here keeps that structure through both the editor and the sanitized
      // render path (<br> is on sanitizeRichTextHtml's own allowlist).
      .replace(/\n/g, "<br>")
  );
}

/**
 * A field switched to `RichTextEditor` from a plain `<textarea>` can still hold real,
 * unsanitized plain text saved before the switch (code-review finding: Projects' own
 * `description` held plain text, live in production, for roughly 4 days before this branch —
 * Service Library's 7 fields have no such history, since that module was built rich-text-only
 * from day one). Loading that plain text straight into Tiptap (which parses its `content` prop as
 * HTML) or straight into `dangerouslySetInnerHTML` risks silently corrupting or altering it — a
 * literal `<b>` in old plain text would suddenly render as real bold, or a disallowed tag would be
 * silently stripped by the sanitizer.
 *
 * Detects that case (the value doesn't start with a recognized rich-text tag) and escapes + wraps
 * it as a single paragraph, so it keeps displaying and editing exactly as it always did (including
 * any embedded newlines, converted to `<br>`). A no-op for any value this app's own sanitizer has
 * ever produced, since that output always starts with a real tag.
 */
export function toSafeRichTextValue(value: string): string {
  if (value === "" || LOOKS_LIKE_RICH_TEXT_HTML.test(value)) {
    return value;
  }
  return `<p>${escapeHtml(value)}</p>`;
}

/**
 * Shared nullish-contract logic behind every form's local `richTextField()` wrapper (code-review
 * finding: hand-duplicated verbatim between `service-library-form.tsx` and
 * `persona-library-form.tsx`). An omitted key leaves an existing value unchanged on update
 * (matching each module's own `update*Schema`'s nullish contract); an explicit `null` is what
 * actually clears a value back to "none". `isEmptyRichTextHtml()` treats a `RichTextEditor`
 * field's own "nothing typed" output (`"<p></p>"`) as empty, not just a genuinely blank string.
 */
export function richTextFieldValue(
  value: string,
  mode: "create" | "edit",
): string | null | undefined {
  const trimmed = value.trim();
  if (!isEmptyRichTextHtml(trimmed)) return trimmed;
  return mode === "create" ? undefined : null;
}

/**
 * A `RichTextEditor` field is a contentEditable div, not a real form control — it has no native
 * `maxLength` attribute, so every form using it needs to check the limit by hand at submit time.
 * That check (and its message) was previously duplicated per form (code-review finding, reuse).
 * Checks each `[label, value]` pair against `maxLength` in order and returns the first offending
 * field's message, or `null` if none exceed it.
 */
export function findOverLongRichTextField(
  fields: ReadonlyArray<readonly [label: string, value: string]>,
  maxLength: number,
): string | null {
  for (const [label, value] of fields) {
    if (value.length > maxLength) {
      return `${label} is too long (max ${maxLength.toLocaleString()} characters).`;
    }
  }
  return null;
}
