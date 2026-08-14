import type { ComponentType, ReactNode } from "react";
import {
  colorTokens,
  layoutTokens,
  radiusTokens,
  spacingTokens,
  statusTokens,
  typographyTokens,
  type StatusToken,
} from "../tokens.js";

/**
 * Shared reusable page-shell components (Phase 1F brief §14) — future
 * modules compose pages from these instead of hand-rolling layout markup.
 * Framework-agnostic (no `next/link` dependency): anything that renders an
 * internal link accepts an optional `linkComponent` prop so `dashboard-web`
 * can inject `next/link` for client-side navigation; plain `<a>` is the
 * default so this package stays usable outside Next.js.
 */

export interface LinkComponentProps {
  readonly href: string;
  readonly children: ReactNode;
  readonly className?: string;
}

const DefaultLink: ComponentType<LinkComponentProps> = ({ href, children, className }) => (
  <a href={href} className={className}>
    {children}
  </a>
);

export interface BreadcrumbItem {
  readonly label: string;
  readonly href?: string;
}

export interface BreadcrumbsProps {
  readonly items: readonly BreadcrumbItem[];
  readonly linkComponent?: ComponentType<LinkComponentProps>;
}

export function Breadcrumbs({
  items,
  linkComponent: Link = DefaultLink,
}: BreadcrumbsProps): ReactNode {
  return (
    <nav aria-label="Breadcrumb">
      <ol
        style={{
          display: "flex",
          flexWrap: "wrap",
          alignItems: "center",
          gap: spacingTokens.xs,
          margin: 0,
          padding: 0,
          listStyle: "none",
          fontSize: typographyTokens.fontSizeSm,
          color: colorTokens.foregroundMuted,
        }}
      >
        {items.map((item, index) => {
          const isLast = index === items.length - 1;
          return (
            <li
              key={`${item.label}-${index}`}
              style={{ display: "flex", alignItems: "center", gap: spacingTokens.xs }}
            >
              {item.href && !isLast ? (
                <Link href={item.href}>{item.label}</Link>
              ) : (
                <span
                  aria-current={isLast ? "page" : undefined}
                  style={isLast ? { color: colorTokens.foreground } : undefined}
                >
                  {item.label}
                </span>
              )}
              {!isLast ? <span aria-hidden="true">/</span> : null}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}

export interface PageHeaderProps {
  readonly title: string;
  readonly breadcrumbs?: readonly BreadcrumbItem[];
  readonly linkComponent?: ComponentType<LinkComponentProps>;
  readonly statusBadge?: ReactNode;
  readonly contextActions?: ReactNode;
}

/** The page-title area + breadcrumbs + status/contextual-actions slots, per brief §8's shell layout. */
export function PageHeader({
  title,
  breadcrumbs,
  linkComponent,
  statusBadge,
  contextActions,
}: PageHeaderProps): ReactNode {
  return (
    <header
      style={{
        display: "flex",
        flexDirection: "column",
        gap: spacingTokens.sm,
        paddingBottom: spacingTokens.lg,
        marginBottom: spacingTokens.lg,
        borderBottom: `1px solid ${colorTokens.border}`,
      }}
    >
      {breadcrumbs && breadcrumbs.length > 0 ? (
        <Breadcrumbs items={breadcrumbs} linkComponent={linkComponent} />
      ) : null}
      <div
        style={{
          display: "flex",
          flexWrap: "wrap",
          alignItems: "center",
          justifyContent: "space-between",
          gap: spacingTokens.md,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: spacingTokens.sm }}>
          <h1
            style={{
              fontSize: typographyTokens.fontSize2xl,
              fontWeight: typographyTokens.fontWeightSemibold,
              color: colorTokens.foreground,
              margin: 0,
            }}
          >
            {title}
          </h1>
          {statusBadge}
        </div>
        {contextActions ? (
          <div style={{ display: "flex", alignItems: "center", gap: spacingTokens.sm }}>
            {contextActions}
          </div>
        ) : null}
      </div>
    </header>
  );
}

export interface StatusBadgeProps {
  readonly status: StatusToken;
  readonly label: string;
}

/** Encodes state in form as well as label, per artifact/design guidance for scanned UI. */
export function StatusBadge({ status, label }: StatusBadgeProps): ReactNode {
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
        color: colorTokens.foreground,
        background: colorTokens.mutedSurface,
      }}
    >
      <span
        aria-hidden="true"
        style={{
          width: "0.5rem",
          height: "0.5rem",
          borderRadius: radiusTokens.full,
          background: statusTokens[status],
        }}
      />
      {label}
    </span>
  );
}

export interface ContentContainerProps {
  readonly children: ReactNode;
}

/** The standard max-width content wrapper every page body renders inside. */
export function ContentContainer({ children }: ContentContainerProps): ReactNode {
  return (
    <div style={{ maxWidth: layoutTokens.contentMaxWidth, marginInline: "auto", width: "100%" }}>
      {children}
    </div>
  );
}

export interface FiltersBarProps {
  readonly children?: ReactNode;
}

/** An empty shell only — real filter controls are each future module's own responsibility (brief §14). */
export function FiltersBar({ children }: FiltersBarProps): ReactNode {
  if (!children) {
    return null;
  }
  return (
    <div
      style={{
        display: "flex",
        flexWrap: "wrap",
        alignItems: "center",
        gap: spacingTokens.sm,
        paddingBottom: spacingTokens.md,
        marginBottom: spacingTokens.md,
      }}
    >
      {children}
    </div>
  );
}
