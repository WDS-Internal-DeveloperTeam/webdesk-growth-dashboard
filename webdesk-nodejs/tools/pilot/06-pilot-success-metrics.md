# 06 — Pilot Success Metrics

- Context: zero 200K context-window errors; startup load within budget every session
- Truthfulness: zero shipped hallucinated API calls (all external calls traced to verified docs/sandbox)
- Gates: every gate passed with the required artifact; no skipped client approvals on contracts/schema
- Sync: cron sync runs idempotently; reconciliation clean; survives a chaos pass (ERP down) without data loss
- Quality: code review + fitness tests pass; no P1 open at launch
- Delivery: G5.5 observability + runbooks complete before G6
- Health: M6 health score baselined and visible on the master dashboard
