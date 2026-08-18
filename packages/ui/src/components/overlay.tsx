"use client";

import {
  useEffect,
  useId,
  useRef,
  useState,
  type KeyboardEvent as ReactKeyboardEvent,
  type ReactNode,
} from "react";
import {
  borderTokens,
  colorTokens,
  layoutTokens,
  radiusTokens,
  shadowTokens,
  spacingTokens,
  typographyTokens,
  zIndexTokens,
} from "../tokens.js";

/**
 * Navigation/overlay components (design system `06-dashboard-component-system.md`
 * §3) — Drawer, Modal, Tooltip, Dropdown, Command/action menu. Every dialog-like
 * surface here (Drawer, Modal) traps focus, closes on `Escape`, and restores
 * focus to the element that opened it, per `14-accessibility-requirements.md`
 * §"fully operable by keyboard alone."
 */

const FOCUSABLE_SELECTOR =
  'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])';

function useDialogBehavior(isOpen: boolean, onClose: () => void) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const previouslyFocused = useRef<HTMLElement | null>(null);
  // Callers routinely pass an inline arrow function, so `onClose` gets a new identity on every
  // render of the parent. Reading it through a ref (kept fresh below, no effect needed) lets the
  // focus-trap effect depend on `isOpen` alone — it no longer tears down and re-runs (stealing
  // focus back to the trigger element) on an unrelated parent re-render while the dialog is open.
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  useEffect(() => {
    if (!isOpen) {
      return;
    }
    previouslyFocused.current = document.activeElement as HTMLElement | null;
    const container = containerRef.current;
    const focusable = container?.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR);
    (focusable?.[0] ?? container)?.focus();

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        onCloseRef.current();
        return;
      }
      if (event.key !== "Tab" || !container) {
        return;
      }
      const focusables = Array.from(container.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR));
      if (focusables.length === 0) {
        return;
      }
      const first = focusables[0];
      const last = focusables[focusables.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last?.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first?.focus();
      }
    }

    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      previouslyFocused.current?.focus();
    };
  }, [isOpen, onClose]);

  return containerRef;
}

export interface DrawerProps {
  readonly isOpen: boolean;
  readonly onClose: () => void;
  readonly title: string;
  readonly children: ReactNode;
}

/** A right-edge side panel (design system §5.5 `drawerWidth`) — used for notifications, record detail, filters. */
export function Drawer({ isOpen, onClose, title, children }: DrawerProps): ReactNode {
  const titleId = useId();
  const containerRef = useDialogBehavior(isOpen, onClose);

  if (!isOpen) {
    return null;
  }

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        background: "rgb(15 23 42 / 0.4)",
        zIndex: zIndexTokens.overlay,
      }}
      onClick={onClose}
    >
      <div
        ref={containerRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
        onClick={(event) => event.stopPropagation()}
        style={{
          position: "fixed",
          insetBlock: 0,
          insetInlineEnd: 0,
          width: `min(90vw, ${layoutTokens.drawerWidth})`,
          background: colorTokens.surfaceRaised,
          boxShadow: shadowTokens.lg,
          display: "flex",
          flexDirection: "column",
          zIndex: zIndexTokens.modal,
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: spacingTokens.md,
            borderBottom: `${borderTokens.widthThin} solid ${colorTokens.border}`,
          }}
        >
          <h2
            id={titleId}
            style={{
              margin: 0,
              fontSize: typographyTokens.fontSizeLg,
              fontWeight: typographyTokens.fontWeightSemibold,
            }}
          >
            {title}
          </h2>
          <button
            type="button"
            aria-label="Close"
            onClick={onClose}
            style={{
              background: "none",
              border: "none",
              cursor: "pointer",
              fontSize: typographyTokens.fontSizeLg,
              color: colorTokens.foregroundMuted,
            }}
          >
            ×
          </button>
        </div>
        <div style={{ padding: spacingTokens.md, overflowY: "auto", flex: 1 }}>{children}</div>
      </div>
    </div>
  );
}

export interface ModalProps {
  readonly isOpen: boolean;
  readonly onClose: () => void;
  readonly title: string;
  readonly children: ReactNode;
  readonly footer?: ReactNode;
}

