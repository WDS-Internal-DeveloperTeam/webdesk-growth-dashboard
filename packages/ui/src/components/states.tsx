import type { ReactNode } from "react";
import {
  colorTokens,
  radiusTokens,
  spacingTokens,
  statusBadgeTokens,
  typographyTokens,
} from "../tokens.js";

/**
 * Shared reusable UI states (Phase 1F brief §15) — future modules render
 * these instead of building their own ad-hoc loading/empty/error markup.
 * Every state is a real, accessible landmark, not a bare spinner or blank
 * screen (brief's own "avoid indefinite blank screens" instruction).
 */

const containerStyle: React.CSSProperties = {
  display: "flex",
  flexDirection: "column",
  alignItems: "center",
  textAlign: "center",
  gap: spacingTokens.sm,
  padding: spacingTokens["2xl"],
  color: colorTokens.foregroundMuted,
  fontFamily: typographyTokens.fontFamilyBase,
};

const titleStyle: React.CSSProperties = {
  fontSize: typographyTokens.fontSizeLg,
  fontWeight: typographyTokens.fontWeightSemibold,
  color: colorTokens.foreground,
  margin: 0,
};

const bodyStyle: React.CSSProperties = {
  fontSize: typographyTokens.fontSizeSm,
  maxWidth: "32rem",
  margin: 0,
};

function badgeStyle(background: string, foreground: string): React.CSSProperties {
  return {
    display: "inline-block",
    padding: `${spacingTokens.xs} ${spacingTokens.sm}`,
    borderRadius: radiusTokens.full,
    background,
    color: foreground,
    fontSize: typographyTokens.fontSizeXs,
    fontWeight: typographyTokens.fontWeightMedium,
  };
}

export interface LoadingStateProps {
  readonly label?: string;
}

/** `role="status"` + `aria-live="polite"` — announced to assistive tech without stealing focus. */
export function LoadingState({ label = "Loading" }: LoadingStateProps): ReactNode {
  return (
    <div style={containerStyle} role="status" aria-live="polite">
      <span style={badgeStyle(colorTokens.mutedSurface, colorTokens.foregroundMuted)}>
        {label}…
      </span>
    </div>
  );
}

export interface EmptyStateProps {
  readonly title: string;
  readonly description?: string;
  readonly action?: ReactNode;
}

/** Explains why there's no data and what an authorized next action might be (brief §15). */
export function EmptyState({ title, description, action }: EmptyStateProps): ReactNode {
  return (
    <div style={containerStyle}>
      <p style={titleStyle}>{title}</p>
      {description ? <p style={bodyStyle}>{description}</p> : null}
      {action}
    </div>
  );
}

export interface ErrorStateProps {
  readonly title?: string;
  /**
   * Renders `title` as a real `<h1>` instead of the default styled `<p>`.
   * Set this when the state IS the page (a full-page boundary like
   * `app/error.tsx`, which needs a real top-level heading) — leave it unset
   * when embedding this state inside a page that already has its own
   * heading, so two `<h1>`s don't collide.
   */
  readonly titleAs?: "p" | "h1";
  /** Safe, user-facing message only — never a stack trace, SQL, or internal path (brief §22). */
  readonly message: string;
  readonly correlationId?: string;
  readonly action?: ReactNode;
}

export function ErrorState({
  title = "Something went wrong",
  titleAs = "p",
  message,
  correlationId,
  action,
}: ErrorStateProps): ReactNode {
  const Title = titleAs;
  return (
    <div style={containerStyle} role="alert">
      {/* statusBadgeTokens.blocked.text, not colorTokens.danger — colorTokens.danger on
          dangerSurface is only 4.41:1, under WCAG AA's 4.5:1 for normal text; a real
          violation axe-core caught once any badge here was first scanned on an
          authenticated route (see the Dashboard UI Foundation Alignment a11y coverage). */}
      <span style={badgeStyle(colorTokens.dangerSurface, statusBadgeTokens.blocked.text)}>
        Error
      </span>
      <Title style={titleStyle}>{title}</Title>
      <p style={bodyStyle}>{message}</p>
      {correlationId ? (
        <p style={{ ...bodyStyle, fontFamily: typographyTokens.fontFamilyMono }}>
          Reference: {correlationId}
        </p>
      ) : null}
      {action}
    </div>
  );
}

