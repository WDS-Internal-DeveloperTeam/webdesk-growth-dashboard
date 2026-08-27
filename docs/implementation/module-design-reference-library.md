# Design Reference Library (module #14) — scope and as-built record

> Single-file template (effective 2026-08-27): `## Scope` is written before any code exists; the
> as-built sections are appended once the module is built and verified.

## Scope

### Pre-implementation verification

| Check                                | Result                                                                                    |
| ------------------------------------ | ------------------------------------------------------------------------------------------ |
| Recommended roadmap position         | Row 14, Wave 4 — `canonical-inputs/Recommended_Module_Roadmap.md`                          |
| Dependency-computed roadmap position | `docs/phase-plans/module-implementation-roadmap.md`, `libraries` group, no listed prerequisite |
| Registry dependency (seeded)         | `null` — no prerequisite module                                                            |
| RBAC permission group (seeded)       | `creative_design`, already seeded (migration `00013`) — **no new RBAC migration**          |
| Confidentiality level (seeded)       | `null` — organization-wide, no confidential-field mechanism needed                         |
| Open Critical/High security finding  | None                                                                                        |
| Blocking credential                  | None                                                                                        |

Source material: `03_Detailed_Module_Specifications.md §11` (flat field list only — "source URL,
screenshot, page/section type, likes, dislikes, desktop behavior, mobile behavior, motion notes,
accessibility concerns, performance concerns, tags, approval") and
`02_Version_1_Module_Inclusion_Matrix.md` row 11 ("Reference URL, screenshots, likes/dislikes,
tags, approvals"). The roadmap's own one-line description frames intent: "Store examples,
screenshots, references and design rationale with provenance/status. References are inspiration,
not automatically approved patterns." No wireframe, no data-model table cluster beyond a bare
`design_references` name in `04_Data_Model_and_Ownership.md`'s "Brand and design" list, and no
workflow-state-machine section name this module specifically — the smallest-honest-reading
precedent every module since Projects has followed applies here too.

### In scope

One organization-wide table, `design_reference_records`, RBAC-gated on the seeded
`creative_design` group (the same group Brand Library uses).

### Design decisions

**D1 — Single flat table, no `recordType` discriminator.** Unlike Business Knowledge Center/
Brand Library, the spec names one flat field list with no enumerated sub-types — every record is
the same shape (one external design reference). No discriminator column needed.

**D2 — `screenshotUrl`: plain nullable URL field, not a new attachment mechanism** (user-confirmed
via `AskUserQuestion`). A `safeHttpUrlSchema`-validated (`@webdesk/validation`) nullable string,
mirroring Brand Library's `fileReference` exactly. No Asset Library module and no provisioned
Vercel Blob store exist yet (open blocker in `CLAUDE.md`) — building real upload/storage
infrastructure for this module now would be premature. `sourceUrl` (the reference's own origin
page) gets the identical validation, distinct field.

**D3 — `likes`/`dislikes`: free-text rich-text notes, not counters** (user-confirmed via
`AskUserQuestion`). Qualitative design-critique rationale ("clean use of whitespace," "CTA buried
below the fold"), matching the module's own stated purpose ("design rationale with
provenance/status"). Per the 2026-08-22 standing rule, both use `RichTextEditor` on the frontend
and real write-time (`sanitizeNullableRichText()`/`sanitizeNullableRichTextIfChanged()`) +
render-time (`SanitizedRichText`) sanitization on the backend — built sanitize-ready from day one
even though no `dashboard-web` UI exists yet this pass, matching Brand Library's own precedent.
`motionNotes`/`accessibilityConcerns`/`performanceConcerns` are the same shape (free-text
rationale) and get identical treatment.

**D4 — `pageSectionType`: a plain free-text field, not a closed enum.** The spec names "page/section
type" with no enumerated value list anywhere (unlike, say, `ArtifactApprovalStatus`). A closed enum
would mean inventing values with no source — kept as a short plain string (length-capped), matching
the precedent of not fabricating enumerated vocabulary the spec doesn't actually provide.

**D5 — `desktopBehavior`/`mobileBehavior`: plain text fields, not rich text.** These describe
observed behavior (a factual note, e.g. "sticky header on scroll"), distinct in kind from the
`likes`/`dislikes`/`*Concerns` rationale fields — kept as plain, length-capped text, avoiding
inventing a false rich-text need for every long-ish field.

**D6 — `tags`: a plain unvalidated string array**, mirroring `roles`/`icpIds`/similar free-text tag
fields elsewhere in this codebase (Persona Library's `roles`/`industries`, Service Library's
`icpIds`). No backing tag entity exists.

**D7 — Standard 8-value `ArtifactApprovalStatus` workflow, reused verbatim.** The seeded
`creative_design` RBAC row (`designer_creative_reviewer: VCERAS`, `marketing_editor: VR`,
`developer: V`, `qa_security_reviewer: VR`, only `super_admin`/`owner_growth_approver` hold `P`) is
identical to Brand Library's own — reuses the exact `TRANSITIONS` table byte-for-byte, matching the
established precedent of copying this table verbatim into each new module (already-accepted,
tracked debt recorded at each prior occurrence, most recently Brand Library's).

**D8 — Real publish/unpublish, orthogonal to approval** (user-confirmed via `AskUserQuestion`).
Mirrors Brand Library's own `isPublished`/`publishedAt` mechanism exactly: `publish()` requires
`approvalStatus === "approved"`, atomic CAS on both the approval-status guard and the publish-state
guard; `unpublish()` has no status restriction; `publishedAt` stamped once via `COALESCE`, never
cleared, never overwritten.

**D9 — `version` is server-managed**, incremented by 1 on every successful content update (never on
a status-transition or publish/unpublish call) — mirrors `brand_library_records.version`.

**D10 — No sub-resources, no cross-module relationship fields.** The spec names no relationships
for this module.

### Deliberately out of scope this pass

No `dashboard-web` UI — backend only, matching every prior module's own backend-first precedent.

---

## As-built

_(appended once the build completes)_
