---
tier: 2
load_when: ["designer-active", "design", "mockup-production"]
description: SOW-driven Scheduled Jobs / Cron Jobs — only if the SOW defines background processes. KPIs, jobs table, row + global actions, edit schedule, retry/failure, history, logs, protected jobs, audit.
---

# Scheduled Jobs / Cron Jobs Module

Purpose: a clean, production-ready module to monitor, run, pause, resume, edit, retry, and troubleshoot scheduled background tasks — fully SOW-driven. Include this module only if the SOW defines scheduled/background processing.

Do not make this specific to ERP, ecommerce, sync jobs, inventory, or pricing unless the SOW names them. First analyze the SOW (`00-sow-analysis-first.md`) for scheduled jobs, background processes, sync workflows, import/export tasks, report jobs, notification jobs, webhook-retry jobs, cleanup/maintenance jobs, data-processing jobs, automation workflows. Use only the identified jobs. Do not hard-code job names like Inventory Sync, Pricing Sync, Order Sync, or ERP Sync unless the SOW names them.

Module name (SOW-based): Scheduled Jobs / Background Jobs / System Jobs / Automation Jobs / Cron Jobs (only if the SOW uses cron terminology). Recommended default: `Scheduled Jobs`.

---

## Page header & global actions

Title `Scheduled Jobs`; subtitle `Monitor and manage scheduled background processes.` Header: title, description, environment badge (if applicable), last-updated timestamp, Refresh. Global actions: Run All, Pause All, Resume All (if Pause All exists), Refresh. Global actions require confirmation; Run All warns if many jobs will execute; Pause All skips protected/critical jobs unless permitted; Resume All resumes only paused jobs; success/error/partial-success toasts. Example confirmation: `Are you sure you want to run all scheduled jobs now? This may trigger multiple background processes.`

## Permission rules

- **View:** view jobs, status, last/next run, history, logs (if allowed). Cannot run/pause/resume/edit/retry, or use global actions.
- **Manage:** Run Now, Pause, Resume, Edit schedule, Retry failed jobs, update retry count, view detailed logs, use global actions (if allowed).
- **No Access:** `You do not have permission to view scheduled jobs.`

## KPI cards

Only SOW-relevant metrics: Total Jobs, Running, Paused, Failed, Completed Today, Queued, Average Duration, Next Scheduled Job.

## Filters & search

Search by job name; filter by status, module/workflow, schedule type, last result, enabled/paused state; date range for last run. Possible statuses (only those that fit): Scheduled, Running, Completed, Failed, Paused, Queued, Skipped, Warning.

## Jobs table

Realistic SOW-based data. Required columns: Job Name, Module/Workflow, Schedule, Enable/Disable or Pause/Resume state, Retry Count, Status, Last Run, Next Run, Average Duration, Last Result, Actions. Optional extra columns: Job Type, Priority, Timeout, Last Error, Success Rate, Triggered By, Updated At.

## Row actions

Run Now, Pause, Resume, Retry (failed only), Edit, View Details, View Logs, View History. Rules: show Pause only when active; show Resume only when paused; show Retry only when last run failed/warned; disable actions while running; protected jobs show a lock icon; critical actions require confirmation.

## Job details drawer / page

Show: name, description, module/workflow, schedule, current status, pause/resume state, retry count, retry interval, timeout, last run, next run, average duration, last result, last error message, success/failure trend, recent logs, recent run history. Actions: Run Now, Pause, Resume, Retry, Edit, View Full Logs, Back to Jobs.

## Edit job (permitted users)

Editable fields: Job Name (if allowed), Schedule, Timezone, Retry Count, Retry Interval, Timeout, Failure Notification (if applicable), Enable Auto Retry (if applicable). Schedule options: Every X minutes, Hourly, Daily, Weekly, Monthly, Custom cron expression (only if required), Manual only. Validation: schedule required; timezone required; numeric retry/timeout; valid custom cron; show next-run preview (e.g. `Next Run: Tomorrow at 2:00 AM IST`).

## Retry & failure handling

Fields: retry count, retry interval, max retry limit, timeout, auto-retry enabled, failure reason, failure notification. Failed jobs show error reason; retry re-triggers the job; repeated failures show warning/critical badge; retry result shows toast.

## Job history & logs

History columns: Run ID, Started At, Completed At, Duration, Status, Triggered By (System / Manual / Retry / Webhook / User Name), Result, Error Message, Action. Logs: Timestamp, Log Level (Info / Warning / Error / Critical), Message, Job Name, Run ID, Related Module, Error Details. Sensitive values never shown in logs.

## Protected / critical jobs

Cannot be deleted; may not be paused without confirmation; schedule changes require confirmation; Pause All skips them unless permitted; show lock icon; track all changes in audit log.

## Notifications & audit

Web dashboard notifications only (email if applicable; no push/SMS unless SOW requires). Events: job failed, completed with warning, delayed, skipped, duration exceeded threshold, paused, resumed, retried multiple times. Audit tracks: manual trigger, pause, resume, schedule updated, retry count updated, retried, failed, completed, global Run/Pause/Resume All. Each entry: action, job name, performed by, date/time, previous value, new value, result.

## States

- **Loading:** skeleton KPI cards, skeleton table rows, loading job details.
- **Empty:** no scheduled jobs configured — CTA (permission-based) Configure Job.
- **No search result:** no jobs found matching filters.
- **Error:** failed to load / run / pause / resume / update job.
- **No Access:** user does not have permission to view scheduled jobs.
- **Read-Only:** user can view jobs but cannot manage them.

## UX & responsive

Professional, clean, modern, production-ready, permission-aware, SOW-driven. Use KPI cards, tables, status badges, icons, filters, search, drawers, modals, confirmation dialogs, toasts, logs, run history, empty/loading/error states.

- **Desktop:** KPI cards on top, full jobs table, details drawer on the right.
- **Tablet:** condensed table, horizontal scroll if needed, drawer or full-width panel.
- **Mobile browser:** job rows become cards; filters collapse; details open as full-screen drawer; logs stack vertically.

## Final Output Rule

Before generating the UI, output a short analysis section: (1) scheduled/background jobs from the SOW, (2) job types required, (3) statuses required, (4) row actions required, (5) global actions required, (6) permission rules, (7) protected/critical jobs, (8) audit-trail requirements, (9) assumptions made. Then generate the Scheduled Jobs UI.
