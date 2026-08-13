import { z } from "zod";

const severityEnum = z.enum(["critical", "high", "medium", "low"]);
const timeString = z.string().regex(/^\d{2}:\d{2}(:\d{2})?$/, "expected HH:MM or HH:MM:SS");

export const createContactSchema = z
  .object({
    contactUserId: z.string().uuid().nullish(),
    contactName: z.string().min(1).max(255).nullish(),
    contactEmail: z.string().email().nullish(),
    contactPhone: z.string().min(1).max(64).nullish(),
    area: z.string().min(1).max(64),
    role: z.enum(["primary", "backup"]),
    escalationPriority: z.number().int().min(1),
    channelPreference: z.string().min(1).max(32).nullish(),
    severityApplicability: z.array(severityEnum).nullish(),
    workingHoursStart: timeString.nullish(),
    workingHoursEnd: timeString.nullish(),
    timeZone: z.string().min(1).max(64).nullish(),
    effectiveEndDate: z.coerce.date().nullish(),
  })
  .refine((value) => Boolean(value.contactUserId) || Boolean(value.contactName), {
    message: "A contact requires either contactUserId or contactName",
  });
export type CreateContactDto = z.infer<typeof createContactSchema>;

export const updateContactSchema = z.object({
  role: z.enum(["primary", "backup"]).optional(),
  escalationPriority: z.number().int().min(1).optional(),
  channelPreference: z.string().min(1).max(32).nullish(),
  severityApplicability: z.array(severityEnum).nullish(),
  workingHoursStart: timeString.nullish(),
  workingHoursEnd: timeString.nullish(),
  timeZone: z.string().min(1).max(64).nullish(),
  effectiveEndDate: z.coerce.date().nullish(),
  activeStatus: z.boolean().optional(),
});
export type UpdateContactDto = z.infer<typeof updateContactSchema>;

export const listContactsQuerySchema = z.object({
  area: z.string().min(1).max(64).optional(),
  activeStatus: z.coerce.boolean().optional(),
});
export type ListContactsQueryDto = z.infer<typeof listContactsQuerySchema>;

export const escalationChainQuerySchema = z.object({
  area: z.string().min(1).max(64),
  severity: severityEnum,
  atTime: z.coerce.date().optional(),
});
export type EscalationChainQueryDto = z.infer<typeof escalationChainQuerySchema>;

export const evaluateResponseTargetSchema = z.object({
  severity: severityEnum,
  incidentOpenedAt: z.coerce.date(),
  now: z.coerce.date().optional(),
});
export type EvaluateResponseTargetDto = z.infer<typeof evaluateResponseTargetSchema>;
