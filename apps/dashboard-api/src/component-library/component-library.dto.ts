import { z } from "zod";
import { safeHttpUrlSchema } from "@webdesk/validation";

// Mirrors packages/database/src/component-library/entities.ts's ComponentApprovalStatus —
// identical vocabulary to Design Token Library's/Website Strategy Center's/Service Library's/
// Persona Library's/Proof and Claims Library's own, reused verbatim (design decision 5).
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

export const componentApprovalStatusSchema = z.enum(APPROVAL_STATUS_VALUES);

const MAX_TOKEN_IDS = 100;
// .nullish(), not just .optional() — every other nullable field in this file distinguishes
// "omitted" (no change) from "explicit null" (clear), mirroring
// design-token-library.dto.ts's own usageReferencesField fix.
const tokenIdsField = z.array(z.string().uuid()).max(MAX_TOKEN_IDS).nullish();

// One shared shape for every optional text field below — short factual strings/paths (design
// decision 4) and prose/checklist-shaped fields (design decisions 3, other-fields notes) both
// reduce to the identical `z.string().max(max).nullish()`, so a single helper (parameterized by
// cap) replaces what were two identically-bodied functions. Longer caps are still sized
// generously so a future RichTextEditor conversion needs no migration.
const textField = (max: number) => z.string().max(max).nullish();

export const listComponentsQuerySchema = z.object({
  category: z.string().max(100).optional(),
  approvalStatus: componentApprovalStatusSchema.optional(),
  search: z.string().max(255).optional(),
  limit: z.coerce.number().int().min(1).max(200).optional(),
  offset: z.coerce.number().int().min(0).optional(),
});
export type ListComponentsQueryDto = z.infer<typeof listComponentsQuerySchema>;

export const createComponentSchema = z.object({
  publicId: z.string().min(1).max(64),
  category: z.string().min(1).max(100),
  name: z.string().min(1).max(255),
  // safeHttpUrlSchema (@webdesk/validation), not a bare z.string() — a stored `javascript:` value
  // rendered as a link in a future dashboard-web UI would repeat the exact stored-XSS gap
  // Projects' own `environment.url` shipped with once (design decision, other-fields notes).
  figmaReference: safeHttpUrlSchema.nullish(),
  tokenIds: tokenIdsField,
  htmlStructure: textField(4_000),
  phpPath: textField(2_000),
  scssClassesPath: textField(2_000),
  jsDependencies: textField(2_000),
  states: textField(4_000),
  responsiveBehavior: textField(2_000),
  browserSupport: textField(2_000),
  accessibility: textField(2_000),
  schema: textField(2_000),
  analytics: textField(2_000),
  tests: textField(2_000),
  // Existence-checked in-module (ComponentsService.assertReplacementExists()) against this same
  // table's own recordId — never immutable across a version chain, unlike category (design
  // decision, other-fields notes).
  replacementRecordId: z.string().uuid().nullish(),
});
export type CreateComponentDto = z.infer<typeof createComponentSchema>;

// category/publicId are never accepted here — both immutable after creation. approvalStatus is
// likewise never accepted — only the dedicated status-transition route may change it, same
// discipline as every sibling module's own update schema.
export const updateComponentSchema = z
  .object({
    name: z.string().min(1).max(255).optional(),
    figmaReference: safeHttpUrlSchema.nullish(),
    tokenIds: tokenIdsField,
    htmlStructure: textField(4_000),
    phpPath: textField(2_000),
    scssClassesPath: textField(2_000),
    jsDependencies: textField(2_000),
    states: textField(4_000),
    responsiveBehavior: textField(2_000),
    browserSupport: textField(2_000),
    accessibility: textField(2_000),
    schema: textField(2_000),
    analytics: textField(2_000),
    tests: textField(2_000),
    replacementRecordId: z.string().uuid().nullish(),
  })
  // Rejects a genuinely empty patch (`{}`) with a clean 400 instead of silently succeeding as a
  // no-op that still writes an essentially-empty audit event, mirroring every sibling module's
  // own identical fix (updateDesignTokenSchema, updateWebsiteStrategyRecordSchema,
  // updatePersonaSchema, updateProofClaimSchema).
  .refine((data) => Object.keys(data).length > 0, {
    message: "At least one field must be provided",
  });
export type UpdateComponentDto = z.infer<typeof updateComponentSchema>;

export const changeComponentApprovalStatusSchema = z.object({
  approvalStatus: componentApprovalStatusSchema,
});
export type ChangeComponentApprovalStatusDto = z.infer<typeof changeComponentApprovalStatusSchema>;
