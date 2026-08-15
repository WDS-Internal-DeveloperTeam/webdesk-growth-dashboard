---
tier: 2
load_when: ["session-boundary"]
description: "The HANDOFF.md template. Copy to outputs/<client_slug>/HANDOFF.md."
---

# HANDOFF.md Template (Node.js)

> Copy this to `outputs/<client_slug>/HANDOFF.md`. Written at the end of every session by whoever closes it; read FIRST by whoever opens the next. Hard cap: **200 lines** — if it grows, archive to `docs/session-handoffs/<date>-<slug>.md` and reset. See `session-handoff-protocol.md`.

---

```markdown
# HANDOFF — {{client-slug}}

- **Session ended:** {{YYYY-MM-DD HH:MM}} ({{project timezone, e.g. America/Toronto}})
- **Session ID:** {{session-id-if-tracked}}
- **Last active agent:** {{pm / architect / designer / backend-role / frontend-role / qa / code-review / delivery-head}}
- **Build context:** {{nodejs | nodejs+bigcommerce | nodejs+shopify}}
- **Project type:** {{integration-middleware | custom-app-build | frontend-tool | version-upgrade | maintenance}}
- **Active milestone / sprint:** {{M2 / S2.1}}
- **Current gate:** {{derived from `project.json.gates[]` — DO NOT hand-edit as truth; see note below}}

> Gate status (open/passed/failed) is authoritative ONLY in `project.json.gates[]`. This line and any gate mention below are read from it. If HANDOFF and `project.json` ever disagree, **`project.json` wins** — correct the handoff, never the reverse.

## Where we left off

{{1–2 sentences. The exact last concrete thing being done and where it stopped.
Name the file. Example: "Building DDI inventory pull in
src/integrations/erp/ddi/inventory-sync.js. Pull + normalize done and tested;
per-batch watermark commit pending. Next: wrap batch write + watermark update in
one Sequelize transaction. No blockers."

If the session ended on a context/error/interrupt, say so and give the minimal
reload path: "Hit context limit after sync-engine work. Resume by reloading
CLAUDE.md + HANDOFF.md + data-model.md only, then finish the remaining 2 files."}}

## Files committed this session

| File                                           | Branch                              | Notes                           |
| ---------------------------------------------- | ----------------------------------- | ------------------------------- |
| {{src/integrations/erp/ddi/inventory-sync.js}} | {{feature/S2.1-ddi-inventory-sync}} | {{pull+normalize done, tested}} |
| {{...}}                                        |                                     |                                 |

## Files pending commit (work in progress)

| File                                           | Status                       | Blocker  |
| ---------------------------------------------- | ---------------------------- | -------- |
| {{src/integrations/erp/ddi/inventory-sync.js}} | {{watermark commit pending}} | {{none}} |
| {{...}}                                        |                              |          |

Commit or stash these before the next session unless intentionally left dirty.

## Next 3 tasks (queued)

1. {{Specific. e.g. "Wrap batch write + watermark update in one transaction; add overlapping-run advisory lock."}}
2. {{Task 2}}
3. {{Task 3}}

After these, see CLAUDE.md "Active tasks (this sprint)" for the backlog.

## Client blockers (waiting on)

Format: `[opened-date] — what we're waiting on. Owner: human PM / client / vendor. Target unblock.`

- {{[2026-07-10] — DDI Inform sandbox API credentials (verify-at-discovery). Owner: human PM chasing client. Target: 2026-07-15.}}
- {{[2026-07-11] — G-Schema client sign-off on data-model.md. Owner: human PM. Target: 2026-07-14.}}

If none: _(none)_

## Open failure modes captured this session

- {{[FM-007] DDI returns 200 with an empty body on an empty inventory delta — must treat as "no change", not an error.}}

If none: _(none — clean session)_

## Decisions made this session

Format: `[YYYY-MM-DD] [ADR-id if applicable] — summary.` Also append to CLAUDE.md "Recent decisions".

- {{[2026-07-12] ADR-004 — BullMQ + Redis chosen over node-cron for the sync queue (retries + DLQ needed).}}

## Token / context usage this session (optional)

- Input: {{N}} · Output: {{N}} · Est. cost: ${{N}} · Cumulative: ${{N}} / ${{budget}}
- Context high-water mark: {{~X% of window}}

## What NOT to do on resume

- {{Do NOT run migrations against staging — G-Schema not yet client-approved.}}
- {{Do NOT load the Shopify integration KB — this project's integration_targets are bigcommerce + erp:ddi-inform only.}}

If none: _(no specific cautions)_

## Session links

- Last commit: `{{hash}}` on `{{branch}}`
- Staging URL: {{url}}
- Mockup preview URL (if active): {{url}}
- Open PRs / issues: {{list}}

---

Last touched: {{timestamp}} · by {{name-or-agent}}
```

---

Last reviewed: 2026-06-30 (initial Node.js build)
Next review due: 2026-09-30
