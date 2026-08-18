"use client";

import { useId, useRef, type KeyboardEvent, type ReactNode } from "react";
import {
  borderTokens,
  colorTokens,
  radiusTokens,
  shadowTokens,
  spacingTokens,
  statusBadgeTokens,
  typographyTokens,
  type StatusBadgeToken,
} from "../tokens.js";

/**
 * Structural/display components (design system `06-dashboard-component-system.md`
 * §2) — Badge, Avatar, Card, Table, Tabs, Accordion, Pagination.
 */

export interface BadgeProps {
  readonly bucket: StatusBadgeToken;
  readonly label: string;
}

/**
 * The real business-record/workflow status badge (design system §10), driven by
 * `statusBadgeTokens` — distinct from `page-shell.tsx`'s `StatusBadge`, which
 * uses `statusTokens` for system/integration health only. Every real status
 * name maps to one of these 5 buckets (never invented); status is encoded in
 * form (dot + label) as well as color, never color alone.
 */
export function Badge({ bucket, label }: BadgeProps): ReactNode {
  const tokens = statusBadgeTokens[bucket];
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: spacingTokens.xs,
        padding: `${spacingTokens.xs} ${spacingTokens.sm}`,
        borderRadius: radiusTokens.full,
        fontSize: typographyTokens.fontSizeXs,
        fontWeight: typographyTokens.fontWeightMedium,
        color: tokens.text,
        background: tokens.background,
      }}
    >
      <span
        aria-hidden="true"
        style={{
          width: "0.5rem",
          height: "0.5rem",
          borderRadius: radiusTokens.full,
          background: tokens.dot,
        }}
      />
      {label}
    </span>
  );
}

export interface AvatarProps {
  readonly name: string;
  readonly size?: "sm" | "md" | "lg";
}

const AVATAR_DIMENSION: Readonly<Record<"sm" | "md" | "lg", string>> = {
  sm: "1.5rem",
  md: "2rem",
  lg: "2.75rem",
};

/** Shared initials-from-display-name derivation — also used directly by `dashboard-web`'s `AppShell` for icon-only sidebar tiles. */
export function initialsFor(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) {
    return "?";
  }
  const first = parts[0]?.[0] ?? "";
  const last = parts.length > 1 ? (parts[parts.length - 1]?.[0] ?? "") : "";
  return (first + last).toUpperCase();
}

/** Initials-only — no photo/avatar-image capability exists anywhere in this app yet. */
export function Avatar({ name, size = "md" }: AvatarProps): ReactNode {
  const dimension = AVATAR_DIMENSION[size];
  return (
    <span
      role="img"
      aria-label={name}
      title={name}
      style={{
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        width: dimension,
        height: dimension,
        borderRadius: radiusTokens.full,
        background: colorTokens.mutedSurface,
        color: colorTokens.foregroundMuted,
        fontSize: typographyTokens.fontSizeXs,
        fontWeight: typographyTokens.fontWeightSemibold,
        flexShrink: 0,
      }}
    >
      {initialsFor(name)}
    </span>
  );
}

export interface CardProps {
  readonly children: ReactNode;
  readonly padded?: boolean;
}

/** The standard raised content container — used for summary blocks, form sections, and record panels. */
export function Card({ children, padded = true }: CardProps): ReactNode {
  return (
    <div
      style={{
        background: colorTokens.surfaceRaised,
        border: `${borderTokens.widthThin} solid ${colorTokens.border}`,
        borderRadius: radiusTokens.md,
        boxShadow: shadowTokens.sm,
        padding: padded ? spacingTokens.lg : 0,
      }}
    >
      {children}
    </div>
  );
}

export type SortDirection = "asc" | "desc";

export interface TableColumn<Row> {
  readonly key: string;
  readonly header: string;
  readonly sortable?: boolean;
  readonly render: (row: Row) => ReactNode;
}

export interface TableProps<Row> {
  readonly caption: string;
  readonly columns: readonly TableColumn<Row>[];
  readonly rows: readonly Row[];
  readonly getRowKey: (row: Row) => string;
  readonly sortKey?: string;
  readonly sortDirection?: SortDirection;
  readonly onSortChange?: (key: string) => void;
  readonly emptyMessage?: string;
}

