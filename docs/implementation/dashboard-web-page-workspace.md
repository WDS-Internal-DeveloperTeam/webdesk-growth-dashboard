# `dashboard-web` Page Workspace UI — as-built status

> **Handoff record, 2026-08-26**, work paused mid-slice to continue on another machine, **updated
> 2026-08-27** once verification was completed on the new machine. This records exactly what is
> built, what is verified, and what remains.
> Task package: `docs/task-packages/dashboard-web-page-workspace.md`.

Branch: `dashboard-web-page-workspace` (off `main` at `e1953c6`). Code-reviewed (9 findings, all
fixed), security-reviewed (0 findings above threshold), required second-role human reviewed
(Jitesh D, "Approved"), gated (`G4-dashboard-web-page-workspace`, WebDesk Solution, CONFIRM),
merged as [PR #68](https://github.com/WDS-Internal-DeveloperTeam/webdesk-growth-dashboard/pull/68)
(merge commit `6a7f4889139e54883364c9c3bce833734d45abe3`), and verified live in production
2026-08-27 — `dashboard-api`'s `/health` returned `build.commitShaShort == 6a7f488`, confirming the
exact merged commit is what's serving, and `dashboard-web`'s `/page-workspace` resolves (307) to
`/auth/sign-in` for an unauthenticated visitor, confirming the session gate is intact. **The
Page Workspace UI is now genuinely live in production**, closing out this slice's full
build-to-production arc — backend and now the full UI (project picker, artifact panel across all
15 tabs, lifecycle actions, version history, an "Open workspace" link from Page Inventory) are
both live.

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

## Verification status

**Fully re-verified 2026-08-27**, not trusted from the pre-CSS-fix numbers the branch was paused
with — every check below was re-run fresh on this machine.

| Check                      | State                                                                                                                                         |
| -------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------- |
| Typecheck (both apps)      | Clean                                                                                                                                         |
| `pnpm build`               | 9/9, with `/page-workspace` and `/page-workspace/[pageId]` emitted                                                                            |
| `dashboard-web` unit tests | 826/826 passed (831/831 after the code-review fix round below)                                                                                |
| Lint                       | Clean                                                                                                                                         |
| `prettier --check`         | 1 file fixed (`lib/page-workspace.ts`, whitespace-only — never checked on this branch before)                                                 |
| Live browser render        | `/page-workspace` and `/page-workspace/[pageId]` both redirect an unauthenticated visitor to `/auth/sign-in` cleanly, 0 console/server errors |

No local `dashboard-api` exists in this environment, so the authenticated success-path rendering
(the artifact panel, the stepper) was not visually confirmed — the same limitation several prior
slices in this codebase have already noted for themselves.

## Two environment gotchas worth knowing

Both cost real time here and neither is caught by typecheck:

1. **`vitest.config.mts` includes only `tests/unit/**/*.test.tsx`.** A `.test.ts` file is silently
   ignored — it does not fail, it simply never runs. The first version of
   `page-workspace-query.test` was written as `.ts` and reported "No test files found".
2. **CSS Modules' `composes` only works on a simple class selector.** `.actions button { composes:
... }` is a descendant selector and makes Turbopack fail the whole build with an internal panic.
   Lint does not catch it, and neither does `check-css-tokens.mjs`; only `next build` does. Fixed by
   giving the buttons their own `.actionButton` class and applying it in the components.

## Independent code review — 2026-08-27

This project's own `code-review` skill ran at high effort (8 finder angles, 1-vote verification)
against the full branch diff. 9 candidates survived dedup and verification — 8 CONFIRMED, 1
PLAUSIBLE — and **all 9 were fixed** the same session.

Most severe, and a genuine showstopper: every mutation in the module (`page-artifact-panel.tsx`,
`page-lifecycle-actions.tsx`) fetched a bare relative path instead of prefixing it with
`getApiBaseUrl()` — the only two mutating components in the entire app that didn't. Since
`dashboard-web` and `dashboard-api` are separate origins in production, every create/edit/status-
transition/reopen/lifecycle action would have 404'd against `dashboard-web`'s own deployment.
Fixed, alongside promoting the module's base-path template (previously hardcoded independently in
three places) into a single shared `workspaceApiPath()` export in `lib/page-workspace-query.ts`.

Also fixed:

- **No `key` prop on `<PageArtifactPanel>`** — switching tabs didn't remount the client component,
  so `editing`/`content`/`notes` state from the previously-open tab survived into the newly-
  selected one; saving could silently overwrite the wrong artifact/version with stale text.
- **`getArtifactVersions()` had no `isUuid()` guard and threw unconditionally on any non-OK
  response**, unlike its two sibling functions in the same file — a transient 500 crashed the
  entire workspace route. Now guards and degrades to `[]` on a malformed id or 404, and the call
  site in `[pageId]/page.tsx` wraps the remaining throw path in a try/catch, logging and degrading
  to an empty version list instead of crashing.
- **Stale-button race in `PageArtifactPanel`'s `run()`** — busy cleared and editing reset
  synchronously, before the un-awaited `router.refresh()` delivered fresh data, while the button
  set was derived from the still-stale `currentVersion` prop. `PageLifecycleActions` (the sibling
  component in the same PR) already avoided this via a local mirror; `PageArtifactPanel` now does
  too, via a `currentStatus` mirror updated from the known target value on a successful
  `changeStatus()`/`reopen()`.
- **`moveTo()`'s `setCurrentPrevious` ternary was dead code** — it compared the transition target
  against the stale pre-transition `currentStage`, which no legal transition ever equals, so
  `currentPrevious` was unconditionally cleared to `null` after every move. Fixed to mirror the
  backend's own `nextPreviousStage()`: carry the existing resume point forward across an interrupt-
  to-interrupt chain, or capture the stage just left when entering an interrupt from the main path.
- **Missing `projectId` called `notFound()`** (a dead end) instead of redirecting to
  `/page-workspace`'s own project picker, unlike the identical case in the sibling Page Inventory
  module. Fixed to match.
- **`allowedLifecycleTargets()` never offered a direct move between two interrupt stages**
  (e.g. `blocked` → `paused`), even though the backend's own `LIFECYCLE_TRANSITIONS`/
  `RESUME_OR_ARCHIVE` explicitly supports it ("a paused page that then becomes blocked is a real
  situation"). The existing frontend test asserted the narrower behavior with a comment about not
  letting a resume "skip every approval gate" — traced that rationale and confirmed it only
  justifies restricting the RESUME edge itself (must go back to `previousStage`, never an arbitrary
  main-path stage), not omitting the separate lateral interrupt-to-interrupt edges. Fixed to offer
  every other interrupt target directly, matching the backend exactly; both affected tests updated.
- **`useSyncedState()` not reused** — `page-lifecycle-actions.tsx` hand-rolled the identical
  `useState`+`useEffect` resync pattern the hook (`lib/use-synced-state.ts`, already on `main`
  before this branch started) exists specifically to stop being copied a 6th/7th time. Now uses it.
- **`saveEdit()` duplicated `postMutation()`'s fetch/error-handling shape** (PLAUSIBLE — real but
  smaller than initially reported, since it did already reuse `parseApiErrorMessage()`) because
  `postMutation()` hardcoded `method: "POST"` and this is the app's only `PATCH` call site. Fixed
  by giving `postMutation()` an optional `method` parameter instead.

Re-validated after every fix: 831/831 `dashboard-web` unit tests (5 new regression tests covering
the URL-prefix fix, the stale-button-race fix, the reopen-status fix, and the interrupt-to-
interrupt fix), typecheck/lint/`prettier --check`/`next build` all clean, and both new routes
re-confirmed live-rendering with a clean unauthenticated redirect and zero console/server errors.

## Security review — 2026-08-27

A separate `security-review` skill run then found **0 findings above threshold**. Checked and
ruled out: no `dangerouslySetInnerHTML` anywhere in this diff (`PageArtifactPanel` receives
`readView` as an opaque, server-rendered `ReactNode`, matching the established `SanitizedRichText`
boundary convention exactly); the one `redirect()` call targets a fixed literal, not user input (no
open redirect); every mutating `fetch()` URL is built from `workspaceApiPath()` plus fixed
suffixes, with `projectId`/`pageId` sourced from route/query params and `artifact.id`/
`currentVersion.id` from already-fetched backend data — nothing attacker-controlled reaches a URL
segment unexpectedly, and `content`/`notes`/`reason` are sent only as JSON body values, never
interpolated into a URL; `getArtifactVersions()`'s new `isUuid()` guard is a hardening, not a
regression; `postMutation()`'s new `method` parameter is a compile-time-only union, not
attacker-influenceable; and all real authorization enforcement stays server-side in
`dashboard-api` — the client-side transition mirrors are explicitly documented as advisory only.

## Deliberately not built

- **Compare Version** (D3). The wireframe names it and `packages/ui` has a real `DiffViewer`, so
  unlike most deferrals this one is genuinely buildable — versions carry real content. Deferred as
  scope, not as a limitation.
- **Comments, related records, owner, required approvers.** All appear in the wireframe; none is
  backed by any column this module owns. See task package §3.

## Not started

Second-role human review, the gate decision, push/PR, and merge — each its own separate,
not-yet-requested step, per this project's standing discipline.
