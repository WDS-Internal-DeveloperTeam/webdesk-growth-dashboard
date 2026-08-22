import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import type {
  PersonaApprovalStatus,
  PersonaEntity,
  PersonaListFilter,
  PersonaRepository,
} from "@webdesk/database";
import { PERSONA_REPOSITORY } from "./persona-library.constants.js";
import type { CreatePersonaDto, UpdatePersonaDto } from "./persona-library.dto.js";
// eslint-disable-next-line @typescript-eslint/consistent-type-imports -- real (value) import: NestJS constructor injection needs the class reference at runtime.
import { AuditService } from "../audit/audit.service.js";
// eslint-disable-next-line @typescript-eslint/consistent-type-imports -- real (value) import: NestJS constructor injection needs the class reference at runtime.
import { AuthorizationService } from "../authz/authorization.service.js";

const MODULE_KEY = "service_persona_proof";

/** The real, seeded RBAC action (`06_Roles_and_Permissions.md:42`) required for a given
 *  `approvalStatus` transition — identical vocabulary to Service Library's own. */
type PersonaApprovalAction = "submit" | "review" | "approve";

/**
 * Sourced from `05_Workflow_State_Machines.md §2`'s generic artifact lifecycle, reused verbatim
 * from `ServicesService`'s own (already code-reviewed) `TRANSITIONS` table (D3) — a single source
 * of truth for both "is this transition legal" (a key's presence) and "what RBAC action does it
 * require" (the value). `submitted`/`revision_requested`/`rejected -> draft` all require `submit`
 * (the submitter/editor drives the revise-and-resubmit loop, not the approver) — the exact fix
 * Service Library's own code review already made once for this identical shape.
 * `archived`/`superseded` are both terminal — no code path resurrects a record from either.
 */
const TRANSITIONS: Readonly<
  Record<
    PersonaApprovalStatus,
    Readonly<Partial<Record<PersonaApprovalStatus, PersonaApprovalAction>>>
  >
> = {
  draft: { submitted: "submit", archived: "approve" },
  submitted: { under_review: "review", draft: "submit", archived: "approve" },
  under_review: {
    approved: "approve",
    revision_requested: "review",
    rejected: "approve",
    archived: "approve",
  },
  revision_requested: { draft: "submit", submitted: "submit", archived: "approve" },
  approved: { superseded: "approve", archived: "approve" },
  rejected: { draft: "submit", archived: "approve" },
  superseded: {},
  archived: {},
};

@Injectable()
export class PersonasService {
  constructor(
    @Inject(PERSONA_REPOSITORY) private readonly personas: PersonaRepository,
    private readonly authorizationService: AuthorizationService,
    private readonly auditService: AuditService,
  ) {}

  async create(input: CreatePersonaDto, actorUserId: string): Promise<PersonaEntity> {
    const existing = await this.personas.findByPublicId(input.publicId);
    if (existing) {
      throw new BadRequestException(`publicId already in use: ${input.publicId}`);
    }

    const created = await this.personas.create({
      ...input,
      createdBy: actorUserId,
    });

    await this.auditService.record({
      eventType: "data_change",
      actorUserId,
      actorType: "human",
      entityType: "persona",
      entityId: created.id,
      action: "create",
      afterState: { name: created.name },
      retentionCategory: "audit-7y",
    });

    return created;
  }

  async findById(id: string): Promise<PersonaEntity> {
    const persona = await this.personas.findById(id);
    if (!persona) {
      throw new NotFoundException(`Persona not found: ${id}`);
    }
    return persona;
  }

  async list(filter: PersonaListFilter): Promise<readonly PersonaEntity[]> {
    return this.personas.list(filter);
  }

  async update(id: string, patch: UpdatePersonaDto, actorUserId: string): Promise<PersonaEntity> {
    // 404s cleanly before touching anything else — mirrors ServicesService.update()'s own
    // findServiceOrThrow()-first ordering.
    await this.findById(id);

    const updated = await this.personas.update(id, { ...patch, updatedBy: actorUserId });
    if (!updated) {
      throw new NotFoundException(`Persona not found: ${id}`);
    }

    await this.auditService.record({
      eventType: "data_change",
      actorUserId,
      actorType: "human",
      entityType: "persona",
      entityId: id,
      action: "update",
      afterState: { ...patch },
      retentionCategory: "audit-7y",
    });

    return updated;
  }

  async changeApprovalStatus(
    id: string,
    nextStatus: PersonaApprovalStatus,
    actorUserId: string,
  ): Promise<PersonaEntity> {
    const persona = await this.findById(id);
    if (persona.approvalStatus === nextStatus) {
      return persona; // no-op, not an error — re-requesting the current status is harmless
    }

    const requiredAction = TRANSITIONS[persona.approvalStatus][nextStatus];
    if (!requiredAction) {
      throw new BadRequestException(
        `Invalid persona approval status transition: ${persona.approvalStatus} -> ${nextStatus}`,
      );
    }
    await this.authorizationService.assertAllowed(actorUserId, MODULE_KEY, requiredAction);

    const result = await this.personas.updateStatus(
      id,
      persona.approvalStatus,
      nextStatus,
      actorUserId,
    );
    if (result.outcome === "not_found") {
      throw new NotFoundException(`Persona not found: ${id}`);
    }
    if (result.outcome === "conflict") {
      throw new ConflictException(
        `Persona ${id} approval status changed concurrently ` +
          `(expected ${persona.approvalStatus}, now ${result.entity.approvalStatus}) — reload and retry`,
      );
    }

    const isApproval = nextStatus === "approved";
    try {
      await this.auditService.record({
        eventType: isApproval ? "approval" : "data_change",
        actorUserId,
        actorType: "human",
        entityType: "persona",
        entityId: id,
        action: `status:${persona.approvalStatus}->${nextStatus}`,
        beforeState: { approvalStatus: persona.approvalStatus },
        afterState: { approvalStatus: nextStatus },
        retentionCategory: isApproval ? "approval-audit-7y" : "audit-7y",
      });
    } catch (error) {
      console.error(
        `Persona ${id} approval status transition ${persona.approvalStatus}->${nextStatus} ` +
          "committed, but recording its audit event failed:",
        error,
      );
    }

    return result.entity;
  }
}
