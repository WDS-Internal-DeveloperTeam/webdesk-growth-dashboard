import {
  forwardRef,
  type ButtonHTMLAttributes,
  type ChangeEvent,
  type InputHTMLAttributes,
  type ReactNode,
  type SelectHTMLAttributes,
  type TextareaHTMLAttributes,
} from "react";
import {
  borderTokens,
  colorTokens,
  controlSizeTokens,
  focusTokens,
  motionTokens,
  radiusTokens,
  spacingTokens,
  typographyTokens,
  type ControlSizeToken,
} from "../tokens.js";
import type { LinkComponentProps } from "./page-shell.js";

/**
 * Core form/action controls (design system `06-dashboard-component-system.md`
 * §1) — the ~30-component gap this package closes first, since every future
 * module page needs these immediately. Every color/spacing/size value comes
 * from a token, never a literal, per `16-existing-shell-gap-analysis.md`'s
 * own standardization recommendation.
 */

const focusRingStyle: React.CSSProperties = {
  outlineColor: focusTokens.ringColor,
  outlineOffset: focusTokens.ringOffset,
};

const transitionStyle = `background-color ${motionTokens.durationFast} ${motionTokens.easingStandard}, border-color ${motionTokens.durationFast} ${motionTokens.easingStandard}`;

export type ButtonVariant = "primary" | "secondary" | "danger" | "ghost";
export type ButtonSize = Exclude<ControlSizeToken, "lg"> | "lg";

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  readonly variant?: ButtonVariant;
  readonly size?: ButtonSize;
}

function buttonVariantStyle(variant: ButtonVariant): React.CSSProperties {
  switch (variant) {
    case "primary":
      return {
        background: colorTokens.primary,
        color: colorTokens.primaryForeground,
        border: "1px solid transparent",
      };
    case "danger":
      return {
        background: colorTokens.danger,
        color: colorTokens.primaryForeground,
        border: "1px solid transparent",
      };
    case "ghost":
      return {
        background: "transparent",
        color: colorTokens.foreground,
        border: "1px solid transparent",
      };
    case "secondary":
    default:
      return {
        background: colorTokens.surface,
        color: colorTokens.foreground,
        border: `1px solid ${colorTokens.border}`,
      };
  }
}

/** The single primary-action control every future module reaches for instead of a hand-rolled `<button>`. */
export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant = "secondary", size = "md", style, disabled, children, ...rest },
  ref,
) {
  const sizeTokens = controlSizeTokens[size];
  return (
    <button
      ref={ref}
      type="button"
      disabled={disabled}
      style={{
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        gap: spacingTokens.xs,
        height: sizeTokens.height,
        paddingInline: sizeTokens.paddingInline,
        fontSize: sizeTokens.fontSize,
        fontWeight: typographyTokens.fontWeightMedium,
        fontFamily: typographyTokens.fontFamilyBase,
        borderRadius: radiusTokens.sm,
        cursor: disabled ? "not-allowed" : "pointer",
        opacity: disabled ? 0.6 : 1,
        transition: transitionStyle,
        ...buttonVariantStyle(variant),
        ...style,
      }}
      {...rest}
    >
      {children}
    </button>
  );
});

export interface IconButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  readonly label: string;
  readonly icon: ReactNode;
  readonly size?: ButtonSize;
  readonly variant?: ButtonVariant;
}

/** An icon-only control — `label` is mandatory and renders as `aria-label`, never a bare icon with no accessible name. */
export const IconButton = forwardRef<HTMLButtonElement, IconButtonProps>(function IconButton(
  { label, icon, size = "md", variant = "ghost", style, ...rest },
  ref,
) {
  const sizeTokens = controlSizeTokens[size];
  return (
    <button
      ref={ref}
      type="button"
      aria-label={label}
      title={label}
      style={{
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        width: sizeTokens.height,
        height: sizeTokens.height,
        borderRadius: radiusTokens.sm,
        cursor: "pointer",
        transition: transitionStyle,
        ...buttonVariantStyle(variant),
        ...style,
      }}
      {...rest}
    >
      {icon}
    </button>
  );
});

