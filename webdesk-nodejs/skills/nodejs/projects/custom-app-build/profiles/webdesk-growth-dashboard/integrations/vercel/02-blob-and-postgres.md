---
tier: 2
load_when: ["webdesk-growth-dashboard", "integration-work", "schema-work"]
description: "Concrete adapter reference for Vercel Blob object storage and Vercel-provisioned PostgreSQL connection handling, including the serverless-aware pooling concern flagged in knowledge/03-nestjs-on-vercel.md."
---

# Vercel — Blob and PostgreSQL

> Concrete adapter reference. Policy (upload limits, formats, interim scan statuses) lives in `../../knowledge/08-vercel-blob-and-file-handling.md`. The Neon-exclusion stop-condition and region requirement live in `../../knowledge/01-approved-architecture.md` §"Database" — read both before implementing either piece.

---

## `ObjectStorageAdapter` against Vercel Blob

```ts
// packages/integrations/vercel/src/blob-adapter.ts
export class VercelBlobAdapter implements ObjectStorageAdapter {
  async getUploadAuthorization(fileMeta: FileMeta, opts: { directUpload: boolean }) { ... }
  async confirmUpload(assetId: string, checksum: string) { ... }
  async getSignedDownloadUrl(assetId: string, opts: { ttl: number }) { ... }
  async delete(assetId: string) { ... }
}
```

- **Direct-to-Blob upload** uses Vercel Blob's client-upload token mechanism — the browser requests a short-lived upload token from `dashboard-api`, then uploads directly to Blob, never proxying the full file body through a Function (avoids the request-body size ceiling entirely for large files, per `../../knowledge/08-vercel-blob-and-file-handling.md`'s direct-upload threshold discussion).
- **Checksum** (SHA-256) computed client-side during/after upload and verified server-side in `confirmUpload()` before the asset's metadata record is marked usable.
- **Signed download URLs** are time-limited (TTL configured per confidentiality tier — a `restricted` asset may warrant a shorter TTL than a `public` one, though `public` assets in this system are still never anonymously public per the private-Blob requirement).
- **Private store** — every Blob object requires the store's access token/auth to read; there is no public-bucket-equivalent URL pattern in use.

---

## PostgreSQL connection handling on Vercel Functions

**This is a serverless-specific concern the base skill's connection-pool guidance (sized for a persistent process) does not address** — flagged in `../../knowledge/03-nestjs-on-vercel.md` §"Cold-start and bootstrap." Concrete options, finalized once the actual Vercel Marketplace Postgres provider is selected (`../../knowledge/01-approved-architecture.md` §"Database"):

- **Provider-side connection pooler** (many managed-Postgres-on-Vercel offerings include a pgbouncer-style pooler endpoint distinct from the direct-connection endpoint) — the application connects to the pooler endpoint, not the direct database endpoint, so many concurrent cold-started Functions don't each open a full Postgres connection.
- **Sequelize pool sizing** tuned small (`pool: { max: 1-2, idle: <short> }` per Function instance, relying on the pooler above to multiplex actual database connections) rather than the base skill's persistent-process-oriented pool sizes (`pool: { max: 10 }`).
- **Serverless driver mode**, if the selected provider offers one (some serverless Postgres providers offer an HTTP- or WebSocket-based driver specifically designed for Functions environments as an alternative to a traditional TCP connection pool) — evaluate against standard `pg`+Sequelize once the provider is known; do not assume this is available or necessary until the provider is confirmed.

**Do not finalize this section's implementation until the Postgres provider stop-condition in `../../knowledge/01-approved-architecture.md` is resolved** — the concrete pooling mechanism depends on which provider is actually usable within the Neon-exclusion / East-Coast constraint.

---

## verify-at-discovery checklist

- [ ] Vercel Blob client-upload token mechanism and current SDK surface.
- [ ] Confirmed Vercel Marketplace Postgres provider (blocks finalizing pooling approach).
- [ ] That provider's recommended serverless connection-pooling mechanism.
- [ ] Vercel Blob signed-URL TTL configuration options and defaults.

See `pointers.md` for documentation anchors.
