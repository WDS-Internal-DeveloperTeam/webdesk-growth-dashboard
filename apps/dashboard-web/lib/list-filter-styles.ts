import type { CSSProperties } from "react";

/**
 * Shared `<select>`/`<input>`/submit-button style objects for this app's hand-rolled list-page
 * filter forms — extracted after the identical objects were independently copy-pasted into
 * `app/(shell)/business-knowledge-center/page.tsx` and `app/(shell)/service-library/page.tsx`
 * before `app/(shell)/persona-library/page.tsx` became a 3rd independent copy, in the same files
 * that already import `listTableCellStyle`/`listTableHeaderCellStyle` from
 * `lib/list-table-styles.ts` and `primaryActionLinkStyle` from `lib/action-link-style.ts` right
 * next to these — the shared-style-extraction pattern was already established, just not applied
 * consistently to these two.
 */
export const filterSelectStyle: CSSProperties = {
  padding: "0.4rem 0.6rem",
  border: "1px solid var(--webdesk-dashboard-color-border)",
  borderRadius: "0.25rem",
  fontSize: "0.875rem",
  minWidth: "12rem",
};

export const filterSubmitButtonStyle: CSSProperties = {
  alignSelf: "flex-end",
  padding: "0.4rem 0.9rem",
  border: "1px solid var(--webdesk-dashboard-color-border)",
  borderRadius: "0.25rem",
  background: "var(--webdesk-dashboard-color-surface)",
  fontSize: "0.875rem",
  cursor: "pointer",
};
