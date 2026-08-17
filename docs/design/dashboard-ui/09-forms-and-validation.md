# Forms and Validation

**Status:** Proposed, pending approval. Covers the design prompt's §9 field-type inventory and
validation-state contract, applied consistently across every module's record editor
(`07-page-patterns.md` archetype C).

## 1. Field types and their component (from `06-dashboard-component-system.md`)

| Field type                                                                                       | Component                   | Notes                                                            |
| ------------------------------------------------------------------------------------------------ | --------------------------- | ---------------------------------------------------------------- |
| Text                                                                                             | `Input` (`type="text"`)     |                                                                  |
| Textarea                                                                                         | `Textarea`                  | Auto-growing, internally scrolls past a max height.              |
| Select                                                                                           | `Select`                    | Native-backed.                                                   |
| Multi-select                                                                                     | `Multi-select`              | Tag/chip + listbox.                                              |
| Checkbox                                                                                         | `Checkbox`                  | Independent boolean, saved on form submit.                       |
| Radio                                                                                            | `Radio`                     | Mutually exclusive set, ≤ ~5 options; beyond that, use `Select`. |
| Date                                                                                             | `Date field`                | Native-backed by default.                                        |
| Number                                                                                           | `Input` (`type="number"`)   |                                                                  |
| URL                                                                                              | `Input` (`type="url"`)      | Client-side format validation only; the real security-relevant   |
| scheme restriction (http/https-only, closing the `javascript:` stored-XSS class this project has |
| already fixed once for `ProjectEnvironment.url`) is a **server-side** contract — see §5.         |
| Tags/entities                                                                                    | `Multi-select`              | Same component as multi-select; "entity" fields (e.g. a          |
| Keyword & Entity Library reference) additionally back onto the `Relationship picker` when the    |
| value must resolve to a real record, not a free-text tag.                                        |
| File attachment reference                                                                        | `File attachment` component | Reference-only, per                                              |
| `06-dashboard-component-system.md` §6 — never an in-browser upload-and-store flow built by this  |
| UI layer.                                                                                        |
| Relationships                                                                                    | `Relationship picker`       | Search-and-select, returns `{id, displayName}` only.             |
| Rich/Markdown content                                                                            | `Textarea` (interim)        | Per `06-dashboard-component-system.md` §7 — a full               |
| WYSIWYG editor is deliberately deferred until a specific module names the requirement.           |

## 2. Field states — one contract, every field

Every field component in this system supports the same state set, so a user never has to relearn
what "required" or "confidential" looks like between modules:

- **Label** — always visible, never placeholder-as-label (a well-known accessibility and usability
  anti-pattern — placeholder text disappears the moment a user starts typing, and doesn't meet
  WCAG 2.2's label-in-name requirement reliably).
- **Description/help** — small, muted text below the label, optional.
- **Required** — a small asterisk or "Required" text label next to the field label — never color
  alone (matches the system-wide "never color alone" rule).
- **Validation error** — red border + `dangerSurface`-tinted background + an inline error message
  directly under the field, programmatically associated via `aria-describedby` (a specific,
  currently-unverified accessibility requirement — flagged plainly in
  `14-accessibility-requirements.md` rather than assumed done).
- **Warning** — same treatment as error but `warning`-toned; used for a value that's valid but
  worth double-checking (e.g. a URL that doesn't match the project's configured domain) — distinct
  from a hard validation error, and never blocks submission on its own.
- **Confidential field** — a lock icon + "Restricted" label, per `07-page-patterns.md` archetype
  C: a user without access sees the field exists and is restricted, never that it's silently
  absent, so the record's real shape is never misrepresented by an under-privileged view.
- **Disabled** — visually muted, not interactive, used when a field is conditionally unavailable
  given other field values (not for permission-based restriction — that's Confidential's job).
- **Read-only** — visually distinct from Disabled (no muted/grayed treatment — still reads as
  normal text, just non-editable) — used for fields like Projects' `publicId` on the edit form,
  matching that already-live precedent exactly.

## 3. Section structure

Per design prompt §9's own instruction — "do not use huge unstructured forms" — every form beyond
~6 fields is split into named sections (plain heading rules under Direction A, per
`01-visual-directions.md`; never a full-page single scroll of ungrouped fields). Ready for Claude's
~30-field record and Page Workspace's per-tab content are the clearest real cases requiring this;
the pattern applies uniformly below that size too once a module's spec crosses roughly half a
dozen fields.

## 4. Save states

Per `07-page-patterns.md` archetype C: **Save draft** (secondary) and **Submit for review**
(primary) render as two distinct actions wherever the module has a review workflow — never merged
into one ambiguous "Save." A persistent "Unsaved changes" / "All changes saved" indicator lives
near the primary action, and a `beforeunload` confirmation guards against silent data loss,
matching the reasoning already given in `07-page-patterns.md`.

## 5. Client vs. server validation — a hard boundary, not a preference

Client-side validation (required-field checks, format hints, the URL-format check above) exists
purely for fast feedback — **it is never the actual security or data-integrity boundary.** Every
field's real validation is enforced server-side, matching this project's own existing, hard-won
precedent: the `ProjectEnvironment.url` stored-XSS fix (closed both client-side, as an immediate
mitigation, and — correctly — at the backend Zod schema, the actual fix location) is the standing
example this design system follows for every future URL/reference field, not a one-off. A form
component's client-side check failing to catch something is a UX gap; a server-side check failing
to catch something is a security incident — this system's forms are built with that asymmetry in
mind from the start, not discovered later.

## 6. Error surfacing from the API

Server validation errors return as a structured `issues[]` array (this project's own existing
`ApiErrorResponse.issues` contract, already built for the Create/Edit Project form) — the form
maps each issue back to its originating field by path, showing the same inline-error treatment as
a client-side validation failure. A server error that doesn't map to a known field (a cross-field
or record-level rule) surfaces as a form-level `Alert` above the first section, not silently
dropped.
