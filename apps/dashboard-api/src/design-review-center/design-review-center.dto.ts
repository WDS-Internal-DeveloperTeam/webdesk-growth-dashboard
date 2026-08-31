import { z } from "zod";

// Mirrors packages/database/src/design-review-center/entities.ts's DesignReviewStatus (D3).
const DESIGN_REVIEW_STATUS_VALUES = [
  "submitted",
  "revision_requested",
  "approved",
  "rejected",
  "superseded",
] as const;
export const designReviewStatusSchema = z.enum(DESIGN_REVIEW_STATUS_VALUES);

// Mirrors packages/database/src/design-review-center/entities.ts's DesignReviewType (D2) — taken
// verbatim from 03_Detailed_Module_Specifications.md §19.
const DESIGN_REVIEW_TYPE_VALUES = [
  "creative_direction",
  "ux",
  "conversion",
  "ui",
  "accessibility_by_design",
  "responsive_behavior",
  "component_consistency",
  "motion",
  "performance_impact",
] as const;
export const designReviewTypeSchema = z.enum(DESIGN_REVIEW_TYPE_VALUES);

// The 4 approval-shaped actions DesignReviewsService.decide() handles — deliberately excludes
// "supersede" (D4/D5), which is never a directly-requested action; it is written only by the
// automatic supersede side effect triggered by a DIFFERENT review's own "-> approved" transition.
const DECIDE_DESIGN_REVIEW_ACTION_VALUES = [
  "approve",
  "approve_with_notes",
  "request_revision",
  "reject",
] as const;
export const decideDesignReviewActionSchema = z.enum(DECIDE_DESIGN_REVIEW_ACTION_VALUES);

// "notes" mirrors review-and-approval-center.dto.ts's own already-established rich-text
// conversion (2026-08-24/25, per the 2026-08-22 standing rule) — sanitized server-side before
// storage (design-reviews.service.ts#decide()) and again at render time via the shared
// SanitizedRichText component whenever a dashboard-web UI for this module exists.
// "targetLabel"/"versionALabel"/"versionBLabel" (short identifiers, not authored narrative
// content) deliberately stay plain text, mirroring review-and-approval-center.dto.ts's own
// identical reasoning.
const NOTES_MAX_LENGTH = 4000;
const TARGET_LABEL_MAX_LENGTH = 500;
const VERSION_LABEL_MAX_LENGTH = 255;

// z.coerce.boolean() runs Boolean(value) — since query params always arrive as strings,
// "?assignedToMe=false" would coerce to Boolean("false"), which is true (any non-empty string is
// truthy), silently inverting the filter. An explicit "true"/"false" literal map has no such
// trap — mirrors review-and-approval-center.dto.ts's own already-established fix for the
// identical bug class.
const booleanQueryParam = z.enum(["true", "false"]).transform((value) => value === "true");

export const createDesignReviewSchema = z.object({
  // Validated against the real module registry at the service layer
  // (AuthorizationService.isValidModuleKey(), D9) — a shape-only check here (non-empty, bounded)
  // is all Zod can express without an async DB lookup.
  targetModuleKey: z.string().min(1).max(64),
  // No existence check (D9) — no generic cross-module lookup capability exists to validate it
  // against.
  targetId: z.string().uuid(),
  targetLabel: z.string().max(TARGET_LABEL_MAX_LENGTH).nullish(),
  reviewType: designReviewTypeSchema,
  assignedToUserId: z.string().uuid().nullish(),
  versionALabel: z.string().max(VERSION_LABEL_MAX_LENGTH).nullish(),
  versionBLabel: z.string().max(VERSION_LABEL_MAX_LENGTH).nullish(),
});
export type CreateDesignReviewDto = z.infer<typeof createDesignReviewSchema>;

export const decideDesignReviewSchema = z.object({
  action: decideDesignReviewActionSchema,
  notes: z.string().max(NOTES_MAX_LENGTH).nullish(),
  // The review's current status the caller last saw — required for the atomic compare-and-swap.
  // A mismatch against the row's real current status (a stale read, or a concurrent decision)
  // surfaces as a clean 409, not a silently-accepted transition. "superseded" is a valid value
  // here (the caller's own honest last-observed read could be stale in exactly that way), even
  // though DesignReviewRepository.updateStatus() itself always rejects a terminal expectedStatus
  // up front — the repository, not this schema, is the actual enforcement point.
  expectedStatus: designReviewStatusSchema,
});
export type DecideDesignReviewDto = z.infer<typeof decideDesignReviewSchema>;

export const listDesignReviewsQuerySchema = z.object({
  status: designReviewStatusSchema.optional(),
  targetModuleKey: z.string().max(64).optional(),
  reviewType: designReviewTypeSchema.optional(),
  // Resolved by the service layer to "assignedToUserId: <the caller's own id>" — mirrors
  // review-and-approval-center.dto.ts's own listReviewsQuerySchema.
  assignedToMe: booleanQueryParam.optional(),
  search: z.string().max(500).optional(),
  limit: z.coerce.number().int().min(1).max(200).optional(),
  offset: z.coerce.number().int().min(0).optional(),
});
export type ListDesignReviewsQueryDto = z.infer<typeof listDesignReviewsQuerySchema>;
