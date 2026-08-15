---
tier: 2
load_when: ["code-production", "security-topic", "backend-active"]
description: "JWT access+refresh, rotation, revocation, and per-module RBAC (View/Edit/Delete minimum, extended per module)."
---

# Security 02 — Authentication & Authorization

> The auth model for every dashboard/API: **JWT access + refresh** with rotation and revocation, and **per-module RBAC** (View/Edit/Delete is the minimum per module, extended per module where the SOW needs it). Matches blueprint §8.

---

## Authentication — JWT access + refresh

- **Two tokens.** A short-lived **access token** (e.g. 15 min) carries identity + tenant + role; a longer-lived **refresh token** (e.g. 7–30 days) exchanges for a new access token.
- **Refresh-token rotation:** every refresh issues a _new_ refresh token and invalidates the old one. If an old (already-rotated) refresh token is presented, treat it as theft — revoke the whole family and force re-login.
- **Server-side revocation list:** keep a store (DB/Redis) of revoked refresh tokens / token families and a `tokenVersion` per user. Logout, password change, and role change bump the version so outstanding tokens stop working. Access tokens are short-lived so they expire naturally; revocation is enforced at refresh time.
- **Storage:** prefer **httpOnly, Secure, SameSite cookies** for the refresh token; the access token can be in memory. Never put either in `localStorage` if avoidable (XSS-readable). See `frontend/01`.
- **Passwords:** hash with **argon2id** (or bcrypt) — never store or log plaintext (NODE-004). Show/hide + confirm fields on forms; rate-limit and lock-out on the login route.
- **Secrets:** access and refresh signing secrets are distinct, from env/secret manager, rotatable (`03-secrets-and-config.md`).

```js
// claims kept minimal; authorization is re-checked server-side, not trusted from the token alone
const access = jwt.sign(
  { sub: user.id, tenantId: user.tenantId, role: user.roleId, ver: user.tokenVersion },
  config.jwt.accessSecret,
  { expiresIn: "15m" },
);
```

```js
// auth middleware
export function authenticate(req, _res, next) {
  const token = readBearer(req); // or cookie
  const claims = jwt.verify(token, config.jwt.accessSecret); // throws → 401 centrally
  req.user = claims;
  req.tenantId = claims.tenantId; // tenant flows from here
  next();
}
```

---

## Authorization — per-module RBAC (extensible action matrix, VED minimum)

Authorization is a **per-module permission matrix** (blueprint §8): `role × module × {actions}`. The action set is **extensible**, not a fixed triple:

- **View / Edit / Delete is the seeded minimum** every module carries.
- A module **extends** the set with the actions it needs: **create, approve, export, import, run** (a.k.a. execute), **configure, manage_all**. A module only carries the actions that apply to it; a SOW that needs Approve/Run/Export therefore has a permission to grant and enforce.

A role is a set of `(module, action)` grants — where `action` is any string from that module's permission set — for Admin, Manager, + custom roles.

Data model (see `database/01`): permissions are stored as `(role_id, module, action)` rows (or a per role×module `permissions` set), VED seeded, any action addable — not fixed `can_view/can_edit/can_delete` columns.

```
modules:                   id, key (e.g. "users", "settings", "sync"), name
roles:                     id, tenant_id, name
role_module_permissions:   role_id, module_id, action   // one row per granted action; VED seeded, extensible
```

Enforcement — **every protected route declares the module + action it needs:**

```js
// require(module, action) — action is ANY string in that module's permission set
// (view|edit|delete seeded; create|approve|export|import|run|configure|manage_all when the module defines it)
export const require = (moduleKey, action) => async (req, res, next) => {
  const allowed = await permissionService.can(req.user.role, moduleKey, action);
  if (!allowed) return next(new ForbiddenError(moduleKey, action)); // 403
  next();
};

router.get("/users", authenticate, require("users", "view"), listUsers);
router.put("/users/:id", authenticate, require("users", "edit"), updateUser);
router.delete("/users/:id", authenticate, require("users", "delete"), deleteUser);
router.post("/sync/:id/run", authenticate, require("sync", "run"), runSync); // extended action
router.post("/invoices/:id/ok", authenticate, require("invoices", "approve"), approveInvoice); // extended action
```

Rules:

- **Server-side is the control.** The dashboard hides modules/actions for UX (`frontend/02`), but the route check is what actually authorizes (OWASP API5).
- **Object-level check too** (OWASP API1/BOLA): "can edit `users`" is function-level; the service still confirms the target object belongs to `req.tenantId` (NODE-104).
- **Master/super-admin** is a distinct role whose cross-tenant access is explicit and audited (`database/03`).
- A **role change revokes outstanding tokens** (bump `tokenVersion`) so a demoted user loses access immediately, not at token expiry.

---

## Audit

Authentication events (login, refresh, revoke), authorization denials, and every master-scope access write to `audit_log`. This feeds the activity log module and the security tests.
