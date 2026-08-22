import { z } from "zod";

// Mirrors packages/database/src/persona-library/entities.ts's PersonaApprovalStatus — see
// packages/database/src/service-library/service.repository.ts's own ServiceApprovalStatus
// equivalent, reused verbatim per D3.
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

export const personaApprovalStatusSchema = z.enum(APPROVAL_STATUS_VALUES);

// These fields are plain text, not HTML — unlike Service Library's 7 Positioning fields and
// Projects' description, this module was explicitly out of scope for the dashboard-web rich-text
// editor rollout, so no sanitization is applied and no markup-overhead length raise is needed.
const LONG_TEXT_MAX_LENGTH = 20_000;
const longTextField = z.string().max(LONG_TEXT_MAX_LENGTH).nullish();

const shortTextField = z.string().max(255).nullish();

// Plain descriptive string lists (buyer-side job titles, target industries) — not identifier
// lists, unlike relatedServiceIds below.
const stringListField = z.array(z.string().min(1).max(255)).max(100).optional();

// Unvalidated identifier list (D2) — plain strings, capped in count so a single request can't
// smuggle an unbounded array; no format/existence check, since Service Library's own
// icpIds/relatedPageIds/relatedCaseStudyIds fields follow the identical, deliberate precedent —
// no relationship is retrofitted here even though `services` already exists.
const idListField = z.array(z.string().min(1).max(128)).max(200).optional();

export const listPersonasQuerySchema = z.object({
  approvalStatus: personaApprovalStatusSchema.optional(),
  search: z.string().max(255).optional(),
  limit: z.coerce.number().int().min(1).max(200).optional(),
  offset: z.coerce.number().int().min(0).optional(),
});
export type ListPersonasQueryDto = z.infer<typeof listPersonasQuerySchema>;

export const createPersonaSchema = z.object({
  publicId: z.string().min(1).max(64),
  name: z.string().min(1).max(255),
  buyerType: shortTextField,
  companySize: shortTextField,
  roles: stringListField,
  industries: stringListField,
  geography: shortTextField,
  goals: longTextField,
  pains: longTextField,
  triggers: longTextField,
  objections: longTextField,
  decisionCriteria: longTextField,
  relatedServiceIds: idListField,
  badFitSignals: longTextField,
  messagingTrack: longTextField,
  ctaPreferences: longTextField,
});
export type CreatePersonaDto = z.infer<typeof createPersonaSchema>;

// publicId is create-only, per the base-entity standard's own "never regenerated once assigned"
// rule — mirrors updateServiceSchema's own contract. approvalStatus and version are deliberately
// not accepted here (D4/D5) — approvalStatus only changes via the dedicated status-transition
// route, and version is server-managed, incremented automatically on every successful update.
export const updatePersonaSchema = z.object({
  name: z.string().min(1).max(255).optional(),
  buyerType: shortTextField,
  companySize: shortTextField,
  roles: stringListField,
  industries: stringListField,
  geography: shortTextField,
  goals: longTextField,
  pains: longTextField,
  triggers: longTextField,
  objections: longTextField,
  decisionCriteria: longTextField,
  relatedServiceIds: idListField,
  badFitSignals: longTextField,
  messagingTrack: longTextField,
  ctaPreferences: longTextField,
});
export type UpdatePersonaDto = z.infer<typeof updatePersonaSchema>;

export const changePersonaApprovalStatusSchema = z.object({
  approvalStatus: personaApprovalStatusSchema,
});
export type ChangePersonaApprovalStatusDto = z.infer<typeof changePersonaApprovalStatusSchema>;
