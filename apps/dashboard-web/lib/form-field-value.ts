/**
 * The plain-text sibling of `richTextFieldValue()` (`lib/rich-text.ts`) — the identical
 * trim-then-nullish-by-mode contract for a plain `<input>`/`<textarea>` field, not deliberately
 * kept next to the rich-text version since this file has none of that module's rich-text-specific
 * scope. Extracted after this exact function had been independently hand-copied into
 * `service-library-form.tsx`, `persona-library-form.tsx` (as `textField`), `proof-and-claims-library-form.tsx`
 * (as `textField`), and `page-form.tsx` (code-review finding, `dashboard-web-page-inventory`) — a
 * 4th occurrence, past the 2-copy threshold that already triggered extraction for the rich-text
 * variant. Only `page-form.tsx` was switched to import this on introduction; the 3 pre-existing
 * copies in already-shipped forms are left untouched, matching this project's own scoping
 * discipline (fix duplication introduced by the branch under review, not retroactively edit
 * merged code from prior modules).
 */
export function plainTextFieldValue(
  value: string,
  mode: "create" | "edit",
): string | null | undefined {
  const trimmed = value.trim();
  if (trimmed !== "") return trimmed;
  return mode === "create" ? undefined : null;
}
