# Proposed Patch 09 — `project-json.schema.json`: Add `vercel` to `host_target` Enum

**Status:** Proposed. Not merged. Not applied to the base skill by this task.

## Reason

`_contracts/project-json.schema.json`'s `project.host_target` enum is `["local", "aws", "gcp", "cloudflare", "heroku", "vps"]` — Vercel, a mainstream Node.js/Next.js hosting target, is absent. This project worked around it with a project-local composed schema extension (`profiles/webdesk-growth-dashboard/contracts/project-profile.schema.json`, per the skill-build task's explicit "prefer a project-local schema extension... avoid changing the global schema directly unless necessary" instruction) rather than editing the base schema directly.

## Current gap

A project choosing Vercel as its host target cannot validate a plain `project.json` against the unmodified base schema without either an enum mismatch or a project-local extension (which this project uses, but which every future Vercel-hosted project would otherwise have to reinvent).

## Proposed files changed

- **Edit:** `webdesk-nodejs/skills/_contracts/project-json.schema.json` — one-line change: `"host_target": { "enum": ["local", "aws", "gcp", "cloudflare", "heroku", "vercel", "vps"], ... }` (alphabetized insertion of `"vercel"`).

## Compatibility impact

**Fully backward compatible.** Adding an enum value never invalidates any existing `project.json` that used one of the prior values — this is a strictly additive schema change. No existing project's state file needs modification.

## Regression risk

**Very low.** This is the lowest-risk patch in this set — a single enum-value addition to a JSON Schema `enum` array, with no structural or semantic change to any other field.

## Reusability scope

**Generally reusable** — Vercel is a common enough deploy target that this addition benefits any future project, not just this one. Recommend applying this patch first among the ten, given its near-zero risk and immediate value.
