import { BadRequestException, Inject, Injectable, NotFoundException } from "@nestjs/common";
import type {
  ContactRole,
  ContactVerificationStatus,
  IncidentSeverity,
  OperationalContactEntity,
  OperationalContactRepository,
} from "@webdesk/database";
import { OPERATIONAL_CONTACT_REPOSITORY } from "./operational-contacts.constants.js";
// eslint-disable-next-line @typescript-eslint/consistent-type-imports -- real (value) import: NestJS constructor injection needs the class reference at runtime, see google-auth.service.ts's note.
import { AuditService } from "../audit/audit.service.js";

export interface CreateContactInput {
  contactUserId?: string | null;
  contactName?: string | null;
  contactEmail?: string | null;
  contactPhone?: string | null;
  area: string;
  role: ContactRole;
  escalationPriority: number;
  channelPreference?: string | null;
  severityApplicability?: readonly IncidentSeverity[] | null;
  workingHoursStart?: string | null;
  workingHoursEnd?: string | null;
  timeZone?: string | null;
  effectiveStartDate?: Date;
  effectiveEndDate?: Date | null;
}

export type UpdateContactInput = Partial<{
  role: ContactRole;
  escalationPriority: number;
  channelPreference: string | null;
  severityApplicability: readonly IncidentSeverity[] | null;
  workingHoursStart: string | null;
  workingHoursEnd: string | null;
  timeZone: string | null;
  effectiveEndDate: Date | null;
  activeStatus: boolean;
  verificationStatus: ContactVerificationStatus;
}>;

/** Converts a UTC instant to "HH:MM:SS" local time in the given IANA time zone. */
function localTimeOfDay(atTime: Date, timeZone: string): string {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hour12: false,
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).formatToParts(atTime);
  const get = (type: string) => parts.find((part) => part.type === type)?.value ?? "00";
  return `${get("hour")}:${get("minute")}:${get("second")}`;
}

/**
 * Supports an overnight window (`workingHoursStart > workingHoursEnd`, e.g. 22:00-06:00) by
 * treating it as wrapping past midnight — WITHOUT this, a contact configured with such hours
 * would never be selectable: `localTime >= start && localTime <= end` is unsatisfiable for any
 * `localTime` when `start > end`, silently excluding that contact from every escalation chain at
 * every hour, not just outside their configured window.
 */
function isWithinWorkingHours(contact: OperationalContactEntity, atTime: Date): boolean {
  if (!contact.workingHoursStart || !contact.workingHoursEnd || !contact.timeZone) {
    return true; // no working-hours restriction configured — always available
  }
  const localTime = localTimeOfDay(atTime, contact.timeZone);
  const { workingHoursStart: start, workingHoursEnd: end } = contact;
  if (start <= end) {
    return localTime >= start && localTime <= end;
  }
  // Overnight window: e.g. start=22:00, end=06:00 means "available from 22:00 to midnight, OR
  // from midnight to 06:00".
  return localTime >= start || localTime <= end;
}

function isEffective(contact: OperationalContactEntity, atTime: Date): boolean {
  if (new Date(contact.effectiveStartDate) > atTime) {
    return false;
  }
  if (contact.effectiveEndDate && new Date(contact.effectiveEndDate) < atTime) {
    return false;
  }
  return true;
}

function appliesToSeverity(contact: OperationalContactEntity, severity: IncidentSeverity): boolean {
  return contact.severityApplicability === null || contact.severityApplicability.includes(severity);
}

/**
 * The configurable operational-contact service (brief §17). Escalation-
 * chain resolution is real and tested — it answers "who do we contact for
 * this area/severity right now" from stored configuration — but it sends
 * nothing and tracks no incident, staying inside §17's own "configurable
 * contact model" scope rather than crossing into §18's excluded "full
 * incident-management system."
 */
@Injectable()
export class OperationalContactService {
  constructor(
    @Inject(OPERATIONAL_CONTACT_REPOSITORY) private readonly contacts: OperationalContactRepository,
    private readonly auditService: AuditService,
  ) {}

  async create(input: CreateContactInput, actorUserId: string): Promise<OperationalContactEntity> {
    if (!input.contactUserId && !input.contactName) {
      throw new BadRequestException("A contact requires either contactUserId or contactName");
    }
    if (input.escalationPriority < 1) {
      throw new BadRequestException("escalationPriority must be a positive integer");
    }

    const contact = await this.contacts.create(input);

    await this.auditService.record({
      eventType: "operational_contact_created",
      actorUserId,
      actorType: "human",
      entityType: "operational_contact",
      entityId: contact.id,
      action: "create",
      reason: `area:${input.area} role:${input.role}`,
      retentionCategory: "approval-audit-7y",
    });

    return contact;
  }

  async findById(id: string): Promise<OperationalContactEntity> {
    const contact = await this.contacts.findById(id);
    if (!contact) {
      throw new NotFoundException(`Operational contact not found: ${id}`);
    }
    return contact;
  }

  async update(
    id: string,
    patch: UpdateContactInput,
    actorUserId: string,
  ): Promise<OperationalContactEntity> {
    await this.findById(id); // throws NotFoundException if missing
    const updated = await this.contacts.update(id, patch);
    if (!updated) {
      throw new NotFoundException(`Operational contact not found: ${id}`);
    }

    await this.auditService.record({
      eventType: "operational_contact_updated",
      actorUserId,
      actorType: "human",
      entityType: "operational_contact",
      entityId: id,
      action: "update",
      afterState: patch as Record<string, unknown>,
      retentionCategory: "approval-audit-7y",
    });

    return updated;
  }

  async deactivate(id: string, actorUserId: string): Promise<OperationalContactEntity> {
    return this.update(id, { activeStatus: false }, actorUserId);
  }

  async markVerified(id: string, actorUserId: string): Promise<OperationalContactEntity> {
    return this.update(id, { verificationStatus: "verified" }, actorUserId);
  }

  async markVerificationFailed(id: string, actorUserId: string): Promise<OperationalContactEntity> {
    return this.update(id, { verificationStatus: "failed" }, actorUserId);
  }

  async list(
    filter: { area?: string; activeStatus?: boolean; limit?: number; offset?: number } = {},
  ): Promise<readonly OperationalContactEntity[]> {
    return this.contacts.list(filter);
  }

  /**
   * Primary contacts first, then backups; within each group, ascending
   * `escalationPriority`. Filters to active, effective-dated,
   * severity-applicable contacts; further filters by working hours when
   * `atTime` is supplied.
   */
  async resolveEscalationChain(
    area: string,
    severity: IncidentSeverity,
    atTime: Date = new Date(),
  ): Promise<readonly OperationalContactEntity[]> {
    const candidates = await this.contacts.findActiveForArea(area);
    const applicable = candidates
      .filter((contact) => isEffective(contact, atTime))
      .filter((contact) => appliesToSeverity(contact, severity))
      .filter((contact) => isWithinWorkingHours(contact, atTime));

    return [...applicable].sort((a, b) => {
      if (a.role !== b.role) {
        return a.role === "primary" ? -1 : 1;
      }
      return a.escalationPriority - b.escalationPriority;
    });
  }
}
