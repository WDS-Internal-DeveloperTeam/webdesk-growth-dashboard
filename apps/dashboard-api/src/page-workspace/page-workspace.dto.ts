import { z } from "zod";
import {
  PAGE_ARTIFACT_TYPES,
  PAGE_ARTIFACT_VERSION_STATUSES,
  PAGE_LIFECYCLE_STAGES,
} from "@webdesk/database";

/**
 * The three enums are imported from `@webdesk/database`, never re-declared here — unlike
 * `page-inventory.dto.ts`/`website-strategy-center.dto.ts`, which each hand-maintain a second
 * copy of their module's own vocabulary. Importing means a value added to `entities.ts` cannot
 * silently fail validation here, and closes the "enum triplicated across three files" finding
 * this project's own reviews have raised on several prior modules.
 */
export const pageArtifactTypeSchema = z.enum(PAGE_ARTIFACT_TYPES);
export const pageArtifactVersionStatusSchema = z.enum(PAGE_ARTIFACT_VERSION_STATUSES);
export const pageLifecycleStageSchema = z.enum(PAGE_LIFECYCLE_STAGES);

/** Matches the 40,000 ceiling every rich-text field in this codebase uses — double the plain-text
 *  20,000 baseline, to absorb HTML markup overhead (the ratio Business Knowledge Center
 *  established and every later rich-text conversion reused). */
const LONG_TEXT_MAX_LENGTH = 40_000;
const richTextField = z.string().max(LONG_TEXT_MAX_LENGTH).nullish();

/** `05_Workflow_State_Machines.md §1`: "Rejection and revision require a reason." Enforced as a
 *  real non-empty constraint, not merely an optional field. */
const REASON_MAX_LENGTH = 2_000;
const requiredReasonSchema = z.string().trim().min(1).max(REASON_MAX_LENGTH);

/** `04_Data_Model_and_Ownership.md §5`'s Git-backed artifact provenance (task package D9).
 *  Caller-supplied and unvalidated beyond shape — no GitHub adapter exists yet to verify any of
 *  it, the same deferred-integration shape `pages.wordpressPageId` already uses. */
const gitProvenanceFields = {
  repository: z.string().trim().max(255).nullish(),
  path: z.string().trim().max(2_000).nullish(),
  branch: z.string().trim().max(255).nullish(),
  commitSha: z.string().trim().max(64).nullish(),
  contentChecksum: z.string().trim().max(128).nullish(),
};

/** Creates the artifact row for a tab if it does not exist yet, plus its first draft version. */
export const createArtifactSchema = z.object({
  artifactType: pageArtifactTypeSchema,
  content: richTextField,
  notes: richTextField,
  ...gitProvenanceFields,
});
export type CreateArtifactDto = z.infer<typeof createArtifactSchema>;

/** In-place edit of an existing DRAFT version. Rejected outright by the service when the target
 *  version is approved or otherwise terminal — `04_Data_Model_and_Ownership.md §5`, task package
 *  D7: editing an approved artifact forks a new version via `reopen()` instead. */
export const updateArtifactVersionSchema = z
  .object({
    content: richTextField,
    notes: richTextField,
    ...gitProvenanceFields,
  })
  .refine((patch) => Object.keys(patch).length > 0, {
    message: "At least one field must be provided",
  });
export type UpdateArtifactVersionDto = z.infer<typeof updateArtifactVersionSchema>;

/**
 * A version status transition. `reason` is REQUIRED for `rejected` and `revision_requested`
 * (`05_Workflow_State_Machines.md §1`), and optional otherwise — expressed as a real schema-level
 * refinement so the rule cannot be bypassed by a caller, rather than as service-code discipline.
 */
export const changeVersionStatusSchema = z
  .object({
    status: pageArtifactVersionStatusSchema,
    reason: z.string().trim().max(REASON_MAX_LENGTH).nullish(),
  })
  .refine(
    (dto) =>
      !["rejected", "revision_requested"].includes(dto.status) ||
      (typeof dto.reason === "string" && dto.reason.length > 0),
    { path: ["reason"], message: "A reason is required to reject or request revision" },
  );
export type ChangeVersionStatusDto = z.infer<typeof changeVersionStatusSchema>;

/** `03_Detailed_Module_Specifications.md §6`: "Reopening an approved stage creates a new version
 *  and records the reason." The reason is mandatory, never optional. */
export const reopenArtifactSchema = z.object({
  reason: requiredReasonSchema,
});
export type ReopenArtifactDto = z.infer<typeof reopenArtifactSchema>;

/**
 * A page lifecycle transition (`05_Workflow_State_Machines.md §3`, task package D5).
 *
 * `reason` is required for the three states that represent something going wrong
 * (`revision_requested`, `blocked`, `failed`) — the same "rejection and revision require a
 * reason" rule from §1, applied to the lifecycle axis. `rolled_back` is included too: a rollback
 * is a real incident, and recording why is the whole point of an audited transition.
 */
export const changeLifecycleStageSchema = z
  .object({
    stage: pageLifecycleStageSchema,
    reason: z.string().trim().max(REASON_MAX_LENGTH).nullish(),
  })
  .refine(
    (dto) =>
      !["revision_requested", "blocked", "failed", "rolled_back"].includes(dto.stage) ||
      (typeof dto.reason === "string" && dto.reason.length > 0),
    { path: ["reason"], message: "A reason is required for this transition" },
  );
export type ChangeLifecycleStageDto = z.infer<typeof changeLifecycleStageSchema>;

/** Mirrors `PageArtifactVersionRepository`'s own DEFAULT/MAX clamping, so a caller cannot request
 *  an unbounded page — the same cap every list endpoint in this codebase applies. */
export const listVersionsQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(200).optional(),
  offset: z.coerce.number().int().min(0).optional(),
});
export type ListVersionsQueryDto = z.infer<typeof listVersionsQuerySchema>;
