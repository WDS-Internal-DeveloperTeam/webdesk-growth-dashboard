---
tier: 2
load_when: ["designer-active", "design", "mockup-production"]
description: SOW-driven Web Dashboard Notification Settings — dashboard + email channels only, SOW-based event types, module/severity/user-level preferences, notification center, test, audit.
---

# Web Dashboard Notification Settings Module

Purpose: a clean, production-ready Notification Settings module for **web dashboard** notifications, letting users choose which system notifications they receive inside the dashboard and/or by email — fully SOW-driven.

This module is only for web dashboard notifications. Do not include mobile app notifications, SMS, or push notifications unless the SOW specifically requires them. First analyze the SOW (`00-sow-analysis-first.md`) for functional modules, important system events, background workflows, integration events, user-activity events, approval flows, failure/warning scenarios, business-critical alerts, system-health alerts, and notification requirements. Use only the events/modules identified. Do not hard-code notification types like Failed Sync Alert / Success Sync Alert / Warning Alert unless the SOW includes sync/background processing.

---

## Page header

Title `Notification Settings`; subtitle `Manage your dashboard and email notification preferences.` Header: title, description, last-updated timestamp, updated-by (if applicable), optional environment badge (Production / Staging / Sandbox).

## Permission rules

- **View:** view preferences, enabled/disabled types, selected delivery methods. Cannot update, save, or send test notifications.
- **Edit:** update preferences, enable/disable types, select dashboard/email delivery, set frequency, send test email (if allowed).
- **No Access:** `You do not have permission to view notification settings.`

## Channels

Checkbox controls. Allowed channels: **Dashboard Notification** (appears in notification bell / header dropdown / notification center / alert badge / recent notifications list) and **Email Notification** (only if required by the SOW). Do not include SMS, Mobile Push, or Mobile App notifications.

## Notification event types

Checkbox-based preferences for SOW-based events. Possible types (use only those matching the SOW): Success, Failure, Warning, Critical, Pending Approval, Assignment, Status Change, System Health, Integration Error, Report Ready, Security, Business Rule, SLA/Deadline, User Activity. If the SOW includes sync/background jobs, sync alerts may apply; if not, do not use sync-related alerts.

## Module-based preferences

Group notification settings by SOW modules (module names come only from the SOW). Example structure:

| Module          | Event         | Dashboard | Email    | Frequency |
| --------------- | ------------- | --------- | -------- | --------- |
| SOW Module Name | Failure Alert | Checkbox  | Checkbox | Dropdown  |
| SOW Module Name | Warning Alert | Checkbox  | Checkbox | Dropdown  |
| SOW Module Name | Success Alert | Checkbox  | Checkbox | Dropdown  |

## Frequency / delivery

Options where applicable: Instant, Daily Digest, Weekly Digest, Never. Recommended defaults: Critical → Instant; Failure → Instant; Warning → Instant or Daily Digest; Success → Daily Digest or Disabled.

## Dashboard notification center

Provision for: notification bell in header, unread count badge, dropdown, "view all" link, mark as read, mark all as read, filter by unread/read, filter by type, clear notification (if required), timestamp, related module/action link. Each item shows: title, short message, severity badge, related module, time, read/unread state, action link (View Details / Review / Retry / Open Record / Resolve).

## Severity-based & user-level & global preferences

- **Severity levels:** Critical / Warning / Info / Success — each with enable/disable, dashboard checkbox, email checkbox, frequency.
- **User-level:** each user manages their own preferences per role/permission.
- **Global rules** (only if the SOW requires admin-level management): default preferences, critical-alert recipients, admin-only alerts, system-wide rules, required events users cannot disable.

## Test notification

Only for allowed channels and permitted users: Send Test Email, Send Test Dashboard Notification. Show result: success/failed, sent time, sent by, error message if failed.

## Edit behavior & audit

View mode shows current preferences; edit mode allows selecting checkboxes, enabling/disabling types, choosing Dashboard/Email, choosing frequency, save/cancel. After save: success/error toast, update last-updated timestamp, record audit entry. Audit tracks: preference updated, dashboard/email enabled/disabled, frequency changed, test dashboard/email notification sent. Each entry: action, performed by, date/time, changed field, previous value, new value, result.

## States

- **Loading:** skeleton notification cards, loading checkbox matrix.
- **Empty:** no notification settings configured — CTA Configure Notifications.
- **Error:** failed to load / save preferences / send test notification.
- **No Access:** user does not have permission to view notification settings.
- **Read-Only:** user can view but cannot edit.

## UX & responsive

Professional, clean, modern, checkbox-based, permission-aware, SOW-driven, web-dashboard focused, responsive. Use checkboxes, toggles, cards, tables, badges, dropdowns, tooltips, notification bell/center, toasts, empty/loading/error states.

- **Desktop:** grouped cards or table matrix; Dashboard/Email in columns; frequency dropdown.
- **Tablet:** stack groups; keep checkbox matrix scrollable if needed.
- **Mobile browser:** accordion sections by module; event types as cards; stack Dashboard/Email checkboxes vertically.

Do not design this as a mobile app notification system.

## Final Output Rule

Before generating the UI, output a short analysis section: (1) notification modules from the SOW, (2) event types from the SOW, (3) dashboard/email channels required, (4) user-level vs global settings, (5) permission rules, (6) assumptions made. Then generate the Notification Settings UI. The design must not look ERP/ecommerce/CRM/sync/booking-specific unless the SOW defines that project type.
