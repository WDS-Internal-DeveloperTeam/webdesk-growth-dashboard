# `dashboard-web` Page Workspace UI — as-built status

> **Handoff record, 2026-08-26.** Work paused mid-slice to continue on another machine. This
> records exactly what is built, what is verified, and what the next session should do first.
> Task package: `docs/task-packages/dashboard-web-page-workspace.md`.

Branch: `dashboard-web-page-workspace` (off `main` at `e1953c6`). Not pushed, not reviewed, not
gated, not merged.

## Built

**Data layer**

- `packages/shared-types` — `PageArtifact`, `PageArtifactVersion`, `PageArtifactType`,
  `PageArtifactVersionStatus`, `PageLifecycleStage`. Also closes a real gap: `Page` never carried
  `lifecycleStage`/`lifecyclePreviousStage`, even though the `packages/database` entity gained
  them with migration `00068`.
- `lib/page-workspace-query.ts` — the 16 tabs, stage labels, badge mapping, client-side mirrors of
  both transition tables, and the href builder. Zero non-type imports, so client components can use
  it without dragging `next/headers` into the browser bundle.
- `lib/page-workspace.ts` — server fetches: `getArtifacts()`, `getArtifactVersions()`,
  `getPageLifecycle()`.

**Components**

- `components/page-artifact-panel.tsx` — the single data-driven component behind all 15 artifact
  tabs: create, edit (draft only), status transitions, reopen. Receives the rendered read view as a
  server-produced `ReactNode`, because `SanitizedRichText` wraps `sanitize-html` (Node-only) and
  cannot run inside a `"use client"` component.
- `components/page-lifecycle-actions.tsx` — lifecycle transitions, including the dynamic
  resume-to-`lifecyclePreviousStage` edge.

**Routes**

- `/page-workspace` — project picker plus a page list with lifecycle badges. Deliberately not a
  second Page Inventory: filtering and SEO state stay that module's job.
- `/page-workspace/[pageId]` — the workspace: header, 16-stage stepper (an off-path state renders
  as its own notice rather than being forced onto the linear track, D6), 16 URL-driven tabs, the
  artifact panel, and version history.
- `page-inventory/[pageId]` gained an "Open workspace" link (D4).

**Tests** — 16 query tests, 10 component tests. Cover the transition mirrors, the resume edge,
approved-version immutability, terminal states, and that the read view arrives pre-rendered.

## Verification status — read this before continuing

| Check                      | State                                                              |
| -------------------------- | ------------------------------------------------------------------ |
| Typecheck (both apps)      | Clean                                                              |
| `pnpm build`               | 9/9, with `/page-workspace` and `/page-workspace/[pageId]` emitted |
| `dashboard-web` unit tests | **STALE** — 826/826 passed, but BEFORE the final CSS change        |
| Lint                       | **STALE** — clean, but likewise before that change                 |
| Live browser render        | Not done                                                           |

**First action next session:** re-run `pnpm --filter @webdesk/dashboard-web test` and `pnpm lint`.
The last CSS fix changed both components (see below), and while `pnpm build` did pass afterwards —
which compiles them — the test and lint runs were interrupted before they finished. Do not treat
the 826/826 figure as current.

## Two environment gotchas worth knowing

Both cost real time here and neither is caught by typecheck:

1. **`vitest.config.mts` includes only `tests/unit/**/*.test.tsx`.** A `.test.ts` file is silently
   ignored — it does not fail, it simply never runs. The first version of
   `page-workspace-query.test` was written as `.ts` and reported "No test files found".
2. **CSS Modules' `composes` only works on a simple class selector.** `.actions button { composes:
... }` is a descendant selector and makes Turbopack fail the whole build with an internal panic.
   Lint does not catch it, and neither does `check-css-tokens.mjs`; only `next build` does. Fixed by
   giving the buttons their own `.actionButton` class and applying it in the components.

## Deliberately not built

- **Compare Version** (D3). The wireframe names it and `packages/ui` has a real `DiffViewer`, so
  unlike most deferrals this one is genuinely buildable — versions carry real content. Deferred as
  scope, not as a limitation.
- **Comments, related records, owner, required approvers.** All appear in the wireframe; none is
  backed by any column this module owns. See task package §3.

## Not started

Code review, security review, second-role human review, the gate decision, push/PR, and merge —
each its own separate, not-yet-requested step, per this project's standing discipline.
