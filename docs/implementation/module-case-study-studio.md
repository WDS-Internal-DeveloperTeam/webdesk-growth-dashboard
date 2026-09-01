# Case Study Studio — module #23

## Scope

Built directly on the explicit "start Case Study Studio" instruction, following this project's
Recommended Module Roadmap (module #23) and the dependency-computed
`docs/phase-plans/module-implementation-roadmap.md` (Wave 2, co-dependent cluster
`case_study_studio ↔ proof_and_claims_library ↔ service_library ↔ persona_library ↔
case_study_library`). Case Study Studio's own two real dependencies —
`proof_and_claims_library` and `asset_library` — are both already live in production
(migrations `00053`/`00075` respectively), so this module can be built now without violating the
cluster note. Only `case_study_library` (which _depends on_ Case Study Studio, not the reverse)
remains unbuilt — not a blocker.

Source: `webdesk-dashboard-documentation-v1/03_Detailed_Module_Specifications.md §7` (flow +
mandatory governance), `07_Low_Fidelity_Wireframes.md §4` (field groups),
`04_Data_Model_and_Ownership.md:133-137` (named child tables: `case_study_sources`,
`case_study_claims`, `case_study_assets`, `case_study_consents`, `case_study_approvals`).

### Design decisions confirmed directly with the user first (`AskUserQuestion`)

- **D1 — Workflow**: implement the full bespoke 14-stage lifecycle named in the spec, not a
  trimmed version — the first workflow in this codebase larger than Internal Linking Library's
  4-state precedent. Real status values (snake_case): `intake`, `upload`, `completeness_review`,
  `ready_for_claude`, `missing_information`, `draft`, `search_review`,
  `fact_confidentiality_review`, `internal_approval`, `client_approval`, `scheduled`, `published`,
  `unpublished`, `archived`. `archived` is terminal.
- **D2 — Claims/sources**: reuse Proof and Claims Library directly via a real,
  existence-validated `relatedClaimIds` relationship (`ClaimsService.existingClaimIds()`,
  mirroring `ServicesService.existingServiceIds()`'s own already-reviewed pattern) — no new
  `case_study_claims`/`case_study_sources` tables. The canonical data-model doc's own separate
  table names for these are superseded by this project's own real, already-live
  `proof_and_claims_library` module.
- **D3 — Assets**: build a real `case_study_assets` join table. **Discovered mid-scoping, after
  the question was answered**: Asset Library (module #15) is already live in production
  (migrations `00074`/`00075`, `assets` table) — a fact not reflected in the question asked, which
  assumed no asset dependency existed yet. This is strictly better than what was approved: instead
  of a standalone table duplicating licence/consent fields Asset Library already owns,
  `case_study_assets` is a real many-to-many join (`case_study_id`, `asset_id`, `role` — e.g.
  "hero_screenshot"/"logo"/"testimonial_screenshot"/"video"/"document", `caption`) with `asset_id`
  existence-validated against the real `assets` table via a new narrow
  `AssetsService.existingAssetIds()` delegating method, matching the
  `existingServiceIds()`/`existingRecordIds()`/`existingComponentIds()` precedent. Licence/consent
  for a given asset live on `assets` itself — no duplication.

### Further design decisions (engineering judgment, consistent with established precedent)

- **D4 — Schema shape**: single parent table `case_studies` (organization-wide, no `project_id`,
  matching Persona/Service/Brand Library's own precedent — the module registry seeds no
  project-scoping signal), plus three real child tables: `case_study_assets` (D3, join into
  `assets`), `case_study_consents` (case-study-level consent evidence — client
  publication/testimonial/logo-usage consent, distinct from an individual asset's own
  `consent_reference`), and `case_study_approvals` (a queryable decision-history log for the two
  approval stages, mirroring Review and Approval Center's own `review_decisions` table shape —
  `approvalType` (`internal`/`client`), `decision` (`approved`/`rejected`/`revision_requested`),
  `decidedByUserId`, `notes`).
- **D5 — Parent fields**: `publicId`, `clientName`, `projectTitle`, `industry`, `platform`,
  `visibility` (`public`/`internal_only`/`confidential`/`client_approval_required` — reusing the
  Case Study Library spec's own 4-value vocabulary from §8, since Studio is the same content
  before it graduates to the Library), `embargoDate` (nullable date), `challenge`/`solution`/
  `implementation`/`results` (the wireframe's own 4-field narrative group — rich-text, sanitized
  write-time + render-time, per the 2026-08-22 standing rule, even though no `dashboard-web` UI
  exists yet in this pass, matching every prior backend-only module's own precedent),
  `relatedServiceIds` (existence-validated into the already-live `services` table),
  `relatedClaimIds` (D2), `assignedReviewerUserId` (existence-validated into `users`, nullable),
  `clientApprovalRequired` (boolean, gates whether `internal_approval` can go straight to
  `scheduled` or must pass through `client_approval`), `status` (D1), `scheduledPublishAt`
  (nullable timestamp), `publishedAt` (server-stamped, `COALESCE`-write, never overwritten once
  set — matching every sibling publish mechanism), `unpublishReason` (nullable text — the spec's
  own named "mandatory governance" field, required by the service layer specifically on the
  `published -> unpublished` transition, not at the schema level), `version` (server-managed,
  incremented on every content edit).
- **D6 — RBAC**: reuses the already-seeded `case_studies` permission group verbatim (its own
  group, distinct from `service_persona_proof`) — no new RBAC migration. Grant letters: `super_admin`/
  `owner_growth_approver` hold `VCERAPX` (view/create/edit/review/approve/publish+unpublish/export);
  `marketing_editor` holds `VCESR` (view/create/edit/submit/review — no approve);
  `designer_creative_reviewer`/`qa_security_reviewer` hold `VR` (view/review); `developer`/
  `read_only` hold `V` only. The `X` (export) action has no wired feature anywhere in this
  codebase yet and is left unwired here too, matching the standing "recorded as-seeded, not worked
  around" precedent from Review and Approval Center's own RBAC-oddity note.
- **D7 — Transition→action mapping** (`TRANSITIONS` table, `@RequirePermission` at the route
  level gated on `view` only, with the real per-transition action checked dynamically inside
  `changeStatus()`, mirroring every sibling artifact-approval module):
  - `submit`: `intake→upload`, `upload→completeness_review`, `ready_for_claude→draft`,
    `draft→search_review`, `missing_information→draft`
  - `review`: `completeness_review→ready_for_claude`, `search_review→fact_confidentiality_review`,
    `fact_confidentiality_review→internal_approval`, and `→missing_information` from
    `completeness_review`/`ready_for_claude`/`search_review`/`fact_confidentiality_review`
  - `approve`: `internal_approval→client_approval` (only if `clientApprovalRequired`),
    `internal_approval→scheduled` (only if `!clientApprovalRequired`),
    `client_approval→scheduled`, `internal_approval→missing_information`,
    `client_approval→missing_information`, and every `→archived` transition from any non-terminal
    status (archive is a permanent, hard-to-reverse action, gated at the same tier as approval —
    matching every sibling artifact module's own precedent)
  - `publish`: `scheduled→published`, `unpublished→published`
  - `unpublish`: `published→unpublished`
  - Each `internal_approval`/`client_approval` transition additionally inserts a
    `case_study_approvals` row (`approvalType` derived from the source status,
    `decision` derived from the target status — `approved` for a forward transition, `archived`
    reached from an approval stage recorded as `rejected`), in the same transaction as the atomic
    CAS status write, mirroring Review and Approval Center's own `withTransaction()` pairing.
- **D8 — Atomicity**: `updateStatus()` uses the same atomic compare-and-swap
  `(id, expectedStatus) → UPDATE ... WHERE status = expectedStatus RETURNING *` pattern every
  sibling module uses, throwing a discriminated `not_found`/`conflict` result mapped to 404/409.
  `update()` (content edit) carries a terminal-state guard (rejects editing an `archived`/
  `unpublished`... no — `unpublished` is NOT terminal, only `archived` is) — rejects editing an
  `archived` record.
- **D9 — Confidentiality**: none — the module registry seeds `confidentiality_level: null` for
  `case_study_studio`, matching Persona/Website Strategy Center's own precedent (the `visibility`
  field is a workflow/publication concept per D5, not a per-field redaction axis).
- **D10 — Scope of this pass**: backend only (`packages/database`, `apps/dashboard-api`) — no
  `dashboard-web` UI, matching every prior module's own backend-first precedent.

### Migration numbering

Starting from `00091` per explicit instruction (concurrent in-flight work elsewhere has already
claimed `00089`/`00090`) — `00091-create-case-study-studio.ts` (schema),
`00092-mark-case-study-studio-in-development.ts` (module-registry status flip, matching every
sibling module's own two-migration pattern).

---

## As-built

Built on branch `module-case-study-studio`, off `main` at commit `103c532`. All 4 tables
(`case_studies`, `case_study_assets`, `case_study_consents`, `case_study_approvals`) as designed
in D1–D10 above, plus new narrow existence-check delegating methods needed for the D2/D3
relationship validation: `ClaimsService.existingClaimIds()` (+ `ProofClaimRepository.findByIds()`)
and `AssetsService.existingAssetIds()` (+ `AssetRepository.findByIds()`), mirroring
`ServicesService.existingServiceIds()`'s own already-reviewed pattern. `case_study_studio.dto.ts`'s
`changeCaseStudyStatusSchema` deliberately deviates from a literal `{expectedStatus, notes?}`
shape to `{status, notes?, unpublishReason?}` — matching the real
`changeServiceApprovalStatusSchema`/`changeProofClaimApprovalStatusSchema` precedent, which accept
only the target status and let the service read the record's own real current status as the CAS
`expectedStatus`, rather than trusting a client-supplied "expected" value.

Migrations start at `00091` (a numbering gap after `00088` was left deliberately, per explicit
instruction, since other in-flight work had already claimed `00089`/`00090`) —
`00091-create-case-study-studio.ts`, `00092-mark-case-study-studio-in-development.ts`.

**Independently re-verified by the orchestrating session, not trusted from the build agent's own
report**: read the controller's RBAC decorator placement directly (method-level throughout, never
class-level — the exact bug class this codebase has hit and fixed twice before), read the full
`TRANSITIONS` map in `case-studies.service.ts` and confirmed it matches D7 exactly (every
`submit`/`review`/`approve`/`publish`/`unpublish` edge, the `clientApprovalRequired` branching,
the mandatory `unpublishReason` check, the `withTransaction()`-paired `case_study_approvals`
insert), confirmed both `packages/database/src/index.ts` and `index.cjs.ts` barrels export the new
module, and confirmed the asset/consent sub-resource repositories scope every `update`/`remove` by
`(id, caseStudyId)` at the database `WHERE` level with no unscoped mutation path reachable from any
controller route.

Every validation command was re-run directly against a real local disposable PostgreSQL 17
database (`webdesk_phase1b_dev`), not assumed from the agent's report:

- `tsc --noEmit`: clean for both `@webdesk/database` and `@webdesk/dashboard-api`
- `eslint --max-warnings=0`: clean for both packages
- `prettier --check`: clean on every touched file
- A full migration down/up round-trip on both new migrations (`00091`/`00092` reverted then
  reapplied) confirmed clean — 90 migrations, 0 pending
- `packages/database` unit tests: 28/28 (unaffected)
- `packages/database` integration tests: 650/650 (30 new), against a real database
- `dashboard-api` unit tests: 44/44 for this module (1430/1430 overall)
- `dashboard-api` e2e tests: 28/28 for this module in isolation; the full 653-test suite showed 9
  unrelated `website-strategy-center.e2e-spec.ts` failures on the first combined run, re-run in
  isolation and confirmed passing (22/22) — resource-contention flakiness from running 33 e2e spec
  files in parallel against one shared local database, not a regression introduced by this branch
- `validate:module-registry`: 43 modules, 21 permission groups, all references resolve
- `pnpm audit`: 0 vulnerabilities

**Independent code review then ran** (this project's own `code-review` skill, high effort, 8-angle
finder pass, 1-vote self-verification) — 9 candidates surfaced after dedup, 7 CONFIRMED and 1
PLAUSIBLE, 7 fixed. Most severe: `update()` accepted `clientApprovalRequired` as an ordinary
patchable field with only a terminal-state (`archived`) guard, letting a caller holding both
`edit` and `approve` (a real seeded combination — `super_admin`/`owner_growth_approver` both hold
`VCERAPX`) flip the flag to `false` immediately before transitioning `internal_approval->scheduled`,
silently skipping the `client_approval` stage with no `case_study_approvals` "client" decision ever
recorded — fixed by excluding `clientApprovalRequired` from `updateCaseStudySchema` entirely (a
one-time intake decision, now immutable once set). Also fixed: `publishedAt` was unconditionally
overwritten on every `->published` transition, contradicting the migration's own documented
"stamp once, never overwrite" invariant — a republish (`unpublished->published`) would silently
erase the original first-publish date; `unpublishReason` was never cleared on any transition back
to `published`, leaving a stale reason on a currently-live record; `case-study-assets.service.ts#create()`
ran two independent existence checks sequentially instead of via `Promise.all`; the three update
DTOs (`updateCaseStudySchema`/`updateCaseStudyAssetSchema`/`updateCaseStudyConsentSchema`) were
hand-duplicated instead of derived via `.omit({...}).partial()`; the unique-constraint-violation
catch in `create()` (both the parent and the asset sub-resource) hand-rolled
`error.name === "SequelizeUniqueConstraintError"` instead of the shared
`isSequelizeUniqueConstraintError()` helper `@webdesk/validation` already exports for exactly this
purpose; and the `TRANSITIONS` map was keyed by plain, untyped template strings with no
compile-time connection to the real `CaseStudyStatus` union — a typo'd key would have compiled
cleanly and silently made that transition permanently unreachable — fixed by introducing a
`` `${CaseStudyStatus}->${CaseStudyStatus}` `` template-literal key type. **1 PLAUSIBLE finding
left as accepted, tracked debt**: `changeStatus()`'s same-status no-op early-return happens before
the per-transition RBAC action check runs, letting a `view`-only caller get a 200 on a
same-status re-request with no authorization check — verified as byte-identical to Service
Library's own already-reviewed, already-gated `changeApprovalStatus()` ordering, so it's inherited
precedent, not a risk newly introduced by this branch. 4 new regression tests added
(`case-studies.service.spec.ts` — republish preserves `publishedAt`, republish clears
`unpublishReason`; a new `case-study-studio.dto.spec.ts` — `clientApprovalRequired`/`publicId`/`assetId`
stripped from their respective update schemas). Re-validated: `tsc --noEmit`/`eslint --max-warnings=0`/
`prettier --check` clean, 51/51 `dashboard-api` unit tests for this module, 28/28 e2e tests for
this module, 650/650 `packages/database` integration tests, `pnpm audit` 0 vulnerabilities.

**A separate `security-review` skill run then found 0 findings above threshold.** Confirmed:
every repository query is parameterized (Sequelize's `where`/`update`/`findAll` API; the migration's
own raw `sequelize.query()` calls are fixed string literals with no interpolated input); every
`@RequirePermission` decorator is method-level (never class-level — the known past bug class in
this codebase); both sub-resource repositories (`CaseStudyAssetRepository`/
`CaseStudyConsentRepository`) scope `update()`/`remove()` by the compound `{id, caseStudyId}` at
the database `WHERE` level, with a real IDOR check; `existingAssetIds()`/`existingClaimIds()`
expose only a bare `Set<string>` of ids, never full entity data, across the module boundary;
`consentEvidenceReference` is validated via `safeHttpUrlSchema` (not a bare string), avoiding a
repeat of the historical Projects `environment.url` stored-XSS finding; no DTO accepts a
server-governed field (`status`/`publishedAt`/`version`/`clientApprovalRequired`/`assetId` are all
correctly excluded from their update schemas); and rich-text fields are sanitized on every write
path including `changeStatus()`'s `notes`. The same-status no-op RBAC-check ordering was noted as
context, not a finding — byte-identical to already-accepted precedent elsewhere in this codebase.

**Required second-role human review complete** — a review packet (published as a Claude
artifact, "Case Study Studio Review Packet" — code review + security review findings, fixes, and
validation evidence, with a decision section) was prepared, since the implementing agent cannot
also be its own reviewer (ADR-0010). Jitesh D reviewed it and returned "Approved." **The gate
(G4-case-study-studio) was then separately requested and approved** — WebDesk Solution, decision
CONFIRM. See `docs/project-state/module-case-study-studio-approval-checklist.md`'s "Sign-off"
section and `outputs/webdesk-growth-dashboard/project.json`'s `gates[]`.

Not yet pushed or merged — each is its own separate, not-yet-requested next step per this
project's standing discipline.
