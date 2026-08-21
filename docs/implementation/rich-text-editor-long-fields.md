# Rich-text editor rollout — Service Library (7 fields) + Projects (`description`) (as-built)

**Status:** Built, fully validated, live-verified end-to-end against a real local database, not
yet reviewed, gated, or merged. Branch `rich-text-editor-long-fields`, off `main` at the commit
recording PR #48's merge as live in production.

## 1. Why this exists, and its scope

Requested directly ("use the rich html editor in place of the text area please change at every
place"). Before starting, surveyed every plain `<textarea>` in `apps/dashboard-web/components/` —
15 sites across 6 files (Service Library's 7 Positioning fields; Projects' `description` plus its
Objectives/Repositories/Environments sub-resource "description"/"notes" fields; Business Knowledge
Center's `notes`, which already sits alongside an existing `RichTextEditor` field, `content`) —
and flagged that switching editors also means real backend changes: neither Service Library's nor
Projects' DTOs/services sanitize HTML today (Business Knowledge Center's own `content` field is
the only precedent, with a dedicated write-time + render-time sanitization boundary).

Two scope questions were put to the user directly (`AskUserQuestion`) rather than guessed:

1. **Which fields switch?** Chosen: Service Library's **all 7** Positioning fields (no clear
   "primary content vs. secondary notes" split exists among them, unlike Business Knowledge
   Center's own two-field precedent) plus Projects' **`description` only** — its own sub-resource
   fields (Objectives/Repositories/Environments) stay plain text, matching the "primary record
   field switches, short annotation fields on sub-resources don't" rule the user's answer implied.
2. **Backend sanitization in this same pass?** Chosen: **yes** — mirror Business Knowledge
   Center's pattern exactly (sanitize on write, sanitize again on render, raise max-length
   constants for markup overhead) rather than shipping a frontend-only change that would persist
   unsanitized HTML with only a length cap.

## 2. What changed

### Frontend — Service Library (`apps/dashboard-web/components/service-library-form.tsx`)

All 7 `<textarea>` elements (`shortPublicDescription`/`audience`/`problems`/`capabilities`/
`outcomes`/`exclusions`/`internalDescription`) replaced with `<RichTextEditor>` (the existing
Tiptap-based component Business Knowledge Center's own `content` field already uses — no new
component built). `LONG_TEXT_MAX_LENGTH` raised `20_000` → `40_000` (2×, matching the ratio
Business Knowledge Center's own `CONTENT_MAX_LENGTH` raise used for the same "HTML carries real
markup overhead" reason). `textField()`'s empty-check now also treats Tiptap's own
"nothing typed" output (`"<p></p>"`) as empty, alongside `""`. Since `RichTextEditor` is a
contentEditable div with no native `maxLength` attribute, a length check for all 7 fields now runs
once, explicitly, at submit time (mirroring Business Knowledge Center's own `CONTENT_MAX_LENGTH`
check). The now-unused `.textarea` CSS Module composition was removed from
`service-library-form.module.css`.

### Frontend — Service Library detail page

`TextBlock` (used by all 7 fields) now renders via `dangerouslySetInnerHTML` +
`sanitizeRenderedHtml()` instead of a plain-text `<p>` with `whiteSpace: pre-wrap` — the same
render-time defense-in-depth pattern Business Knowledge Center's own detail page already
establishes for `content`.

### Backend — Service Library (`apps/dashboard-api/src/service-library/`)

`service-library.dto.ts`'s `LONG_TEXT_MAX_LENGTH` raised to `40_000` to match the frontend.
`services.service.ts` gained `sanitizeLongTextField()` (mirroring
`sanitize-html.util.ts`'s own `sanitizeContentOrNull()` pattern), wired into both `create()` and
`update()` for all 7 fields — `null`/`undefined` pass through unchanged (preserving the fields'
existing three-way nullish semantics), a real string is sanitized against the shared
`@webdesk/validation` `sanitizeRichTextHtml()` allowlist before being written.

### Frontend — Projects (`apps/dashboard-web/components/project-form.tsx`)

`description`'s `<textarea>` replaced with `<RichTextEditor>`. `DESCRIPTION_MAX_LENGTH` raised
`10_000` → `20_000`. The field's own established "sent as-is, never coerced to null" convention
needed no change — the rich-text editor's own empty output (`"<p></p>"`) is just sent verbatim,
same as an empty string always was; a length check was added at submit time (no native `maxLength`
on a contentEditable div). The now-unused `.textarea` CSS Module composition was removed from
`project-form.module.css`.

### Frontend — Project detail page

The `description` render site switched to `dangerouslySetInnerHTML` + `sanitizeRenderedHtml()`,
same pattern as Service Library's detail page above. `descriptionStyle` needed no change (it
already had no `whiteSpace: pre-wrap` to remove).

### Backend — Projects (`apps/dashboard-api/src/projects/`)

`projects.dto.ts`'s `description` max length raised `10_000` → `20_000` (extracted into a named
`DESCRIPTION_MAX_LENGTH` constant, previously an inline literal repeated on both
`createProjectSchema` and `updateProjectSchema`). `project.service.ts` gained the identical
`sanitizeLongTextField()` helper, wired into `create()`/`update()` for `description` only — the
Objectives/Repositories/Environments services are untouched, since their own
"description"/"notes" fields stay plain text per the scope decision above.

## 3. Test conventions (new for this codebase)

