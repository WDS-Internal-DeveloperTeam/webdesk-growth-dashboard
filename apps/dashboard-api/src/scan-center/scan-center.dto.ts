import { z } from "zod";
import { safeHttpUrlSchema } from "@webdesk/validation";

// --- shared enums ---

const SCAN_TYPE_VALUES = [
  "full_website",
  "selected_page",
  "repository",
  "wordpress_health",
  "theme_plugin_core_currency",
  "security_indicators",
  "accessibility",
  "performance",
  "links",
  "metadata",
  "structured_data",
] as const;
export const scanTypeSchema = z.enum(SCAN_TYPE_VALUES);

export const scanModeSchema = z.enum(["manual", "scheduled"]);

const SCAN_RUN_STATUS_VALUES = [
  "requested",
  "queued",
  "running",
  "completed",
  "partially_completed",
  "failed",
  "timed_out",
  "cancelled",
] as const;
export const scanRunStatusSchema = z.enum(SCAN_RUN_STATUS_VALUES);

export const scanRunTriggerTypeSchema = z.enum(["manual", "scheduled"]);

export const scanFindingSeveritySchema = z.enum(["critical", "high", "medium", "low", "info"]);

export const scanFindingStatusSchema = z.enum(["open", "acknowledged", "resolved", "dismissed"]);

// --- scan_definitions ---

// `projectId` is deliberately NOT a field here — every route carries it exclusively via the
// `:projectId` route path segment, never a client-supplied query param (`PermissionGuard` only
// ever reads `request.params?.projectId` — the exact lesson Page Inventory's/Keyword & Entity
// Library's/Internal Linking Library's own doc comments record).
export const listScanDefinitionsQuerySchema = z.object({
  scanType: scanTypeSchema.optional(),
  isEnabled: z
    .enum(["true", "false"])
    .transform((value) => value === "true")
    .optional(),
  search: z.string().max(255).optional(),
  limit: z.coerce.number().int().min(1).max(200).optional(),
  offset: z.coerce.number().int().min(0).optional(),
});
export type ListScanDefinitionsQueryDto = z.infer<typeof listScanDefinitionsQuerySchema>;

export const createScanDefinitionSchema = z.object({
  publicId: z.string().min(1).max(64),
  name: z.string().min(1).max(255),
  scanType: scanTypeSchema,
  mode: scanModeSchema.optional(),
  // Deliberately NOT URL-validated — a repository ref or a "selected page" slug isn't always a URL.
  target: z.string().max(10_000).nullish(),
  environment: z.string().max(255).nullish(),
  scheduleCron: z.string().max(255).nullish(),
  isEnabled: z.boolean().optional(),
});
export type CreateScanDefinitionDto = z.infer<typeof createScanDefinitionSchema>;

// `publicId`/`scanType` are never accepted here — both immutable after creation, mirroring every
// sibling module's own `publicId`/discriminator-field create-only contract.
export const updateScanDefinitionSchema = z
  .object({
    name: z.string().min(1).max(255).optional(),
    mode: scanModeSchema.optional(),
    target: z.string().max(10_000).nullish(),
    environment: z.string().max(255).nullish(),
    scheduleCron: z.string().max(255).nullish(),
    isEnabled: z.boolean().optional(),
  })
  .refine((data) => Object.keys(data).length > 0, {
    message: "At least one field must be provided",
  });
export type UpdateScanDefinitionDto = z.infer<typeof updateScanDefinitionSchema>;

// --- scan_runs ---

export const listScanRunsQuerySchema = z.object({
  scanDefinitionId: z.string().uuid().optional(),
  status: scanRunStatusSchema.optional(),
  limit: z.coerce.number().int().min(1).max(200).optional(),
  offset: z.coerce.number().int().min(0).optional(),
});
export type ListScanRunsQueryDto = z.infer<typeof listScanRunsQuerySchema>;

// The definition itself supplies scan type/target/etc. — a run only needs to know how it was
// triggered.
export const createScanRunSchema = z.object({
  scanDefinitionId: z.string().uuid(),
  publicId: z.string().min(1).max(64),
  triggerType: scanRunTriggerTypeSchema,
});
export type CreateScanRunDto = z.infer<typeof createScanRunSchema>;

// A newly-created finding, accepted only alongside a run's own transition into a terminal
// "completed with results" state (`completed`/`partially_completed`) — there is no standalone
// create route for scan_findings.
export const scanRunFindingInputSchema = z.object({
  category: z.string().max(255).nullish(),
  severity: scanFindingSeveritySchema,
  title: z.string().min(1).max(255),
  description: z.string().max(20_000).nullish(),
  location: z.string().max(500).nullish(),
});
export type ScanRunFindingInputDto = z.infer<typeof scanRunFindingInputSchema>;

export const changeScanRunStatusSchema = z.object({
  status: scanRunStatusSchema,
  errorSummary: z.string().max(10_000).nullish(),
  findings: z.array(scanRunFindingInputSchema).max(500).optional(),
});
export type ChangeScanRunStatusDto = z.infer<typeof changeScanRunStatusSchema>;

// --- scan_findings ---

export const listScanFindingsQuerySchema = z.object({
  scanRunId: z.string().uuid().optional(),
  severity: scanFindingSeveritySchema.optional(),
  status: scanFindingStatusSchema.optional(),
  search: z.string().max(255).optional(),
  limit: z.coerce.number().int().min(1).max(200).optional(),
  offset: z.coerce.number().int().min(0).optional(),
});
export type ListScanFindingsQueryDto = z.infer<typeof listScanFindingsQuerySchema>;

export const changeScanFindingStatusSchema = z.object({
  status: scanFindingStatusSchema,
});
export type ChangeScanFindingStatusDto = z.infer<typeof changeScanFindingStatusSchema>;

// --- scan_evidence ---

export const listScanEvidenceQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(200).optional(),
  offset: z.coerce.number().int().min(0).optional(),
});
export type ListScanEvidenceQueryDto = z.infer<typeof listScanEvidenceQuerySchema>;

export const createScanEvidenceSchema = z.object({
  publicId: z.string().min(1).max(64),
  evidenceType: z.string().max(100).nullish(),
  reference: safeHttpUrlSchema.nullish(),
  notes: z.string().max(10_000).nullish(),
  capturedAt: z.string().datetime().nullish(),
});
export type CreateScanEvidenceDto = z.infer<typeof createScanEvidenceSchema>;
