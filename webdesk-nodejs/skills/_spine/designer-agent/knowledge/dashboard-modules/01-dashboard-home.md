---
tier: 2
load_when: ["designer-active", "design", "mockup-production"]
description: SOW-driven Dashboard Home — page header, KPI cards, charts, system health, recent activity, alerts, states, responsive. All content derived from the SOW.
---

# Dashboard Home Module

Purpose: a clean, modern, production-ready Dashboard Home giving a quick overview of key metrics, system activity, system health, recent activity, alerts/exceptions, and items needing attention — all built only from the SOW.

The dashboard must be SOW-driven and must not be specific to ERP, ecommerce, CRM, sync, or booking systems unless the SOW clearly defines that project type. First run the SOW analysis in `00-sow-analysis-first.md`; use only the identified items for KPIs, charts, health, activity, and alerts. Do not hard-code examples like ERP API Status, BigCommerce API Status, Inventory/Pricing/Orders Synced, or Cron Jobs unless the SOW names them.

---

## Page header

- Page title: `Dashboard`
- Short subtitle based on the SOW
- Date range filter
- Optional module filter (SOW-based)
- Optional status filter (SOW-based)
- Optional environment badge if applicable: Production / Staging / Sandbox
- Last updated timestamp (e.g. `Last Updated: Jun 30, 2026, 10:42 AM`)

## KPI cards

Create KPI cards from the SOW's key metrics, workflows, or modules. Do not use fixed KPI names unless they exist in the SOW.

Possible KPI types (use only the relevant ones): Total Records Processed, Successful Actions, Failed Actions, Pending Actions, Open Issues, Completed Jobs, Delayed Jobs, Active Users, Active Integrations, Pending Approvals, Revenue Impact, Business Activity, or any project-specific metric.

Each KPI card: metric title, main value, small comparison text, trend indicator, status indicator, icon placeholder. Example — Title `Total Processed`, Value `12,430`, Comparison `+8.2% vs previous period`, Status `Healthy`.

## Main layout

Two-column: **left** for charts/analytics, **right** for system health / operational status. Recent activity and alerts below.

## Charts & analytics

Create chart provisions from the SOW; do not hard-code chart titles unless relevant. Possible charts (use only relevant): Success vs Failure, Activity Over Time, Daily/Weekly Activity, Status Distribution, Module-wise Performance, API/Request Usage, Error Breakdown, Processing Time Trend, User Activity Trend, Business Activity Trend, Revenue Trend, Approval Activity, Task Completion Trend.

Each chart: title, realistic dummy data based on the SOW, legends, axis labels, tooltips, and empty / loading / error states.

## System health

Right-side panel. Health items must be based on the SOW's systems, integrations, services, or workflows — no fixed platform-specific statuses unless part of the SOW.

Possible items (use only relevant): Database Status, Primary API Status, Secondary API Status, Webhook/Event Status, Scheduled Job Status, Queue/Worker Status, Authentication/Token Status, File Processing Status, Notification Service Status, Third-party Integration Status, Storage Status, Background Process Status.

Each health item: component name; status badge (Healthy / Warning / Critical / Unknown); last checked time; short description; optional action (View logs / Check details / Retry / Configure).

## Recent activity

Table or timeline of latest system events (SOW-based). Possible columns: Time, Module, Activity/Event, Status, Source, Result, Action. Status examples: Success, Failed, Pending, Warning, In Progress. Use realistic dummy data based on the SOW.

## Alerts & exceptions

Section for issues needing attention. Possible alert types (only relevant ones): Failed process, Delayed job, API error, Data mismatch, Missing configuration, Pending approval, Webhook failure, Authentication issue, Processing delay, Sync issue, User action required.

Each alert: severity (High / Medium / Low), message, affected module/system, time, action button. Example actions: View Details, Retry, Resolve, Configure, Assign.

## States

- **Loading:** skeleton KPI cards, skeleton charts, loading health panel, loading recent activity table.
- **Empty:** no dashboard data available, clear message, optional SOW-based CTA.
- **Error:** failed to load dashboard data, retry button.
- **No Access:** user does not have permission to view dashboard data.

## UX & responsive

Professional, modern, clean, scannable, responsive, SOW-driven. Use cards, tables, badges, icons, charts, filters, toasts, empty states, confirmations where needed.

- **Desktop:** KPI grid; charts left, health right; recent activity + alerts below.
- **Tablet:** KPI cards wrap to fewer columns; charts/health stack as needed.
- **Mobile:** KPI cards single-column; charts stack; recent activity becomes card-based; tables become responsive cards or horizontal scroll.

## Final Output Rule

Before generating the UI, output a short analysis section: (1) KPIs identified from the SOW, (2) system health items, (3) charts required, (4) recent activity items, (5) alerts and exceptions, (6) assumptions made. Then generate the Dashboard Home UI.