Two real test-writing lessons, both discovered while updating `project-form.test.tsx`'s existing
tests (which had, until now, only ever exercised plain `<textarea>`/`<input>` fields):

- **`RichTextEditor` is a Tiptap contentEditable `<div>`, not a real form control** —
  `fireEvent.change(...)` and `toHaveValue()` don't apply to it. Matches
  `business-knowledge-record-form.test.tsx`'s own established precedent: never simulate typing
  into a `RichTextEditor` field via `fireEvent.change`; verify its content only via the `initial`
  prop (`screen.getByText(...)`, optionally wrapped in `await waitFor(...)` since Tiptap sets
  content via its own `useEffect`) or via structural checks
  (`document.querySelectorAll('[contenteditable="true"]')`).
- Two `project-form.test.tsx` tests that previously typed a value into the `description`
  `<textarea>` and asserted on it were rewritten: one to stop asserting the typed value (renamed,
  the empty-description case it now covers is already tested elsewhere), one to assert the loaded
  content via `getByText` instead of `toHaveValue`.

New tests added, none of which attempt to simulate typing (matching the established limitation
above): a "renders N contenteditable divs, 0 textareas" structural check for each form; a "the
initial HTML content of an edit-mode rich field renders correctly" check for Service Library;
backend unit tests (one for `create()`, one for `update()`, in both `services.service.spec.ts` and
`project.service.spec.ts`) proving a disallowed tag (`<script>`, `<img onerror=...>`) is stripped
before the value reaches the repository layer, while `null`/`undefined` still pass through
unchanged.

Deliberately **not** tested: the new submit-time max-length rejection path (`LONG_TEXT_MAX_LENGTH`/
`DESCRIPTION_MAX_LENGTH` exceeded) — reliably typing 40,000+ characters into a Tiptap
contentEditable region via jsdom's `fireEvent` isn't practical, and `business-knowledge-record-
form.test.tsx` doesn't test its own equivalent `CONTENT_MAX_LENGTH` path either; this branch
follows that same established, accepted gap rather than forcing a fragile test.

## 4. Validation

- 465/465 `dashboard-api` unit tests (4 new — 2 in `services.service.spec.ts`, 2 in
  `project.service.spec.ts`), 153/153 `dashboard-api` e2e/integration tests (unchanged — no new
  e2e coverage added; the sanitization wiring is proven at the unit level and, separately, via the
  live end-to-end verification below).
- 311/311 `dashboard-web` unit tests (3 new: one structural "7 contenteditable, 0 textarea" check
  for `ServiceLibraryForm`, one "initial rich-text content loads" check for `ServiceLibraryForm`,
  one structural "1 contenteditable, 0 textarea" check for `ProjectForm`).
- typecheck/lint/`check-css-tokens.mjs`/`next build`/prettier all clean across `dashboard-api` and
  `dashboard-web`.

## 5. Live end-to-end verification (not just typecheck/build/tests)

Unlike most prior slices in this session (which noted "no local `dashboard-api` was available in
this environment" as a real, accepted limitation), this one stood up a genuinely live local stack
against the project's existing disposable-database convention
(`packages/database/README.md`'s `webdesk_phase1b_dev`) — both `dashboard-web` (`next dev`, with
`PLAYWRIGHT_E2E_TEST_MODE=1` for the shell-level session bypass) and `dashboard-api` (`nest start`,
`DATABASE_URL` pointed at the same disposable database, all 51 migrations applied) running
locally, plus a real provisioned Super Admin user and a real minted `wds_session` cookie (via
`SessionService`'s own `issue()` logic, replicated in a throwaway script, deleted immediately
after use — never committed).

Confirmed live in the Browser pane:

- **Service Library create form**: all 7 fields render as real Tiptap editors with a working
  toolbar (screenshot + `read_page` accessibility-tree confirmation — each exposed as
  `textbox "<Label>"`, correctly labeled). The "no categories yet" warning (finding 1 from the
  earlier code-review round) rendered correctly against a genuinely empty `service_categories`
  table, then disappeared once a real category row was inserted.
- **Typing and formatting genuinely works**: clicking into a field and typing produced real DOM
  output (`<p>Fast, reliable headless commerce.</p>`); selecting text and clicking the Bold
  toolbar button produced `<p><strong>...</strong></p>` — proving the editor is truly interactive,
  not just visually present.
- **The full round trip, live, through the real backend**: submitted a real create request
  (`canonicalName`/`categoryId`/a bold-formatted `shortPublicDescription`) — the app redirected to
  the new service's real detail page, which rendered `<strong>Fast reliable commerce</strong>` as
  genuinely bold text (confirmed via `document.querySelectorAll('strong')`), proving the value
  survived `services.service.ts`'s write-time sanitization, was persisted, re-fetched, and
  rendered correctly through `sanitizeRenderedHtml()` + `dangerouslySetInnerHTML` on the detail
  page.
- **The same full round trip repeated for Projects**: created a real project with a
  `RichTextEditor`-authored description; the detail page rendered it correctly.
- **Zero new console/server errors** across the whole flow (the one error visible in the console
  buffer throughout was a single stale entry from the very first request attempt, made before
  `dashboard-api` was started locally — confirmed by its unchanged `digest` value across every
  later check, not a new occurrence).

All local infrastructure (both dev servers, the disposable database's temporary
`service_categories` test row) was for verification purposes only — no production or shared
system was touched, and the throwaway session-minting script was deleted immediately after use,
never committed.