export interface AppLinkProps extends LinkComponentProps {
  readonly linkComponent?: React.ComponentType<LinkComponentProps>;
  readonly variant?: "default" | "muted";
}

/** A styled internal-navigation link — distinct from `Button`, which is for actions, not navigation. */
export function AppLink({
  linkComponent: Link,
  variant = "default",
  href,
  children,
  className,
}: AppLinkProps): ReactNode {
  const style: React.CSSProperties = {
    color: variant === "muted" ? colorTokens.foregroundMuted : colorTokens.accent,
    fontSize: typographyTokens.fontSizeSm,
    textDecoration: "none",
  };
  if (Link) {
    return (
      <Link href={href} className={className}>
        <span style={style}>{children}</span>
      </Link>
    );
  }
  return (
    <a href={href} className={className} style={style}>
      {children}
    </a>
  );
}

function fieldBaseStyle(size: ButtonSize, hasError?: boolean): React.CSSProperties {
  const sizeTokens = controlSizeTokens[size];
  return {
    width: "100%",
    height: sizeTokens.height,
    paddingInline: sizeTokens.paddingInline,
    fontSize: sizeTokens.fontSize,
    fontFamily: typographyTokens.fontFamilyBase,
    color: colorTokens.foreground,
    background: colorTokens.surfaceRaised,
    border: `${borderTokens.widthThin} solid ${hasError ? colorTokens.danger : colorTokens.border}`,
    borderRadius: radiusTokens.sm,
    transition: transitionStyle,
  };
}

export interface FieldWrapperProps {
  readonly label: string;
  readonly hideLabel?: boolean;
  readonly hint?: string;
  readonly error?: string;
  readonly required?: boolean;
  readonly htmlFor: string;
  readonly children: ReactNode;
}

/** Shared label/hint/error scaffold every field control below renders through, so the a11y wiring (`aria-describedby`, error announcement) lives in one place. */
export function FieldWrapper({
  label,
  hideLabel,
  hint,
  error,
  required,
  htmlFor,
  children,
}: FieldWrapperProps): ReactNode {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: spacingTokens.xs }}>
      <label
        htmlFor={htmlFor}
        style={
          hideLabel
            ? {
                position: "absolute",
                width: 1,
                height: 1,
                overflow: "hidden",
                clip: "rect(0 0 0 0)",
              }
            : {
                fontSize: typographyTokens.fontSizeSm,
                fontWeight: typographyTokens.fontWeightMedium,
                color: colorTokens.foreground,
              }
        }
      >
        {label}
        {required ? (
          <span aria-hidden="true" style={{ color: colorTokens.danger }}>
            {" "}
            *
          </span>
        ) : null}
      </label>
      {children}
      {hint && !error ? (
        <p
          id={`${htmlFor}-hint`}
          style={{
            margin: 0,
            fontSize: typographyTokens.fontSizeXs,
            color: colorTokens.foregroundMuted,
          }}
        >
          {hint}
        </p>
      ) : null}
      {error ? (
        <p
          id={`${htmlFor}-error`}
          role="alert"
          style={{ margin: 0, fontSize: typographyTokens.fontSizeXs, color: colorTokens.danger }}
        >
          {error}
        </p>
      ) : null}
    </div>
  );
}

