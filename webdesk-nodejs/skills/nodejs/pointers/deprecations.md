---
tier: 2
load_when: ["nodejs", "planning", "g1_5", "integration-work"]
description: "Deprecation tracker — placeholder structure for recording deprecated/sunset versions, APIs, and contract api_versions across the Node stack, ERPs, and store platforms. Update at scaffold + each version-upgrade project."
---

# Deprecation Tracker

> Single place to record anything sunsetting that the system must roll forward off: Node-stack versions, store-platform API versions, ERP API versions, and library/API surfaces. **This is a living placeholder — populate at scaffold (G3) and whenever a `version-upgrade` or `verify-at-discovery`/`verify-at-build` check finds drift.** Architecture fitness tests enforce pinned `api_version`s; this file is where the human-tracked sunset _dates_ live. Empty rows are expected until real verification fills them.

## How to use

- One row per deprecated/sunset item. Add the **replacement** + **deadline** + **owner** + **status**.
- Cross-reference the contract `deprecation_date` field (`integration-contract.schema.json`) for store/ERP API versions.
- Review at every G1.5 and before each launch (G6).

## Node stack

| Item           | Deprecated/sunset          | Current target | Replace by          | Status | Notes                                         |
| -------------- | -------------------------- | -------------- | ------------------- | ------ | --------------------------------------------- |
| Sequelize v7   | alpha — not for production | v6.x stable    | —                   | watch  | Do not adopt until stable; flag if requested. |
| Express 4.x    | superseded by 5.x          | Express 5.x    | new projects on 5.x | watch  | Note 4→5 breaking changes on any upgrade.     |
| _add as found_ |                            |                |                     |        |                                               |

## BigCommerce

| Item                        | Deprecated/sunset          | Current target | Replace by   | Status          | Notes                                   |
| --------------------------- | -------------------------- | -------------- | ------------ | --------------- | --------------------------------------- |
| v2 endpoints (per-resource) | partially superseded by v3 | v3             | per-resource | verify-at-build | Confirm which resources remain v2-only. |
| _add as found_              |                            |                |              |                 |                                         |

## Shopify

| Item                       | Deprecated/sunset           | Current target    | Replace by             | Status          | Notes                                            |
| -------------------------- | --------------------------- | ----------------- | ---------------------- | --------------- | ------------------------------------------------ |
| REST Admin API             | **legacy since 2024-10-01** | GraphQL Admin API | GraphQL                | confirmed       | Build new on GraphQL; new features GraphQL-only. |
| Old quarterly API versions | sunset ~1 yr after release  | current `YYYY-MM` | roll forward quarterly | verify-at-build | Watch `X-Shopify-Api-Version` on webhooks.       |
| _add as found_             |                             |                   |                        |                 |                                                  |

## ERP APIs

| ERP                 | Item                                        | Deprecated/sunset                     | Replace by     | Status              | Notes                                        |
| ------------------- | ------------------------------------------- | ------------------------------------- | -------------- | ------------------- | -------------------------------------------- |
| NetSuite            | Token-Based Auth (TBA) for new integrations | being phased out (no new TBA ~2027.1) | OAuth 2.0      | verify-at-discovery | Prefer OAuth2 for new builds.                |
| NetSuite            | SuiteTalk SOAP                              | discouraged (legacy)                  | SuiteTalk REST | verify-at-discovery | Use REST for new integrations.               |
| DDI Inform / others | API versions                                | unknown                               | —              | verify-at-discovery | Fill once the real API surface is confirmed. |
| _add as found_      |                                             |                                       |                |                     |                                              |
