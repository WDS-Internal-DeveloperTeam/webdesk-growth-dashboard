import { Controller, Get, Req, UseGuards } from "@nestjs/common";
import { ApiOperation, ApiTags } from "@nestjs/swagger";
import type { ApiSuccessResponse, ModuleRegistrySummary } from "@webdesk/shared-types";
import type { RequestWithCorrelationId } from "../common/correlation-id.middleware.js";
import type { AuthenticatedRequest } from "../auth/session/session.guard.js";
import { SessionGuard } from "../auth/session/session.guard.js";
// eslint-disable-next-line @typescript-eslint/consistent-type-imports -- real (value) import: NestJS constructor injection needs the class reference at runtime, see google-auth.service.ts's note.
import { NavigationService } from "./navigation.service.js";

type NavigationRequest = AuthenticatedRequest & RequestWithCorrelationId;

/**
 * `GET /me/navigation` (Phase 1F brief §9/§10) — the registry-driven,
 * permission-aware module list `dashboard-web`'s shell renders as
 * navigation. Gated only by `SessionGuard`, same reasoning as
 * `CapabilitiesController`: every authenticated user may see their own
 * navigation, and it's already filtered to their own capabilities — there
 * is nothing left to additionally gate with `PermissionGuard`. This
 * endpoint is a discovery/UX convenience only; real route authorization
 * still happens at each module's own future endpoints.
 */
@ApiTags("authz")
@Controller("me")
@UseGuards(SessionGuard)
export class NavigationController {
  constructor(private readonly navigation: NavigationService) {}

  @Get("navigation")
  @ApiOperation({
    summary: "The caller's own permission-filtered, Version-1-scoped module navigation",
  })
  async getNavigation(
    @Req() req: NavigationRequest,
  ): Promise<ApiSuccessResponse<readonly ModuleRegistrySummary[]>> {
    const navigation = await this.navigation.getNavigation(req.authUser!.id);
    return { success: true, data: navigation, correlationId: req.correlationId ?? "unknown" };
  }
}
