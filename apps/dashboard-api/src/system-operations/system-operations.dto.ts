import { z } from "zod";

const severityEnum = z.enum(["critical", "high", "medium", "low"]);
const statusEnum = z.enum(["unknown", "healthy", "degraded", "unavailable", "not_configured"]);

export const listActivityQuerySchema = z.object({
  eventType: z.string().min(1).max(64).optional(),
  category: z.string().min(1).max(64).optional(),
  severity: severityEnum.optional(),
  relatedEntityType: z.string().min(1).max(32).optional(),
  relatedEntityId: z.string().min(1).max(128).optional(),
  correlationId: z.string().uuid().optional(),
  limit: z.coerce.number().int().min(1).max(200).optional(),
  offset: z.coerce.number().int().min(0).optional(),
});
export type ListActivityQueryDto = z.infer<typeof listActivityQuerySchema>;

export const recordCheckSchema = z.object({
  componentKey: z.string().min(1).max(64),
  status: statusEnum,
  detail: z.string().min(1).nullish(),
});
export type RecordCheckDto = z.infer<typeof recordCheckSchema>;
