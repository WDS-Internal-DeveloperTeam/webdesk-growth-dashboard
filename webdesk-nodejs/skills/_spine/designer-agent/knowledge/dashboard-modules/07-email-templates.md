---
tier: 2
load_when: ["designer-active", "design", "mockup-production"]
description: SOW-driven Email Templates / Message Templates — template list, view/edit/preview, variables/placeholders, send test, version history, security, audit. Only templates the SOW defines.
---

# Email Templates / Message Templates Module

Purpose: a clean, production-ready module to view, edit, preview, and manage predefined system communication templates — fully SOW-driven.

Do not make this specific to ecommerce, ERP, sync, CRM, or booking systems unless the SOW names them. First analyze the SOW (`00-sow-analysis-first.md`) for: email/notification/alert templates, workflow-based message templates, user-invitation/password templates, approval/rejection templates, report/summary templates, integration/failure-alert templates, system-generated communication types, and the variables/placeholders each needs. Use only the templates identified. Do not hard-code fixed templates unless the SOW names them.

Module name (SOW-based): Email Templates / Message Templates / Notification Templates / Communication Templates / System Templates. Recommended default: `Email Templates`.

---

## Page header & permissions

Title `Email Templates`; subtitle `View, edit, and manage system email templates.` Header: title, description, optional environment badge, last-updated timestamp, search field, optional Create Template button (only if the SOW allows custom templates).

- **View:** view list/details, preview, view available variables. Cannot edit, save, send test emails, or restore versions.
- **Edit:** edit allowed templates, save, preview, send test email (if allowed), restore versions (if allowed).
- **No Access:** `You do not have permission to view email templates.`

## Template list

Required columns: Template Name, Template Type, Subject, Related Module, Last Updated, Updated By, Actions. Additional (if applicable): Template ID, Status (only if the SOW requires activation/deactivation), Language, Version, Recipient Type, Trigger Event, Last Tested At.

Possible example templates (use only those fitting the SOW): User Invitation, Password Reset, Account Verification, Welcome Email, Failed Process Alert, Success Notification, Warning Alert, Approval Request, Approval Confirmation, Rejection Notification, Report Ready, System Health Alert, Integration Failure Alert.

## Filters & row actions

Filters: search by name; filter by module, template type, trigger event, updated by, date range; optional Language, Recipient Type, Status (if applicable). Row actions: View, Edit, Preview, Send Test Email (if allowed), View Logs, View Version History (if applicable). Rules: Edit only for edit permission; Send Test Email requires permission; system-protected templates may be view-only; every edit recorded in activity logs.

## View & edit template

**View details** (page or drawer): template name, type, related module, trigger event, recipient type, subject, email body, available variables/placeholders, last updated, updated by, version history (if applicable), recent activity logs.

**Edit** (form or drawer) fields: Template Name (editable only if allowed), Subject, Email Body, Variables/Placeholders, Footer content (if applicable), Reply-To Email (if applicable), CC/BCC (only if required by the SOW). Editor: rich text or HTML editor, plain-text fallback (if required), placeholder insertion helper, preview mode, validation messages, Save, Cancel, unsaved-changes warning.

## Template variables / placeholders

Section for available variables — e.g. `{{user_name}}`, `{{company_name}}`, `{{record_id}}`, `{{status}}`, `{{date}}`, `{{module_name}}`, `{{action_url}}`. Rules: variables based on the SOW; show name and description; click-to-insert into subject/body; validate missing/invalid variables before saving; warn if required variables are removed.

## Preview & send test

Preview shows: subject preview, body preview, sample dummy values for variables, desktop email preview, plain-text preview (if applicable); optional send test to current user or custom email (if allowed). Send Test Email (only if email sending is part of the SOW): recipient email, template selected, sample variable values. Result: success/failed, sent time, sent by, error message if failed.

## Version history & security

Version history (if the SOW requires auditability/rollback): version number, changed by, changed at, changed fields, previous/new subject/body, restore action (if allowed). Restore requires confirmation, creates a new version, masks sensitive values. Security rules: do not expose sensitive values; validate all placeholders before saving; restrict editing of protected system templates; prevent unsafe scripts in HTML templates; log every edit; warn before changing production-workflow templates; keep default/system templates recoverable.

## Activity logs / audit trail

Every edit recorded. Track: template viewed, edited, subject changed, body changed, variable changed, test email sent, template restored, template exported (if applicable). Each entry: action, template name, performed by, date/time, changed field, previous value, new value, result, IP address (if applicable).

## States

- **Loading:** skeleton template rows, loading editor.
- **Empty:** no templates available yet.
- **No search result:** no templates found matching filters.
- **Error:** failed to load templates / save template / send test email / load version history.
- **No Access:** user does not have permission to view email templates.
- **Read-Only:** user can view templates but cannot edit.

## UX & responsive

Professional, clean, modern, production-ready, permission-aware, SOW-driven, easy to edit safely. Use template table, search/filters, details drawer, edit drawer/page, rich text editor, placeholder helper, preview panel, version history, activity logs, confirmation dialogs, toasts, loading/empty/error states.

- **Desktop:** template list/table on left or table layout; details/editor on the right; preview panel available.
- **Tablet:** condensed table; editor opens as full-width drawer.
- **Mobile browser:** template rows become cards; editor opens full screen; placeholder list collapses into accordion.

## Final Output Rule

Before generating the UI, output a short analysis section: (1) email/message templates from the SOW, (2) related modules, (3) trigger events, (4) required placeholders/variables, (5) permission rules, (6) audit-log requirements, (7) assumptions made. Then generate the Email Templates UI. The design must not look ERP/ecommerce/CRM/sync/booking-specific unless the SOW defines that project type.