/** A centered dialog — for confirmations and short focused tasks, not full pages. */
export function Modal({ isOpen, onClose, title, children, footer }: ModalProps): ReactNode {
  const titleId = useId();
  const containerRef = useDialogBehavior(isOpen, onClose);

  if (!isOpen) {
    return null;
  }

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "rgb(15 23 42 / 0.4)",
        zIndex: zIndexTokens.overlay,
        padding: spacingTokens.md,
      }}
      onClick={onClose}
    >
      <div
        ref={containerRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
        onClick={(event) => event.stopPropagation()}
        style={{
          width: "min(90vw, 32rem)",
          background: colorTokens.surfaceRaised,
          borderRadius: radiusTokens.md,
          boxShadow: shadowTokens.lg,
          zIndex: zIndexTokens.modal,
        }}
      >
        <div style={{ padding: spacingTokens.lg }}>
          <h2
            id={titleId}
            style={{
              margin: 0,
              marginBottom: spacingTokens.md,
              fontSize: typographyTokens.fontSizeLg,
              fontWeight: typographyTokens.fontWeightSemibold,
            }}
          >
            {title}
          </h2>
          {children}
        </div>
        {footer ? (
          <div
            style={{
              display: "flex",
              justifyContent: "flex-end",
              gap: spacingTokens.sm,
              padding: spacingTokens.lg,
              borderTop: `${borderTokens.widthThin} solid ${colorTokens.border}`,
            }}
          >
            {footer}
          </div>
        ) : null}
      </div>
    </div>
  );
}

export interface TooltipProps {
  readonly label: string;
  readonly children: ReactNode;
}

/** Shown on hover AND keyboard focus (never hover-only, per `14-accessibility-requirements.md`). */
export function Tooltip({ label, children }: TooltipProps): ReactNode {
  const [isVisible, setIsVisible] = useState(false);
  const tooltipId = useId();

  return (
    <span
      style={{ position: "relative", display: "inline-flex" }}
      onMouseEnter={() => setIsVisible(true)}
      onMouseLeave={() => setIsVisible(false)}
      onFocus={() => setIsVisible(true)}
      onBlur={() => setIsVisible(false)}
    >
      <span aria-describedby={isVisible ? tooltipId : undefined}>{children}</span>
      {isVisible ? (
        <span
          id={tooltipId}
          role="tooltip"
          style={{
            position: "absolute",
            bottom: "calc(100% + 0.375rem)",
            left: "50%",
            transform: "translateX(-50%)",
            whiteSpace: "nowrap",
            padding: `${spacingTokens.xs} ${spacingTokens.sm}`,
            borderRadius: radiusTokens.sm,
            background: colorTokens.primary,
            color: colorTokens.primaryForeground,
            fontSize: typographyTokens.fontSizeXs,
            zIndex: zIndexTokens.dropdown,
          }}
        >
          {label}
        </span>
      ) : null}
    </span>
  );
}

export interface DropdownItem {
  readonly id: string;
  readonly label: string;
  readonly onSelect: () => void;
}

export interface DropdownProps {
  readonly trigger: ReactNode;
  readonly triggerLabel: string;
  readonly items: readonly DropdownItem[];
  /** Optional non-interactive content (e.g. the signed-in user's email) rendered above `items`. */
  readonly header?: ReactNode;
}

