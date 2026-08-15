---
tier: 2
load_when: ["code-production", "frontend-active"]
description: "React/Next standards for dashboards — structure, data fetching, JWT auth handling, state, forms/validation."
---

# Frontend 01 — React / Next Standards

> Standards for the React/Next dashboards this system builds. Same spirit as the backend coding standards: small components, validated input, no secrets in the client, predictable structure.

---

## Project structure (Next.js App Router)

```
app/
├── (auth)/login/page.jsx          public route
├── (dashboard)/                    auth-gated group
│   ├── layout.jsx                  shell: nav, RBAC-gated menu, theme
│   ├── page.jsx                    dashboard home (KPIs)
│   ├── users/                      module route
│   └── settings/
├── api/                            route handlers (BFF) — never call the ERP directly from the browser
components/
├── ui/                             presentational, reusable (Button, Table, Card)
└── modules/                        feature components (UserTable, RoleMatrix)
lib/
├── api-client.js                   typed fetch wrapper (attaches access token, refresh-on-401)
├── auth.js                         token storage, decode, refresh
└── schemas.js                      zod schemas shared with forms
hooks/                              useUsers, useCurrentUser, usePermissions
```

- **Components are small and single-purpose.** Presentational components in `ui/` take props and render; data-fetching/stateful logic lives in hooks or server components.
- **kebab-case files, PascalCase component names** (`user-table.jsx` → `export function UserTable()`).
- Function components + hooks only. No class components.

---

## Data fetching

- **Server components fetch on the server** where the data is auth-scoped and not user-interactive — keeps tokens off the client and payloads small.
- **Client interactivity** (filtering, mutations) uses a data layer — **TanStack Query** (or SWR) — for caching, loading/error states, and revalidation. Don't hand-roll fetch-in-`useEffect` for anything non-trivial.
- **All browser → backend traffic goes through the BFF / the app's own API,** never directly to the ERP or store from the browser. The browser holds a JWT for _our_ API only; upstream credentials stay server-side (NODE-004, NODE-103).
- Centralize fetch in `lib/api-client.js`: it attaches the access token, and on a `401` it attempts a single refresh then retries once before redirecting to login.

```js
// lib/api-client.js (sketch)
export async function apiFetch(path, opts = {}) {
  let res = await fetch(`/api/v1${path}`, withAuth(opts));
  if (res.status === 401 && (await tryRefresh()))
    res = await fetch(`/api/v1${path}`, withAuth(opts));
  if (!res.ok) throw new ApiError(res.status, await safeJson(res));
  return res.json();
}
```

---

## Auth handling (JWT — aligns with `security/02-authn-authz.md`)

- **Access + refresh tokens.** Short-lived access token, longer-lived refresh token.
- **Prefer httpOnly, Secure, SameSite cookies** for tokens over `localStorage` — `localStorage` is readable by any XSS. If the architecture requires a bearer token in JS, scope the blast radius and never store the refresh token in JS.
- **Refresh-token rotation:** each refresh issues a new refresh token and invalidates the old; the client just retries the failed request after refresh.
- **Show/hide password fields** on login and user forms (blueprint §8). Confirm-password fields validate equality client-side and server-side.
- **Never decode trust from the client.** The client may read the JWT to render the right menu, but every authorization decision is re-checked server-side per request — the UI gate is convenience, not security.

---

## State

- **Server state** (data from the API) → TanStack Query / SWR cache. Don't duplicate it into a global store.
- **UI/local state** → `useState`/`useReducer` in the owning component.
- **Cross-cutting app state** (current user, permissions, theme) → a small context provider, not a heavyweight global store. Keep it minimal.

---

## Forms & validation

- **Validate on both sides.** Client validation is UX; the server re-validates the same shape (NODE-005). Share the schema where possible.
- Use **React Hook Form + zod** (`zodResolver`) for forms — declarative, accessible error wiring, minimal re-renders.
- Map server validation errors (422) back onto the right fields rather than a generic toast.

```jsx
const form = useForm({ resolver: zodResolver(CreateUserSchema) });
```

---

## Quality bar

- No secrets, API keys, or upstream tokens in client code or `NEXT_PUBLIC_*` env (those ship to the browser).
- Accessible by default: semantic elements, labels tied to inputs, keyboard-navigable, focus states. Tested with axe (`testing/03`).
- ESLint (with the React/Next plugins) + Prettier; no `console.log` left in shipped code.
- Loading and error states are designed, not afterthoughts — a dashboard that monitors syncs must show "stale", "error", and "loading" honestly.
