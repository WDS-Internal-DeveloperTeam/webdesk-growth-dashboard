---
tier: 2
load_when: ["designer-active", "design", "mockup-production"]
description: SOW-driven Settings — only the sections the SOW requires; generalized connection/integration/email/webhook/data-processing/business-rules/security sections; timezone; masked credentials; per-section edit; audit.
---

# Settings Module

Purpose: a clean, production-ready Settings page letting authorized users view and manage system configuration, company info, integrations, credentials, notification settings, and operational preferences — fully SOW-driven.

Do not make Settings specific to ERP, ecommerce, BigCommerce, Shopify, CRM, sync, or booking systems unless the SOW clearly mentions them. First analyze the SOW (`00-sow-analysis-first.md`) for: company info required, platform/system connections, third-party integrations, API credential requirements, email/notification settings, business rules, environment settings, webhook/event settings, data-processing settings, security/access-control requirements. Use only the sections the SOW requires. Do not hard-code Store Connection, ERP Connection, SMTP, API Path, Client ID, Client Secret, or Access Token unless the SOW names them.

---

## Permission rules

- **View:** view settings, see masked sensitive fields, view connection status and last-updated details. Cannot edit, save, test connections (if not permitted), or reveal secrets.
- **Edit/Configure:** edit allowed settings, save, test connections, update credentials, configure integrations, update notification settings.
- **No Access:** `You do not have permission to view settings.`

## Page header & layout

Title `Settings`; subtitle `Manage company details, system configuration, integrations, and operational settings.` Header: title, description, optional environment badge (Production / Staging / Sandbox / Development), last-updated timestamp, updated-by name.

Layout: left-side settings navigation + right-side editable panel, or grouped cards if few sections. Each section: section title, short description, Edit/Save/Cancel buttons, last-updated info, validation messages, success/error toasts.

## Settings sections (include only those the SOW requires)

1. **Company / Organization Information** — Company Logo (upload/preview/replace/remove), Name, Email (validated), Mobile (validated), Address (multiline), Timezone (searchable dropdown), Website URL, Default Language, Business Hours (as applicable). Edit only for users with permission.
2. **Primary Platform / System Connection** — generalized main-system connection (do not call it Store Connection unless the SOW says store). Possible fields: Platform/System Name, URL, API Base URL, API Path, Client ID, Client Secret, Access Token, API Key, API Version, Authentication Type, Connection Status, Last Connected/Tested At. Actions: Test Connection, Save, Reset, View Connection Logs (if applicable). Sensitive fields masked by default; secrets not shown in full after save; reveal only with permission; confirm before updating credentials; log every credential update. Test result shows success/failed, response time, last tested time, tested by, error message, API-version compatibility (if applicable).
3. **External System / Integration Connection** — only if the SOW mentions external systems/integrations (ERP/CRM/POS/payment/shipping/marketing/warehouse/accounting/any third party). Do not call it ERP Connection unless the SOW says ERP. Possible fields: Integration Name/Type, Username, Password, API Endpoint, API Key, Access Token, Secret Key, Retry Count, Timeout, API Version, Authentication Type, Connection Status. Actions: Test Connection, Save, View Logs, Retry Failed Connection (if applicable). Validation: required fields; endpoint URL format; numeric retry/timeout; masked credentials.
4. **Email / Notification Configuration** — only if the SOW requires email/notification/alert/messaging config. Do not call it SMTP Settings unless SMTP is specified. Possible fields: Email Provider, Host, Port, Username, Password, From Email, From Name, Encryption Type, Reply-To Email, Notification/Alert Recipients. Actions: Test Email, Save, Send Test Notification. Validation: host required if SMTP; numeric port; valid email format; masked password; test-email result message.
5. **Webhook / Event Settings** — only if the SOW mentions webhooks/events/callbacks/real-time updates. Fields: Webhook URL, Secret, Event Types, Retry Count, Timeout, Signature Verification, Last Webhook Received, Webhook Status. Actions: Test Webhook, Regenerate Secret, View Webhook Logs.
6. **Data Processing / Sync Settings** — only if the SOW mentions sync/import/export/scheduled jobs/queues/automation/background processing. Fields: Sync Frequency, Batch Size, Retry Count, Failure Notification Email, Auto Retry Enabled, Last Sync Time, Next Scheduled Run, Processing Timeout. Actions: Save, Run Now, Pause/Resume (only if required), View Sync Logs.
7. **Business Rules / Operational Settings** — only if the SOW defines configurable rules. Fields (SOW-based): Default Processing Rule, Approval Requirement, Auto Assignment Rule, Threshold Values, Notification Rules, Escalation Rules, SLA Settings, Default Status Rules.
8. **Security Settings** — only if required. Fields: Session Timeout, Password Policy, Two-Factor Authentication, Login Attempt Limit, Allowed IPs, Token Expiry, API Access Control.
9. **Audit / Logs** — track: company info updated, connection settings updated, credentials changed, email settings updated, webhook settings changed, sync settings changed, business rules changed, test connection performed. Each entry: action, section, performed by, date/time, changed field, previous value, new value, result. Sensitive values never shown in full.

## Edit behavior

Per-section edit mode. **View mode:** field label, value, masked sensitive values, Edit button if permitted. **Edit mode:** input fields, Save, Cancel, validation messages, unsaved-changes warning. **Critical-change confirmation** before saving: API credentials, password, access token, webhook secret, API endpoint, notification sender email, business rules affecting system behavior.

## States

- **Loading:** skeleton settings cards, loading input placeholders.
- **Empty:** no settings configured yet — CTA (permission-based) Configure Settings.
- **Error:** failed to load / save settings / test connection — retry button.
- **No Access:** user does not have permission to view settings.
- **Read-Only:** user can view settings but cannot edit.

## UX & responsive

Professional, modern, clean, permission-aware, SOW-driven, secure for sensitive settings. Use cards, forms, tabs/side-nav, badges, icons, masked fields, tooltips, confirmation modals, toasts, loading/empty/error states.

- **Desktop:** left settings nav + right detail panel; section-level edit buttons.
- **Tablet:** nav becomes top tabs; forms stack cleanly.
- **Mobile:** sections become accordions; fields stack vertically; Save/Cancel stay accessible.

## Final Output Rule

Before generating the UI, output a short analysis section: (1) settings sections identified from the SOW, (2) fields per section, (3) sensitive fields to mask, (4) permissions to view/edit, (5) connection-test requirements, (6) audit-trail requirements, (7) assumptions made. Then generate the Settings UI. The design must not look ERP/ecommerce/CRM/sync/booking-specific unless the SOW defines that project type.

> Timezone note: the Company/Organization timezone is the system's operational clock — it drives all cron/background schedules and every displayed timestamp (store UTC, display configured tz). Changing it reschedules background jobs; surface a confirm step. This is a fixed system contract (see `01-dashboard-standards.md` §3.4).
