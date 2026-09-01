import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import type {
  ProofClaimApprovalStatus,
  ProofClaimEntity,
  ProofClaimListFilter,
  ProofClaimRepository,
} from "@webdesk/database";
import {
  sanitizeNullableRichText,
  sanitizeNullableRichTextIfChanged,
  sanitizeRichTextHtml,
} from "@webdesk/validation";
import { PROOF_CLAIM_REPOSITORY } from "./proof-and-claims-library.constants.js";
import type { CreateProofClaimDto, UpdateProofClaimDto } from "./proof-and-claims-library.dto.js";
// eslint-disable-next-line @typescript-eslint/consistent-type-imports -- real (value) import: NestJS constructor injection needs the class reference at runtime.
import { AuditService } from "../audit/audit.service.js";
// eslint-disable-next-line @typescript-eslint/consistent-type-imports -- real (value) import: NestJS constructor injection needs the class reference at runtime.
import { AuthorizationService } from "../authz/authorization.service.js";
// eslint-disable-next-line @typescript-eslint/consistent-type-imports -- real (value) import: NestJS constructor injection needs the class reference at runtime.
import { ServicesService } from "../service-library/services.service.js";

const MODULE_KEY = "service_persona_proof";

/**
 * `sanitizeNullableRichTextIfChanged()` (`@webdesk/validation`) is typed for a field that may be
 * `null`/`undefined` — `claim` is neither (required, `.min(1)`, never `.nullish()`), so its return
 * type (`string | null | undefined`) doesn't structurally fit `claim`'s own `string | undefined`
 * update-patch shape. This is a type-only narrowing wrapper, not a re-implementation (code-review
 * finding: an earlier version hand-copied the "skip re-sanitizing an unchanged value" branching
 * instead of delegating) — for `claim`'s actual input domain (`string | undefined`, never `null`),
 * `sanitizeNullableRichTextIfChanged()` already produces the identical output for every reachable
 * case, so this only narrows the result type, it doesn't duplicate the logic. Kept local to this
 * file rather than promoted to `@webdesk/validation` — this is the only required rich-text field
 * anywhere in this app so far, so a shared generic helper for one call site is out of proportion.
 */
function sanitizeRequiredRichTextIfChanged(
  value: string | undefined,
  current: string,
): string | undefined {
  return sanitizeNullableRichTextIfChanged(value, current) as string | undefined;
}

/** A malformed (non-UUID) id can never resolve to a real service — filtered out before querying
 *  rather than sent to Postgres, whose `uuid` column type would otherwise reject it with a raw
 *  driver error the global exception filter turns into an opaque 500 instead of a clean 400 (same
 *  guard `PersonasService.assertServiceIdsExist()`/`UsersService.findById()` already use for the
 *  identical reason). */
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** The real, seeded RBAC action (`06_Roles_and_Permissions.md:42`) required for a given
 *  `approvalStatus` transition — identical vocabulary to Service Library's/Persona Library's own. */
type ProofClaimApprovalAction = "submit" | "review" | "approve";

/**
 * Sourced from `05_Workflow_State_Machines.md §2`'s generic artifact lifecycle, reused verbatim
 * from `ServicesService`'s/`PersonasService`'s own (already code-reviewed) `TRANSITIONS` table —
 * a 3rd occurrence of this identical shape, deliberately not extracted into a shared helper
 * (already-accepted, out-of-scope debt in this codebase). `submitted`/`revision_requested`/
 * `rejected -> draft` all require `submit` (the submitter/editor drives the revise-and-resubmit
 * loop, not the approver). `archived`/`superseded` are both terminal — no code path resurrects a
 * record from either.
 */
const TRANSITIONS: Readonly<
  Record<
    ProofClaimApprovalStatus,
    Readonly<Partial<Record<ProofClaimApprovalStatus, ProofClaimApprovalAction>>>
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
export class ClaimsService {
  constructor(
    @Inject(PROOF_CLAIM_REPOSITORY) private readonly claims: ProofClaimRepository,
    private readonly services: ServicesService,
    private readonly authorizationService: AuthorizationService,
    private readonly auditService: AuditService,
  ) {}

  /** Narrow, read-only existence check for a set of proof-claim ids — mirrors
   *  `ServicesService.existingServiceIds()`'s own already-reviewed pattern, added so Case Study
   *  Studio's `relatedClaimIds` field can validate against the real `proof_claims` table without
   *  this module needing to export its write-capable repository across the module boundary. */
  async existingClaimIds(ids: readonly string[]): Promise<ReadonlySet<string>> {
    const found = await this.claims.findByIds(ids);
    return new Set(found.map((row) => row.id));
  }

