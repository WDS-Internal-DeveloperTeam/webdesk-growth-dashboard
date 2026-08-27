import { z } from "zod";
import { safeHttpUrlSchema } from "@webdesk/validation";

// Mirrors packages/database/src/asset-library/entities.ts's AssetVisibility (D2).
const VISIBILITY_VALUES = ["public", "internal", "restricted"] as const;
export const assetVisibilitySchema = z.enum(VISIBILITY_VALUES);

// Mirrors packages/database/src/asset-library/entities.ts's AssetScanStatus (D4). Exposed for the
// LIST FILTER only — `scanStatus` is server-managed and is deliberately absent from both the
// create and update schemas, since no scanner exists and nothing may claim a scan result.
const SCAN_STATUS_VALUES = ["not_configured", "pending", "clean", "infected", "failed"] as const;
export const assetScanStatusSchema = z.enum(SCAN_STATUS_VALUES);

// Mirrors packages/database/src/asset-library/entities.ts's AssetApprovalStatus — reused verbatim
// (D5) from Brand Library's/Content Template Library's/Service Library's own identical
// ArtifactApprovalStatus union.
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
export const assetApprovalStatusSchema = z.enum(APPROVAL_STATUS_VALUES);

// `.nullish()` so an explicit `null` can clear a field on update, same convention every sibling
// module's own text fields use.
const LONG_TEXT_MAX_LENGTH = 4000;
const longTextField = z.string().max(LONG_TEXT_MAX_LENGTH).nullish();
const shortTextField = z.string().max(255).nullish();

// `z.coerce.boolean()` runs `Boolean(value)` — since query params always arrive as strings,
// `?isPublished=false` would coerce to `Boolean("false")`, which is `true` (any non-empty string
// is truthy), silently inverting the filter. An explicit "true"/"false" literal map has no such
// trap — mirrors `listBrandLibraryRecordsQuerySchema`'s own already-fixed `booleanQueryParam`.
const booleanQueryParam = z.enum(["true", "false"]).transform((value) => value === "true");

export const listAssetsQuerySchema = z.object({
  approvalStatus: assetApprovalStatusSchema.optional(),
  visibility: assetVisibilitySchema.optional(),
  scanStatus: assetScanStatusSchema.optional(),
  mimeType: z.string().max(255).optional(),
  isPublished: booleanQueryParam.optional(),
  search: z.string().max(255).optional(),
  limit: z.coerce.number().int().min(1).max(200).optional(),
  offset: z.coerce.number().int().min(0).optional(),
});
export type ListAssetsQueryDto = z.infer<typeof listAssetsQuerySchema>;

/**
 * `fileSizeBytes` arrives as a string, not a number: the column is a Postgres BIGINT (a real media
 * file exceeds INTEGER's ~2.1GB ceiling) and JavaScript's `number` cannot represent every BIGINT
 * value exactly. Validated as a non-negative integer literal so a malformed value is a clean 400
 * rather than a raw 500 from Postgres on INSERT.
 */
const fileSizeBytesField = z
  .string()
  .regex(/^\d+$/, "fileSizeBytes must be a non-negative integer string")
  .max(20)
  .nullish();

export const createAssetSchema = z.object({
  publicId: z.string().min(1).max(64),
  title: z.string().min(1).max(255),
  description: longTextField,
  // safeHttpUrlSchema (@webdesk/validation), not a bare z.string() — a stored `javascript:` value
  // would otherwise be a real stored-XSS path once this field is ever rendered as a link by a
  // future dashboard-web UI (D1), mirroring `BrandLibraryRecord.fileReference`'s/
  // `ProjectEnvironment.url`'s/`ProofClaim.claimSources[].sourceUrl`'s own identical guard.
  fileReference: safeHttpUrlSchema.nullish(),
  // The five fields below are caller-supplied metadata in this pass, NOT values derived from a
  // file this system holds (D1) — no Vercel Blob store is provisioned, so no real upload path
  // exists yet. Once the upload slice lands these become server-derived and should stop being
  // accepted here.
  mimeType: shortTextField,
  fileSizeBytes: fileSizeBytesField,
  checksum: z.string().max(128).nullish(),
  widthPx: z.number().int().min(0).nullish(),
  heightPx: z.number().int().min(0).nullish(),
  durationSeconds: z.number().int().min(0).nullish(),
  licence: longTextField,
  licenceHolder: shortTextField,
  consentReference: longTextField,
  altTextGuidance: longTextField,
  // Optional on create — the repository defaults it to `internal`, deliberately the conservative
  // middle value rather than `public`, so an asset is never accidentally created world-visible.
  visibility: assetVisibilitySchema.optional(),
  retentionNote: longTextField,
  // `scanStatus` is deliberately NOT accepted (D4) — server-managed, and no code path in this
  // module ever writes anything but `not_configured`, since no malware scanner exists. A caller
  // must never be able to assert that a file is clean.
});
export type CreateAssetDto = z.infer<typeof createAssetSchema>;

// publicId is create-only (never regenerated once assigned). approvalStatus, scanStatus, version,
// isPublished, and publishedAt are deliberately not accepted here (D4/D5/D6) — approvalStatus only
// changes via the dedicated status-transition route, isPublished/publishedAt only via the
// dedicated publish/unpublish routes, scanStatus never, and version is server-managed, incremented
// automatically on every successful update. Derived from createAssetSchema (mirrors
// updateBrandLibraryRecordSchema's own precedent) rather than hand-retyped, so each field's own
// constraints stay in exactly one place.
export const updateAssetSchema = createAssetSchema
  .omit({ publicId: true })
  .partial()
  // Rejects a genuinely empty patch (`{}`) with a clean 400 instead of silently succeeding as a
  // no-op that still burns a `version` increment (matches updateBrandLibraryRecordSchema's own
  // precedent).
  .refine((data) => Object.keys(data).length > 0, {
    message: "At least one field must be provided",
  });
export type UpdateAssetDto = z.infer<typeof updateAssetSchema>;

export const changeAssetApprovalStatusSchema = z.object({
  approvalStatus: assetApprovalStatusSchema,
});
export type ChangeAssetApprovalStatusDto = z.infer<typeof changeAssetApprovalStatusSchema>;

/**
 * Spec §12's "related records" (D3). `moduleKey` is a `module_registry.key` value, validated at
 * the service layer against the REAL registry via `AuthorizationService.isValidModuleKey()` — a
 * length/format check here would not be enough, since an unrecognized key would otherwise create
 * a relationship pointing at nothing. `recordId` is a UUID but carries no foreign key: the target
 * may live in any of the 43 registered modules, most of which have no table yet.
 */
export const createAssetRelatedRecordSchema = z.object({
  moduleKey: z.string().min(1).max(64),
  recordId: z.string().uuid(),
  note: z.string().max(500).nullish(),
});
export type CreateAssetRelatedRecordDto = z.infer<typeof createAssetRelatedRecordSchema>;

/** Only `note` is patchable — `moduleKey`/`recordId` together ARE the relationship's identity;
 *  repointing one at a different target is a delete plus a create, not an edit. */
export const updateAssetRelatedRecordSchema = z.object({
  note: z.string().max(500).nullish(),
});
export type UpdateAssetRelatedRecordDto = z.infer<typeof updateAssetRelatedRecordSchema>;
