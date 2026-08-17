# @webdesk/ui

Design tokens and shared React components for `dashboard-web`. Framework-agnostic (no Next.js
dependency) — components that render internal links accept an optional `linkComponent` prop so
`dashboard-web` can inject `next/link`; a plain `<a>` is the default.

No Storybook — this file is the component reference, kept next to the code it documents. Every
component listed here has a matching `*.test.tsx` file demonstrating real usage; read that test
file for the exact prop shapes if this summary isn't enough.

## Tokens

Import from `@webdesk/ui`: `colorTokens`, `typographyTokens`, `spacingTokens`, `layoutTokens`,
`borderTokens`, `radiusTokens`, `shadowTokens`, `statusTokens` (system/integration health),
`statusBadgeTokens` (business-record/workflow status — 5 buckets: `healthy` / `attention` /
`blocked` / `informational` / `neutral`, each `{text, background, dot}`), `controlSizeTokens`,
`breakpointTokens`, `zIndexTokens`, `motionTokens`. Never hardcode a literal color/spacing/size
value in a new component or page — import the token instead, so a future palette or scale change
propagates everywhere at once.

`toCssCustomProperties()` flattens every flat token group into `--webdesk-dashboard-*` CSS custom
properties — `dashboard-web`'s root layout calls this once; CSS Modules reference the result
(`var(--webdesk-dashboard-color-accent)`, etc.). `controlSizeTokens` and `statusBadgeTokens` are
nested objects, meant for direct JS/inline-style consumption, and are deliberately excluded from
the flattened output.

`@media` breakpoints and `transition`/`animation` durations can't reference CSS custom properties,
so `dashboard-web`'s `pnpm lint` runs `scripts/check-css-tokens.mjs` after ESLint — it fails the
build if any `.module.css` file hardcodes a breakpoint or duration that doesn't match
`breakpointTokens`/`motionTokens`'s own values. Use the token's literal value in CSS, and keep the
check script's own literal lists in sync if a token value ever changes.

## Page-shell components (`page-shell.tsx`)

- `Breadcrumbs` — a `<nav aria-label="Breadcrumb">` list; last item gets `aria-current="page"`.
- `PageHeader` — the standard title + breadcrumbs + status badge + context-actions row every page
  archetype uses.
- `StatusBadge` — a dot + label using `statusTokens` (system/integration health). For a business
  record's status, use `Badge` (below) with `statusBadgeTokens` instead.
- `ContentContainer` — the standard max-width content wrapper.
- `FiltersBar` — an empty layout shell for a page's own filter controls.

## UI states (`states.tsx`)

`LoadingState`, `EmptyState`, `ErrorState`, `ForbiddenState`, `NotFoundState`,
`NotConfiguredState`, `DegradedState`, `BlockedState`, `FeatureUnavailableState` — real, accessible
landmarks (`role="status"`/`role="alert"` where appropriate) instead of a bare spinner or blank
screen. `FeatureUnavailableState` shows the module registry's real `implementation_status` string —
never a fabricated placeholder.

## Core controls (`controls.tsx`)

`Button` (variants: `primary`/`secondary`/`danger`/`ghost`), `IconButton` (mandatory `label` —
never a bare icon with no accessible name), `AppLink` (styled navigation link, distinct from
`Button`), `Input`, `Textarea`, `Select` (native, supports `multiple`), `Checkbox`, `RadioGroup`,
`Toggle` (`role="switch"`, for immediate-effect settings — not a form-submission `Checkbox`),
`DateField` (native date input). `FieldWrapper` is the shared label/hint/error scaffold `Input`/
`Textarea`/`Select`/`DateField` all render through — reuse it directly only if building a new field
type these don't cover.

## Structural (`structural.tsx`)

- `Badge` — the real business-record/workflow status badge, driven by `statusBadgeTokens`. Map
  every real status name from the approved workflow-state-machine docs to one of the 5 buckets;
  never invent a status.
- `Avatar` — initials only (no photo-avatar capability exists anywhere in this app yet).
- `Card` — the standard raised content container.
- `Table` — generic, typed (`Table<Row>`); sortable headers are real `<button>`s, never a bare
  clickable label.
