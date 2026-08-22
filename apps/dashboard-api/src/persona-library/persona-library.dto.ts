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

// These 8 fields are now real HTML from the dashboard-web RichTextEditor — a 2026-08-22 standing
// rule requiring every dashboard-web long-text field to use the rich-text editor going forward.
// personas.service.ts sanitizes a field's *submitted* value on every create/update it's actually
// present in; an update() patch that resends an untouched field's current stored value unchanged
// skips re-sanitizing it (an efficiency optimization, not a gap — that value already went through
// this same sanitizer on write, or, for a persona created before this rollout, is real plain text
// with nothing to strip). Every read still goes through the render-time SanitizedRichText
// component regardless (code-review finding, persona-library-rich-text-editor: an earlier doc
// comment here overclaimed "always sanitized before storage," true only for a field a caller
// actually changes). Raised from 20_000, same markup-overhead reasoning as Service Library's/
// Business Knowledge Center's own raise: real HTML carries more bytes than the equivalent plain
// text for the same visible content.
const LONG_TEXT_MAX_LENGTH = 40_000;
const longTextField = z.string().max(LONG_TEXT_MAX_LENGTH).nullish();

const shortTextField = z.string().max(255).nullish();

// Plain descriptive string lists (buyer-side job titles, target industries) — not identifier
// lists, unlike relatedServiceIds below. `.nullish()`, not just `.optional()`, so an explicit
// `null` can clear the field on update — matching the scalar text fields' own null-to-clear
// convention (code-review finding: array fields previously accepted only `[]` to clear, an
// asymmetry a caller following the scalar fields' convention could easily trip over).
const stringListField = z.array(z.string().min(1).max(255)).max(100).nullish();

// Existence-validated against the real `services` table (relatedServiceIds only — see
// PersonasService.assertServiceIdsExist(), code-review finding: this field previously had zero
// validation despite `services` already existing, unlike Service Library's own icpIds/
// relatedPageIds/relatedCaseStudyIds, which are genuinely unvalidated because their target
// modules don't exist yet). `.nullish()` for the same null-to-clear reason as stringListField.
const idListField = z.array(z.string().min(1).max(128)).max(200).nullish();

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
export const updatePersonaSchema = z
  .object({
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
  })
  // Rejects a genuinely empty patch (`{}`) with a clean 400 instead of silently succeeding as a
  // no-op that still burns a `version` increment and writes an essentially-empty audit event
  // (code-review finding).
  .refine((data) => Object.keys(data).length > 0, {
    message: "At least one field must be provided",
  });
export type UpdatePersonaDto = z.infer<typeof updatePersonaSchema>;

export const changePersonaApprovalStatusSchema = z.object({
  approvalStatus: personaApprovalStatusSchema,
});
export type ChangePersonaApprovalStatusDto = z.infer<typeof changePersonaApprovalStatusSchema>;
