# Owner Clarifications — 2026-08-05

This file records a project-owner clarification issued **after** the initial WordPress Technical Discovery document was registered, kept separate from that document rather than edited into it, so the discovery document's original content and this later clarification both remain independently auditable.

**Do not read this as a correction of the discovery document's content.** The discovery document (`canonical-inputs/Current_WordPress_Technical_Discovery.md`) is preserved exactly as supplied. This file records a _later_ clarification that supersedes one specific reading of it — the plugin-inventory line item that reported ACF ("Advanced Custom Fields") as installed and active — for planning and implementation purposes going forward.

---

## Context

On 2026-08-05, registering the WordPress Technical Discovery document surfaced a conflict: its "ACF version and field groups" entry recommended building new field groups on free-tier ACF + ACF Local JSON, and its plugin inventory listed ACF 6.8.6 as installed and active. This directly contradicted `01_Dashboard_Master_Specification.md`'s "No ACF or ACF Local JSON" exclusion, on which this profile's WDS-001 forbidden-action rule is built.

Per `knowledge/00-scope-and-precedence.md`'s conflict-handling rule, this was surfaced to the project owner rather than resolved silently. Two clarifications followed, both on 2026-08-05:

1. **Target architecture:** the Master Specification's "No ACF" exclusion stands. No new ACF field groups, no ACF Local JSON, in any new development.
2. **Current-state fact:** a further clarification revised the underlying current-state reading itself, not just the target-architecture choice.

## The clarification (verbatim)

> "There will be no ACF. WebDesk is not currently using ACF in the WordPress system. Native meta objects and custom PHP will be used."

## What this means, stated plainly

- **No confirmed ACF data dependency exists.** The discovery document's plugin-inventory line reporting ACF 6.8.6 as installed and active is not treated as confirmed evidence of a current, active data dependency.
- **WebDesk is not using ACF for structured WordPress content.** This applies to both current state and all new development.
- **No ACF data migration is assumed.** There is no migration workstream to plan for, budget, or schedule on this basis.
- **New development uses native WordPress metadata and custom PHP** — `register_post_meta()`, native meta boxes, custom PHP admin interfaces, custom taxonomies, WordPress attachment IDs, and approved custom tables where justified.
- **Plugin presence will be verified at implementation kickoff.** This is a routine, one-time verification step (already part of the discovery document's own "Remaining WordPress verification items" list), not evidence-gathering for a migration that is otherwise assumed to be needed.
- **If ACF is found installed but unused, it may be removed after staging verification**, through the approved plugin-cleanup process. This is a cleanup action, not a content-migration project.

## If this is ever contradicted

If, at implementation kickoff, ACF is found installed **and** in active use for real content, that is new information that contradicts this clarification — it should itself be escalated as a fresh conflict per `knowledge/00-scope-and-precedence.md §3`, not silently resolved in either direction.

## Where this is applied

This clarification is reflected in: `knowledge/00-scope-and-precedence.md §4`, `knowledge/07-wordpress-integration.md`, `knowledge/15-project-specific-forbidden-actions.md` (WDS-001), `README.md`, `CHANGELOG.md`, and `docs/skill-build/approval-checklist.md`. Each of those files points back to this file rather than repeating its full text.
