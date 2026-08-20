"use client";

import { useRouter } from "next/navigation";
import type { ReactNode } from "react";
import { PAGE_SIZE_OPTIONS, type PageSize } from "@/lib/pagination";

export interface PageSizeSelectProps {
  readonly value: PageSize;
  /** Builds the destination href for a chosen page size — the caller's own `buildXHref(query, {
   *  pageSize })`, which already resets `offset` to 0 for any non-offset override. */
  readonly buildHref: (pageSize: PageSize) => string;
}

/**
 * Shared "records per page" control for every paginated list page (`/projects`,
 * `/business-knowledge-center`). A small client island — same established pattern as
 * `ProjectSwitcher` (a native `<select>` whose `onChange` triggers navigation immediately, no
 * "Apply" button) — rather than folding this into the surrounding filter `<form>`, since a page-size
 * change is expected to apply at once, the same way it does in every other table UI a reader has
 * used before.
 */
export function PageSizeSelect({ value, buildHref }: PageSizeSelectProps): ReactNode {
  const router = useRouter();

  return (
    <label style={{ display: "flex", alignItems: "center", gap: "0.5rem", fontSize: "0.875rem" }}>
      <span style={{ color: "var(--webdesk-dashboard-color-foreground-muted)" }}>Per page</span>
      <select
        aria-label="Records per page"
        value={value}
        onChange={(event) => {
          router.push(buildHref(Number(event.target.value) as PageSize));
        }}
        style={{
          padding: "0.3rem 0.5rem",
          border: "1px solid var(--webdesk-dashboard-color-border)",
          borderRadius: "0.25rem",
          fontSize: "0.875rem",
          background: "var(--webdesk-dashboard-color-surface)",
          color: "var(--webdesk-dashboard-color-foreground)",
        }}
      >
        {PAGE_SIZE_OPTIONS.map((size) => (
          <option key={size} value={size}>
            {size}
          </option>
        ))}
      </select>
    </label>
  );
}
