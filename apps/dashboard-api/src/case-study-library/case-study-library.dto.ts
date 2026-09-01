import { z } from "zod";

// Existence-validated at the service layer (CaseStudyLibraryService.assertPageIdsExist()),
// mirroring Case Study Studio's/Persona Library's own idListField.
const idListField = z.array(z.string().min(1).max(128)).max(200).nullish();

// Plain, unvalidated (D3) — no dedicated "technologies" module exists.
const stringListField = z.array(z.string().min(1).max(100)).max(100).nullish();

const MAX_TESTIMONIALS = 20;
const QUOTE_MAX_LENGTH = 2000;
const NAME_MAX_LENGTH = 255;

// Plain, structured text — NOT rich-text/HTML (D4). No sanitization is wired for this field,
// unlike every rich-text-converted field elsewhere in this codebase.
const testimonialSchema = z.object({
  quote: z.string().min(1).max(QUOTE_MAX_LENGTH),
  author: z.string().max(NAME_MAX_LENGTH).nullish(),
  role: z.string().max(NAME_MAX_LENGTH).nullish(),
});
const testimonialListField = z.array(testimonialSchema).max(MAX_TESTIMONIALS).nullish();

export const listCaseStudyLibraryRecordsQuerySchema = z.object({
  search: z.string().max(255).optional(),
  limit: z.coerce.number().int().min(1).max(200).optional(),
  offset: z.coerce.number().int().min(0).optional(),
});
export type ListCaseStudyLibraryRecordsQueryDto = z.infer<
  typeof listCaseStudyLibraryRecordsQuerySchema
>;

export const createCaseStudyLibraryRecordSchema = z.object({
  publicId: z.string().min(1).max(64),
  caseStudyId: z.string().uuid(),
  relatedPageIds: idListField,
  technologies: stringListField,
  testimonials: testimonialListField,
});
export type CreateCaseStudyLibraryRecordDto = z.infer<typeof createCaseStudyLibraryRecordSchema>;

// Derived via .omit().partial() from createCaseStudyLibraryRecordSchema, mirroring every sibling
// module's own established derivation pattern. `publicId`/`caseStudyId` are both create-only — a
// library record's identity IS the case study it extends (D1); re-pointing it at a different case
// study would be a delete+create, not an edit.
export const updateCaseStudyLibraryRecordSchema = createCaseStudyLibraryRecordSchema
  .omit({ publicId: true, caseStudyId: true })
  .partial()
  // Rejects a genuinely empty patch ({}) with a clean 400 instead of silently succeeding as a
  // no-op, mirroring Persona Library's/Case Study Studio's own updateXSchema fix.
  .refine((data) => Object.keys(data).length > 0, {
    message: "At least one field must be provided",
  });
export type UpdateCaseStudyLibraryRecordDto = z.infer<typeof updateCaseStudyLibraryRecordSchema>;