export interface InputProps extends Omit<InputHTMLAttributes<HTMLInputElement>, "size"> {
  readonly label: string;
  readonly hideLabel?: boolean;
  readonly hint?: string;
  readonly error?: string;
  readonly size?: ButtonSize;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(function Input(
  { id, label, hideLabel, hint, error, required, size = "md", style, ...rest },
  ref,
) {
  const fieldId = id ?? `input-${label.toLowerCase().replace(/\s+/g, "-")}`;
  return (
    <FieldWrapper
      label={label}
      hideLabel={hideLabel}
      hint={hint}
      error={error}
      required={required}
      htmlFor={fieldId}
    >
      <input
        ref={ref}
        id={fieldId}
        required={required}
        aria-invalid={Boolean(error)}
        aria-describedby={error ? `${fieldId}-error` : hint ? `${fieldId}-hint` : undefined}
        style={{ ...fieldBaseStyle(size, Boolean(error)), ...style }}
        {...rest}
      />
    </FieldWrapper>
  );
});

export interface TextareaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  readonly label: string;
  readonly hideLabel?: boolean;
  readonly hint?: string;
  readonly error?: string;
}

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(function Textarea(
  { id, label, hideLabel, hint, error, required, style, rows = 4, ...rest },
  ref,
) {
  const fieldId = id ?? `textarea-${label.toLowerCase().replace(/\s+/g, "-")}`;
  return (
    <FieldWrapper
      label={label}
      hideLabel={hideLabel}
      hint={hint}
      error={error}
      required={required}
      htmlFor={fieldId}
    >
      <textarea
        ref={ref}
        id={fieldId}
        required={required}
        rows={rows}
        aria-invalid={Boolean(error)}
        aria-describedby={error ? `${fieldId}-error` : hint ? `${fieldId}-hint` : undefined}
        style={{
          ...fieldBaseStyle("md", Boolean(error)),
          height: "auto",
          paddingBlock: spacingTokens.sm,
          resize: "vertical",
          ...style,
        }}
        {...rest}
      />
    </FieldWrapper>
  );
});

export interface SelectOption {
  readonly value: string;
  readonly label: string;
}

export interface SelectProps extends Omit<SelectHTMLAttributes<HTMLSelectElement>, "size"> {
  readonly label: string;
  readonly hideLabel?: boolean;
  readonly hint?: string;
  readonly error?: string;
  readonly options: readonly SelectOption[];
  readonly placeholder?: string;
  readonly size?: ButtonSize;
}

/** Single-select. For multiple values, pass `multiple` (native multi-select) — a bespoke tag-picker is out of this pass's scope. */
export const Select = forwardRef<HTMLSelectElement, SelectProps>(function Select(
  {
    id,
    label,
    hideLabel,
    hint,
    error,
    required,
    options,
    placeholder,
    size = "md",
    style,
    multiple,
    ...rest
  },
  ref,
) {
  const fieldId = id ?? `select-${label.toLowerCase().replace(/\s+/g, "-")}`;
  return (
    <FieldWrapper
      label={label}
      hideLabel={hideLabel}
      hint={hint}
      error={error}
      required={required}
      htmlFor={fieldId}
    >
      <select
        ref={ref}
        id={fieldId}
        required={required}
        multiple={multiple}
        aria-invalid={Boolean(error)}
        aria-describedby={error ? `${fieldId}-error` : hint ? `${fieldId}-hint` : undefined}
        style={{
          ...fieldBaseStyle(size, Boolean(error)),
          height: multiple ? "auto" : fieldBaseStyle(size).height,
          ...style,
        }}
        {...rest}
      >
        {placeholder && !multiple ? <option value="">{placeholder}</option> : null}
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </FieldWrapper>
  );
});

export interface CheckboxProps extends Omit<
  InputHTMLAttributes<HTMLInputElement>,
  "type" | "size"
> {
  readonly label: string;
}

export const Checkbox = forwardRef<HTMLInputElement, CheckboxProps>(function Checkbox(
  { id, label, style, ...rest },
  ref,
) {
  const fieldId = id ?? `checkbox-${label.toLowerCase().replace(/\s+/g, "-")}`;
  return (
    <label
      htmlFor={fieldId}
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: spacingTokens.xs,
        fontSize: typographyTokens.fontSizeSm,
        color: colorTokens.foreground,
        cursor: "pointer",
      }}
    >
      <input
        ref={ref}
        id={fieldId}
        type="checkbox"
        style={{ width: "1rem", height: "1rem", accentColor: colorTokens.accent, ...style }}
        {...rest}
      />
      {label}
    </label>
  );
});

export interface RadioOption {
  readonly value: string;
  readonly label: string;
}

export interface RadioGroupProps {
  readonly label: string;
  readonly name: string;
  readonly options: readonly RadioOption[];
  readonly value?: string;
  readonly onChange?: (value: string) => void;
  readonly hideLabel?: boolean;
}

