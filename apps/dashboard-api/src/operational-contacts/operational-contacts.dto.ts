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

// `z.coerce.boolean()` runs `Boolean(value)` — since Express query params always arrive as
// strings, `?activeStatus=false` coerces to `Boolean("false")`, which is `true` (any non-empty
// string is truthy). That silently inverted the filter: a caller asking for inactive contacts
// would get active ones back. An explicit "true"/"false" literal map has no such trap.
const booleanQueryParam = z.enum(["true", "false"]).transform((value) => value === "true");

export const listContactsQuerySchema = z.object({
  area: z.string().min(1).max(64).optional(),
  activeStatus: booleanQueryParam.optional(),
  // Same bound as every other list endpoint in this Phase 1E slate (jobs/notifications/
  // system-events) — this repository's own query previously had no LIMIT/pagination cap at all
  // (docs/security/threat-model-phase-1e-operational-infrastructure.md's Denial of Service
  // finding), unlike every one of those.
  limit: z.coerce.number().int().min(1).max(200).optional(),
  offset: z.coerce.number().int().min(0).optional(),
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
