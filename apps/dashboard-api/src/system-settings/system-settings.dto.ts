import { z } from "zod";

// Mirrors packages/database/src/system-settings/entities.ts's SystemSettingType (D1).
const SETTING_TYPE_VALUES = [
  "status_definition",
  "category_definition",
  "taxonomy_definition",
  "file_limit",
  "git_rule",
  "backup_rule",
  "escalation_sla",
  "documentation_rule",
  "environment",
] as const;

export const systemSettingTypeSchema = z.enum(SETTING_TYPE_VALUES);

const MAX_JSON_FIELD_BYTES = 50_000;

/**
 * The implementation doc's own "Scope" section describes this as reusing a shared
 * `boundedJsonObjectSchema()` helper from `@webdesk/validation`, "introduced by Import and Export
 * Center." That turned out to be aspirational, not actual: `import-and-export-center.dto.ts`
 * declares an identically-shaped helper (same 50,000-byte cap) as a private, module-local
 * function — it was never actually promoted into `@webdesk/validation`. Rather than import a
 * symbol that doesn't exist, this module declares its own local copy, byte-for-byte matching
 * Import and Export Center's own cap and refinement shape, flagged here for a future reviewer
 * (and a real candidate for promoting into `@webdesk/validation` once a third consumer needs it —
 * this codebase's own established "extract after the 2nd occurrence" convention).
 */
function boundedJsonObjectSchema(fieldLabel: string) {
  return z
    .record(z.unknown())
    .refine((value) => Buffer.byteLength(JSON.stringify(value), "utf8") <= MAX_JSON_FIELD_BYTES, {
      message: `${fieldLabel} must serialize to at most ${MAX_JSON_FIELD_BYTES} bytes`,
    });
}

// `z.coerce.boolean()` runs `Boolean(value)` — since query params always arrive as strings,
// `?isActive=false` would coerce to `Boolean("false")`, which is `true` (any non-empty string is
// truthy), silently inverting the filter. An explicit "true"/"false" literal map has no such trap
// — mirrors `listBrandLibraryRecordsQuerySchema`'s own already-fixed `booleanQueryParam`.
const booleanQueryParam = z.enum(["true", "false"]).transform((value) => value === "true");

export const listSystemSettingsQuerySchema = z.object({
  settingType: systemSettingTypeSchema.optional(),
  isActive: booleanQueryParam.optional(),
  search: z.string().max(255).optional(),
  limit: z.coerce.number().int().min(1).max(200).optional(),
  offset: z.coerce.number().int().min(0).optional(),
});
export type ListSystemSettingsQueryDto = z.infer<typeof listSystemSettingsQuerySchema>;

export const createSystemSettingSchema = z.object({
  publicId: z.string().min(1).max(64),
  settingType: systemSettingTypeSchema,
  key: z.string().min(1).max(200),
  // Bounded JSONB (D2) — no per-settingType schema validation beyond the byte cap, since no spec
  // exists to validate each settingType's own real shape against.
  value: boundedJsonObjectSchema("value"),
  // Plain text (no rich-text/sanitization — this is internal config, not authored content).
  description: z.string().max(2000).nullish(),
});
export type CreateSystemSettingDto = z.infer<typeof createSystemSettingSchema>;

// publicId and settingType are both create-only (D1's own "immutable after create" rule —
// changing settingType after creation would be a different record). isActive is deliberately not
// accepted here (D4) — it only changes via the dedicated active-state route. Derived from
// createSystemSettingSchema (mirrors updateBrandLibraryRecordSchema's own precedent) rather than
// hand-retyped, so `key`'s own constraints stay in exactly one place too.
export const updateSystemSettingSchema = createSystemSettingSchema
  .omit({ publicId: true, settingType: true })
  .partial()
  // Rejects a genuinely empty patch (`{}`) with a clean 400 instead of silently succeeding as a
  // no-op write (matches updateBrandLibraryRecordSchema's own precedent).
  .refine((data) => Object.keys(data).length > 0, {
    message: "At least one field must be provided",
  });
export type UpdateSystemSettingDto = z.infer<typeof updateSystemSettingSchema>;

// expectedIsActive is an optional CAS guard (mirrors ContentTemplateRepository.updatePublishState()'s
// own expectedIsPublished parameter) — a caller that read the setting's current state can pass it
// back to close the same class of concurrent-write race Brand Library's own CAS guards prevent; a
// caller that doesn't care about a stale-read race can omit it for a plain unconditional toggle.
export const changeSystemSettingActiveStateSchema = z.object({
  isActive: z.boolean(),
  expectedIsActive: z.boolean().optional(),
});
export type ChangeSystemSettingActiveStateDto = z.infer<
  typeof changeSystemSettingActiveStateSchema
>;
