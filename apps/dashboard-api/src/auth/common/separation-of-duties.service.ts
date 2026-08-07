import { ForbiddenException, Injectable } from "@nestjs/common";

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
 */
@Injectable()
export class SeparationOfDutiesService {
  /** Throws if `approverId` and `actorId` (the submitter/implementer/target) are the same — never returns a boolean for the caller to accidentally ignore. */
  assertDistinctActors(approverId: string, actorId: string, context: string): void {
    if (approverId === actorId) {
      throw new ForbiddenException(
        `Separation of duties: the ${context} cannot also approve their own submission.`,
      );
    }
  }
}
