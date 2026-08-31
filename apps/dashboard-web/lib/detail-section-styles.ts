import type { CSSProperties } from "react";

/**
 * Shared `<section>`/heading/definition-list style objects for this app's hand-rolled detail-page
 * "sections as headings, not client-side tabs" layout — extracted after the identical objects were
 * independently copy-pasted into `app/(shell)/projects/[projectId]/page.tsx`,
 * `app/(shell)/business-knowledge-center/[recordId]/page.tsx`, and
 * `app/(shell)/service-library/[serviceId]/page.tsx` before `persona-library/[personaId]/page.tsx`
 * became a 4th independent copy — the same "extract after the identical objects were independently
 * copy-pasted" trigger `lib/list-table-styles.ts`'s own doc comment already documents once for the
 * list-page `<th>`/`<td>` styles. `dlStyle`'s `margin` is the majority value (`0`) shared by three
 * of the four pages; the Projects detail page's own `margin: "0 0 0.75rem"` is a real, small,
 * pre-existing divergence, so its own file still composes a local override from this base rather
 * than losing that value silently.
 */
export const sectionStyle: CSSProperties = {
  marginBottom: "2rem",
};

export const subsectionStyle: CSSProperties = {
  marginBottom: "1rem",
};

export const h2Style: CSSProperties = {
  fontSize: "1.125rem",
  fontWeight: 600,
  marginBottom: "0.75rem",
};

export const h3Style: CSSProperties = {
  fontSize: "0.9375rem",
  fontWeight: 600,
  marginBottom: "0.375rem",
};

export const dlStyle: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fill, minmax(14rem, 1fr))",
  gap: "0.75rem 1.5rem",
  margin: 0,
};

export const mutedStyle: CSSProperties = {
  fontSize: "0.875rem",
  color: "var(--webdesk-dashboard-color-foreground-muted)",
  margin: 0,
};

// No `whiteSpace: pre-wrap` here — this wraps real HTML (already structured with its own <p>/<br>
// tags from the rich-text editor), not plain text needing that treatment. Extracted from a 3rd
// independent copy across Service Library/Business Knowledge Center/Persona Library's own detail
// pages (code-review finding, persona-library-rich-text-editor) — the same duplication pattern
// this module's other exports were already extracted to stop.
export const richContentStyle: CSSProperties = {
  fontSize: "0.9375rem",
  color: "var(--webdesk-dashboard-color-foreground)",
};

// Extracted from a 3rd independent copy across Design Token Library's/Website Strategy Center's
// own detail pages' `VersionEntry` before Component Library's detail page became a 3rd — the same
// duplication pattern this file's other exports were already extracted to stop.
export const versionCardStyle: CSSProperties = {
  border: "1px solid var(--webdesk-dashboard-color-border)",
  borderRadius: "0.5rem",
  padding: "0.75rem 1rem",
  marginBottom: "0.75rem",
};
