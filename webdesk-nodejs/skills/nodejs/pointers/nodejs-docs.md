---
tier: 2
load_when: ["nodejs", "code-production", "planning"]
description: "Anchored official doc URLs + pinned versions for the Node stack (Node 22, Express, Sequelize, React, Next). Confirm exact minor/patch at project scaffold; record drift in deprecations.md."
---

# Node Stack — Doc Pointers

> Official entry points for the WebDesk Node stack (blueprint §11, CONVENTIONS §8). Versions below are the **major lines to target**; **confirm the exact minor/patch at scaffold (G3)** and pin in `package.json`. As of authoring (2026-06-30) the noted current versions are accurate; record any drift in `deprecations.md`. Always prefer the official docs over blog posts.

## Pinned versions (targets)

| Layer          | Target       | Current (2026-06-30)                           | Notes                                                                                                                       |
| -------------- | ------------ | ---------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------- |
| **Node.js**    | **22.x LTS** | 22.x active LTS                                | ES Modules, `async/await` only (blueprint §11). Confirm LTS status at scaffold.                                             |
| **Express**    | **5.x**      | 5.x (stable since 2024-10)                     | Express 5 is the stable line; note breaking changes vs 4.x.                                                                 |
| **Sequelize**  | **6.x**      | 6.37.x stable (7.x still alpha)                | **Default ORM** (blueprint §10). Stay on **v6 stable**; do NOT adopt v7 until it leaves alpha — flag if a project wants it. |
| **React**      | **19.x**     | 19.x                                           | Used by the dashboard.                                                                                                      |
| **Next.js**    | **16.x**     | 16.2.x (16 stable since 2025-10; min Node 20+) | Dashboard framework; Turbopack default in 16. Confirm current at scaffold.                                                  |
| **PostgreSQL** | **16.x+**    | —                                              | Default DB (blueprint §10).                                                                                                 |

## Doc anchors

- Node.js 22 docs: https://nodejs.org/docs/latest-v22.x/api/
- Node.js releases/LTS schedule: https://nodejs.org/en/about/previous-releases
- Express 5: https://expressjs.com/en/5x/api.html · v5 release notes: https://expressjs.com/en/blog/2024-10-15-v5-release/
- Sequelize v6: https://sequelize.org/docs/v6/ · releases/versioning: https://sequelize.org/releases/
- React: https://react.dev/reference/react
- Next.js: https://nextjs.org/docs
- PostgreSQL 16: https://www.postgresql.org/docs/16/index.html
- node-cron: https://www.npmjs.com/package/node-cron · BullMQ: https://docs.bullmq.io/

## At-scaffold (G3) checklist

- [ ] Confirm Node 22 is current active LTS; pin engine in `package.json`.
- [ ] Pin Express 5.x, Sequelize 6.x (NOT 7 alpha), React 19.x, Next 16.x — exact patch.
- [ ] Record any version that has moved on / been deprecated → `deprecations.md`.
- [ ] Confirm queue choice (node-cron default; BullMQ+Redis when concurrency/retries/DLQ needed — blueprint §20).
