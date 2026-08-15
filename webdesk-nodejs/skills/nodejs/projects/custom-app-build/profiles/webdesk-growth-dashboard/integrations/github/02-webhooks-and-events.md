---
tier: 2
load_when: ["webdesk-growth-dashboard", "integration-work", "security-topic"]
description: "GitHub webhook events consumed by the dashboard, signature verification, replay protection, idempotent processing, and failed-webhook recovery."
---

# GitHub — Webhooks and Events

> Applies `nodejs/knowledge/security/04-webhook-security.md`'s three-control model (verify signature → reject replays → process idempotently) to GitHub's specific headers and event shapes. Policy context: `../../knowledge/06-github-app-integration.md` §"Webhook security."

---

## Events subscribed (scope to what's actually consumed)

| Event                       | Consumer                               | Notes                                                            |
| --------------------------- | -------------------------------------- | ---------------------------------------------------------------- |
| `pull_request`              | Ready for Claude Queue, Release Center | opened / closed / synchronize / review_requested / review states |
| `check_suite` / `check_run` | Technical Center, Release Center       | CI status sync                                                   |
| `deployment_status`         | Release Center                         | deployment state sync                                            |
| `push`                      | Ready for Claude Queue, Release Center | commit-existence / SHA tracking on protected branches            |

Do not subscribe to an event type with no dashboard consumer — each additional subscription is additional idempotency and security surface with no product value (`../../knowledge/06-github-app-integration.md` §"Events actually needed").

---

## 1. Verify the signature

```ts
// Raw body MUST be captured before NestJS's JSON body-parsing runs for this route
// (see ../../knowledge/03-nestjs-on-vercel.md, "Layering" table).
import { createHmac, timingSafeEqual } from "node:crypto";

function verifyGitHubSignature(rawBody: Buffer, signatureHeader: string, secret: string): boolean {
  const expected = "sha256=" + createHmac("sha256", secret).update(rawBody).digest("hex");
  const a = Buffer.from(expected);
  const b = Buffer.from(signatureHeader ?? "");
  return a.length === b.length && timingSafeEqual(a, b);
}
```

Header: `X-Hub-Signature-256`. Reject with 401 on mismatch; log the rejection without the payload body's potentially sensitive contents. The webhook secret is per-installation (or per-App, depending on configuration — **verify at discovery**), stored per `nodejs/knowledge/security/03-secrets-and-config.md`.

## 2. Reject replays

- **Dedupe key:** `X-GitHub-Delivery` header (a UUID, unique per delivery attempt — including redeliveries triggered manually from the GitHub UI, which reuse the _original_ delivery ID in some cases — **verify this behavior at discovery**, since it affects whether a manual redelivery should be treated as a legitimate reprocess-request or a replay to ignore).
- Record processed delivery IDs per `contracts/webhook-event.schema.json`'s unique index on `(provider, event_id)`.

## 3. Process idempotently

- Ack fast (`202`) once signature-verified and enqueued; do the actual PR/commit/deployment-state update from the queue (`JobQueueAdapter`, `../../knowledge/04-serverless-queues-workflows-and-cron.md`).
- Upsert on GitHub's own stable IDs (PR number + repo, commit SHA, deployment ID) — never blind-insert a new `pull_requests`/`deployments` row on every event for the same underlying entity.

---

## Failed webhook recovery

A webhook that fails processing _after_ successful delivery+ack follows the standard job-record retry/DLQ discipline (`../../knowledge/04-serverless-queues-workflows-and-cron.md`). Separately, GitHub itself offers delivery-level redelivery (for deliveries that failed at the transport level, e.g., the dashboard's endpoint was down) from the App's webhook deliveries UI/API — record in the integration contract whether the dashboard also exposes an operator-facing "replay" action or relies on GitHub's own redelivery exclusively.

---

## verify-at-discovery checklist

- [ ] Exact webhook secret configuration (per-App vs. per-installation).
- [ ] Whether a manually-redelivered event reuses the original `X-GitHub-Delivery` ID.
- [ ] Exact payload shape for each subscribed event type, current API version.
