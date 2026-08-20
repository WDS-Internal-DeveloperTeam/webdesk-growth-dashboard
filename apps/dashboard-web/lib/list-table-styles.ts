import type { CSSProperties } from "react";

/**
 * Shared `<th>`/`<td>` inline-style objects for this app's hand-rolled list-page tables — extracted
 * after the identical objects were independently copy-pasted into `app/(shell)/projects/page.tsx`
 * and `app/(shell)/business-knowledge-center/page.tsx`. A shared `Table`/`DataTable` primitive in
 * `packages/ui` was judged premature when only the Projects list page existed as a single consumer;
 * this second, now-identical consumer is exactly the trigger that reasoning named to revisit — a
 * full component wasn't built here (still a bigger step than a review-fix pass calls for), but the
 * style objects themselves no longer need to drift independently across two files.
 */
export const listTableHeaderCellStyle: CSSProperties = {
  textAlign: "left",
  padding: "0.6rem 0.75rem",
  borderBottom: "1px solid var(--webdesk-dashboard-color-border)",
  fontSize: "0.75rem",
  color: "var(--webdesk-dashboard-color-foreground-subtle)",
  fontWeight: 600,
  textTransform: "uppercase",
  letterSpacing: "0.04em",
};

export const listTableCellStyle: CSSProperties = {
  padding: "0.6rem 0.75rem",
  borderBottom: "1px solid var(--webdesk-dashboard-color-border)",
  verticalAlign: "middle",
};
