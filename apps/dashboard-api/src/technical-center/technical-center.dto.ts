import { z } from "zod";

// --- shared enums ---

const TECHNICAL_CHECK_TYPE_VALUES = [
  "coding_standards",
  "linting",
  "automated_tests",
  "coverage",
  "dependency_vulnerability",
  "wordpress_compatibility",
  "php_compatibility",
  "code_review",
  "security",
  "accessibility",
  "performance",
  "browser_compatibility",
  "visual_regression",
] as const;
export const technicalCheckTypeSchema = z.enum(TECHNICAL_CHECK_TYPE_VALUES);

export const technicalCheckModeSchema = z.enum(["manual", "scheduled"]);

const TECHNICAL_CHECK_RUN_STATUS_VALUES = [
  "requested",
  "queued",
  "running",
  "completed",
  "partially_completed",
  "failed",
  "timed_out",
  "cancelled",
] as const;
export const technicalCheckRunStatusSchema = z.enum(TECHNICAL_CHECK_RUN_STATUS_VALUES);

export const technicalCheckRunTriggerTypeSchema = z.enum(["manual", "scheduled"]);

export const technicalFindingSeveritySchema = z.enum(["critical", "high", "medium", "low", "info"]);

export const technicalFindingStatusSchema = z.enum([
  "open",
  "acknowledged",
  "resolved",
  "dismissed",
]);

// --- technical_check_definitions ---

// `projectId` is deliberately NOT a field here — every route carries it exclusively via the
// `:projectId` route path segment, never a client-supplied query param (`PermissionGuard` only
// ever reads `request.params?.projectId` — the exact lesson Page Inventory's/Scan Center's own
// doc comments record).
export const listTechnicalCheckDefinitionsQuerySchema = z.object({
  checkType: technicalCheckTypeSchema.optional(),
  isEnabled: z
    .enum(["true", "false"])
    .transform((value) => value === "true")
    .optional(),
  search: z.string().max(255).optional(),
  limit: z.coerce.number().int().min(1).max(200).optional(),
  offset: z.coerce.number().int().min(0).optional(),
});
export type ListTechnicalCheckDefinitionsQueryDto = z.infer<
  typeof listTechnicalCheckDefinitionsQuerySchema
>;

export const createTechnicalCheckDefinitionSchema = z.object({
  publicId: z.string().min(1).max(64),
  name: z.string().min(1).max(255),
  checkType: technicalCheckTypeSchema,
  mode: technicalCheckModeSchema.optional(),
  // Deliberately NOT URL-validated — a repository ref, a package name, or a "selected page" slug
  // isn't always a URL.
  target: z.string().max(10_000).nullish(),
  environment: z.string().max(255).nullish(),
  scheduleCron: z.string().max(255).nullish(),
  isEnabled: z.boolean().optional(),
});
export type CreateTechnicalCheckDefinitionDto = z.infer<
  typeof createTechnicalCheckDefinitionSchema
>;

// `publicId`/`checkType` are never accepted here — both immutable after creation, mirroring
// every sibling module's own `publicId`/discriminator-field create-only contract.
export const updateTechnicalCheckDefinitionSchema = z
  .object({
    name: z.string().min(1).max(255).optional(),
    mode: technicalCheckModeSchema.optional(),
    target: z.string().max(10_000).nullish(),
    environment: z.string().max(255).nullish(),
    scheduleCron: z.string().max(255).nullish(),
    isEnabled: z.boolean().optional(),
  })
  .refine((data) => Object.keys(data).length > 0, {
    message: "At least one field must be provided",
  });
export type UpdateTechnicalCheckDefinitionDto = z.infer<
  typeof updateTechnicalCheckDefinitionSchema
>;

// --- technical_check_runs ---

export const listTechnicalCheckRunsQuerySchema = z.object({
  technicalCheckDefinitionId: z.string().uuid().optional(),
  status: technicalCheckRunStatusSchema.optional(),
  limit: z.coerce.number().int().min(1).max(200).optional(),
  offset: z.coerce.number().int().min(0).optional(),
});
export type ListTechnicalCheckRunsQueryDto = z.infer<typeof listTechnicalCheckRunsQuerySchema>;

// The definition itself supplies check type/target/etc. — a run only needs to know how it was
// triggered.
export const createTechnicalCheckRunSchema = z.object({
  technicalCheckDefinitionId: z.string().uuid(),
  publicId: z.string().min(1).max(64),
  triggerType: technicalCheckRunTriggerTypeSchema,
});
export type CreateTechnicalCheckRunDto = z.infer<typeof createTechnicalCheckRunSchema>;

// A newly-created finding, accepted only alongside a run's own transition into a terminal
// "completed with results" state (`completed`/`partially_completed`) — there is no standalone
// create route for technical_findings.
export const technicalCheckRunFindingInputSchema = z.object({
  category: z.string().max(255).nullish(),
  severity: technicalFindingSeveritySchema,
  title: z.string().min(1).max(255),
  description: z.string().max(20_000).nullish(),
  location: z.string().max(500).nullish(),
});
export type TechnicalCheckRunFindingInputDto = z.infer<typeof technicalCheckRunFindingInputSchema>;

export const changeTechnicalCheckRunStatusSchema = z.object({
  status: technicalCheckRunStatusSchema,
  errorSummary: z.string().max(10_000).nullish(),
  findings: z.array(technicalCheckRunFindingInputSchema).max(500).optional(),
});
export type ChangeTechnicalCheckRunStatusDto = z.infer<typeof changeTechnicalCheckRunStatusSchema>;

// --- technical_findings ---

export const listTechnicalFindingsQuerySchema = z.object({
  technicalCheckRunId: z.string().uuid().optional(),
  severity: technicalFindingSeveritySchema.optional(),
  status: technicalFindingStatusSchema.optional(),
  search: z.string().max(255).optional(),
  limit: z.coerce.number().int().min(1).max(200).optional(),
  offset: z.coerce.number().int().min(0).optional(),
});
export type ListTechnicalFindingsQueryDto = z.infer<typeof listTechnicalFindingsQuerySchema>;

export const changeTechnicalFindingStatusSchema = z.object({
  status: technicalFindingStatusSchema,
});
export type ChangeTechnicalFindingStatusDto = z.infer<typeof changeTechnicalFindingStatusSchema>;
