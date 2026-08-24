import { z } from "zod";

// Mirrors packages/database/src/review-and-approval-center/entities.ts's ReviewStatus (task
// package D2).
const REVIEW_STATUS_VALUES = ["submitted", "revision_requested", "approved", "rejected"] as const;
export const reviewStatusSchema = z.enum(REVIEW_STATUS_VALUES);

// The 4 approval-shaped actions `ReviewsService.decide()` handles — deliberately excludes
// `pause`/`resume`/`delegate` (task package §4), each of which has its own dedicated route/DTO
// below.
const DECIDE_REVIEW_ACTION_VALUES = [
  "approve",
  "approve_with_notes",
  "request_revision",
  "reject",
] as const;
export const decideReviewActionSchema = z.enum(DECIDE_REVIEW_ACTION_VALUES);

// Plain text, capped at 2000 chars (task package §3) — no RichTextEditor, no dashboard-web UI
// exists yet for this module.
const NOTES_MAX_LENGTH = 2000;
const COMMENT_BODY_MAX_LENGTH = 2000;
const TARGET_LABEL_MAX_LENGTH = 500;
const VERSION_LABEL_MAX_LENGTH = 255;

// `z.coerce.boolean()` runs `Boolean(value)` — since query params always arrive as strings,
// `?assignedToMe=false` would coerce to `Boolean("false")`, which is `true` (any non-empty string
// is truthy), silently inverting the filter. An explicit "true"/"false" literal map has no such
// trap — mirrors `content-template-library.dto.ts`'s own already-established `booleanQueryParam`
// fix for the identical bug class.
const booleanQueryParam = z.enum(["true", "false"]).transform((value) => value === "true");

export const createReviewSchema = z.object({
  // Validated against the real module registry at the service layer (task package D6,
  // AuthorizationService.isValidModuleKey()) — a shape-only check here (non-empty, bounded) is all
  // Zod can express without an async DB lookup.
  targetModuleKey: z.string().min(1).max(64),
  // No existence check (task package D6) — no generic cross-module lookup capability exists to
  // validate it against.
  targetId: z.string().uuid(),
  targetLabel: z.string().max(TARGET_LABEL_MAX_LENGTH).nullish(),
  assignedToUserId: z.string().uuid().nullish(),
  versionALabel: z.string().max(VERSION_LABEL_MAX_LENGTH).nullish(),
  versionBLabel: z.string().max(VERSION_LABEL_MAX_LENGTH).nullish(),
});
export type CreateReviewDto = z.infer<typeof createReviewSchema>;

export const decideReviewSchema = z.object({
  action: decideReviewActionSchema,
  notes: z.string().max(NOTES_MAX_LENGTH).nullish(),
  // The review's current status the caller last saw — required for the atomic compare-and-swap
  // (task package §3/§4). A mismatch against the row's real current status (a stale read, or a
  // concurrent decision) surfaces as a clean 409, not a silently-accepted transition.
  expectedStatus: reviewStatusSchema,
});
export type DecideReviewDto = z.infer<typeof decideReviewSchema>;

export const setReviewPausedSchema = z.object({
  isPaused: z.boolean(),
  expectedIsPaused: z.boolean(),
});
export type SetReviewPausedDto = z.infer<typeof setReviewPausedSchema>;

export const delegateReviewSchema = z.object({
  assignedToUserId: z.string().uuid(),
});
export type DelegateReviewDto = z.infer<typeof delegateReviewSchema>;

export const createReviewCommentSchema = z.object({
  body: z.string().min(1).max(COMMENT_BODY_MAX_LENGTH),
});
export type CreateReviewCommentDto = z.infer<typeof createReviewCommentSchema>;

export const listReviewsQuerySchema = z.object({
  status: reviewStatusSchema.optional(),
  targetModuleKey: z.string().max(64).optional(),
  // Resolved by the service layer to `assignedToUserId: <the caller's own id>` — the RBAC matrix's
  // own top-of-file doc comment names this exact "(assigned)" object-level-scoping requirement as
  // this module's own responsibility to enforce (task package §1).
  assignedToMe: booleanQueryParam.optional(),
  search: z.string().max(500).optional(),
  limit: z.coerce.number().int().min(1).max(200).optional(),
  offset: z.coerce.number().int().min(0).optional(),
});
export type ListReviewsQueryDto = z.infer<typeof listReviewsQuerySchema>;
