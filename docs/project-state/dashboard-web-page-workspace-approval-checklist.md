# Approval checklist — `dashboard-web` Page Workspace UI

Branch `dashboard-web-page-workspace` · commits `4f8d87d`, `15555c3`, `cb50a0f`
Task package: `docs/task-packages/dashboard-web-page-workspace.md`
Implementation record: `docs/implementation/dashboard-web-page-workspace.md`

## Preconditions

| Item                                   | Status | Evidence                                                            |
| -------------------------------------- | ------ | ------------------------------------------------------------------- |
| Backend (`module-page-workspace`) live | Yes    | Merged and verified in production 2026-08-26 (PR #67)               |
| Scoping forks confirmed with owner     | Yes    | Four decisions confirmed before code was written (see task package) |

## Independent code review

High effort, 8 finder angles, 1-vote verification. **9 candidates — 8 CONFIRMED, 1 PLAUSIBLE, all
9 fixed.**

| #   | Finding                                                                      | Disposition |
| --- | ---------------------------------------------------------------------------- | ----------- |
| 1   | Every mutation fetched `dashboard-web`'s own origin, not `dashboard-api`     | Fixed       |
| 2   | No `key` prop on the artifact panel — edits could leak across tabs           | Fixed       |
| 3   | `getArtifactVersions()` had no guard, could crash the whole page             | Fixed       |
| 4   | Stale-button race — buttons re-enabled before the refresh landed             | Fixed       |
| 5   | Dead-code ternary unconditionally cleared the resume point                   | Fixed       |
| 6   | Missing project id was a dead-end 404 instead of a picker redirect           | Fixed       |
| 7   | UI omitted a real, backend-supported interrupt-to-interrupt transition       | Fixed       |
| 8   | `useSyncedState()` hook not reused — hand-copied a 6th/7th time              | Fixed       |
| 9   | `saveEdit()` duplicated the shared mutation helper's fetch shape (PLAUSIBLE) | Fixed       |

Finding 1 (missing `getApiBaseUrl()` prefix) was the most severe: every create/edit/status-
transition/reopen/lifecycle action in this module would have failed in production, since
`dashboard-web` and `dashboard-api` are separate origins. Finding 7 was investigated rather than
taken at face value — an existing test asserted the narrower behavior with a comment about not
letting a resume "skip every approval gate"; traced that rationale against the backend's actual
transition table and confirmed it only justifies restricting the resume edge itself, not the
separate lateral interrupt-to-interrupt edges that were missing. Five new regression tests were
added covering the URL-prefix fix, the stale-button-race fix, the reopen-status fix, and the
interrupt-to-interrupt fix.

## Security review

Run separately, after the code-review fixes. **0 findings at or above the reporting threshold.**

Cleared: no `dangerouslySetInnerHTML` anywhere in this diff (rich text arrives as an opaque,
server-rendered `ReactNode`, matching the established `SanitizedRichText` boundary convention);
the one `redirect()` call targets a fixed literal, not user input (no open redirect); every
mutating fetch URL is built from route/query params and already-fetched backend data, with
`content`/`notes`/`reason` sent only as JSON body values, never interpolated into a URL; the new
`isUuid()` guard is a hardening, not a regression; `postMutation()`'s new `method` parameter is a
compile-time-only union; and all real authorization enforcement stays server-side in
`dashboard-api` — the client-side transition mirrors are explicitly documented as advisory only.

## Validation

| Check                      | Result    | Notes                                                                     |
| -------------------------- | --------- | ------------------------------------------------------------------------- |
| `dashboard-web` unit tests | 831 / 831 | 72 files; 5 new regression tests from the fix round                       |
| `pnpm build`               | 9 / 9     | `/page-workspace` and `/page-workspace/[pageId]` emitted                  |
| Typecheck                  | clean     | both apps                                                                 |
| Lint                       | clean     | `--max-warnings=0`, includes CSS token check                              |
| `prettier --check`         | clean     |                                                                           |
| Live browser render        | clean     | both new routes redirect unauthenticated cleanly, 0 console/server errors |

No local `dashboard-api` exists in this environment, so the authenticated success-path rendering
(the artifact panel, the stepper) was not visually confirmed — the same limitation several prior
`dashboard-web` slices in this codebase have already noted for themselves; unlike the sibling
backend module (`module-page-workspace`), this is a `dashboard-web`-only branch with no database
integration/e2e suite of its own to run.

## Sign-off — required second-role human review

Per ADR-0010 the implementing agent cannot also be its own reviewer. Review packet published as
a Claude artifact: <https://claude.ai/code/artifact/d913fd84-e7ec-493d-9881-2aca474a557d>

| Field    | Value   |
| -------- | ------- |
| Reviewer | —       |
| Decision | Pending |
| Date     | —       |

## Gate

Not yet requested. A gate decision is separate from the second-role review above, and neither
authorizes pushing the branch, opening a PR, or merging — each remains its own explicit step,
per this project's standing no-auto-merge rule.
