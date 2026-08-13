import { z } from "zod";

export const createHoldSchema = z
  .object({
    scope: z.enum(["entity", "category"]),
    resourceType: z.string().min(1).max(64).nullish(),
    resourceId: z.string().min(1).max(128).nullish(),
    categoryKey: z.string().min(1).max(64).nullish(),
    reasonCategory: z.string().min(1).max(64),
    reason: z.string().min(1),
    approvedByUserId: z.string().uuid().nullish(),
    endDate: z.coerce.date().nullish(),
  })
  .refine((value) => value.scope !== "entity" || (value.resourceType && value.resourceId), {
    message: "An entity-scoped hold requires both resourceType and resourceId",
  })
  .refine((value) => value.scope !== "category" || value.categoryKey, {
    message: "A category-scoped hold requires categoryKey",
  })
  .refine((value) => value.scope !== "entity" || !value.categoryKey, {
    message: "An entity-scoped hold must not also carry a categoryKey",
  })
  .refine((value) => value.scope !== "category" || (!value.resourceType && !value.resourceId), {
    message: "A category-scoped hold must not also carry resourceType/resourceId",
  });
export type CreateHoldDto = z.infer<typeof createHoldSchema>;

export const releaseHoldSchema = z.object({
  releaseReason: z.string().min(1),
});
export type ReleaseHoldDto = z.infer<typeof releaseHoldSchema>;

export const checkEligibilitySchema = z.object({
  categoryKey: z.string().min(1).max(64),
  resourceType: z.string().min(1).max(64),
  resourceId: z.string().min(1).max(128),
  anchorDate: z.coerce.date(),
  hasActiveDependency: z.boolean().optional(),
});
export type CheckEligibilityDto = z.infer<typeof checkEligibilitySchema>;

export const listHoldsQuerySchema = z.object({
  status: z.enum(["active", "released"]).optional(),
});
export type ListHoldsQueryDto = z.infer<typeof listHoldsQuerySchema>;
