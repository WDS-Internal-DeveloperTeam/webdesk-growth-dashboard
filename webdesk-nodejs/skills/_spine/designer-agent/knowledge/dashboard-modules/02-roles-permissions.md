---
tier: 2
load_when: ["designer-active", "design", "mockup-production"]
description: SOW-driven Roles & Permissions — roles CRUD/clone, dynamic per-module permission matrix (VED minimum), NO role status, protected roles, assigned-users reassignment, audit trail.
---

# Roles & Permissions Module

Purpose: a clean, production-ready Roles & Permissions module letting authorized admins create, edit, clone, delete roles, manage permissions, view/reassign assigned users, and track changes — fully SOW-driven.

Do not hard-code default permission modules (Dashboard, Users, Settings, Reports, Orders, Products, Logs, Integrations, Cron Jobs, Sync History, Email Templates) unless the SOW names them. First analyze the SOW (`00-sow-analysis-first.md`) to identify functional modules, admin screens, background workflows, reports, settings areas, integration areas, approval flows, logs/audit areas, user types, and access-control requirements — then use only those as permission modules.

---

## Important status rule — DROP role status

Do **not** include Role Status anywhere. Remove: role status field, Active/Inactive dropdown, Active/Inactive badge, status filter, deactivate-role option, inactive-role logic. Roles are managed only through Create, Edit, Clone, Delete, Reassign-before-delete, and protected-role rules.

## Page header

Title `Roles & Permissions`; subtitle `Manage user roles, access levels, and module permissions.` Header actions: Create Role button; optional environment badge (Production / Staging / Sandbox).

## Filters & search

Search by role name/description; filter by role type if applicable (System / Custom); sort by role name / assigned users / created / updated. **No status filter.**

## Roles table

Realistic SOW-based dummy data. Columns: Role Name, Description, Assigned Users Count, Role Type (if applicable), Created At, Updated At, Created By, Actions. Row actions: View, Edit, Clone, Delete.

Behavior: protected system roles cannot be deleted or edited by unauthorized users; roles with assigned users cannot be deleted directly (warn + require reassignment); assigned-user count is clickable and opens the assigned-user list.

## Create / Edit role (modal or drawer)

Fields: Role Name, Role Description, Permission Matrix. Do **not** include role status / Active-Inactive / deactivate. Validation: role name required; duplicate name errors; at least one permission selected; unsaved-changes warning on close; success/error toasts. Buttons — create mode: Cancel / Save Role; edit mode: Cancel / Update Role.

## Permission matrix

Rows are generated **only** from SOW-identified modules/screens/workflows/admin areas (e.g. Orders/Products/Customers/Reports/Settings for one SOW, or Bookings/Calendar/Payments/Notifications/User Management for another). Never use a module not in the SOW.

**Permission columns are dynamic per module.** View / Edit / Delete is the minimum set; extend with the types a module needs: Create, Approve, Export, Import, Run / Execute, Configure, Manage All. Not every module needs every type — if a permission does not apply, show it disabled / N/A, or omit it. Add "Select All" per module row and "Select All Permissions" for the full matrix; add tooltip/help text for complex permissions; group modules logically if many (Core Modules, Management, Operations, Reports, Settings, Integrations, Logs & Audit — only groups that fit the SOW).

## View role details

View-only state/page showing: role name, description, role type (if applicable), assigned-users count, created/updated dates, created by, last updated by, permission summary, assigned-users list, recent role activity. Actions: Edit, Clone, Delete, Back to Roles.

## Clone role

Copy permissions, not assigned users; pre-fill name `Copy of [Role Name]`; allow editing name/description/permissions before saving; confirm after successful clone.

## Delete role

Confirmation modal. If no users assigned, allow deletion. If users assigned, prevent direct deletion and show: `This role has assigned users. Please reassign users before deleting this role.` Provide reassign option. Protected system roles are not deletable.

## Assigned users

View users per role; click count to open list; reassign users to another role; prevent active users being left without a role; warn when changing permissions affecting active users. Assigned-users list shows: user name, email, current role, last login, reassign action.

## Protected system roles

Possible protected roles (only if relevant): Super Admin, Owner, System Admin. Rules: Super Admin cannot be deleted; Super Admin permissions cannot be reduced by lower-level users; a user cannot remove their own critical access; system roles show a lock icon; system roles may be view-only or partially editable per permissions.

## Audit trail

Track: role created / updated / cloned / deleted, permission changed, user assigned / removed / reassigned. Each entry: action, performed by, date/time, affected role, changed field, previous value, new value.

## States

- **Loading:** skeleton table rows, loading permission matrix.
- **Empty:** no roles created yet — CTA Create Role.
- **No search result:** no roles found matching filters.
- **Error:** failed to load roles / save role / update permissions.
- **No Access:** user does not have permission to manage roles.

## UX & responsive

Professional, modern, clean, production-ready, responsive, SOW-driven. Use tables, cards, badges, icons, modals, drawers, confirmation dialogs, toasts, permission matrix, empty/loading/error states.

- **Desktop:** full role table, full permission matrix, modal/drawer for create/edit.
- **Tablet:** condensed table, horizontal scroll for the matrix.
- **Mobile:** role cards instead of wide table; matrix grouped by module; sticky save/cancel in create/edit form.

## Final Output Rule

Before generating the UI, output a short analysis section: (1) modules identified from the SOW, (2) suggested default roles, (3) permission types required per module, (4) protected/system roles, (5) user-assignment rules, (6) assumptions made. Then generate the Roles & Permissions UI. The design must not look ERP/ecommerce/CRM/sync/booking-specific unless the SOW defines that project type.