/** Every sortable header is a real `<button>`, per `08-tables-and-filters.md` — never a bare clickable label. */
export function Table<Row>({
  caption,
  columns,
  rows,
  getRowKey,
  sortKey,
  sortDirection,
  onSortChange,
  emptyMessage = "No records to show.",
}: TableProps<Row>): ReactNode {
  return (
    <div style={{ overflowX: "auto" }}>
      <table
        style={{ width: "100%", borderCollapse: "collapse", fontSize: typographyTokens.fontSizeSm }}
      >
        <caption
          style={{
            position: "absolute",
            width: 1,
            height: 1,
            overflow: "hidden",
            clip: "rect(0 0 0 0)",
          }}
        >
          {caption}
        </caption>
        <thead>
          <tr>
            {columns.map((column) => {
              const isSorted = sortKey === column.key;
              return (
                <th
                  key={column.key}
                  scope="col"
                  aria-sort={
                    column.sortable
                      ? isSorted
                        ? sortDirection === "asc"
                          ? "ascending"
                          : "descending"
                        : "none"
                      : undefined
                  }
                  style={{
                    textAlign: "left",
                    padding: spacingTokens.sm,
                    borderBottom: `${borderTokens.widthMedium} solid ${colorTokens.border}`,
                    color: colorTokens.foregroundMuted,
                    fontWeight: typographyTokens.fontWeightSemibold,
                  }}
                >
                  {column.sortable ? (
                    <button
                      type="button"
                      onClick={() => onSortChange?.(column.key)}
                      style={{
                        display: "inline-flex",
                        alignItems: "center",
                        gap: spacingTokens.xs,
                        background: "none",
                        border: "none",
                        padding: 0,
                        font: "inherit",
                        color: "inherit",
                        cursor: "pointer",
                      }}
                    >
                      {column.header}
                      {isSorted ? (
                        <span aria-hidden="true">{sortDirection === "asc" ? "▲" : "▼"}</span>
                      ) : null}
                    </button>
                  ) : (
                    column.header
                  )}
                </th>
              );
            })}
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 ? (
            <tr>
              <td
                colSpan={columns.length}
                style={{
                  padding: spacingTokens.lg,
                  textAlign: "center",
                  color: colorTokens.foregroundMuted,
                }}
              >
                {emptyMessage}
              </td>
            </tr>
          ) : (
            rows.map((row) => (
              <tr key={getRowKey(row)}>
                {columns.map((column) => (
                  <td
                    key={column.key}
                    style={{
                      padding: spacingTokens.sm,
                      borderBottom: `${borderTokens.widthThin} solid ${colorTokens.border}`,
                    }}
                  >
                    {column.render(row)}
                  </td>
                ))}
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}

export interface TabItem {
  readonly id: string;
  readonly label: string;
  readonly panel: ReactNode;
}

export interface TabsProps {
  readonly label: string;
  readonly items: readonly TabItem[];
  readonly activeId: string;
  readonly onChange: (id: string) => void;
}

/** WAI-ARIA Tabs pattern: roving tabindex, Left/Right/Home/End keyboard navigation (`14-accessibility-requirements.md`). */
export function Tabs({ label, items, activeId, onChange }: TabsProps): ReactNode {
  const tabRefs = useRef<Record<string, HTMLButtonElement | null>>({});

  function focusAndActivate(id: string) {
    onChange(id);
    tabRefs.current[id]?.focus();
  }

  function handleKeyDown(event: KeyboardEvent<HTMLButtonElement>, index: number) {
    if (!["ArrowRight", "ArrowLeft", "Home", "End"].includes(event.key)) {
      return;
    }
    event.preventDefault();
    let nextIndex = index;
    if (event.key === "ArrowRight") {
      nextIndex = (index + 1) % items.length;
    } else if (event.key === "ArrowLeft") {
      nextIndex = (index - 1 + items.length) % items.length;
    } else if (event.key === "Home") {
      nextIndex = 0;
    } else if (event.key === "End") {
      nextIndex = items.length - 1;
    }
    const next = items[nextIndex];
    if (next) {
      focusAndActivate(next.id);
    }
  }

  const activeItem = items.find((item) => item.id === activeId) ?? items[0];

  return (
    <div>
      <div
        role="tablist"
        aria-label={label}
        style={{
          display: "flex",
          gap: spacingTokens.md,
          borderBottom: `${borderTokens.widthThin} solid ${colorTokens.border}`,
        }}
      >
        {items.map((item, index) => {
          const isActive = item.id === activeItem?.id;
          return (
            <button
              key={item.id}
              ref={(element) => {
                tabRefs.current[item.id] = element;
              }}
              type="button"
              role="tab"
              id={`tab-${item.id}`}
              aria-selected={isActive}
              aria-controls={`tabpanel-${item.id}`}
              tabIndex={isActive ? 0 : -1}
              onClick={() => onChange(item.id)}
              onKeyDown={(event) => handleKeyDown(event, index)}
              style={{
                padding: `${spacingTokens.sm} ${spacingTokens.xs}`,
                marginBottom: "-1px",
                background: "none",
                border: "none",
                borderBottom: `${borderTokens.widthMedium} solid ${isActive ? colorTokens.accent : "transparent"}`,
                color: isActive ? colorTokens.foreground : colorTokens.foregroundMuted,
                fontWeight: isActive
                  ? typographyTokens.fontWeightSemibold
                  : typographyTokens.fontWeightRegular,
                fontSize: typographyTokens.fontSizeSm,
                cursor: "pointer",
              }}
            >
              {item.label}
            </button>
          );
        })}
      </div>
      {items.map((item) => (
        <div
          key={item.id}
          role="tabpanel"
          id={`tabpanel-${item.id}`}
          aria-labelledby={`tab-${item.id}`}
          hidden={item.id !== activeItem?.id}
          style={{ paddingTop: spacingTokens.md }}
        >
          {item.panel}
        </div>
      ))}
    </div>
  );
}

export interface AccordionItem {
  readonly id: string;
  readonly title: string;
  readonly content: ReactNode;
}

export interface AccordionProps {
  readonly items: readonly AccordionItem[];
  readonly expandedIds: ReadonlySet<string>;
  readonly onToggle: (id: string) => void;
}

/** Disclosure pattern (`aria-expanded` + `hidden` panel), not a full WAI-ARIA Accordion widget — each item is independent. */
export function Accordion({ items, expandedIds, onToggle }: AccordionProps): ReactNode {
  return (
    <div>
      {items.map((item) => {
        const isExpanded = expandedIds.has(item.id);
        return (
          <div
            key={item.id}
            style={{ borderBottom: `${borderTokens.widthThin} solid ${colorTokens.border}` }}
          >
            <h3 style={{ margin: 0 }}>
              <button
                type="button"
                aria-expanded={isExpanded}
                aria-controls={`accordion-panel-${item.id}`}
                onClick={() => onToggle(item.id)}
                style={{
                  width: "100%",
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  padding: spacingTokens.md,
                  background: "none",
                  border: "none",
                  textAlign: "left",
                  font: "inherit",
                  fontWeight: typographyTokens.fontWeightMedium,
                  color: colorTokens.foreground,
                  cursor: "pointer",
                }}
              >
                {item.title}
                <span aria-hidden="true">{isExpanded ? "−" : "+"}</span>
              </button>
            </h3>
            <div
              id={`accordion-panel-${item.id}`}
              hidden={!isExpanded}
              style={{ padding: `0 ${spacingTokens.md} ${spacingTokens.md}` }}
            >
              {item.content}
            </div>
          </div>
        );
      })}
    </div>
  );
}

export interface PaginationProps {
  readonly page: number;
  readonly hasNextPage: boolean;
  readonly onPageChange: (page: number) => void;
}

/** Offset/page-based pagination — matches the pattern already used by the live Projects list page. */
export function Pagination({ page, hasNextPage, onPageChange }: PaginationProps): ReactNode {
  const id = useId();
  return (
    <nav
      aria-label="Pagination"
      id={id}
      style={{ display: "flex", alignItems: "center", gap: spacingTokens.sm }}
    >
      <button
        type="button"
        onClick={() => onPageChange(page - 1)}
        disabled={page <= 1}
        style={{
          padding: `${spacingTokens.xs} ${spacingTokens.sm}`,
          borderRadius: radiusTokens.sm,
          border: `${borderTokens.widthThin} solid ${colorTokens.border}`,
          background: colorTokens.surface,
          color: colorTokens.foreground,
          cursor: page <= 1 ? "not-allowed" : "pointer",
          opacity: page <= 1 ? 0.5 : 1,
        }}
      >
        Previous
      </button>
      <span style={{ fontSize: typographyTokens.fontSizeSm, color: colorTokens.foregroundMuted }}>
        Page {page}
      </span>
      <button
        type="button"
        onClick={() => onPageChange(page + 1)}
        disabled={!hasNextPage}
        style={{
          padding: `${spacingTokens.xs} ${spacingTokens.sm}`,
          borderRadius: radiusTokens.sm,
          border: `${borderTokens.widthThin} solid ${colorTokens.border}`,
          background: colorTokens.surface,
          color: colorTokens.foreground,
          cursor: !hasNextPage ? "not-allowed" : "pointer",
          opacity: !hasNextPage ? 0.5 : 1,
        }}
      >
        Next
      </button>
    </nav>
  );
}
