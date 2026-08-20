/**
 * Shared helper for reading Next.js `searchParams` (`Record<string, string | string[] | undefined>`)
 * — a duplicated param takes the first value, matching how a browser's own `URLSearchParams.get()`
 * behaves. Extracted after the identical function had been independently copy-pasted into
 * `lib/projects-query.ts` and `lib/business-knowledge-query.ts`; both now import from here. Zero
 * non-type imports, so `"use client"` components can import it directly.
 */
export function firstValue(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}
