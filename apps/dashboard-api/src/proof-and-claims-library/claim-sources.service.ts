import { Inject, Injectable, NotFoundException } from "@nestjs/common";
import type {
  ClaimSourceEntity,
  ClaimSourceRepository,
  ProofClaimRepository,
} from "@webdesk/database";
import {
  CLAIM_SOURCE_REPOSITORY,
  PROOF_CLAIM_REPOSITORY,
} from "./proof-and-claims-library.constants.js";
// eslint-disable-next-line @typescript-eslint/consistent-type-imports -- real (value) import: NestJS constructor injection needs the class reference at runtime.
import { AuditService } from "../audit/audit.service.js";

/**
 * Claim-source CRUD, scoped to a parent claim — mirrors `RoadmapItemsService`'s own shape
 * (`apps/dashboard-api/src/projects/roadmap-items.service.ts`), the closest existing precedent for
 * a genuine sub-resource service in this codebase. Sources aren't independently governed by the
 * parent claim's approval workflow — editing a source is an `edit`-level action, same tier as
 * editing the claim's own content fields, checked at the controller/route level (no dynamic
 * per-transition check needed here, unlike `ClaimsService.changeApprovalStatus()`).
 */
@Injectable()
export class ClaimSourcesService {
  constructor(
    @Inject(CLAIM_SOURCE_REPOSITORY) private readonly claimSources: ClaimSourceRepository,
    @Inject(PROOF_CLAIM_REPOSITORY) private readonly claims: ProofClaimRepository,
    private readonly auditService: AuditService,
  ) {}

  /** `claim_sources.claim_id` is FK-constrained (migration `00054`), but a well-formed, nonexistent
   *  `claimId` was previously only caught at the database layer — surfacing as a raw, unhandled 500
   *  instead of a clean 404 (code-review finding, mirrors `RoadmapItemsService`'s own equivalent
   *  gap for the identical reason). */
  async create(
    claimId: string,
    input: { source: string; sourceUrl?: string | null },
    actorUserId: string,
  ): Promise<ClaimSourceEntity> {
    const claim = await this.claims.findById(claimId);
    if (!claim) {
      throw new NotFoundException(`Proof claim not found: ${claimId}`);
    }

    const created = await this.claimSources.create({
      claimId,
      source: input.source,
      sourceUrl: input.sourceUrl,
    });

    await this.auditService.record({
      eventType: "data_change",
      actorUserId,
      actorType: "human",
      entityType: "claim_source",
      entityId: created.id,
      action: "create",
      afterState: { claimId, source: created.source },
      retentionCategory: "audit-7y",
    });

    return created;
  }

  async findById(id: string): Promise<ClaimSourceEntity> {
    const source = await this.claimSources.findById(id);
    if (!source) {
      throw new NotFoundException(`Claim source not found: ${id}`);
    }
    return source;
  }

  async listByClaim(claimId: string): Promise<readonly ClaimSourceEntity[]> {
    return this.claimSources.listByClaim(claimId);
  }

  /** `claimId`-scoped (IDOR prevention) — a source from a different claim, accessed via this
   *  claim's own route, is treated as not found rather than silently updated. */
  async update(
    id: string,
    claimId: string,
    patch: { source?: string; sourceUrl?: string | null },
    actorUserId: string,
  ): Promise<ClaimSourceEntity> {
    const updated = await this.claimSources.update(id, claimId, patch);
    if (!updated) {
      throw new NotFoundException(`Claim source not found: ${id}`);
    }

    await this.auditService.record({
      eventType: "data_change",
      actorUserId,
      actorType: "human",
      entityType: "claim_source",
      entityId: id,
      action: "update",
      afterState: { claimId, ...patch },
      retentionCategory: "audit-7y",
    });

    return updated;
  }

  /** `claimId`-scoped (IDOR prevention), same as `update()`. */
  async remove(id: string, claimId: string, actorUserId: string): Promise<void> {
    const source = await this.findById(id);
    if (source.claimId !== claimId) {
      throw new NotFoundException(`Claim source not found: ${id}`);
    }

    const removed = await this.claimSources.remove(id, claimId);
    if (!removed) {
      throw new NotFoundException(`Claim source not found: ${id}`);
    }

    await this.auditService.record({
      eventType: "data_change",
      actorUserId,
      actorType: "human",
      entityType: "claim_source",
      entityId: id,
      action: "delete",
      beforeState: { claimId, source: source.source },
      retentionCategory: "audit-7y",
    });
  }
}
