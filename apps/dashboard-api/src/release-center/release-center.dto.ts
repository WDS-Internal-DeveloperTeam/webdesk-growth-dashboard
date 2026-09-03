import { z } from "zod";
import { safeHttpUrlSchema } from "@webdesk/validation";

// --- shared enums ---

export const releaseTypeSchema = z.enum(["staging", "production", "hotfix", "rollback"]);

const RELEASE_STATUS_VALUES = [
  "proposed",
  "checks_running",
  "checks_failed",
  "ready_for_staging",
  "staging_deployed",
  "staging_verification",
  "verification_failed",
  "staging_approved",
  "production_approval",
  "production_deployed",
  "production_verification",
  "completed",
  "hotfix_required",
  "rolled_back",
] as const;
export const releaseStatusSchema = z.enum(RELEASE_STATUS_VALUES);

export const deploymentEnvironmentSchema = z.enum(["staging", "production"]);
export const deploymentOutcomeSchema = z.enum(["succeeded", "failed"]);
export const smokeTestResultSchema = z.enum(["passed", "failed"]);

// --- releases ---

// `projectId` is deliberately NOT a field here — every route carries it exclusively via the
// `:projectId` route path segment, never a client-supplied query param (`PermissionGuard` only
// ever reads `request.params?.projectId` — the exact lesson Page Inventory's/Scan Center's own doc
// comments record).
export const listReleasesQuerySchema = z.object({
  releaseType: releaseTypeSchema.optional(),
  status: releaseStatusSchema.optional(),
  search: z.string().max(255).optional(),
  limit: z.coerce.number().int().min(1).max(200).optional(),
  offset: z.coerce.number().int().min(0).optional(),
});
export type ListReleasesQueryDto = z.infer<typeof listReleasesQuerySchema>;

export const createReleaseSchema = z.object({
  publicId: z.string().min(1).max(64),
  releaseType: releaseTypeSchema,
  title: z.string().min(1).max(255),
  // Deliberately plain, unsanitized text — no `dashboard-web` UI exists yet, matching Scan
  // Center's/Technical Center's own "stay plain until a UI decision is made" precedent.
  notes: z.string().max(10_000).nullish(),
  hotfixReason: z.string().max(10_000).nullish(),
  assignedDeveloperUserId: z.string().uuid().nullish(),
  assignedReviewerUserId: z.string().uuid().nullish(),
});
export type CreateReleaseDto = z.infer<typeof createReleaseSchema>;

// `publicId`/`releaseType` are never accepted here — both immutable after creation, mirroring
// every sibling module's own `publicId`/discriminator-field create-only contract. `status` and
// every server-stamped column are likewise never accepted — only `changeStatus()` may set them.
export const updateReleaseSchema = z
  .object({
    title: z.string().min(1).max(255).optional(),
    notes: z.string().max(10_000).nullish(),
    hotfixReason: z.string().max(10_000).nullish(),
    assignedDeveloperUserId: z.string().uuid().nullish(),
    assignedReviewerUserId: z.string().uuid().nullish(),
  })
  .refine((data) => Object.keys(data).length > 0, {
    message: "At least one field must be provided",
  });
export type UpdateReleaseDto = z.infer<typeof updateReleaseSchema>;

export const changeReleaseStatusSchema = z.object({
  status: releaseStatusSchema,
  // Recorded onto `release_approvals.notes` when the transition's own action is `approve`;
  // otherwise ignored.
  notes: z.string().max(10_000).nullish(),
  // Required only on a transition into `rolled_back` — enforced in `ReleasesService.changeStatus()`
  // itself, not at this schema layer, mirroring `CaseStudiesService.changeStatus()`'s own
  // `unpublishReason`-required-on-one-transition precedent.
  reason: z.string().max(10_000).nullish(),
  rolledBackSha: z.string().max(40).nullish(),
  replacementReleaseId: z.string().uuid().nullish(),
});
export type ChangeReleaseStatusDto = z.infer<typeof changeReleaseStatusSchema>;

// --- release_artifacts ("repositories and SHAs, PRs") ---

const repoOwnerOrName = z
  .string()
  .min(1)
  .max(255)
  .regex(/^[\w.-]+$/, "expected a plain GitHub owner/repo segment, no slashes or spaces");

export const listReleaseArtifactsQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(200).optional(),
  offset: z.coerce.number().int().min(0).optional(),
});
export type ListReleaseArtifactsQueryDto = z.infer<typeof listReleaseArtifactsQuerySchema>;

export const createReleaseArtifactSchema = z.object({
  repoOwner: repoOwnerOrName,
  repoName: repoOwnerOrName,
  commitSha: z.string().min(1).max(40),
  prUrl: safeHttpUrlSchema.nullish(),
});
export type CreateReleaseArtifactDto = z.infer<typeof createReleaseArtifactSchema>;

// --- deployments ---

export const listDeploymentsQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(200).optional(),
  offset: z.coerce.number().int().min(0).optional(),
});
export type ListDeploymentsQueryDto = z.infer<typeof listDeploymentsQuerySchema>;

export const createDeploymentSchema = z.object({
  environment: deploymentEnvironmentSchema,
  outcome: deploymentOutcomeSchema,
  // Manual record-keeping (no real execution engine, D3) — a caller may back-date when the deploy
  // actually happened; omitted defaults to `now()` at the database layer.
  deployedAt: z.string().datetime().optional(),
  notes: z.string().max(10_000).nullish(),
});
export type CreateDeploymentDto = z.infer<typeof createDeploymentSchema>;

// --- smoke_tests ---

export const listSmokeTestsQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(200).optional(),
  offset: z.coerce.number().int().min(0).optional(),
});
export type ListSmokeTestsQueryDto = z.infer<typeof listSmokeTestsQuerySchema>;

export const createSmokeTestSchema = z.object({
  environment: deploymentEnvironmentSchema,
  name: z.string().min(1).max(255),
  result: smokeTestResultSchema,
  ranAt: z.string().datetime().optional(),
  notes: z.string().max(10_000).nullish(),
});
export type CreateSmokeTestDto = z.infer<typeof createSmokeTestSchema>;
