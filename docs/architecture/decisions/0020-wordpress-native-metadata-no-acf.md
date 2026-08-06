# ADR-0020 — WordPress Native Metadata and No-ACF Architecture

**Status:** Accepted, following a resolved conflict between two approved sources — see below

## Context

`01_Dashboard_Master_Specification.md` explicitly excludes ACF ("Advanced Custom Fields") and ACF Local JSON from the WordPress architecture. The registered Current WordPress Technical Discovery document (`canonical-inputs/Current_WordPress_Technical_Discovery.md`) directly contradicted this at the target-architecture level (its "Theme folder structure" recommendation still references an `acf-json/` directory and `inc/acf.php`), and an earlier-supplied version of that same document additionally reported ACF as an installed, active plugin at the current-state level. This was a genuine conflict between two precedence-level sources, surfaced to the project owner rather than silently resolved, per `knowledge/00-scope-and-precedence.md §1–3`.

## Decision

- **Target architecture:** no ACF, no ACF Local JSON, no ACF-pattern custom-field abstraction of any kind, for any new field or new theme development, in any environment. The WebDesk Custom Theme's field groups (global settings, page sections, services, case studies, testimonials, FAQs, team members, CTAs) are implemented with `register_post_meta()`, native meta boxes, custom PHP admin interfaces, custom taxonomies, WordPress attachment IDs, and approved custom tables where justified — never ACF. The Master Specification's exclusion is authoritative here; this is not a close call.
- **Current state:** no confirmed ACF data dependency exists. The record is kept clean and in two parts, neither edited into the other:
  1. The originally-supplied Current WordPress Technical Discovery document (`canonical-inputs/Current_WordPress_Technical_Discovery.md`) is preserved exactly as supplied.
  2. A separate, dated owner clarification (`canonical-inputs/Owner_Clarifications_2026-08-05.md`) supersedes the discovery document's ACF-related planning/current-use assumption: _"There will be no ACF. WebDesk is not currently using ACF in the WordPress system. Native meta objects and custom PHP will be used."_

  This owner clarification is what governs — not a reconstructed history of the discovery document itself. (Separately, and not load-bearing for this decision: the discovery document's own Part 1 was re-supplied on 2026-08-06 as a native Markdown file, whose plugin inventory does not list ACF — a fact independently verifiable from this session's own record, noted here only because it happens to be consistent with the owner clarification, not as the basis for this ADR's decision.)

- **No ACF data migration is assumed or planned.** Verification of actual plugin presence happens once, at implementation kickoff, as a routine part of the WordPress verification checklist. If ACF is found installed but unused, it is removed through the approved plugin-cleanup process (a cleanup action, not a migration project). If ACF is found installed **and** in active use for real content, that is new information contradicting this ADR and the owner clarification, and must be escalated as a fresh conflict, not silently folded back into an assumed migration plan.

## Alternatives considered

- **Following the Technical Discovery document's original ACF recommendation** — rejected: contradicts the higher-precedence Master Specification, and the conflict-handling rule requires following the higher-precedence source.
- **Assuming an ACF migration project is required "to be safe"** — rejected: no confirmed current dependency exists per the owner clarification; inventing a migration workstream for unconfirmed data would itself be a fabrication this project's standing discipline exists to prevent.

## Consequences

Every field-group implementation across the WebDesk Custom Theme's modules (Services, Case Studies, Testimonials, Team Members, FAQs, global settings, reusable CTAs) is built on native WordPress mechanisms from the start — no ACF dependency is ever introduced, even temporarily, during Phase 1+ implementation.

## Security considerations

Native `register_post_meta()` usage should follow WordPress's own meta-field sanitization/capability conventions — no ACF-specific security model applies since ACF is not used.

## Operational considerations

The CaseStudy/Portfolio plugin migration (a separate, already-resolved decision — Option A, register post types in the WebDesk Custom Theme itself, with exact meta-key mappings confirmed in the Technical Discovery document) is unrelated to this ACF decision and proceeds independently.

## Validation method

Reviewed against `01_Dashboard_Master_Specification.md`, `canonical-inputs/Current_WordPress_Technical_Discovery.md`, `canonical-inputs/Owner_Clarifications_2026-08-05.md`, and profile `knowledge/07-wordpress-integration.md` §"ACF conflict — resolved."

## Approval gate

G1 (architecture approval) — this ADR specifically should not be treated as routine, given its conflict-resolution history; a reviewer should specifically confirm no file anywhere in this project states ACF is "confirmed installed and active" or "must be migrated."

## Related dashboard requirements

`01_Dashboard_Master_Specification.md`, `10_WordPress_Integration_and_Migration.md`.

## Related skill rules

Profile `knowledge/07-wordpress-integration.md`; WDS-001 (absolute rule).

## Open setup values

Actual ACF plugin presence is unconfirmed until implementation-kickoff verification — tracked in `docs/project-state/setup-input-register.md`, not blocking Phase 0.
