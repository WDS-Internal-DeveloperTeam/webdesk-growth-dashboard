---
tier: 2
load_when: ["designer-active", "design", "mockup-production"]
description: SOW-driven Process History / Sync History — only if the SOW defines processes. KPIs, history table, direction field, error/logs, retry, export, status badges, audit.
---

# Process History / Sync History Module

Purpose: a clean, production-ready module to review completed, failed, pending, and in-progress system processes (sync jobs, imports, exports, automation runs, webhook events, background jobs, data processing) — fully SOW-driven. Include only if the SOW defines such processes.

Do not make this specific to ERP, ecommerce, inventory sync, pricing sync, or order sync unless the SOW names them. First analyze the SOW (`00-sow-analysis-first.md`) for background processes, sync workflows, import/export workflows, data-processing activities, automation runs, webhook/event processing, scheduled-job executions, modules involved, and success/failure/error tracking. Use only identified process types/modules. Do not hard-code sync-specific labels unless sync is part of the SOW.

Module name (SOW-based): Process History / Activity History / Job History / Sync History (only if sync) / Import-Export History / Automation History / Event History. Recommended default: `Process History`.

---

## Page header & permissions

Title `Process History`; subtitle `Review system process activity, results, errors, and execution details.` Header: title, description, environment badge (if applicable), last-updated timestamp, Refresh, Export (if allowed).

- **View:** view history, status, counts, basic error details (if allowed). Cannot export, retry, view sensitive logs, download files, or access restricted error details.
- **Manage:** export history, retry failed process (if applicable), view full logs, view error details, download source/result files (if applicable).
- **No Access:** `You do not have permission to view process history.`

## KPI cards

Only SOW-relevant: Total Processes, Successful, Failed, In Progress, Partially Completed, Total Records Processed, Total Success Count, Total Failure Count, Average Duration, Last Completed Process.

## Filters & search

Search by Job/Process ID, module, entity/object type; filter by status, direction (if applicable), date range, source/destination system (if applicable), triggered by, process type. Possible statuses (only those that fit): Success, Failed, Partial Success, In Progress, Pending, Cancelled, Warning, Skipped.

## History table

Realistic SOW-based data. Required columns: Job/Process ID, Module, Entity/Object, Process Type, Direction (if applicable), Started At, Completed At, Duration, Status, Success Count, Failure Count, Error Summary, Actions. Optional (if applicable): Source System, Destination System, Triggered By, Trigger Type, Total Records, Skipped Count, Warning Count, Retry Count, Last Retry At, File Name, Batch ID, API Response Code, Correlation ID, Environment.

**Direction field** — use only if the SOW includes data movement between systems (Inbound / Outbound / Bidirectional / Internal / Source to Destination). If no data movement, replace with a more relevant field: Trigger Type / Process Type / Source / Workflow / Action Type.

## Row actions

By permission: View Details, View Logs, View Errors, Retry Failed Items (if applicable), Download Report, Export Result, Open Related Record, Copy Job ID. Rules: Retry only for failed/partial; View Errors only when failure count > 0; Download Report only if reports/files generated; sensitive logs hidden from unpermitted users.

## Process details drawer / page

Show: Job/Process ID, module, entity/object, process type, direction (if applicable), source/destination system (if applicable), started/completed at, duration, status, triggered by, trigger type, total records, success/failure/warning/skipped counts, retry count, last result, error summary. Actions: Retry Failed Items, View Full Logs, Download Error/Success Report, Copy Job ID, Back to History.

## Error details & logs

Error details: error code, message, affected record/entity, field name (if applicable), source value (if applicable), failure reason, timestamp, retry status, suggested action (if applicable). Rules: summarized in table, full list in drawer/page; filter errors by type; download error report (if applicable); mask sensitive info. Logs: timestamp, log level (Info/Warning/Error/Critical), message, Job/Process ID, related module, related entity, error details. Sensitive data never shown in logs.

## Retry & export

Retry (only if the SOW supports it): retry entire process, failed records only, selected failed records, from last checkpoint (if applicable). Retry requires confirmation, shows toast, creates a new history entry or links to the original, is permission-based, and is tracked. Export (if permitted): current table, success report, failure report, full process report, logs. Formats: CSV, Excel, PDF (only if required).

## Status badges & audit

Badges: Success, Failed, Partial Success, In Progress, Pending, Warning, Cancelled, Skipped — each with clear visual treatment and tooltip if needed. Audit tracks: process viewed, error report downloaded, logs viewed, process retried, failed records retried, history exported. Each entry: action, Job/Process ID, performed by, date/time, result.

## States

- **Loading:** skeleton KPI cards, skeleton table rows, loading details drawer.
- **Empty:** no process history available yet.
- **No search result:** no records found matching filters.
- **Error:** failed to load history / error details / export / retry.
- **No Access:** user does not have permission to view process history.
- **Read-Only:** user can view but cannot export, retry, or view sensitive logs.

## UX & responsive

Professional, clean, modern, production-ready, permission-aware, SOW-driven. Use KPI cards, tables, status badges, filters, search, date range picker, details drawer, error-details table, logs panel, export buttons, confirmation modals, toasts, empty/loading/error states.

- **Desktop:** KPI cards on top, full history table, details drawer on the right.
- **Tablet:** condensed table, horizontal scroll if needed, drawer or full-width panel.
- **Mobile browser:** history rows become cards; filters collapse; details open full-screen; logs/error details stack vertically.

## Final Output Rule

Before generating the UI, output a short analysis section: (1) process/history types from the SOW, (2) modules involved, (3) entities/objects involved, (4) required statuses, (5) required table columns, (6) required actions, (7) permission rules, (8) error and log requirements, (9) assumptions made. Then generate the Process History UI. The design must not look ERP/ecommerce/CRM/sync/booking-specific unless the SOW defines that project type.