- `Tabs` — full WAI-ARIA pattern (roving tabindex, Left/Right/Home/End keyboard navigation).
- `Accordion` — a disclosure pattern (`aria-expanded` + `hidden` panel per item), not a full
  WAI-ARIA Accordion widget.
- `Pagination` — Previous/Next, matches the offset-pagination pattern the Projects list page
  already uses.

## Navigation/overlay (`overlay.tsx`)

`Drawer`, `Modal`, `Dropdown`, `Tooltip`, `CommandMenu`. `Drawer` and `Modal` are real dialogs:
focus-trapped, close on `Escape`, restore focus to the triggering element on close. `Tooltip` shows
on hover **and** keyboard focus, never hover-only. `Dropdown` accepts an optional `header` for
non-interactive content (e.g. an email address) above its action items. `CommandMenu` is the
`⌘K`/`Ctrl+K` module-search overlay pattern — filters a flat `items` list by label.

## Feedback (`feedback.tsx`)

- `Alert` — a page-level banner for a condition needing attention (`info`/`warning`/`danger`/
  `success`). Not for routine status (`Badge`) or transient confirmation (`Toast`).
- `ToastProvider` / `useToast()` — wrap a subtree once; `showToast(message, variant?)` fires a
  transient, auto-dismissing confirmation. Never use for an error that requires the user to read
  and act — that's `Alert`'s job.
- `Progress` — determinate/indeterminate bar, scoped narrowly to the 5 pipeline-shaped modules'
  detail pages (Ready for Claude Queue, Scan Center, Change Center, Release Center, Review &
  Approval Center). Not a generic loading indicator — that's `LoadingState`.
- `Timeline` — the human-friendly Activity view ("Created → Edited → Submitted → Approved"),
  distinct from the full audit log.
- `VersionIndicator` — the current/draft/previous affordance every versioned record needs.

## Domain-specific (`domain.tsx`)

- `ApprovalBlock` — the single reusable approval surface (current/proposed version, submitter,
  reviewer, required approver(s), status, comments, date, collapsed previous-approvals list,
  Approve/Request Revision/Reject actions). Reused identically by the Review & Approval Center, the
  Design Review Center, and any module's own inline submit-for-review flow — do not build a
  module-specific variant.
- `DiffViewer` — field-level before/after diff on a structured record. Not a code-diff renderer
  (source-code review happens in GitHub, referenced by link, not re-rendered here).
- `FileAttachment` — references an asset (Vercel Blob); never uploads/stores here. Pass
  `href: null` and `restrictedMessage` for a confidential-field-aware locked state.
- `RelationshipPicker` — search-and-select for one record referencing another; returns a
  lightweight `{id, displayName}` reference, not the full related record.
- `Stepper` — scoped to Release Center, Page Workspace, and similar explicitly staged workflows.
  Never a generic status replacement.
- `Code` — the mono-font inline-text convention (`<Code>{value}</Code>`) instead of ad hoc
  `style={{fontFamily: ...}}` at each call site.

## Conventions for new components

- Every color/spacing/size value comes from a token — never a hardcoded literal.
- Interactive components needing `useState`/`useEffect`/`useRef`/`useContext` need a `"use client"`
  directive at the top of the file (Next.js's RSC compiler enforces this on every module it
  imports, not just the app's own files) — `controls.tsx` has none of these hooks and is
  deliberately server-renderable; the other component files do and are marked accordingly.
- A dialog-like surface (anything modal/blocking) must trap focus, close on `Escape`, and restore
  focus on close — see `overlay.tsx`'s shared `useDialogBehavior` hook.
- Status is encoded in form (icon/dot + label text) as well as color — never color alone.
- Verify new text/background color pairs against WCAG AA (4.5:1 for normal text, 3:1 for large
  text/UI components) before shipping — several pre-existing token pairs failed this when first
  checked against a real rendered page (see `docs/implementation/dashboard-ui-foundation-alignment.md`).
