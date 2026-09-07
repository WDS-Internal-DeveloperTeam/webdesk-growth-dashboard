import { z } from "zod";

// --- shared enums (mirror packages/database/src/integrations/entities.ts) ---

const PROVIDER_VALUES = [
  "github",
  "wordpress",
  "vercel_blob",
  "postgresql",
  "smtp",
  "sentry",
  "uptime_monitor",
  "vulnerability_scanner",
  "upstash",
  "other",
] as const;
export const integrationProviderSchema = z.enum(PROVIDER_VALUES);

const STATUS_VALUES = ["connected", "disconnected", "error", "not_configured"] as const;
export const integrationStatusSchema = z.enum(STATUS_VALUES);

export const integrationVerificationResultSchema = z.enum(["success", "failure", "unknown"]);

const webhookProcessingStatusSchema = z.enum(["received", "processed", "failed"]);

// `z.coerce.boolean()` runs `Boolean(value)` — since query params always arrive as strings,
// `?isActive=false` would coerce to `Boolean("false")`, which is `true` (any non-empty string is
// truthy), silently inverting the filter. An explicit "true"/"false" literal map has no such trap
// — mirrors `listBrandLibraryRecordsQuerySchema`'s own already-fixed `booleanQueryParam`.
const booleanQueryParam = z.enum(["true", "false"]).transform((value) => value === "true");

// `.nullish()` so an explicit `null` can clear a field on update, same convention every sibling
// module's own plain-text fields use. Plain ops notes — no rich-text/sanitization treatment (D-
// schema, matching Scan Center's/Technical Center's own precedent for internal ops metadata).
const notesField = z.string().max(10_000).nullish();
const configReferenceField = z.string().max(2000).nullish();

// --- integrations ---

// Capped at 200, NOT 100 — dashboard-web list pages always request `pageSize + 1`, and the
// largest real page-size option is 100 (101 total). A 100 cap here already caused a real
// production incident once (`docs/implementation/module-decision-and-activity-log.md`'s
// "Incident" section) — every sibling list-query schema in this codebase caps at 200 specifically
// to leave that headroom.
const limitField = z.coerce.number().int().min(1).max(200).optional();
const offsetField = z.coerce.number().int().min(0).optional();

/** Rejects a genuinely empty patch object (`{}`) with a clean 400 instead of silently succeeding
 *  as a no-op — shared by every update schema below so the message text can't drift between them,
 *  mirroring `portfolio-library.dto.ts`'s own identically-named, identically-purposed helper. */
function rejectEmptyPatch<T extends z.ZodTypeAny>(schema: T) {
  return schema.refine((data: object) => Object.keys(data as Record<string, unknown>).length > 0, {
    message: "At least one field must be provided",
  });
}

const paginationOnlyQuerySchema = z.object({
  limit: limitField,
  offset: offsetField,
});

export const listIntegrationsQuerySchema = z.object({
  provider: integrationProviderSchema.optional(),
  status: integrationStatusSchema.optional(),
  isActive: booleanQueryParam.optional(),
  search: z.string().max(255).optional(),
  limit: limitField,
  offset: offsetField,
});
export type ListIntegrationsQueryDto = z.infer<typeof listIntegrationsQuerySchema>;

export const createIntegrationSchema = z.object({
  publicId: z.string().min(1).max(64),
  provider: integrationProviderSchema,
  displayName: z.string().min(1).max(255),
  configReference: configReferenceField,
  notes: notesField,
});
export type CreateIntegrationDto = z.infer<typeof createIntegrationSchema>;

// `publicId`/`provider` are never accepted here — both immutable after create (D-schema),
// mirroring every sibling module's own `publicId`/discriminator-field create-only contract.
// `status`/`lastVerified*`/`isActive` are governed exclusively via the dedicated
// verify/toggle-active routes, never through this generic update route.
export const updateIntegrationSchema = rejectEmptyPatch(
  createIntegrationSchema.omit({ publicId: true, provider: true }).partial(),
);
export type UpdateIntegrationDto = z.infer<typeof updateIntegrationSchema>;

export const verifyIntegrationSchema = z.object({
  result: integrationVerificationResultSchema,
  notes: notesField,
});
export type VerifyIntegrationDto = z.infer<typeof verifyIntegrationSchema>;

export const toggleIntegrationActiveSchema = z.object({
  isActive: z.boolean(),
});
export type ToggleIntegrationActiveDto = z.infer<typeof toggleIntegrationActiveSchema>;

// --- integration_environments ---

// `integrationId` is deliberately NOT a field here — every route carries it exclusively via the
// `:integrationId` route path segment, mirroring Page Inventory's/Scan Center's own precedent for
// a project-scoped (here, integration-scoped) sub-resource.
export const createIntegrationEnvironmentSchema = z.object({
  environmentName: z.string().min(1).max(255),
  status: integrationStatusSchema.optional(),
  configReference: configReferenceField,
  notes: notesField,
});
export type CreateIntegrationEnvironmentDto = z.infer<typeof createIntegrationEnvironmentSchema>;

export const updateIntegrationEnvironmentSchema = rejectEmptyPatch(
  createIntegrationEnvironmentSchema.partial(),
);
export type UpdateIntegrationEnvironmentDto = z.infer<typeof updateIntegrationEnvironmentSchema>;

export const listIntegrationEnvironmentsQuerySchema = paginationOnlyQuerySchema;
export type ListIntegrationEnvironmentsQueryDto = z.infer<
  typeof listIntegrationEnvironmentsQuerySchema
>;

// --- webhook_events ---

// `integrationId` IS a field here (unlike the sub-resources above) — this is a bare
// `POST /webhook-events` route too (D-schema: "an event may arrive before it can be matched to a
// known integration"), so the target integration, if any, must be supplied in the body.
export const createWebhookEventSchema = z.object({
  integrationId: z.string().uuid().nullish(),
  eventType: z.string().min(1).max(255),
  receivedAt: z.string().datetime().optional(),
  // Deliberately NOT the raw payload — a short, human-written or truncated summary, to avoid
  // storing secrets/PII that might be embedded in a real webhook body (D-schema).
  payloadSummary: z.string().max(5000).nullish(),
  processingStatus: webhookProcessingStatusSchema.optional(),
  errorMessage: z.string().max(5000).nullish(),
});
export type CreateWebhookEventDto = z.infer<typeof createWebhookEventSchema>;

export const listWebhookEventsQuerySchema = z.object({
  processingStatus: webhookProcessingStatusSchema.optional(),
  limit: limitField,
  offset: offsetField,
});
export type ListWebhookEventsQueryDto = z.infer<typeof listWebhookEventsQuerySchema>;

// --- secret_metadata ---

export const createSecretMetadataSchema = z.object({
  secretName: z.string().min(1).max(255),
  storageLocation: z.string().min(1).max(2000),
  lastRotatedAt: z.string().datetime().nullish(),
  rotationDueAt: z.string().datetime().nullish(),
  notes: notesField,
});
export type CreateSecretMetadataDto = z.infer<typeof createSecretMetadataSchema>;

export const updateSecretMetadataSchema = rejectEmptyPatch(createSecretMetadataSchema.partial());
export type UpdateSecretMetadataDto = z.infer<typeof updateSecretMetadataSchema>;

export const listSecretMetadataQuerySchema = paginationOnlyQuerySchema;
export type ListSecretMetadataQueryDto = z.infer<typeof listSecretMetadataQuerySchema>;
