# `dashboard-web` Decision and Activity Log UI — Approval Checklist

## Scope

Closes the Decision and Activity Log module's last named gap, following the
backend's own build-to-production arc (PR #111, merge commit
`9a5ef065f81ba8b4a978cb3d04fd29b84900f7dc`). A single, organization-wide,
read-only list page (`/decision-and-activity-log`) over `GET
/decision-and-activity-log/events` — no detail page, no create/edit form (the
module has no write path of its own). See
`docs/implementation/module-decision-and-activity-log.md`'s "As-built —
`dashboard-web` UI" section for the full account.

New: `packages/shared-types`'s `AuditEventType`/`AuditActorType`/`AuditEvent`;
`lib/decision-and-activity-log-query.ts`/`lib/decision-and-activity-log.ts`;
the list page itself; 18 new unit tests.

## Independent review (light tier)

Per the 2026-08-27 "right-size the review pipeline" standing rule — a small,
frontend-only UI slice (plus additive shared-types only) consuming an
already-reviewed, already-gated backend with no new endpoint. A direct
read-through pass (not the 8-parallel-agent fan-out) verified:

- The filter contract against the real backend
  `listDecisionAndActivityLogEventsQuerySchema` — `eventType` validated
  against the module's own allowlist, `projectId`/`actorUserId` UUID-shape
  checked client-side before ever being sent, `entityType`/`entityId` length
  caps matching the backend's own.
- `from`/`to` correctly convert a plain `<input type="date">` value to a
  UTC start-of-day/end-of-day ISO datetime at request time, not at parse
  time, so the raw date string round-trips cleanly through the URL/form
  `defaultValue`.
- An invalid `actorUserId`/`projectId` degrades to "no filter applied"
  rather than round-tripping a garbled value that would 400 the whole page.
- Reuse of every established shared helper
  (`list-filter-styles.ts`/`list-table-styles.ts`/`pagination.ts`/
  `search-params.ts`/`uuid.ts`/`format-timestamp.ts`/`users.ts`) — no new
  duplicated style objects or parsing logic.
- `before`/`after` state renders via `JSON.stringify()` inside a `<pre>`,
  never `dangerouslySetInnerHTML`.

**0 findings.**

A separate `security-review` skill run was skipped per the same standing
rule — no new endpoint, no new RBAC action, no new sink; the backend's own
already-reviewed `system_settings:view` gate is the sole enforcement point.

## Validation

Independently re-run by the orchestrating session, not trusted from a
build agent's own report:

- 18/18 new `dashboard-web` unit tests (query parsing, href building, label
  mapping, fetch-function URL construction, UUID-shape short-circuiting,
  pagination trim); 1841/1841 `dashboard-web` unit tests overall.
- Typecheck clean across `@webdesk/shared-types` (built), `dashboard-web`,
  `dashboard-api`, and `dashboard-worker` (the additive shared-types change).
- `eslint --max-warnings=0` + CSS-token check (99 CSS Module files) clean.
- `next build` clean, with `/decision-and-activity-log` present in the
  route list.
- `prettier --check` clean.

## Sign-off

Required second-role human review, per ADR-0010 (the implementing agent
cannot also be its own reviewer): light tier — this checklist's own findings
summary (0 findings) serves as the review artifact, no separate packet
published. **Approved as-is**, WebDesk Solution, 2026-09-03 — no open
findings of any kind on this branch.

Gate `G4-dashboard-web-decision-and-activity-log`: **CONFIRM** — WebDesk
Solution, 2026-09-03, approved commit (recorded at push time) on branch
`dashboard-web-decision-and-activity-log`.

"Push the branch," "Open a PR," and "Merge" were then each separately
requested and executed under the same instruction, per this project's
standing "no auto-merge" rule not blocking a single combined authorization
when explicitly given together.
