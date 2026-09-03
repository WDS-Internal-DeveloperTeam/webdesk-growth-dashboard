import { z } from "zod";

/** Same 20-default/100-max bound style as this module's `UserRepository.listAll()` — see that
 *  method's own doc comment for why this is an admin directory listing (every status, not just
 *  `active`) rather than `UsersModule`'s picker-only `search()`. */
export const listUsersQuerySchema = z.object({
  search: z.string().min(1).max(255).optional(),
  status: z.enum(["active", "disabled"]).optional(),
  limit: z.coerce.number().int().min(1).max(100).optional(),
  offset: z.coerce.number().int().min(0).optional(),
});
export type ListUsersQueryDto = z.infer<typeof listUsersQuerySchema>;

export const updateUserStatusSchema = z.object({
  status: z.enum(["active", "disabled"]),
});
export type UpdateUserStatusDto = z.infer<typeof updateUserStatusSchema>;
