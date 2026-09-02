import { z } from "zod";

// --- shared enums ---

const CATEGORY_VALUES = [
  "theme",
  "plugin",
  "core",
  "database",
  "integration",
  "seo_metadata",
  "analytics_tracking",
  "security",
  "accessibility",
  "performance",
  "redirects_urls",
  "assets",
  "conflicts_failed_sync",
  "rollback_history",
] as const;
export const changeRecordCategorySchema = z.enum(CATEGORY_VALUES);

export const changeRecordSeveritySchema = z.enum(["critical", "high", "medium", "low", "info"]);

const STATUS_VALUES = [
  "detected",
  "under_review",
  "accepted",
  "rejected",
  "deferred",
  "manual_merge_required",
  "applying",
  "applied",
  "verified",
  "apply_failed",
] as const;
export const changeRecordStatusSchema = z.enum(STATUS_VALUES);

// --- change_records ---

// `projectId` is deliberately NOT a field here — every route carries it exclusively via the
// `:projectId` route path segment, never a client-supplied query param, mirroring Scan Center's/
// Internal Linking Library's own `listXxxQuerySchema` doc comments (`PermissionGuard` only ever
// reads `request.params?.projectId`).
export const listChangeRecordsQuerySchema = z.object({
  category: changeRecordCategorySchema.optional(),
  severity: changeRecordSeveritySchema.optional(),
  status: changeRecordStatusSchema.optional(),
  scanFindingId: z.string().uuid().optional(),
  assignedToUserId: z.string().uuid().optional(),
  // A pure app-level list-filter convenience, not real object-level access control — see
  // change-center.constants.ts's own doc comment. Resolved against the caller's own id in the
  // controller, mirroring Review and Approval Center's own `assignedToMe` query param exactly.
  assignedToMe: z
    .enum(["true", "false"])
    .transform((value) => value === "true")
    .optional(),
  search: z.string().max(255).optional(),
  limit: z.coerce.number().int().min(1).max(200).optional(),
  offset: z.coerce.number().int().min(0).optional(),
});
export type ListChangeRecordsQueryDto = z.infer<typeof listChangeRecordsQuerySchema>;

/** `target_module_key`/`target_id` are always either both present or both absent — validated here
 *  for `create()` (no "current" record to merge against); `update()`'s own partial patch defers
 *  this same invariant to the service layer, since a partial payload may set only one half while
 *  intending the other to keep its already-stored value. */
function refineTargetPairing<
  T extends { readonly targetModuleKey?: string | null; readonly targetId?: string | null },
>(data: T, ctx: z.RefinementCtx): void {
  const hasModuleKey = data.targetModuleKey != null;
  const hasTargetId = data.targetId != null;
  if (hasModuleKey !== hasTargetId) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "targetModuleKey and targetId must both be provided, or both omitted",
      path: ["targetId"],
    });
  }
}

export const createChangeRecordSchema = z
  .object({
    publicId: z.string().min(1).max(64),
    category: changeRecordCategorySchema,
    severity: changeRecordSeveritySchema,
    scanFindingId: z.string().uuid().nullish(),
    source: z.string().max(255).nullish(),
    targetModuleKey: z.string().min(1).max(64).nullish(),
    targetId: z.string().uuid().nullish(),
    recordLabel: z.string().min(1).max(500),
    // Deliberately plain text, not sanitized/HTML — raw detected/proposed data (a version string,
    // a config diff snippet, a URL), mirroring Scan Center's own `target`/`errorSummary` fields.
    beforeValue: z.string().max(20_000).nullish(),
    afterValue: z.string().max(20_000).nullish(),
    confidence: z.number().int().min(0).max(100).nullish(),
    recommendation: z.string().max(20_000).nullish(),
    assignedToUserId: z.string().uuid().nullish(),
    decisionNotes: z.string().max(20_000).nullish(),
  })
  .superRefine(refineTargetPairing);
export type CreateChangeRecordDto = z.infer<typeof createChangeRecordSchema>;

// `publicId`/`category` are never accepted here — both immutable after creation, mirroring every
// sibling module's own `publicId`/discriminator-field create-only contract. `status` and every
// server-managed timestamp/`rollbackGuidance` are likewise never accepted — only the dedicated
// status-transition route may change any of them. `severity`, unlike `category`, has no
// documented reason to be immutable — a triager may need to correct an initially-miscategorized
// severity before the record is decided — so it's included here even though it's absent from the
// create-time-only fields above it.
export const updateChangeRecordSchema = z
  .object({
    severity: changeRecordSeveritySchema.optional(),
    scanFindingId: z.string().uuid().nullish(),
    source: z.string().max(255).nullish(),
    targetModuleKey: z.string().min(1).max(64).nullish(),
    targetId: z.string().uuid().nullish(),
    recordLabel: z.string().min(1).max(500).optional(),
    beforeValue: z.string().max(20_000).nullish(),
    afterValue: z.string().max(20_000).nullish(),
    confidence: z.number().int().min(0).max(100).nullish(),
    recommendation: z.string().max(20_000).nullish(),
    assignedToUserId: z.string().uuid().nullish(),
    decisionNotes: z.string().max(20_000).nullish(),
  })
  // Rejects a genuinely empty patch (`{}`) with a clean 400 instead of silently succeeding as a
  // no-op, mirroring every sibling module's own identical fix.
  .refine((data) => Object.keys(data).length > 0, {
    message: "At least one field must be provided",
  });
export type UpdateChangeRecordDto = z.infer<typeof updateChangeRecordSchema>;

export const changeChangeRecordStatusSchema = z
  .object({
    status: changeRecordStatusSchema,
    decisionNotes: z.string().max(20_000).nullish(),
    // Only ever meaningful on a transition INTO apply_failed (05_Workflow_State_Machines.md §8) —
    // rejected outright (a clean 400, not silently ignored) when paired with any other target
    // status, mirroring ScanRunsService's own "findings with the wrong target status" precedent.
    rollbackGuidance: z.string().max(20_000).nullish(),
  })
  .superRefine((data, ctx) => {
    if (data.rollbackGuidance !== undefined && data.status !== "apply_failed") {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "rollbackGuidance may only be supplied when transitioning to apply_failed",
        path: ["rollbackGuidance"],
      });
    }
  });
export type ChangeChangeRecordStatusDto = z.infer<typeof changeChangeRecordStatusSchema>;
