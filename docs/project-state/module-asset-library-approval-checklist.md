# Asset Library Backend — Approval Checklist

**Status:** Built, fully validated against a real disposable database, independently code-reviewed
(4 findings — 3 fixed and re-validated, 1 escalated to the security review), security-reviewed
(0 findings above threshold). Required second-role human review complete — **Jitesh D, "Approved,"
no disputes raised.** Awaiting a gate decision. Not pushed to `origin`; no PR opened.

Module #15 on `canonical-inputs/Recommended_Module_Roadmap.md`. Backend only — `apps/dashboard-web`
is untouched, matching every prior module's own backend-first precedent.

## Completion condition

Every item below must be genuinely true, verified against real evidence, before a gate decision
for this slice can be requested.

| #   | Item                                       | Status                                                                                                                                                                                                                                                                                                                                                                                   |
| --- | ------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | Authorization to build                     | ✅ Explicit "start asset library module" instruction — module #15 on the Recommended Module Roadmap, `dependencies: null` in the seeded registry, so buildable now                                                                                                                                                                                                                       |
| 2   | Genuine scoping confirmed                  | ✅ Three genuine architectural forks put to the project owner (`AskUserQuestion`) before any code was written: file storage (metadata-only vs. real Blob upload), confidentiality enforcement (real redaction vs. plain fields), and related-records modelling (polymorphic child table vs. unvalidated id arrays) — see `docs/implementation/module-asset-library.md` `## Scope`, D1–D9 |
| 3   | Required tests pass                        | ✅ 1055/1055 `dashboard-api` unit (85 new), 440/440 `packages/database` integration (24 new), 442/442 `dashboard-api` e2e (33 new) — all against a real disposable PostgreSQL 17 database, run directly by this session                                                                                                                                                                  |
| 4   | Full validation clean                      | ✅ typecheck, lint (`--max-warnings=0`), `nest build`, prettier all clean; migration `00072`/`00073` up/down round-trip clean (73 applied, `00073` reverted); `validate:module-registry` — 43 modules, 21 permission groups, unaffected; `boundaries:check` 0 errors; `pnpm audit` 0 vulnerabilities                                                                                     |
| 5   | Independent code review complete           | ✅ This project's own `code-review` skill (high effort) — 4 findings, all in the DTO. 3 fixed and re-validated (`d186082`); the 4th escalated to the security review rather than decided unilaterally — see "Independent code review — summary" below                                                                                                                                    |
| 6   | Security review complete                   | ✅ `security-review` skill run separately — **0 findings above threshold.** One candidate identified, independently verified, and REFUTED at 3/10 — see "Security review — summary" below                                                                                                                                                                                                |
| 7   | Known out-of-scope gaps flagged, not fixed | ✅ 1 tracked-debt item (`visibility` write-side gate, cross-module with Service Library) and 1 recorded note (`listByTarget()` reachable from no route) — both below                                                                                                                                                                                                                     |
| 8   | Live end-to-end verified                   | ⚠️ **Not applicable — and not claimed.** Backend-only slice, not deployed. Verified against a real local PostgreSQL 17 database, not production. The production migration is a separate step the project owner runs                                                                                                                                                                      |
| 9   | Documentation updated                      | ✅ `docs/implementation/module-asset-library.md` — collapsed-template rule (2026-08-27): single file, `## Scope` written before any code, `## As-built` appended after                                                                                                                                                                                                                   |
| 10  | Exact branch/commit verified and recorded  | Branch `module-asset-library`, commits `f8bba72` → `f5da246` → `d186082`. Not pushed to `origin`; no PR opened                                                                                                                                                                                                                                                                           |
| 11  | Live in production, independently verified | ⛔ Not yet — merge and production migration are each their own separate, not-yet-requested authorization                                                                                                                                                                                                                                                                                 |

## Design decisions the project owner made directly

