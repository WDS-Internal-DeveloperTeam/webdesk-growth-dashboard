---
tier: 2
load_when: ["delivery-head-active"]
description: "Output template."
---

# Client Launch Report Template

> The go-live report the Delivery Head sends the client. Plain-language, honest, specific — no buttering, no vague "everything went great". States what's live, how it's performing against the SLOs, what to watch, and what's next. Written for a business stakeholder, not an engineer.

---

```
GO-LIVE REPORT — [Project Name]
Client: [Client]            Date: [launch date, client timezone]
Prepared by: Delivery Head  Status: LIVE
```

## 1. What's live

[2–4 plain sentences. What the integration now does for the client: e.g. "Your DDI Inform inventory and pricing now sync to your BigCommerce store automatically every hour. Orders placed on the store flow back into Inform. Your team manages it from the dashboard at [URL]."]

- **Synced entities:** [items, inventory, pricing — ERP→store; orders — store→ERP]
- **Sync schedule:** [e.g. inventory hourly, full reconciliation nightly at 2am your time]
- **Dashboard:** [URL] — [N] users set up, roles: [Admin, Manager].

## 2. How the launch went

- First full sync: [completed in __; __ entities synced; reconciliation clean].
- [Any issue encountered + how it was handled — be honest. "We hit the ERP rate limit during the first full sync; the system backed off and completed cleanly in __." If nothing went wrong, say so plainly.]
- Open P1/P2 at launch: **none** (hard requirement — we don't launch otherwise).

## 3. Performance vs targets

| Measure                        | Target (SLA)    | Launch reading |
| ------------------------------ | --------------- | -------------- |
| Availability                   | [99.5%]         | [—]            |
| Dashboard responsiveness (p95) | [<500ms]        | [__ms]         |
| Inventory freshness            | [within 15 min] | [__ min]       |

[1 sentence: "We're comfortably inside the targets." or an honest note if a measure is close.]

## 4. What we're watching

- The **first 24–72 hours** and the next few full syncs — this is the highest-risk window and we're watching it actively.
- Health score baseline established; this instance is now on our monitoring dashboard, watched alongside our other retainer clients.
- [Any specific watch item, e.g. "We're keeping an eye on the ERP rate limit during full syncs."]

## 5. What you can do

- Log in at [URL] to see sync status, manage users/roles, and review activity logs.
- Settings → Timezone is set to [client tz]; it drives when syncs run. Tell us before changing it.
- Report any issue via [channel]; warranty response targets are P1 4 business hours / P2 1 business day.

## 6. What's next

- [Warranty period start + term.]
- [Deferred/roadmap items, with the RFC reference: e.g. "Customer sync (deferred to phase 2) — RFC-003."]
- [Handoff call scheduled for [date]; handoff guide attached.]

---

> Tone: truthful and specific. If something was close to a limit or required a workaround, say so — the client trusts a report that names the one thing that was tricky more than one that claims perfection.

---

Last reviewed: 2026-06-30 by Claude (initial Node.js build)
Next review due: 2026-09-30
