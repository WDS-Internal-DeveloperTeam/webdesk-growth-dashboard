import { z } from "zod";

const confidentialityEnum = z.enum(["public", "internal", "confidential", "restricted"]);

export const createProjectSchema = z.object({
  publicId: z.string().min(1).max(64),
  name: z.string().min(1).max(255),
  description: z.string().max(10_000).nullish(),
  ownerUserId: z.string().uuid().nullish(),
  confidentiality: confidentialityEnum.optional(),
});
export type CreateProjectDto = z.infer<typeof createProjectSchema>;

export const updateProjectSchema = z.object({
  name: z.string().min(1).max(255).optional(),
  description: z.string().max(10_000).nullish(),
  ownerUserId: z.string().uuid().nullish(),
  confidentiality: confidentialityEnum.optional(),
});
export type UpdateProjectDto = z.infer<typeof updateProjectSchema>;

/** D2's controlled transition set — never a raw status field write. */
export const changeProjectStatusSchema = z.object({
  status: z.enum(["active", "paused", "archived"]),
});
export type ChangeProjectStatusDto = z.infer<typeof changeProjectStatusSchema>;

export const setActivePhaseSchema = z.object({
  roadmapItemId: z.string().uuid().nullable(),
});
export type SetActivePhaseDto = z.infer<typeof setActivePhaseSchema>;

// Same "true"/"false" literal map as operational-contacts.dto.ts — `z.coerce.boolean()` on a
// query-string value is always truthy for any non-empty string, silently inverting a `false` filter.
const listProjectsSortBy = z.enum(["name", "status", "createdAt", "updatedAt"]);

export const listProjectsQuerySchema = z.object({
  status: z.enum(["active", "paused", "archived"]).optional(),
  search: z.string().min(1).max(255).optional(),
  sortBy: listProjectsSortBy.optional(),
  sortOrder: z.enum(["ASC", "DESC"]).optional(),
  // Same 50-default/200-max bound as every other list endpoint in this codebase (jobs,
  // notifications, operational contacts) — never an unbounded query.
  limit: z.coerce.number().int().min(1).max(200).optional(),
  offset: z.coerce.number().int().min(0).optional(),
});
export type ListProjectsQueryDto = z.infer<typeof listProjectsQuerySchema>;

// `z.string().url()` alone accepts any scheme, including `javascript:` — a stored-XSS vector once
// this value is rendered as a clickable link (the exact issue dashboard-web's Project Detail page
// review found and fixed client-side via isSafeHttpUrl(), flagging this schema as the real place to
// close it). Restricting to http(s) here means every consumer gets a safe value by construction,
// not just the one page that happened to add its own guard.
const safeHttpUrl = z
  .string()
  .url()
  .max(500)
  .refine(
    (value) => {
      try {
        return ["http:", "https:"].includes(new URL(value).protocol);
      } catch {
        return false;
      }
    },
    { message: "must be an http:// or https:// URL" },
  );

export const createEnvironmentSchema = z.object({
  name: z.string().min(1).max(64),
  url: safeHttpUrl.nullish(),
  notes: z.string().max(10_000).nullish(),
});
export type CreateEnvironmentDto = z.infer<typeof createEnvironmentSchema>;

export const updateEnvironmentSchema = z.object({
  name: z.string().min(1).max(64).optional(),
  url: safeHttpUrl.nullish(),
  notes: z.string().max(10_000).nullish(),
});
export type UpdateEnvironmentDto = z.infer<typeof updateEnvironmentSchema>;

const repoOwnerOrName = z
  .string()
  .min(1)
  .max(255)
  .regex(/^[\w.-]+$/, "expected a plain GitHub owner/repo segment, no slashes or spaces");

export const createProjectRepositorySchema = z.object({
  repoOwner: repoOwnerOrName,
  repoName: repoOwnerOrName,
  defaultBranch: z.string().min(1).max(255).optional(),
  notes: z.string().max(10_000).nullish(),
});
export type CreateProjectRepositoryDto = z.infer<typeof createProjectRepositorySchema>;

export const updateProjectRepositorySchema = z.object({
  repoOwner: repoOwnerOrName.optional(),
  repoName: repoOwnerOrName.optional(),
  defaultBranch: z.string().min(1).max(255).optional(),
  notes: z.string().max(10_000).nullish(),
});
export type UpdateProjectRepositoryDto = z.infer<typeof updateProjectRepositorySchema>;

export const addProjectUserSchema = z.object({
  userId: z.string().uuid(),
});
export type AddProjectUserDto = z.infer<typeof addProjectUserSchema>;

export const createObjectiveSchema = z.object({
  description: z.string().min(1).max(10_000),
});
export type CreateObjectiveDto = z.infer<typeof createObjectiveSchema>;

export const updateObjectiveSchema = z.object({
  description: z.string().min(1).max(10_000).optional(),
  status: z.enum(["open", "complete"]).optional(),
});
export type UpdateObjectiveDto = z.infer<typeof updateObjectiveSchema>;

export const createRoadmapItemSchema = z.object({
  name: z.string().min(1).max(255),
  sequence: z.number().int().min(0).optional(),
});
export type CreateRoadmapItemDto = z.infer<typeof createRoadmapItemSchema>;

export const updateRoadmapItemSchema = z.object({
  name: z.string().min(1).max(255).optional(),
  sequence: z.number().int().min(0).optional(),
  status: z.enum(["not_started", "active", "complete", "skipped"]).optional(),
});
export type UpdateRoadmapItemDto = z.infer<typeof updateRoadmapItemSchema>;

export const assignApproverSchema = z.object({
  userId: z.string().uuid(),
});
export type AssignApproverDto = z.infer<typeof assignApproverSchema>;