| Fork                   | Decision                                                                                                                                                                                                                                                                                                                                |
| ---------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **D1** File storage    | **Metadata-only.** `fileReference` is a `safeHttpUrlSchema`-validated URL. A deliberate, flagged deviation from `03_Detailed_Module_Specifications.md §12`'s own "direct authenticated upload to private Blob" rule — no Blob store is provisioned, and building the pipeline now would ship a headline feature that fails on every use |
| **D2** Confidentiality | **Real record-level enforcement.** Unlike Brand Library (registry `confidentialityLevel: null`), this module's seeded value is real, so `fileReference`/`consentReference` are redacted on a `restricted` asset via the existing shared `redactConfidentialFields()` mechanism                                                          |
| **D3** Related records | **Real polymorphic `(moduleKey, recordId)` child table**, validated against the live module registry, mirroring Review and Approval Center's own reviewed pattern                                                                                                                                                                       |

D4–D9 (scan status, approval workflow, publish/unpublish, retention note, added `title`, org-wide
scope) were judgment calls made directly and recorded in the implementation doc.

## Independent code review — summary

This project's own `code-review` skill, high effort. **4 findings, all in `asset-library.dto.ts`.**

| #   | Finding                                                                                                                                                                                                                                 | Disposition                                                                                                                                                |
| --- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | `fileSizeBytes` bounded the digit **count** (`.max(20)`), not the value — a well-formed 20-digit string overflowed the BIGINT column with a raw 500, the exact failure the field's own comment claimed to prevent                       | **Fixed** — bounds the value via `BigInt`                                                                                                                  |
| 2   | `widthPx`/`heightPx`/`durationSeconds` unbounded but map to Postgres `INTEGER` — e.g. `3000000000` passed validation, then 500'd on INSERT                                                                                              | **Fixed** — clamped to the INTEGER ceiling                                                                                                                 |
| 3   | `updateAssetRelatedRecordSchema` accepted `{}`, returning 200 and writing a `data_change` audit event recording no change — contradicting the sibling `updateAssetSchema` guard directly above it                                       | **Fixed** — non-empty refine added                                                                                                                         |
| 4   | `visibility` is freely patchable via the plain `edit` grant, and the update response redacts against the post-update value — so one request can declassify a `restricted` asset and return its confidential fields in the same response | **Escalated to the security review**, not decided unilaterally — inherited Service Library precedent, so changing it here diverges one module from another |

11 new regression tests, including both boundary values (exactly at the BIGINT and INTEGER
ceilings, and one past each). Re-validated after the fixes: 1055/1055 unit, 440/440 integration,
442/442 e2e, lint/typecheck/build/prettier clean.

## Security review — summary

`security-review` skill run separately. **0 findings above threshold.**

One candidate (code-review finding 4, above) was carried in and independently verified. Every
technical link in its chain was confirmed factually correct — the exploit works as described, in
one request, with no race. It was nonetheless **REFUTED at confidence 3/10**, on scope and
precedent rather than mechanics:

- **Inherited, not introduced.** All 25 files are pure additions; no shared or pre-existing code is
  modified. The shape is copied verbatim from Service Library (`service-library.dto.ts:90`,
  `services.controller.ts`), already merged, security-reviewed, and gated under `G4-service-library`.
- **The "stronger mandate here" argument fails on inspection.** `00035-populate-module-registry-fields.ts`
  gives _both_ modules a real non-null `confidentialityLevel` — Service Library carries an equally
  genuine confidentiality mandate and the identical bypass.
- **Already adjudicated in this codebase.** The 2026-08-20 Business Knowledge Center security review
  raised this exact concern, independently re-verified it, and scored it 2/10 as a pre-existing
  accepted pattern.
- **The implied fix is incoherent today.** `canEditConfidential()` is zero-seeded for every role
  including `super_admin`, so gating on it would make every `restricted` asset permanently
  un-declassifiable by anyone.
- **No trust boundary is crossed.** The three roles holding `edit` are trusted internal staff who
  can already overwrite `fileReference`/`consentReference` outright.

