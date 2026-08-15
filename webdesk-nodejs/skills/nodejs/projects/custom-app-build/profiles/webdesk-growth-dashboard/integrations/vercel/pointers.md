---
tier: 2
load_when: ["webdesk-growth-dashboard", "integration-work"]
description: "Vercel Functions/Queues/Workflows/Cron/Blob/Postgres doc anchors. Confirm current product surfaces at build — Queues/Workflows are newer Vercel products more likely to change than the core Functions runtime."
---

# Vercel — Doc Pointers

## Doc anchors

### Compute

- Vercel Functions: https://vercel.com/docs/functions
- Functions runtime limits (duration, payload size): https://vercel.com/docs/functions/runtimes
- Node.js runtime: https://vercel.com/docs/functions/runtimes/node-js

### Jobs

- Vercel Queues: https://vercel.com/docs/queues
- Vercel Workflows: https://vercel.com/docs/workflows
- Vercel Cron Jobs: https://vercel.com/docs/cron-jobs

### Storage

- Vercel Blob: https://vercel.com/docs/storage/vercel-blob
- Vercel Postgres / Marketplace database integrations: https://vercel.com/docs/storage

### Fallback

- Upstash QStash: https://upstash.com/docs/qstash
- Upstash Redis: https://upstash.com/docs/redis

## At-build checklist

- [ ] Confirm current Vercel Queues and Vercel Workflows product surface — these are newer products more likely to have changed since this skill build than the core Functions runtime.
- [ ] Confirm current Functions request-body size and execution-duration limits.
- [ ] Confirm which Postgres providers are currently available through Vercel's Marketplace/Storage integrations, and whether any qualifying North America East Coast option exists that is not Neon-based (the stop-condition in `../../knowledge/01-approved-architecture.md`).
- [ ] Confirm Vercel Blob's current client-upload token API.
