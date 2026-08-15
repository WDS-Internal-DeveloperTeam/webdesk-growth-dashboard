---
tier: 2
load_when: ["webdesk-growth-dashboard", "planning", "g0"]
description: "Every field in project.json.example that carries a syntactically valid but not-yet-real placeholder value, and what actually needs to replace it. Separated from project.json.example itself so that file always validates cleanly (no text markers inside typed fields)."
---

# Setup Input Checklist

> `project.json.example` is fully type/format-valid as written (confirm with `../tools/validate-project-profile.py`) — every value in it is syntactically legal. That does **not** mean every value is real. This checklist is the single place tracking which fields carry a placeholder and what has to replace it before the real `project.json` goes into service. Cross-reference `docs/skill-build/unresolved-items.md` for the broader, narrative version of the same gaps.

---

## Fields carrying a placeholder value

| Field                                            | Placeholder in the example                                                                       | Replace with                                                                                                                                                                                                                                         | Blocks                                                                |
| ------------------------------------------------ | ------------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------- |
| `project.id`                                     | `00000000-0000-4000-8000-000000000000`                                                           | A real UUID v4, generated once at project creation                                                                                                                                                                                                   | Project creation                                                      |
| `project.client.primary_contact.name/email/role` | `TBD` / `tbd@webdesksolution.com`                                                                | The actual primary WebDesk contact                                                                                                                                                                                                                   | G0.5 Discovery                                                        |
| `project.repository.url`                         | `https://github.com/webdesk-org/webdesk-growth-dashboard` (a plausible guess, not confirmed)     | The real repository URL once created under the WebDesk GitHub organization                                                                                                                                                                           | Repository creation                                                   |
| `project.assigned_team.*` (8 roles)              | `TBD`                                                                                            | Named humans for pm/architect/designer/backend_lead/frontend_lead/qa_lead/dba/delivery_head                                                                                                                                                          | G1 (self-approval checks depend on these being real, distinct people) |
| `project.created_at` / `updated_at`              | `2026-08-05T00:00:00Z` (today's date, midnight — a placeholder timestamp, not a real write time) | The actual creation/last-write timestamp, updated on every write per the base schema's own rule                                                                                                                                                      | N/A — updates automatically once the file is live                     |
| `vercel_execution.postgres_marketplace_provider` | `null`                                                                                           | The exact Vercel Marketplace Postgres provider, once provisioned — **must never be `"neon"`** (WDS-002); if no qualifying non-Neon East Coast option exists, stop and escalate per `knowledge/01-approved-architecture.md`'s Database stop-condition | G-Schema                                                              |
| `budget.token_cap`                               | `0`                                                                                              | The real hard token cap for this project                                                                                                                                                                                                             | Before heavy agent usage begins                                       |
| `budget.token_alert_threshold`                   | `0`                                                                                              | The real alert threshold                                                                                                                                                                                                                             | Before heavy agent usage begins                                       |
| `budget.hours_budget`                            | `0`                                                                                              | The quoted/approved hours from the G1 estimate ticket                                                                                                                                                                                                | G1                                                                    |
| `budget.cost_estimate_usd`                       | `0`                                                                                              | The real cost estimate                                                                                                                                                                                                                               | G1                                                                    |

## Fields that are real, not placeholders

Everything else in `project.json.example` — `project_type`, `project_profile`, `build_context`, `integration_targets`, `timezone` (a reasonable default, confirm against WebDesk's actual operating timezone but this is a real IANA value, not a marker), `tenant`, `host_target`, `data_sensitivity`, `stage`, `current_gate`, `status`, `schema_version`, the entire `tech_stack` block, the entire `vercel_execution` block (except the one null field above), `lock`, `gates`, `integration_contracts` (the four contract stubs are real — they need `status` flipped from `draft` to `client-approved` at G-Contracts, not replaced), `runbooks_status`, `audit_log_path`, `audit_log` — are already the resolved, approved values for this project and do not change at setup time.

## Not tracked here (broader, non-schema gaps)

Setup-time inputs that don't correspond to a `project.json` field at all (SMTP credentials, actual Vercel project IDs, complete Service/SEO Library data, a future malware-scanning provider) are tracked in `docs/skill-build/unresolved-items.md` §A, not duplicated here.

---

## Verification

```bash
python3 ../tools/validate-project-profile.py project.json.example
```

Should print `PASS — instance validates against the patched schema, 0 errors.` regardless of how many placeholder values above remain unfilled — this checklist tracks _realism_, the validator tracks _type/format correctness_. Both matter; they are not the same check.
