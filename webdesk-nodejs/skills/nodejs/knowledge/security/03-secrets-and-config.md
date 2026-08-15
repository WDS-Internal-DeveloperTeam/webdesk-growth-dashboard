---
tier: 2
load_when: ["code-production", "security-topic", "scaffold"]
description: "Secrets and config handling — env, secret managers, encryption at rest, no secrets in code or logs."
---

# Security 03 — Secrets & Config

> Secrets never live in code, git, or logs (NODE-004), and tokens never live in the DB as plaintext (NODE-103). This is how config and secrets actually flow.

---

## Config from environment

- **All config and secrets come from environment variables**, validated once at boot (`backend/01`). A missing required var fails startup — you never discover it on the first request.
- **`.env.example`** lists every required var with _no values_; it's the documented contract. Real `.env` files are git-ignored and never committed.
- **Per-environment config** (local/staging/prod) differs only by env values, not by code branches.
- **Naming:** `UPPER_SNAKE_CASE`, prefixed by system (`ERP_DDI_*`, `BIGCOMMERCE_*`, `JWT_*`) so scope and rotation are targeted (naming conventions).

```js
function requireEnv(name) {
  const v = process.env[name];
  if (!v) throw new Error(`Missing required env: ${name}`);
  return v;
}
```

---

## Secret storage by environment

- **Local:** git-ignored `.env` (Docker Compose injects it). Mock ERP/store credentials, never real client secrets.
- **Cloud/prod:** a **secret manager** — AWS Secrets Manager / SSM Parameter Store, GCP Secret Manager, or the platform's secret store (Heroku config vars, etc.) per the host target (`§15`). The app reads them as env at deploy/boot; humans don't paste prod secrets into chat or tickets.
- **CI:** secrets are CI-scoped masked variables, never echoed in logs. Test runs use mock/sandbox credentials.

---

## Secrets that get persisted: encrypt at rest (NODE-103)

The dashboard Settings module stores per-client API Key, Access Token, Client Secret, and the system stores ERP/store OAuth + refresh tokens and webhook secrets. These are persisted — so encrypt them:

- **Encrypt at rest** with a KMS-managed key, or app-level **AES-256-GCM** with the master key in the secret manager (never in the DB).
- **Decrypt only in memory at the point of use**; never log the plaintext; never return it in an API response (the Settings UI shows masked/last-4, with a re-enter-to-change flow).
- **Key rotation:** support re-encrypting stored secrets under a new key; store a key id/version alongside the ciphertext.

```js
// lib/crypto.js — AES-256-GCM with key from the secret manager
import { randomBytes, createCipheriv, createDecipheriv } from "node:crypto";
export function encrypt(plaintext, key) {
  const iv = randomBytes(12);
  const c = createCipheriv("aes-256-gcm", key, iv);
  const enc = Buffer.concat([c.update(plaintext, "utf8"), c.final()]);
  return { iv, tag: c.getAuthTag(), data: enc }; // store all three + keyVersion
}
```

---

## Redaction in logs

- The structured logger (`pino`) is configured with **redaction paths** for `authorization`, `password`, `token`, `apiKey`, `clientSecret`, `set-cookie`, etc., so they never reach the log pipeline even if accidentally passed.
- Error objects from upstreams can embed credentials in request configs — strip them before logging (NODE-004).

```js
const logger = pino({
  redact: ["req.headers.authorization", "*.password", "*.token", "*.apiKey", "*.clientSecret"],
});
```

---

## Checklist (G6 pre-launch touches this)

- [ ] No secret in code, git history, or logs
- [ ] `.env.example` complete; real secrets in the secret manager
- [ ] Stored tokens/credentials encrypted at rest, masked in UI/responses
- [ ] Distinct, rotatable secrets per system; rotation path tested
- [ ] Logger redaction configured and verified
