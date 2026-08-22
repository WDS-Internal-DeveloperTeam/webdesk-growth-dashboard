import { z } from "zod";

// Mirrors packages/database/src/service-library/entities.ts's ServiceConfidentiality/
// ServicePublicationStatus/ServiceApprovalStatus — see
// docs/task-packages/module-service-library.md D5/D6.
const CONFIDENTIALITY_VALUES = ["public", "internal", "restricted"] as const;
const PUBLICATION_STATUS_VALUES = ["draft", "published", "unpublished"] as const;
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

export const serviceConfidentialitySchema = z.enum(CONFIDENTIALITY_VALUES);
export const servicePublicationStatusSchema = z.enum(PUBLICATION_STATUS_VALUES);
export const serviceApprovalStatusSchema = z.enum(APPROVAL_STATUS_VALUES);

// Long free-text fields (task package D6 — the source workbook's own sample cells run to
// hundreds of characters); bounded so a single field can't grow unbounded, not because a real
// length limit is specified anywhere. Raised from 20_000 — these 7 fields are now HTML from the
// dashboard-web rich-text editor (sanitized in services.service.ts before being stored), carrying
// real markup overhead over the equivalent plain text, same reasoning as the Business Knowledge
// Center module's own CONTENT_MAX_LENGTH raise.
const LONG_TEXT_MAX_LENGTH = 40_000;
const longTextField = z.string().max(LONG_TEXT_MAX_LENGTH).nullish();

// Unvalidated identifier lists (task package D1) — plain strings, capped in count so a single
// request can't smuggle an unbounded array; no format/existence check, since the modules that
// would own real validation (persona_library/page_inventory/case_study_library) don't exist yet.
const idListField = z.array(z.string().min(1).max(128)).max(200).optional();

export const listServicesQuerySchema = z.object({
  categoryId: z.string().uuid().optional(),
  approvalStatus: serviceApprovalStatusSchema.optional(),
  publicationStatus: servicePublicationStatusSchema.optional(),
  search: z.string().max(255).optional(),
  limit: z.coerce.number().int().min(1).max(200).optional(),
  offset: z.coerce.number().int().min(0).optional(),
});
export type ListServicesQueryDto = z.infer<typeof listServicesQuerySchema>;

export const createServiceSchema = z.object({
  publicId: z.string().min(1).max(64),
  canonicalName: z.string().min(1).max(255),
  publicName: z.string().max(255).nullish(),
  categoryId: z.string().uuid(),
  parentServiceId: z.string().uuid().nullish(),
  shortPublicDescription: longTextField,
  audience: longTextField,
  problems: longTextField,
  capabilities: longTextField,
  outcomes: longTextField,
  exclusions: longTextField,
  internalDescription: longTextField,
  icpIds: idListField,
  relatedPageIds: idListField,
  relatedCaseStudyIds: idListField,
  confidentiality: serviceConfidentialitySchema.optional(),
  ownerUserId: z.string().uuid().nullish(),
  deliverableIds: z.array(z.string().uuid()).max(200).optional(),
  platformIds: z.array(z.string().uuid()).max(200).optional(),
  engagementModelIds: z.array(z.string().uuid()).max(200).optional(),
});
export type CreateServiceDto = z.infer<typeof createServiceSchema>;

// publicId is create-only, per the base-entity standard's own "never regenerated once assigned"
// rule (task package D7) — mirrors updateProjectSchema's own contract. approvalStatus is
// deliberately not accepted here (task package D5) — only the dedicated status-transition route
// may change it.
export const updateServiceSchema = z.object({
  canonicalName: z.string().min(1).max(255).optional(),
  publicName: z.string().max(255).nullish(),
  categoryId: z.string().uuid().optional(),
  parentServiceId: z.string().uuid().nullish(),
  shortPublicDescription: longTextField,
  audience: longTextField,
  problems: longTextField,
  capabilities: longTextField,
  outcomes: longTextField,
  exclusions: longTextField,
  internalDescription: longTextField,
  icpIds: idListField,
  relatedPageIds: idListField,
  relatedCaseStudyIds: idListField,
  confidentiality: serviceConfidentialitySchema.optional(),
  publicationStatus: servicePublicationStatusSchema.optional(),
  ownerUserId: z.string().uuid().nullish(),
  deliverableIds: z.array(z.string().uuid()).max(200).optional(),
  platformIds: z.array(z.string().uuid()).max(200).optional(),
  engagementModelIds: z.array(z.string().uuid()).max(200).optional(),
});
export type UpdateServiceDto = z.infer<typeof updateServiceSchema>;

export const changeServiceApprovalStatusSchema = z.object({
  approvalStatus: serviceApprovalStatusSchema,
});
export type ChangeServiceApprovalStatusDto = z.infer<typeof changeServiceApprovalStatusSchema>;
