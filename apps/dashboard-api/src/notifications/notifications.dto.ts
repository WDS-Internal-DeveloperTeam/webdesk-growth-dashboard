import { z } from "zod";

export const createNotificationSchema = z.object({
  notificationType: z.string().min(1).max(64),
  severity: z.enum(["critical", "high", "medium", "low"]),
  operationalArea: z.string().min(1).max(64).nullish(),
  projectId: z.string().uuid().nullish(),
  recipientUserId: z.string().uuid().nullish(),
  recipientContactId: z.string().uuid().nullish(),
  subject: z.string().min(1).max(255),
  bodyReference: z.string().min(1).nullish(),
  relatedEntityType: z.string().min(1).max(32).nullish(),
  relatedEntityId: z.string().min(1).max(128).nullish(),
});
export type CreateNotificationDto = z.infer<typeof createNotificationSchema>;

export const listNotificationsQuerySchema = z.object({
  deliveryState: z
    .enum(["queued", "sent_to_smtp", "accepted", "failed", "retrying", "permanently_failed"])
    .optional(),
  projectId: z.string().uuid().optional(),
  notificationType: z.string().min(1).max(64).optional(),
  limit: z.coerce.number().int().min(1).max(200).optional(),
  offset: z.coerce.number().int().min(0).optional(),
});
export type ListNotificationsQueryDto = z.infer<typeof listNotificationsQuerySchema>;
