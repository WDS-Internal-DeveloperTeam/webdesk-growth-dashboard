---
tier: 2
load_when: ["webdesk-growth-dashboard", "integration-work"]
description: "WordPress REST API adapter — Application Password auth, least-privilege roles, read/approved-draft-write operations, and the request/response boundary-validation rule applied to WordPress specifically."
---

# WordPress — REST API and Application Passwords

> Loaded only when the active task implements or modifies the WordPress integration. Policy-level rules (no ACF for new development, migration sequencing, production WP-CLI allowlist) live in `../../knowledge/07-wordpress-integration.md` — read that first. This file is the concrete adapter-implementation reference. **Discovery status: the Current WordPress Technical Discovery document is registered** at `canonical-inputs/Current_WordPress_Technical_Discovery.md` — see `../../knowledge/00-scope-and-precedence.md §4` and `../../knowledge/07-wordpress-integration.md §"Discovery status"`. **REST API (`/wp-json/`) availability specifically remains unconfirmed** — the registered document states this explicitly ("could not be verified during the external check"). Application Password support and WP-CLI/SSH actual provisioning are also still open per that same document's own verification checklist. Do not assert either as confirmed working.

---

## Adapter interface

```ts
// packages/integrations/wordpress/src/adapter.ts
export interface WordPressAdapter {
  // Reads
  getPost(postType: string, id: number): Promise<WPPost>;
  listPosts(postType: string, query: WPQuery): Promise<WPPost[]>;
  getPostMeta(postId: number, key: string): Promise<unknown>;
  getPublicationState(postId: number): Promise<{ status: string; url: string | null }>;

  // Approved-draft writes only — never direct publish
  createDraft(postType: string, data: WPDraftInput): Promise<WPPost>;
  updateDraft(postId: number, data: Partial<WPDraftInput>): Promise<WPPost>;

  // Health
  healthCheck(): Promise<{ ok: boolean; latencyMs: number; wpVersion?: string }>;
}
```

Called only through this interface from `dashboard-api`/`dashboard-worker` — never raw `fetch()` calls to the WordPress REST endpoint scattered through business logic, per the same adapter-interface discipline as every other external integration in this profile.

---

## Authentication

- **Dedicated Application Password account per environment** — a WordPress user account created specifically for the dashboard integration, not a shared administrator account, with **least-privilege role** (a custom WordPress role scoped to exactly the operations in scope, not the built-in Administrator role).
- Application Password stored as an environment variable / secret-manager reference (`nodejs/knowledge/security/03-secrets-and-config.md`), transmitted per-request via HTTP Basic Auth over TLS (the standard Application Passwords mechanism), never logged.
- **Independent rotation per environment** — rotating Staging's credential never requires touching Production's.

---

## Allowed operations (restated from policy file, concrete form)

| Operation                          | Allowed?                                                            | Notes                                                                                                                                                                       |
| ---------------------------------- | ------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Read posts/pages/media/terms/menus | Yes                                                                 | Where approved per content type                                                                                                                                             |
| Read publication status            | Yes                                                                 | Feeds Page Inventory / Case Study Library's indexed-copy records — never treated as more authoritative than a fresh read (`../../knowledge/10-data-ownership-and-audit.md`) |
| Create/update **drafts**           | Yes                                                                 | Never publish directly through this path                                                                                                                                    |
| Publish                            | **No**, unless a separately approved workflow explicitly permits it | See `../../knowledge/07-wordpress-integration.md`                                                                                                                           |
| Delete                             | Not by default                                                      | Not part of the approved operation set unless a specific workflow requires it and is separately approved                                                                    |

---

## Boundary validation (NODE-005, applied to WordPress responses)

WordPress REST responses are **untrusted external input**, validated with a schema before use — identical rule to how the base skill treats ERP/store responses (`nodejs/knowledge/01-coding-standards.md`, `security/01-owasp-api.md` API10), applied here because a WordPress installation's actual field shapes (especially native `post_meta` once §"Native structured content" fields are registered) can drift from what's assumed without a live discovery pass.

```ts
// packages/validation — WordPress response schemas, validated before the adapter returns data
const WPPostSchema = z.object({
  id: z.number(),
  status: z.string(),
  link: z.string().url().nullable(),
  // ... fields validated per registered custom meta once confirmed at discovery
});
```

---

## verify-at-discovery checklist

- [ ] Current WordPress version and REST API availability/restrictions (`10_WordPress_Integration_and_Migration.md §1` — reported but unverified).
- [ ] Application Password support actually enabled on the target WordPress.com plan/configuration.
- [ ] Exact custom REST field/endpoint shapes once native `register_post_meta()` fields are registered (`../../knowledge/07-wordpress-integration.md` §"Native structured content").
- [ ] Rate limits or request-throttling behavior on the WordPress.com side, if any.

See `pointers.md` for documentation anchors.
