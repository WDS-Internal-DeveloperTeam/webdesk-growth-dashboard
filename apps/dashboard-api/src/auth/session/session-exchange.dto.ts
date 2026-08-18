import { z } from "zod";

export const sessionExchangeSchema = z.object({
  code: z.string().min(1),
});
export type SessionExchangeDto = z.infer<typeof sessionExchangeSchema>;
