import { z } from "zod";

// Same 20-default/200-max bound style as every other list endpoint in this codebase (jobs,
// notifications, operational contacts, projects) — never an unbounded query.
export const searchUsersQuerySchema = z.object({
  search: z.string().min(1).max(255).optional(),
  limit: z.coerce.number().int().min(1).max(200).optional(),
  offset: z.coerce.number().int().min(0).optional(),
});
export type SearchUsersQueryDto = z.infer<typeof searchUsersQuerySchema>;
