# Brand Library (module #13) — scope and as-built record

> **New template, effective 2026-08-27**: this single file replaces the old task-package +
> implementation-doc pair. The `## Scope` section below is written before any code exists; the
> as-built sections are appended once the module is built and verified.

## Scope

### Pre-implementation verification

| Check                                | Result                                                                             |
| ------------------------------------- | ----------------------------------------------------------------------------------- |
| Recommended roadmap position          | Row 13, Wave 4 — `canonical-inputs/Recommended_Module_Roadmap.md`                  |
| Dependency-computed roadmap position  | Wave 1, no dependencies — `docs/phase-plans/module-implementation-roadmap.md`      |
| Registry dependency                   | `null` — no prerequisite module                                                    |
| RBAC permission group                 | `creative_design`, already seeded (migration `00013`) — **no new RBAC migration**  |
| Confidentiality level (seeded)        | `null` — organization-wide, no confidential-field mechanism needed                 |
| Open Critical/High security finding   | None                                                                                |
| Blocking credential                   | None                                                                                |

Source material: `03_Detailed_Module_Specifications.md §10` (flat field list: logos, colors,
typography, photography, illustration, icon rules, tone, visual personality, dos/don'ts,
deprecated assets — "every active asset has status, version, approval, file reference, and usage
rules"). No wireframe, no data-model table cluster, and no workflow-state-machine section name
this module specifically — the smallest-honest-reading precedent every module since Projects has
followed applies here too.

### In scope

One organization-wide table, `brand_library_records`, RBAC-gated on the seeded `creative_design`
group.

### Design decisions (all user-confirmed via `AskUserQuestion` before any code was written)

**D1 — Single generic table, `recordType` discriminator.** Mirrors Business Knowledge Center's
precedent for a heterogeneous flat field list with no per-type schema basis in the canonical spec.
`recordType` enum: `logo | color | typography | photography | illustration | icon_rule | tone |
visual_personality | dos_dont`. No project scoping (brand identity is organization-wide, matching
the seeded `confidentialityLevel: null` and every other creative/library module's own
organization-wide precedent).

**D2 — `fileReference`: plain nullable URL field, not a new attachment mechanism.** A
`safeHttpUrlSchema`-validated (`@webdesk/validation`) nullable string. Guidance-only records
(`tone`, `visual_personality`, `dos_dont`) legitimately have no file; asset-like records
(`logo`, `photography`, `illustration`) do. No Asset Library module and no provisioned Vercel Blob
store exist yet (open blocker in `CLAUDE.md`) — building real upload/storage infrastructure for
this module now would be premature, matching Service Library's/Persona Library's own precedent of
deferring heavy infra until a dedicated module needs it.

**D3 — Deprecated is a status, not a recordType.** Any record of any type can be marked
deprecated — matches the no-hard-delete precedent every module in this codebase already follows
(e.g. Business Knowledge Center's own `deprecated` status). No separate `deprecated_asset`
recordType.

**D4 — Standard 8-value `ArtifactApprovalStatus` workflow, reused verbatim.** The seeded
`creative_design` RBAC row (`designer_creative_reviewer: VCERAS`, `marketing_editor: VR`,
`developer: V`, `qa_security_reviewer: VR`, only `super_admin`/`owner_growth_approver` hold `P`)
matches the same submit/review/approve vocabulary Service Library/Persona Library/Content Template
Library already use, not Business Knowledge Center's own bespoke 5-value status. Reuses the exact
`TRANSITIONS` table (byte-for-byte, matching the established precedent of copying this table
verbatim into each new module rather than sharing it — already-accepted, tracked debt recorded at
each prior occurrence).

**D5 — Real publish/unpublish, orthogonal to approval.** The seeded `creative_design` group's
unused `P` grant gets the same real mechanism Content Template Library built: `isPublished`/
`publishedAt`, gated on `publish`/`unpublish` RBAC actions, atomic compare-and-swap on both the
approval-status CAS guard (mirrors `ContentTemplateRepository.updatePublishState()`) and the
publish-state CAS guard itself. `publish()` requires `approvalStatus === "approved"`; `unpublish()`
has no status restriction (an operator must always be able to pull a published record down).
`publishedAt` stamped once via `COALESCE`, never cleared, never overwritten.

**D6 — `version` is server-managed**, incremented by 1 on every successful content update
(never on a status-transition or publish/unpublish call) — mirrors `personas.version`/
`content_templates.version`.

**D7 — No sub-resources, no cross-module relationship fields.** The spec names no relationships
for this module (unlike Service Library's `icpIds` or Persona Library's `relatedServiceIds`).

### Deliberately out of scope this pass

No `dashboard-web` UI — backend only, matching every prior module's own backend-first precedent.

---

## As-built

_(Appended once built and verified.)_
