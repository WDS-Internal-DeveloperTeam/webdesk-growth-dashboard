import { z } from "zod";

// Mirrors packages/database/src/design-token-library/entities.ts's DesignTokenGroup — a
// collapsed reading of the spec's own token-group taxonomy (see that file's own doc comment for
// which finer-grained spec items each value covers).
const GROUP_VALUES = [
  "colors",
  "semantic_statuses",
  "theme",
  "typography",
  "spacing",
  "grids",
  "breakpoints",
  "borders",
  "shadows",
  "opacity_and_z_index",
  "icon_sizes",
  "media_ratios",
  "component_sizes",
  "motion",
  "interactive_states",
] as const;

export const designTokenGroupSchema = z.enum(GROUP_VALUES);

const THEME_VARIATION_VALUES = ["light", "dark", "both"] as const;
export const designTokenThemeVariationSchema = z.enum(THEME_VARIATION_VALUES);

// Mirrors packages/database/src/design-token-library/entities.ts's DesignTokenApprovalStatus —
// identical vocabulary to Website Strategy Center's/Service Library's/Persona Library's/Proof and
// Claims Library's own, reused verbatim (design decision 2).
const APPROVAL_STATUS_VALUES = [
  "draft",
  "submitted",
  "under_review",
  "approved",
  "revision_requested",
  "rejected",
  "superseded",
  "archived",
] as const;

export const designTokenApprovalStatusSchema = z.enum(APPROVAL_STATUS_VALUES);

const MAX_USAGE_REFERENCES = 50;
// .nullish(), not just .optional() — every other nullable field in this file distinguishes
// "omitted" (no change) from "explicit null" (clear), and a caller following that convention for
// this field must be able to do the same (code-review finding, matching the identical fix already
// made once in persona-library.dto.ts's stringListField/idListField).
const usageReferencesField = z
  .array(z.string().min(1).max(255))
  .max(MAX_USAGE_REFERENCES)
  .nullish();

export const listDesignTokensQuerySchema = z.object({
  group: designTokenGroupSchema.optional(),
  approvalStatus: designTokenApprovalStatusSchema.optional(),
  search: z.string().max(255).optional(),
  limit: z.coerce.number().int().min(1).max(200).optional(),
  offset: z.coerce.number().int().min(0).optional(),
});
export type ListDesignTokensQueryDto = z.infer<typeof listDesignTokensQuerySchema>;

export const createDesignTokenSchema = z.object({
  publicId: z.string().min(1).max(64),
  group: designTokenGroupSchema,
  name: z.string().min(1).max(255),
  value: z.string().min(1).max(2_000),
  unit: z.string().max(32).nullish(),
  semanticPurpose: z.string().max(2_000).nullish(),
  responsiveVariation: z.string().max(2_000).nullish(),
  themeVariation: designTokenThemeVariationSchema.nullish(),
  usageReferences: usageReferencesField,
});
export type CreateDesignTokenDto = z.infer<typeof createDesignTokenSchema>;

// group/publicId are never accepted here — both immutable after creation. approvalStatus is
// likewise never accepted — only the dedicated status-transition route may change it, same
// discipline as every sibling module's own update schema.
export const updateDesignTokenSchema = z
  .object({
    name: z.string().min(1).max(255).optional(),
    value: z.string().min(1).max(2_000).optional(),
    unit: z.string().max(32).nullish(),
    semanticPurpose: z.string().max(2_000).nullish(),
    responsiveVariation: z.string().max(2_000).nullish(),
    themeVariation: designTokenThemeVariationSchema.nullish(),
    usageReferences: usageReferencesField,
  })
  // Rejects a genuinely empty patch (`{}`) with a clean 400 instead of silently succeeding as a
  // no-op that still writes an essentially-empty audit event, mirroring every sibling module's
  // own identical fix (Website Strategy Center's updateWebsiteStrategyRecordSchema, Persona
  // Library's updatePersonaSchema, Proof and Claims Library's updateProofClaimSchema).
  .refine((data) => Object.keys(data).length > 0, {
    message: "At least one field must be provided",
  });
export type UpdateDesignTokenDto = z.infer<typeof updateDesignTokenSchema>;

export const changeDesignTokenApprovalStatusSchema = z.object({
  approvalStatus: designTokenApprovalStatusSchema,
});
export type ChangeDesignTokenApprovalStatusDto = z.infer<
  typeof changeDesignTokenApprovalStatusSchema
>;
