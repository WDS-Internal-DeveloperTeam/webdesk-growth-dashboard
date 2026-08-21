"use client";

import { useRouter } from "next/navigation";
import type { ReactNode } from "react";
import { PAGE_SIZE_OPTIONS, type PageSize } from "@/lib/pagination";

export interface PageSizeSelectProps {
  readonly value: PageSize;
  /** The destination href for each selectable page size, precomputed by the caller (its own
   *  `buildXHref(query, { pageSize })` per option, which already resets `offset` to 0 for any
   *  non-offset override) — a plain, JSON-serializable object, not a function. A Server Component
   *  page can't pass a closure as a prop to this Client Component (React Server Components
   *  rejects that at render time: "Functions cannot be passed directly to Client Components"),
   *  so the caller computes every option's href up front instead of handing this component a way
   *  to compute one itself. */
  readonly hrefBySize: Readonly<Record<PageSize, string>>;
}

/**
 * Shared "records per page" control for every paginated list page (`/projects`,
 * `/business-knowledge-center`). A small client island — same established pattern as
 * `ProjectSwitcher` (a native `<select>` whose `onChange` triggers navigation immediately, no
 * "Apply" button) — rather than folding this into the surrounding filter `<form>`, since a page-size
 * change is expected to apply at once, the same way it does in every other table UI a reader has
 * used before.
 */
export function PageSizeSelect({ value, hrefBySize }: PageSizeSelectProps): ReactNode {
  const router = useRouter();

  return (
    <label style={{ display: "flex", alignItems: "center", gap: "0.5rem", fontSize: "0.875rem" }}>
      <span style={{ color: "var(--webdesk-dashboard-color-foreground-muted)" }}>Per page</span>
      <select
        aria-label="Records per page"
        value={value}
        onChange={(event) => {
          router.push(hrefBySize[Number(event.target.value) as PageSize]);
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
