import { ForbiddenException, Inject, Injectable } from "@nestjs/common";
import type { AuthorizationActionRepository } from "@webdesk/database";
import { AUTHORIZATION_ACTION_REPOSITORY } from "../../authz/authz.constants.js";

/**
 * `knowledge/12-dashboard-security-controls.md` "Separation of duties" /
 * `06_Roles_and_Permissions.md §4`, restated as one reusable check: the
 * actor who authors/submits/implements an item is never the same actor
 * authorized to approve it. Every future approval workflow (Case Studies,
 * Releases, Change Center, Review Center, security exceptions, and
 * Phase 1C's own emergency-admin recovery request) calls this before
 * accepting an approval action, rather than each reinventing its own
 * self-approval check — enforced here at the service layer, per
 * knowledge/12: "not merely by convention or UI hint."
 *
 * `assertNoPriorConflictingAction` (task package §9/§10 — "Developer who
 * performed implementation ≠ required independent code reviewer" and
 * similar) generalizes this beyond the same-request actor/target shape
 * `assertDistinctActors` covers: it checks whether the *current* actor
 * previously performed a *different, specific* action on the *same*
 * resource, using `authorization_actions` (migration 00017) as the
 * historical record. No code-review/release/task business tables exist
 * yet, so no caller uses this method today — it is the reusable
 * foundation those future workflows call, per the brief's own "establishes
 * the reusable policy foundation... full workflow modules may come later."
 */
@Injectable()
export class SeparationOfDutiesService {
  constructor(
    @Inject(AUTHORIZATION_ACTION_REPOSITORY)
    private readonly authorizationActions: AuthorizationActionRepository,
  ) {}

  /** Throws if `approverId` and `actorId` (the submitter/implementer/target) are the same — never returns a boolean for the caller to accidentally ignore. */
  assertDistinctActors(approverId: string, actorId: string, context: string): void {
    if (approverId === actorId) {
      throw new ForbiddenException(
        `Separation of duties: the ${context} cannot also approve their own submission.`,
      );
    }
  }

  /**
   * Throws if `actorId` already performed `priorActionType` on this exact
   * resource — e.g. the same person who `implemented` a code change
   * cannot also `reviewed` it. Callers should also call `assertDistinctActors`
   * where a same-request actor/target pair is available; this method
   * covers the case where the conflicting action happened earlier, in a
   * different request, which a same-request check alone can't see.
   */
  async assertNoPriorConflictingAction(
    resourceType: string,
    resourceId: string,
    priorActionType: string,
    actorId: string,
    context: string,
  ): Promise<void> {
    const priorActors = await this.authorizationActions.findActorsForResource(
      resourceType,
      resourceId,
      priorActionType,
    );
    if (priorActors.includes(actorId)) {
      throw new ForbiddenException(
        `Separation of duties: the ${context} already performed "${priorActionType}" on this ${resourceType} and cannot also perform the current action.`,
      );
    }
  }

  /** Records an action for future `assertNoPriorConflictingAction` checks against the same resource. */
  async recordAction(
    actorId: string,
    actionType: string,
    resourceType: string,
    resourceId: string,
  ): Promise<void> {
    await this.authorizationActions.record({ actorId, actionType, resourceType, resourceId });
  }
}
