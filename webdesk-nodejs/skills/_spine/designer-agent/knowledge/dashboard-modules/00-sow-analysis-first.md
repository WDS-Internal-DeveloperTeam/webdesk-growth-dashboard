---
tier: 2
load_when: ["designer-active", "design", "mockup-production"]
description: The universal SOW-analysis procedure every dashboard module runs before UI, plus the rule to output the analysis section before generating any UI.
---

# SOW Analysis First — the universal procedure

Purpose: analyze the SOW before designing, and output a short analysis section before any UI, so every module is built only from what the SOW defines.

---

## The rule

Before designing any dashboard or module, first analyze the SOW and identify:

1. Main business workflows
2. Core modules
3. Admin screens
4. Background processes
5. Integrations
6. Reports
7. User types
8. Operational metrics
9. Health monitoring areas
10. Alerts or exception scenarios

Use only the items identified from the SOW to create dashboard KPIs, charts, system health items, recent activity, alerts, settings sections, notification events, jobs, process types, templates, and permission modules.

Do not hard-code platform-specific examples such as:

- ERP API Status
- BigCommerce API Status
- Inventory Synced
- Pricing Synced
- Orders Synced
- Cron Jobs
- Store Connection / ERP Connection
- SMTP / Client Secret / Access Token / API Path
- Failed Sync Alert / Success Sync Alert

Use them only if they are clearly mentioned in the SOW. The final design must not look specific to ERP, ecommerce, CRM, sync system, booking system, or any fixed platform unless the SOW clearly defines that project type.

---

## Output the analysis section before the UI (Final Output Rule)

Every module follows the same "Final Output Rule": before generating the UI, first output a short analysis section listing what was identified from the SOW for that module, then generate the UI.

The analysis section content varies by module but always covers, in some form:

- Items identified from the SOW (KPIs / modules / fields / statuses / events / templates / jobs — whichever the module concerns)
- Permission rules (view vs edit/manage)
- Any protected/critical items
- Audit-trail requirements where the module changes data
- Assumptions made

Only after the analysis section do you generate the module UI. This keeps design traceable to the SOW and prevents overfitting to a previous project's platform.
