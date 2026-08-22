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
  ServiceRepository,
} from "@webdesk/database";
import { sanitizeNullableRichText, sanitizeNullableRichTextIfChanged } from "@webdesk/validation";
import { PERSONA_REPOSITORY } from "./persona-library.constants.js";
import type { CreatePersonaDto, UpdatePersonaDto } from "./persona-library.dto.js";
// eslint-disable-next-line @typescript-eslint/consistent-type-imports -- real (value) import: NestJS constructor injection needs the class reference at runtime.
import { AuditService } from "../audit/audit.service.js";
// eslint-disable-next-line @typescript-eslint/consistent-type-imports -- real (value) import: NestJS constructor injection needs the class reference at runtime.
import { AuthorizationService } from "../authz/authorization.service.js";
import { SERVICE_REPOSITORY } from "../service-library/service-library.constants.js";

const MODULE_KEY = "service_persona_proof";

/** A malformed (non-UUID) id can never resolve to a real service — filtered out before querying
 *  rather than sent to Postgres, whose `uuid` column type would otherwise reject it with a raw
 *  driver error the global exception filter turns into an opaque 500 instead of a clean 400 (same
 *  guard `UsersService.findById()` already uses for the identical reason). */
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

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
    @Inject(SERVICE_REPOSITORY) private readonly services: ServiceRepository,
    private readonly authorizationService: AuthorizationService,
    private readonly auditService: AuditService,
  ) {}

  /** Validates `relatedServiceIds` against the real, already-existing `services` table — mirrors
   *  `ServicesService.assertIdsExist()` exactly (code-review finding: this field previously had no
   *  validation at all, weaker than the precedent it claimed to follow, since Service Library's
   *  own unvalidated fields point at modules that genuinely don't exist yet, unlike `services`). */
  private async assertServiceIdsExist(ids: readonly string[] | null | undefined): Promise<void> {
    if (!ids || ids.length === 0) {
      return;
    }
    const wellFormedIds = ids.filter((id) => UUID_PATTERN.test(id));
    const found = wellFormedIds.length > 0 ? await this.services.findByIds(wellFormedIds) : [];
    const foundIds = new Set(found.map((row) => row.id));
    const missing = ids.filter((id) => !foundIds.has(id));
    if (missing.length > 0) {
      throw new BadRequestException(`relatedServiceIds not found: ${missing.join(", ")}`);
    }
  }

  async create(input: CreatePersonaDto, actorUserId: string): Promise<PersonaEntity> {
    const [existing] = await Promise.all([
      this.personas.findByPublicId(input.publicId),
      this.assertServiceIdsExist(input.relatedServiceIds),
    ]);
    if (existing) {
      throw new BadRequestException(`publicId already in use: ${input.publicId}`);
    }

    let created: PersonaEntity;
    try {
      // Each field hand-enumerated once, the same shape as Service Library's/Projects' own
      // create()/update() rich-text wiring — a 3rd near-identical occurrence with no shared
      // `@webdesk/validation` helper collapsing "sanitize these N named fields" into one call
      // (code-review finding, persona-library-rich-text-editor). Left as accepted, tracked debt:
      // a real fix means retrofitting Service Library's already-shipped call sites too (or living
      // with a 4th inconsistent shape), out of scope for a Persona-Library-only branch.
      created = await this.personas.create({
        ...input,
        goals: sanitizeNullableRichText(input.goals),
        pains: sanitizeNullableRichText(input.pains),
        triggers: sanitizeNullableRichText(input.triggers),
        objections: sanitizeNullableRichText(input.objections),
        decisionCriteria: sanitizeNullableRichText(input.decisionCriteria),
        badFitSignals: sanitizeNullableRichText(input.badFitSignals),
        messagingTrack: sanitizeNullableRichText(input.messagingTrack),
        ctaPreferences: sanitizeNullableRichText(input.ctaPreferences),
        createdBy: actorUserId,
      });
    } catch (error) {
      // The publicId uniqueness check above is TOCTOU (two concurrent creates with the same
      // publicId can both pass it before either INSERT commits) — the real unique index catches
      // the race loser, but without this catch it would otherwise surface as a raw 500 instead of
      // the same clean 400 the check above already gives the non-racing caller (code-review
      // finding). Checked by `.name`, not `instanceof`, since `dashboard-api` never imports
      // `sequelize` directly (ADR-0006/`only-database-package-touches-sequelize` — only
      // `packages/database` may) — `SequelizeUniqueConstraintError` is the fixed, documented name
      // Sequelize's own `UniqueConstraintError` class always carries.
      if (error instanceof Error && error.name === "SequelizeUniqueConstraintError") {
        throw new BadRequestException(`publicId already in use: ${input.publicId}`);
      }
      throw error;
    }

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
    // Pre-fetch reintroduced (2026-08-22, rich-text editor rollout) — a prior code-review pass
    // removed this as a wasted SELECT when Persona Library had no rich-text fields to diff
    // against; now that goals/pains/triggers/objections/decisionCriteria/badFitSignals/
    // messagingTrack/ctaPreferences are real HTML, `sanitizeNullableRichTextIfChanged()` needs
    // the current stored value to skip re-sanitizing a field the patch resends unchanged (the
    // common case for a form that resends full record state), the same reasoning
    // `ServicesService.update()`'s own `findServiceOrThrow()`-first ordering already established.
    // `findById()` also 404s cleanly before anything else runs. Unlike Service Library's own
    // pre-fetch, `assertServiceIdsExist()` has no dependency on `current` at all — run in parallel
    // (code-review finding: this diff's first version ran them sequentially, an unnecessary extra
    // round trip `create()`'s own `Promise.all` two lines above doesn't pay).
    const [current] = await Promise.all([
      this.findById(id),
      this.assertServiceIdsExist(patch.relatedServiceIds),
    ]);

    const updated = await this.personas.update(id, {
      ...patch,
      goals: sanitizeNullableRichTextIfChanged(patch.goals, current.goals),
      pains: sanitizeNullableRichTextIfChanged(patch.pains, current.pains),
      triggers: sanitizeNullableRichTextIfChanged(patch.triggers, current.triggers),
      objections: sanitizeNullableRichTextIfChanged(patch.objections, current.objections),
      decisionCriteria: sanitizeNullableRichTextIfChanged(
        patch.decisionCriteria,
        current.decisionCriteria,
      ),
      badFitSignals: sanitizeNullableRichTextIfChanged(patch.badFitSignals, current.badFitSignals),
      messagingTrack: sanitizeNullableRichTextIfChanged(
        patch.messagingTrack,
        current.messagingTrack,
      ),
      ctaPreferences: sanitizeNullableRichTextIfChanged(
        patch.ctaPreferences,
        current.ctaPreferences,
      ),
      updatedBy: actorUserId,
    });
    // A real TOCTOU-safety net, not dead code — Persona Library has no hard-delete today, but
    // this still guards a hypothetical future one, matching `ServicesService.update()`'s own
    // identical belt-and-suspenders check after its own pre-fetch.
    if (!updated) {
      throw new NotFoundException(`Persona not found: ${id}`);
    }

    // afterState records the raw, pre-sanitization patch, not the sanitized value actually
    // written above — the byte-identical pattern `ServicesService.update()` already has
    // (code-review finding, persona-library-rich-text-editor: flagged as an already-accepted
    // architectural pattern being replicated, not a new deviation this diff introduces; a real
    // fix means sanitizing the audit payload too, out of scope for a Persona-Library-only branch
    // since it'd need to land identically for Service Library's own call site).
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
