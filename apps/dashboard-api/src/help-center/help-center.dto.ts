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
// discriminator-field convention.
export const updateHelpArticleSchema = z.object({
  title: z.string().min(1).max(255).optional(),
  content: z.string().min(1).max(CONTENT_MAX_LENGTH).optional(),
  isPublished: z.boolean().optional(),
});
export type UpdateHelpArticleDto = z.infer<typeof updateHelpArticleSchema>;