Explicitly checked and cleared: SQL injection (parameterized throughout; `escapeLikePattern()` on
search; the two `sequelize.query()` calls in migration `00072` are static literals), mass
assignment of server-managed fields (Zod strip-mode; `scanStatus` hardcoded at the repository — **no
code path can write `clean`**), RBAC placement (method-level `@RequirePermission` on all 10 routes,
never class-level, which `PermissionGuard` fails closed on; `OriginCheckGuard` on every mutating
route), IDOR (`(id, assetId)` scoping at both service and repository layers), privileged-state
races (atomic CAS on status and publish-state, plus the `expectedApprovalStatus` guard on edit),
stored XSS (`safeHttpUrlSchema`; rich-text sanitized on write), and data exposure in errors/logs.

## Open items for the reviewer's decision

| Item                                                                                                                                                                   | Type                                | Recommendation                                                                                                                                                                                                                                                                                                             |
| ---------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `visibility` write-side gate: no confidential-edit check, and the update response redacts against the post-update value, so a downgrade discloses in the same response | Tracked debt, **cross-module**      | Accept here. The cheap half-fix — redact against the **pre-update** visibility (`current` is already in hand at `assets.service.ts:135`) — closes instant disclosure without gating the write, but belongs in a cleanup spanning Asset Library **and** Service Library, since fixing one alone leaves the two inconsistent |
| `AssetRelatedRecordRepository.listByTarget()` is implemented and integration-tested but reachable from no route                                                        | Recorded note, not a defect         | Leave. Dead until a reverse-lookup endpoint exists; the "which assets reference this record?" question is the real point of tracking usage                                                                                                                                                                                 |
| The 8-value `TRANSITIONS` approval table is now the **6th** byte-for-byte copy across modules                                                                          | Pre-existing, already-accepted debt | Flagged for visibility. At six occurrences the "disproportionate to extract for one more consumer" reasoning is thinner than it was at three                                                                                                                                                                               |

## Two real test-writing lessons from this build

1. **`updated_by` is a UUID foreign key, not a label.** Two integration race tests passed
   `"actor-a"`/`"actor-b"` as `updatedBy`; Postgres rejected them outright. Test bug, not a code
   bug — the sibling Brand Library suite passes `null` for exactly this reason.
2. **A failing suite corrupts the shared database for every other suite.** Those two failures also
   broke an unrelated pre-existing suite (`phase1e-audit-migration-00019-regression`). This was
   diagnosed rather than assumed: that suite passes alone on a clean database, the full run passes
   24/24 with this module's file excluded, and it returned to green once the two real bugs were
   fixed. The same hazard is already on record from Page Workspace's own test-execution pass.

## Required second-role human review (ADR-0010)

The implementing agent cannot also be its own reviewer. A review packet was published as a Claude
artifact covering the code-review findings and fixes, the security-review disposition, and the
validation evidence.

| Field           | Value                                                                                                                                                                                                                             |
| --------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Reviewer        | Jitesh D                                                                                                                                                                                                                          |
| Decision        | **Approved**                                                                                                                                                                                                                      |
| Date            | 2026-08-27                                                                                                                                                                                                                        |
| Review artifact | [Asset Library Review Packet](https://claude.ai/code/artifact/b46480e9-f1e1-4e70-a762-1800d9c25f8c)                                                                                                                               |
| Disputes raised | None. The security review's refutation of finding 04 was accepted, and the three open items stand as recorded — the `visibility` write-side gate remains cross-module tracked debt with Service Library, not a fix on this branch |

## Sign-off — G4-asset-library gate

| Field           | Value                         |
| --------------- | ----------------------------- |
| Decision        | _pending — not yet requested_ |
| Approver        | _pending_                     |
| Date            | _pending_                     |
| Approved commit | _pending_                     |

A gate approval does not itself authorize pushing the branch, opening a PR, or merging — each
remains its own separate authorization, per this project's standing "no auto-merge" rule.