export interface ForbiddenStateProps {
  readonly message?: string;
}

/** Represents an authorization failure — distinct from NotFoundState (brief §15). */
export function ForbiddenState({
  message = "You don't have access to this page. If you believe this is a mistake, contact your administrator.",
}: ForbiddenStateProps): ReactNode {
  return (
    <div style={containerStyle} role="alert">
      {/* statusBadgeTokens.attention.text — colorTokens.warning on warningSurface is only
          3.07:1, under WCAG AA's 4.5:1 (same class of bug as the ErrorState fix above). */}
      <span style={badgeStyle(colorTokens.warningSurface, statusBadgeTokens.attention.text)}>
        Access restricted
      </span>
      <p style={titleStyle}>You don&apos;t have permission to view this</p>
      <p style={bodyStyle}>{message}</p>
    </div>
  );
}

export interface NotFoundStateProps {
  readonly title?: string;
  /** See `ErrorStateProps.titleAs` — same reasoning. */
  readonly titleAs?: "p" | "h1";
  readonly message?: string;
}

/** Handles invalid routes/resources (brief §15). */
export function NotFoundState({
  title = "We couldn't find that",
  titleAs = "p",
  message = "The page or record you're looking for doesn't exist or may have been removed.",
}: NotFoundStateProps): ReactNode {
  const Title = titleAs;
  return (
    <div style={containerStyle}>
      <span style={badgeStyle(colorTokens.mutedSurface, colorTokens.foregroundMuted)}>
        Not found
      </span>
      <Title style={titleStyle}>{title}</Title>
      <p style={bodyStyle}>{message}</p>
    </div>
  );
}

export interface NotConfiguredStateProps {
  readonly title?: string;
  readonly message: string;
}

/** For external systems/setup-time dependencies that aren't configured yet (brief §15). */
export function NotConfiguredState({
  title = "Not configured yet",
  message,
}: NotConfiguredStateProps): ReactNode {
  return (
    <div style={containerStyle}>
      {/* statusBadgeTokens.informational.text — colorTokens.info on infoSurface is only
          3.84:1, under WCAG AA's 4.5:1 (same class of bug as the ErrorState fix above). */}
      <span style={badgeStyle(colorTokens.infoSurface, statusBadgeTokens.informational.text)}>
        Not configured
      </span>
      <p style={titleStyle}>{title}</p>
      <p style={bodyStyle}>{message}</p>
    </div>
  );
}

export interface DegradedStateProps {
  readonly message: string;
}

/** A dependency/integration is partially unavailable — distinct from a full outage (brief §15). */
export function DegradedState({ message }: DegradedStateProps): ReactNode {
  return (
    <div style={containerStyle} role="status">
      <span style={badgeStyle(colorTokens.warningSurface, statusBadgeTokens.attention.text)}>
        Degraded
      </span>
      <p style={titleStyle}>Some functionality is limited right now</p>
      <p style={bodyStyle}>{message}</p>
    </div>
  );
}

export interface BlockedStateProps {
  readonly message: string;
}

/** A workflow or dependency prevents further action (brief §15). */
export function BlockedState({ message }: BlockedStateProps): ReactNode {
  return (
    <div style={containerStyle}>
      <span style={badgeStyle(colorTokens.mutedSurface, colorTokens.foregroundMuted)}>Blocked</span>
      <p style={titleStyle}>This can&apos;t proceed yet</p>
      <p style={bodyStyle}>{message}</p>
    </div>
  );
}

export interface FeatureUnavailableStateProps {
  /** The registry's own `implementation_status`/`feature_status` label — never fabricated (brief §13). */
  readonly status: string;
  readonly moduleName: string;
}

/** The controlled placeholder for a not-yet-built Version 1 module (brief §13) — status only, never fake CRUD/data. */
export function FeatureUnavailableState({
  status,
  moduleName,
}: FeatureUnavailableStateProps): ReactNode {
  return (
    <div style={containerStyle}>
      <span style={badgeStyle(colorTokens.mutedSurface, colorTokens.foregroundMuted)}>
        {status}
      </span>
      <p style={titleStyle}>{moduleName}</p>
      <p style={bodyStyle}>
        This module&apos;s real functionality hasn&apos;t been built yet. Its current status is
        &quot;{status}&quot;.
      </p>
    </div>
  );
}
