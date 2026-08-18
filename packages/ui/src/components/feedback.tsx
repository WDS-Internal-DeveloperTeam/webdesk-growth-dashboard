"use client";

import {
  createContext,
  useCallback,
  useContext,
  useId,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import {
  colorTokens,
  motionTokens,
  radiusTokens,
  spacingTokens,
  typographyTokens,
  zIndexTokens,
} from "../tokens.js";

/**
 * Feedback components (design system `06-dashboard-component-system.md` §4)
 * — Alert, Toast, Progress, Timeline, Version indicator.
 */

export type AlertVariant = "info" | "warning" | "danger" | "success";

export interface AlertProps {
  readonly variant: AlertVariant;
  readonly title: string;
  readonly children?: ReactNode;
}

const ALERT_VARIANT_TOKENS: Readonly<
  Record<AlertVariant, { background: string; foreground: string }>
> = {
  info: { background: colorTokens.infoSurface, foreground: colorTokens.info },
  warning: { background: colorTokens.warningSurface, foreground: colorTokens.warning },
  danger: { background: colorTokens.dangerSurface, foreground: colorTokens.danger },
  success: { background: colorTokens.successSurface, foreground: colorTokens.success },
};

/** A page-level banner for a condition needing attention — not for routine status (use `Badge`) or transient confirmation (use `Toast`). */
export function Alert({ variant, title, children }: AlertProps): ReactNode {
  const tokens = ALERT_VARIANT_TOKENS[variant];
  return (
    <div
      role={variant === "danger" || variant === "warning" ? "alert" : "status"}
      style={{
        display: "flex",
        flexDirection: "column",
        gap: spacingTokens.xs,
        padding: spacingTokens.md,
        borderRadius: radiusTokens.md,
        background: tokens.background,
        borderInlineStart: `3px solid ${tokens.foreground}`,
      }}
    >
      <p
        style={{
          margin: 0,
          fontWeight: typographyTokens.fontWeightSemibold,
          color: tokens.foreground,
        }}
      >
        {title}
      </p>
      {children ? (
        <div style={{ fontSize: typographyTokens.fontSizeSm, color: colorTokens.foreground }}>
          {children}
        </div>
      ) : null}
    </div>
  );
}

export type ToastVariant = "info" | "success" | "danger";

export interface ToastMessage {
  readonly id: string;
  readonly message: string;
  readonly variant: ToastVariant;
}

interface ToastContextValue {
  readonly showToast: (message: string, variant?: ToastVariant) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

const TOAST_AUTO_DISMISS_MS = 5000;

/** Wrap the app (or a page subtree) once; `useToast()` anywhere inside fires a transient, auto-dismissing confirmation — never for errors requiring action (use `Alert`). */
export function ToastProvider({ children }: { readonly children: ReactNode }): ReactNode {
  const [toasts, setToasts] = useState<readonly ToastMessage[]>([]);

  const dismiss = useCallback((id: string) => {
    setToasts((current) => current.filter((toast) => toast.id !== id));
  }, []);

  const showToast = useCallback(
    (message: string, variant: ToastVariant = "success") => {
      const id = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
      setToasts((current) => [...current, { id, message, variant }]);
      setTimeout(() => dismiss(id), TOAST_AUTO_DISMISS_MS);
    },
    [dismiss],
  );

  const value = useMemo(() => ({ showToast }), [showToast]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div
        aria-live="polite"
        style={{
          position: "fixed",
          bottom: spacingTokens.lg,
          insetInlineEnd: spacingTokens.lg,
          display: "flex",
          flexDirection: "column",
          gap: spacingTokens.sm,
          zIndex: zIndexTokens.toast,
        }}
      >
        {toasts.map((toast) => (
          <div
            key={toast.id}
            style={{
              padding: `${spacingTokens.sm} ${spacingTokens.md}`,
              borderRadius: radiusTokens.sm,
              background: colorTokens.primary,
              color: colorTokens.primaryForeground,
              fontSize: typographyTokens.fontSizeSm,
              boxShadow: `0 2px 8px 0 rgb(15 23 42 / 0.16)`,
            }}
          >
            {toast.message}
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast(): ToastContextValue {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error("useToast() must be called within a <ToastProvider>");
  }
  return context;
}

export interface ProgressProps {
  readonly label: string;
  readonly value?: number;
  readonly max?: number;
}

/**
 * Scoped narrowly (design system §6, Direction B borrowing) to the 5
 * pipeline-shaped modules' detail pages — never a generic loading
 * indicator (`LoadingState` is that job). Omit `value` for indeterminate.
 */
export function Progress({ label, value, max = 100 }: ProgressProps): ReactNode {
  const isDeterminate = typeof value === "number";
  // Guard `max <= 0` explicitly — `(value / max) * 100` is `NaN` (or `Infinity`) at `max === 0`,
  // which would otherwise propagate straight through both clamps into `style={{ width: "NaN%" }}`.
  const percent = isDeterminate
    ? max > 0
      ? Math.min(100, Math.max(0, (value / max) * 100))
      : 0
    : undefined;
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: spacingTokens.xs }}>
      <span style={{ fontSize: typographyTokens.fontSizeSm, color: colorTokens.foregroundMuted }}>
        {label}
      </span>
      <div
        role="progressbar"
        aria-label={label}
        aria-valuemin={0}
        aria-valuemax={max}
        aria-valuenow={isDeterminate ? value : undefined}
        style={{
          height: "0.5rem",
          borderRadius: radiusTokens.full,
          background: colorTokens.mutedSurface,
          overflow: "hidden",
        }}
      >
        <div
          style={{
            height: "100%",
            width: isDeterminate ? `${percent}%` : "40%",
            borderRadius: radiusTokens.full,
            background: colorTokens.accent,
            transition: `width ${motionTokens.durationBase} ${motionTokens.easingStandard}`,
          }}
        />
      </div>
    </div>
  );
}

export interface TimelineEntry {
  readonly id: string;
  readonly label: string;
  readonly timestamp: string;
  readonly actor?: string;
}

/** The human-friendly Activity view (design prompt §13's Activity-vs-Audit split) — "Created → Edited → Submitted → Approved," not the full audit log. */
export function Timeline({ entries }: { readonly entries: readonly TimelineEntry[] }): ReactNode {
  return (
    <ol
      style={{
        margin: 0,
        padding: 0,
        listStyle: "none",
        display: "flex",
        flexDirection: "column",
        gap: spacingTokens.md,
      }}
    >
      {entries.map((entry) => (
        <li key={entry.id} style={{ display: "flex", gap: spacingTokens.sm }}>
          <span
            aria-hidden="true"
            style={{
              marginTop: "0.375rem",
              width: "0.5rem",
              height: "0.5rem",
              borderRadius: radiusTokens.full,
              background: colorTokens.accent,
              flexShrink: 0,
            }}
          />
          <div>
            <p
              style={{
                margin: 0,
                fontSize: typographyTokens.fontSizeSm,
                color: colorTokens.foreground,
              }}
            >
              {entry.label}
            </p>
            <p
              style={{
                margin: 0,
                fontSize: typographyTokens.fontSizeXs,
                color: colorTokens.foregroundMuted,
              }}
            >
              {entry.timestamp}
              {entry.actor ? ` · ${entry.actor}` : ""}
            </p>
          </div>
        </li>
      ))}
    </ol>
  );
}

export type VersionState = "current" | "draft" | "previous";

export interface VersionIndicatorProps {
  readonly state: VersionState;
  readonly label: string;
}

const VERSION_STATE_LABEL: Readonly<Record<VersionState, string>> = {
  current: "Current",
  draft: "Draft",
  previous: "Previous",
};

/** The consistent current/draft/previous affordance every versioned record needs (design prompt §12). */
export function VersionIndicator({ state, label }: VersionIndicatorProps): ReactNode {
  const id = useId();
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: spacingTokens.xs,
        fontSize: typographyTokens.fontSizeXs,
        color: colorTokens.foregroundMuted,
      }}
    >
      <span
        id={id}
        style={{
          padding: `${spacingTokens.xs} ${spacingTokens.sm}`,
          borderRadius: radiusTokens.sm,
          background: state === "current" ? colorTokens.successSurface : colorTokens.mutedSurface,
          color: state === "current" ? colorTokens.success : colorTokens.foregroundMuted,
          fontWeight: typographyTokens.fontWeightMedium,
        }}
      >
        {VERSION_STATE_LABEL[state]}
      </span>
      {label}
    </span>
  );
}
