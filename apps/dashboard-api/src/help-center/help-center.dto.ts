import { z } from "zod";

const CATEGORIES = [
  "onboarding",
  "project_setup",
  "wordpress_publishing",
  "review_approval",
  "staging_to_production",
  "import_export",
  "search_filtering",
  "design_libraries",
  "page_workspace",
  "security_qa",
  "backup_rollback",
  "faq",
  "videos",
  "known_issues",
  "feedback",
  "version_history",
] as const;

export const helpArticleCategorySchema = z.enum(CATEGORIES);

// `?isPublished=false` naively coerced via `z.coerce.boolean()` would resolve to `true` (any
// non-empty string is truthy) — an explicit "true"/"false" literal map has no such trap. Same
// pattern as operational-contacts.dto.ts's/knowledge-library.dto.ts's own `booleanQueryParam`.
const booleanQueryParam = z.enum(["true", "false"]).transform((value) => value === "true");

export const listHelpArticlesQuerySchema = z.object({
  category: helpArticleCategorySchema.optional(),
  isPublished: booleanQueryParam.optional(),
  // Fuzzy substring match on `title` — backed by `help_articles_title_trgm_idx`.
  search: z.string().min(1).max(255).optional(),
  // Mirrors BusinessKnowledgeCenter's/KnowledgeLibrary's own DEFAULT_LIST_LIMIT/MAX_LIST_LIMIT
  // bound (50/200).
  limit: z.coerce.number().int().min(1).max(200).optional(),
  offset: z.coerce.number().int().min(0).optional(),
});
export type ListHelpArticlesQueryDto = z.infer<typeof listHelpArticlesQuerySchema>;

// Raised to a 2x markup-overhead ratio over a reasonable plain-text ceiling, matching every prior
// rich-text field's own cap convention in this codebase.
const CONTENT_MAX_LENGTH = 40_000;

export const createHelpArticleSchema = z.object({
  category: helpArticleCategorySchema,
  title: z.string().min(1).max(255),
  content: z.string().min(1).max(CONTENT_MAX_LENGTH),
  isPublished: z.boolean().optional(),
});
export type CreateHelpArticleDto = z.infer<typeof createHelpArticleSchema>;

// `category` is deliberately never accepted here — create-only, matching every sibling module's
// discriminator-field convention. Derived via `.omit().partial()` from `createHelpArticleSchema`
// rather than hand-duplicated (code-review finding: a hand-duplicated copy risks a length-cap
// silently drifting out of sync between the two schemas, mirroring Content Template Library's own
// already-fixed `updateContentTemplateSchema` precedent). A `.refine()` rejects a genuinely empty
// patch with a clean 400 rather than letting a no-op save still issue a real DB write and audit
// event (code-review finding, mirroring Content Template Library's/Persona Library's own empty-
// patch guard).
export const updateHelpArticleSchema = createHelpArticleSchema
  .omit({ category: true })
  .partial()
  .refine((data) => Object.keys(data).length > 0, {
    message: "At least one field must be provided to update a help article",
  });
export type UpdateHelpArticleDto = z.infer<typeof updateHelpArticleSchema>;
