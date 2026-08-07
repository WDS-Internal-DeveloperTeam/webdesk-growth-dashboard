import { z } from "zod";

export const assignRoleSchema = z.object({
  roleId: z.string().uuid(),
});
export type AssignRoleDto = z.infer<typeof assignRoleSchema>;