/** A `button` + `menu` pattern (e.g. the header user-menu) — closes on Escape, item selection, or outside click. */
export function Dropdown({ trigger, triggerLabel, items, header }: DropdownProps): ReactNode {
  const [isOpen, setIsOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement | null>(null);
  const menuId = useId();

  useEffect(() => {
    if (!isOpen) {
      return;
    }
    function handlePointerDown(event: PointerEvent) {
      if (rootRef.current && !rootRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setIsOpen(false);
      }
    }
    document.addEventListener("pointerdown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [isOpen]);

  return (
    <div ref={rootRef} style={{ position: "relative", display: "inline-flex" }}>
      <button
        type="button"
        aria-haspopup="menu"
        aria-expanded={isOpen}
        aria-controls={menuId}
        aria-label={triggerLabel}
        onClick={() => setIsOpen((open) => !open)}
        style={{
          background: "none",
          border: "none",
          cursor: "pointer",
          padding: 0,
          display: "inline-flex",
        }}
      >
        {trigger}
      </button>
      {isOpen ? (
        <ul
          id={menuId}
          role="menu"
          aria-label={triggerLabel}
          style={{
            position: "absolute",
            insetInlineEnd: 0,
            top: "calc(100% + 0.25rem)",
            minWidth: "12rem",
            margin: 0,
            padding: spacingTokens.xs,
            listStyle: "none",
            background: colorTokens.surfaceRaised,
            border: `${borderTokens.widthThin} solid ${colorTokens.border}`,
            borderRadius: radiusTokens.sm,
            boxShadow: shadowTokens.md,
            zIndex: zIndexTokens.dropdown,
          }}
        >
          {header ? (
            <li
              role="none"
              style={{
                padding: spacingTokens.sm,
                borderBottom: `${borderTokens.widthThin} solid ${colorTokens.border}`,
                marginBottom: spacingTokens.xs,
              }}
            >
              {header}
            </li>
          ) : null}
          {items.map((item) => (
            <li key={item.id} role="none">
              <button
                type="button"
                role="menuitem"
                onClick={() => {
                  item.onSelect();
                  setIsOpen(false);
                }}
                style={{
                  width: "100%",
                  textAlign: "left",
                  padding: spacingTokens.sm,
                  background: "none",
                  border: "none",
                  borderRadius: radiusTokens.sm,
                  font: "inherit",
                  fontSize: typographyTokens.fontSizeSm,
                  color: colorTokens.foreground,
                  cursor: "pointer",
                }}
              >
                {item.label}
              </button>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}

export interface CommandMenuItem {
  readonly id: string;
  readonly label: string;
  readonly description?: string;
  readonly onSelect: () => void;
}

export interface CommandMenuProps {
  readonly isOpen: boolean;
  readonly onClose: () => void;
  readonly items: readonly CommandMenuItem[];
  readonly placeholder?: string;
  readonly emptyMessage?: string;
}

/** The `⌘K`/`Ctrl+K` command-palette overlay (header module-only search, design system §4.2) — filters `items` by label as the caller types. */
export function CommandMenu({
  isOpen,
  onClose,
  items,
  placeholder = "Search…",
  emptyMessage = "No matches.",
}: CommandMenuProps): ReactNode {
  const [query, setQuery] = useState("");
  const [activeIndex, setActiveIndex] = useState(0);
  const containerRef = useDialogBehavior(isOpen, onClose);
  const listId = useId();

  useEffect(() => {
    if (isOpen) {
      setQuery("");
      setActiveIndex(0);
    }
  }, [isOpen]);

  if (!isOpen) {
    return null;
  }

  const filtered = items.filter((item) => item.label.toLowerCase().includes(query.toLowerCase()));

  function handleKeyDown(event: ReactKeyboardEvent<HTMLInputElement>) {
    if (event.key === "ArrowDown") {
      event.preventDefault();
      setActiveIndex((index) => Math.min(index + 1, filtered.length - 1));
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      setActiveIndex((index) => Math.max(index - 1, 0));
    } else if (event.key === "Enter") {
      event.preventDefault();
      const item = filtered[activeIndex];
      if (item) {
        item.onSelect();
        onClose();
      }
    }
  }

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        display: "flex",
        justifyContent: "center",
        paddingTop: "10vh",
        background: "rgb(15 23 42 / 0.4)",
        zIndex: zIndexTokens.overlay,
      }}
      onClick={onClose}
    >
      <div
        ref={containerRef}
        role="dialog"
        aria-modal="true"
        aria-label="Search"
        tabIndex={-1}
        onClick={(event) => event.stopPropagation()}
        style={{
          width: "min(90vw, 36rem)",
          height: "fit-content",
          background: colorTokens.surfaceRaised,
          borderRadius: radiusTokens.md,
          boxShadow: shadowTokens.lg,
          zIndex: zIndexTokens.modal,
        }}
      >
        <input
          type="text"
          role="combobox"
          aria-expanded={filtered.length > 0}
          aria-controls={listId}
          aria-autocomplete="list"
          placeholder={placeholder}
          value={query}
          onChange={(event) => {
            setQuery(event.target.value);
            setActiveIndex(0);
          }}
          onKeyDown={handleKeyDown}
          style={{
            width: "100%",
            padding: spacingTokens.md,
            border: "none",
            borderBottom: `${borderTokens.widthThin} solid ${colorTokens.border}`,
            fontSize: typographyTokens.fontSizeMd,
            fontFamily: typographyTokens.fontFamilyBase,
            color: colorTokens.foreground,
            background: "transparent",
          }}
        />
        <ul
          id={listId}
          role="listbox"
          style={{
            margin: 0,
            padding: spacingTokens.xs,
            listStyle: "none",
            maxHeight: "20rem",
            overflowY: "auto",
          }}
        >
          {filtered.length === 0 ? (
            <li
              style={{
                padding: spacingTokens.md,
                color: colorTokens.foregroundMuted,
                fontSize: typographyTokens.fontSizeSm,
              }}
            >
              {emptyMessage}
            </li>
          ) : (
            filtered.map((item, index) => (
              <li key={item.id} role="option" aria-selected={index === activeIndex}>
                <button
                  type="button"
                  onClick={() => {
                    item.onSelect();
                    onClose();
                  }}
                  onMouseEnter={() => setActiveIndex(index)}
                  style={{
                    width: "100%",
                    textAlign: "left",
                    padding: spacingTokens.sm,
                    background: index === activeIndex ? colorTokens.mutedSurface : "none",
                    border: "none",
                    borderRadius: radiusTokens.sm,
                    font: "inherit",
                    color: colorTokens.foreground,
                    cursor: "pointer",
                  }}
                >
                  <div style={{ fontSize: typographyTokens.fontSizeSm }}>{item.label}</div>
                  {item.description ? (
                    <div
                      style={{
                        fontSize: typographyTokens.fontSizeXs,
                        color: colorTokens.foregroundMuted,
                      }}
                    >
                      {item.description}
                    </div>
                  ) : null}
                </button>
              </li>
            ))
          )}
        </ul>
      </div>
    </div>
  );
}