  /** Validates `relatedServiceIds` against the real, already-existing `services` table, via
   *  `ServicesService.existingServiceIds()` — a narrow, read-only delegating method, not the
   *  write-capable `SERVICE_REPOSITORY` token directly (code-review finding: this module was the
   *  2nd external consumer to inject the raw repository, exactly the "surface grows" condition
   *  Persona Library's own security review had flagged as needing this closed — mirrors
   *  `PersonasService.assertServiceIdsExist()`'s own identical shape, now both updated together).
   *  This wrapper method itself (the UUID filter + missing-ids `BadRequestException`) is still a
   *  byte-for-byte 2nd copy of `PersonasService`'s own — left as accepted, tracked debt (code-review
   *  finding): a real fix means a shared `@webdesk/validation` helper taking a field-name/error-
   *  message pair, out of proportion for a review-fix pass touching a third module's DTO/service
   *  layer as well. */
  private async assertServiceIdsExist(ids: readonly string[] | null | undefined): Promise<void> {
    if (!ids || ids.length === 0) {
      return;
    }
    const wellFormedIds = ids.filter((id) => UUID_PATTERN.test(id));
    const foundIds =
      wellFormedIds.length > 0
        ? await this.services.existingServiceIds(wellFormedIds)
        : new Set<string>();
    const missing = ids.filter((id) => !foundIds.has(id));
    if (missing.length > 0) {
      throw new BadRequestException(`relatedServiceIds not found: ${missing.join(", ")}`);
    }
  }

  async create(input: CreateProofClaimDto, actorUserId: string): Promise<ProofClaimEntity> {
    const [existing] = await Promise.all([
      this.claims.findByPublicId(input.publicId),
      this.assertServiceIdsExist(input.relatedServiceIds),
    ]);
    if (existing) {
      throw new BadRequestException(`publicId already in use: ${input.publicId}`);
    }

    let created: ProofClaimEntity;
    try {
      // claim/approvedWording/restrictions are now real HTML from dashboard-web's RichTextEditor
      // (dashboard-web-proof-and-claims-library UI build, 2026-08-23) — sanitized server-side
      // before storage, mirroring PersonasService.create()'s own identical wiring. `claim` is
      // required and never null, so it uses `sanitizeRichTextHtml()` directly rather than the
      // nullable-contract wrapper the two optional fields use.
      created = await this.claims.create({
        ...input,
        claim: sanitizeRichTextHtml(input.claim),
        approvedWording: sanitizeNullableRichText(input.approvedWording),
        restrictions: sanitizeNullableRichText(input.restrictions),
        createdBy: actorUserId,
      });
    } catch (error) {
      // The publicId uniqueness check above is TOCTOU (two concurrent creates with the same
      // publicId can both pass it before either INSERT commits) — the real unique index catches
      // the race loser, but without this catch it would otherwise surface as a raw 500 instead of
      // the same clean 400 the check above already gives the non-racing caller. Checked by
      // `.name`, not `instanceof`, since `dashboard-api` never imports `sequelize` directly
      // (ADR-0006/`only-database-package-touches-sequelize` — only `packages/database` may) —
      // `SequelizeUniqueConstraintError` is the fixed, documented name Sequelize's own
      // `UniqueConstraintError` class always carries.
      if (error instanceof Error && error.name === "SequelizeUniqueConstraintError") {
        throw new BadRequestException(`publicId already in use: ${input.publicId}`);
      }
      throw error;
    }

    await this.auditService.record({
      eventType: "data_change",
      actorUserId,
      actorType: "human",
      entityType: "proof_claim",
      entityId: created.id,
      action: "create",
      afterState: { claim: created.claim },
      retentionCategory: "audit-7y",
    });

    return created;
  }

  async findById(id: string): Promise<ProofClaimEntity> {
    const claim = await this.claims.findById(id);
    if (!claim) {
      throw new NotFoundException(`Proof claim not found: ${id}`);
    }
    return claim;
  }

  async list(filter: ProofClaimListFilter): Promise<readonly ProofClaimEntity[]> {
    return this.claims.list(filter);
  }