export function RadioGroup({
  label,
  name,
  options,
  value,
  onChange,
  hideLabel,
}: RadioGroupProps): ReactNode {
  return (
    <fieldset style={{ border: "none", margin: 0, padding: 0 }}>
      <legend
        style={
          hideLabel
            ? {
                position: "absolute",
                width: 1,
                height: 1,
                overflow: "hidden",
                clip: "rect(0 0 0 0)",
              }
            : {
                fontSize: typographyTokens.fontSizeSm,
                fontWeight: typographyTokens.fontWeightMedium,
                color: colorTokens.foreground,
                marginBottom: spacingTokens.xs,
              }
        }
      >
        {label}
      </legend>
      <div style={{ display: "flex", flexDirection: "column", gap: spacingTokens.xs }}>
        {options.map((option) => (
          <label
            key={option.value}
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: spacingTokens.xs,
              fontSize: typographyTokens.fontSizeSm,
              color: colorTokens.foreground,
              cursor: "pointer",
            }}
          >
            <input
              type="radio"
              name={name}
              value={option.value}
              checked={value === option.value}
              onChange={() => onChange?.(option.value)}
              style={{ width: "1rem", height: "1rem", accentColor: colorTokens.accent }}
            />
            {option.label}
          </label>
        ))}
      </div>
    </fieldset>
  );
}

export interface ToggleProps {
  readonly label: string;
  readonly checked: boolean;
  readonly onChange: (checked: boolean) => void;
  readonly hideLabel?: boolean;
  readonly disabled?: boolean;
}

/** A binary on/off control distinct from `Checkbox` (a form-submission value) — used for immediate-effect settings. */
export function Toggle({ label, checked, onChange, hideLabel, disabled }: ToggleProps): ReactNode {
  return (
    <label
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: spacingTokens.sm,
        cursor: disabled ? "not-allowed" : "pointer",
        opacity: disabled ? 0.6 : 1,
      }}
    >
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        aria-label={hideLabel ? label : undefined}
        disabled={disabled}
        onClick={() => onChange(!checked)}
        style={{
          position: "relative",
          width: "2.25rem",
          height: "1.25rem",
          borderRadius: radiusTokens.full,
          border: "none",
          background: checked ? colorTokens.accent : colorTokens.border,
          cursor: disabled ? "not-allowed" : "pointer",
          transition: `background-color ${motionTokens.durationFast} ${motionTokens.easingStandard}`,
          padding: 0,
        }}
      >
        <span
          aria-hidden="true"
          style={{
            position: "absolute",
            top: "0.125rem",
            left: checked ? "1.125rem" : "0.125rem",
            width: "1rem",
            height: "1rem",
            borderRadius: radiusTokens.full,
            background: colorTokens.surfaceRaised,
            transition: `left ${motionTokens.durationFast} ${motionTokens.easingStandard}`,
          }}
        />
      </button>
      {!hideLabel ? (
        <span style={{ fontSize: typographyTokens.fontSizeSm, color: colorTokens.foreground }}>
          {label}
        </span>
      ) : null}
    </label>
  );
}

export interface DateFieldProps extends Omit<
  InputHTMLAttributes<HTMLInputElement>,
  "type" | "size"
> {
  readonly label: string;
  readonly hideLabel?: boolean;
  readonly hint?: string;
  readonly error?: string;
}

/** A thin, token-styled wrapper over the native date input — no bespoke calendar widget in this pass. */
export const DateField = forwardRef<HTMLInputElement, DateFieldProps>(function DateField(
  { id, label, hideLabel, hint, error, required, style, ...rest },
  ref,
) {
  const fieldId = id ?? `date-${label.toLowerCase().replace(/\s+/g, "-")}`;
  return (
    <FieldWrapper
      label={label}
      hideLabel={hideLabel}
      hint={hint}
      error={error}
      required={required}
      htmlFor={fieldId}
    >
      <input
        ref={ref}
        id={fieldId}
        type="date"
        required={required}
        aria-invalid={Boolean(error)}
        aria-describedby={error ? `${fieldId}-error` : hint ? `${fieldId}-hint` : undefined}
        style={{ ...fieldBaseStyle("md", Boolean(error)), ...style }}
        {...rest}
      />
    </FieldWrapper>
  );
});

export type { ChangeEvent };
export { focusRingStyle };
