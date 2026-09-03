import { z } from "zod";

/** Same 20-default/200-max bound style as this module's `UserRepository.listAll()` — see that
 *  method's own doc comment for why this is an admin directory listing (every status, not just
 *  `active`) rather than `UsersModule`'s picker-only `search()`. 200, not 100: `dashboard-web`
 *  list pages request `pageSize + 1` (up to 101 at the largest 100-row page size) to detect a
 *  next page without a separate count query — a 100 cap here would 400 that request. This is the
 *  same fix already applied once in this codebase for the identical mismatch (Decision and
 *  Activity Log module, a real production incident). `offset` is likewise capped at 200 — bounded,
 *  not unlimited, so a caller can't force an arbitrarily expensive scan/count via an unbounded
 *  offset even though `limit` itself is bounded; a hand-operated admin directory realistically
 *  never needs to page past a few hundred rows — raising this further is a separate, later call. */
export const listUsersQuerySchema = z.object({
  search: z.string().min(1).max(255).optional(),
  status: z.enum(["active", "disabled"]).optional(),
  limit: z.coerce.number().int().min(1).max(200).optional(),
  offset: z.coerce.number().int().min(0).max(200).optional(),
});
export type ListUsersQueryDto = z.infer<typeof listUsersQuerySchema>;

export const updateUserStatusSchema = z.object({
  status: z.enum(["active", "disabled"]),
});
export type UpdateUserStatusDto = z.infer<typeof updateUserStatusSchema>;