  async update(
    id: string,
    patch: UpdateProofClaimDto,
    actorUserId: string,
  ): Promise<ProofClaimEntity> {
    // Pre-fetch reintroduced (2026-08-23, rich-text editor rollout) — the original build
    // deliberately skipped this as a wasted SELECT, since this module had no rich-text fields to
    // diff against a "current" value at that point (backend-only pass, no dashboard-web UI yet).
    // Now that claim/approvedWording/restrictions are real HTML,
    // `sanitizeNullableRichTextIfChanged()`/`sanitizeRequiredRichTextIfChanged()` (below) need the
    // current stored value to skip re-sanitizing a field the patch resends unchanged — the same
    // reasoning `PersonasService.update()`'s own identical reversal already established. `findById()`
    // also 404s cleanly before anything else runs; `assertServiceIdsExist()` has no dependency on
    // `current` at all, so it runs in parallel, matching `PersonasService.update()`'s own ordering.
    //
    // Accepted, tracked debt (code-review finding): running both concurrently means a request that
    // is BOTH for a missing `id` AND carries an invalid `relatedServiceIds` entry gets whichever
    // exception (404 vs 400) its underlying query happens to settle first, rather than
    // deterministically the 404 — a real behavior gap, but one this diff only re-exposes, not
    // introduces: `PersonasService.update()`/`ServicesService.update()` already have the identical
    // shape, already shipped. A real fix (e.g. awaiting `findById()` first, then racing
    // `assertServiceIdsExist()` only once existence is confirmed) means resequencing all three
    // services together, out of scope for a single module's review-fix pass.
    const [current] = await Promise.all([
      this.findById(id),
      this.assertServiceIdsExist(patch.relatedServiceIds),
    ]);

    const updated = await this.claims.update(id, {
      ...patch,
      claim: sanitizeRequiredRichTextIfChanged(patch.claim, current.claim),
      approvedWording: sanitizeNullableRichTextIfChanged(
        patch.approvedWording,
        current.approvedWording,
      ),
      restrictions: sanitizeNullableRichTextIfChanged(patch.restrictions, current.restrictions),
      updatedBy: actorUserId,
    });
    // A real TOCTOU-safety net, not dead code — this module has no hard-delete today, but this
    // still guards a hypothetical future one, matching `PersonasService.update()`'s/
    // `ServicesService.update()`'s own identical belt-and-suspenders check after their own
    // pre-fetch.
    if (!updated) {
      throw new NotFoundException(`Proof claim not found: ${id}`);
    }

    // afterState records the raw, pre-sanitization patch, not the sanitized value actually
    // written above — the byte-identical, already-accepted pattern `PersonasService.update()`/
    // `ServicesService.update()` both have.
    await this.auditService.record({
      eventType: "data_change",
      actorUserId,
      actorType: "human",
      entityType: "proof_claim",
      entityId: id,
      action: "update",
      afterState: { ...patch },
      retentionCategory: "audit-7y",
    });

    return updated;
  }

  async changeApprovalStatus(
    id: string,
    nextStatus: ProofClaimApprovalStatus,
    actorUserId: string,
  ): Promise<ProofClaimEntity> {
    const claim = await this.findById(id);
    if (claim.approvalStatus === nextStatus) {
      return claim; // no-op, not an error — re-requesting the current status is harmless
    }

    const requiredAction = TRANSITIONS[claim.approvalStatus][nextStatus];
    if (!requiredAction) {
      throw new BadRequestException(
        `Invalid proof claim approval status transition: ${claim.approvalStatus} -> ${nextStatus}`,
      );
    }
    await this.authorizationService.assertAllowed(actorUserId, MODULE_KEY, requiredAction);

    const result = await this.claims.updateStatus(
      id,
      claim.approvalStatus,
      nextStatus,
      actorUserId,
    );
    if (result.outcome === "not_found") {
      throw new NotFoundException(`Proof claim not found: ${id}`);
    }
    if (result.outcome === "conflict") {
      throw new ConflictException(
        `Proof claim ${id} approval status changed concurrently ` +
          `(expected ${claim.approvalStatus}, now ${result.entity.approvalStatus}) — reload and retry`,
      );
    }

    // A failed audit write here is caught and only console.error'd, not retried or alerted on —
    // the byte-identical, already-accepted pattern PersonasService.changeApprovalStatus()/
    // ServicesService.changeApprovalStatus() both have (code-review finding: left as accepted,
    // tracked debt again here — higher-consequence on an "approved" transition specifically,
    // since this module's own stated purpose is evidence/compliance for public claims, but a real
    // fix, e.g. an audit-write retry/alerting mechanism, is a cross-cutting change to
    // AuditService itself, out of scope for this module).
    const isApproval = nextStatus === "approved";
    try {
      await this.auditService.record({
        eventType: isApproval ? "approval" : "data_change",
        actorUserId,
        actorType: "human",
        entityType: "proof_claim",
        entityId: id,
        action: `status:${claim.approvalStatus}->${nextStatus}`,
        beforeState: { approvalStatus: claim.approvalStatus },
        afterState: { approvalStatus: nextStatus },
        retentionCategory: isApproval ? "approval-audit-7y" : "audit-7y",
      });
    } catch (error) {
      console.error(
        `Proof claim ${id} approval status transition ${claim.approvalStatus}->${nextStatus} ` +
          "committed, but recording its audit event failed:",
        error,
      );
    }

    return result.entity;
  }
}
