/**
 * Conversion between a `datetime-local` HTML input's local-time value and a real ISO 8601 UTC
 * instant string. Extracted after `case-study-studio-form.tsx` and `case-study-consents-section.tsx`
 * independently declared byte-identical copies of both functions in the same PR (code-review
 * finding, `module-case-study-studio`'s own `dashboard-web` UI branch) — matching this codebase's
 * established "extract after the 2nd occurrence" convention (`richTextFieldValue()`,
 * `arrayFieldValue()`, `useSyncedState()`, `resolveIdsToNames()` were all extracted for the same
 * reason).
 */

/** A `datetime-local` input works in the viewer's own local time and has no seconds/timezone —
 *  converts a stored ISO 8601 UTC instant to the local `YYYY-MM-DDTHH:mm` shape that input needs,
 *  or `""` for `null`/an unparseable value. */
export function toDateTimeLocalValue(iso: string | null): string {
  if (!iso) return "";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  const pad = (n: number): string => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

/** The inverse of `toDateTimeLocalValue()` — converts a `datetime-local` input's local-time value
 *  back to a real ISO 8601 UTC instant string. `null` for an empty or unparseable value. */
export function fromDateTimeLocalValue(value: string): string | null {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}
