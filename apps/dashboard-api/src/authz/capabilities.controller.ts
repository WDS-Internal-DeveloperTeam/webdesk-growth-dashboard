import { Controller, Get, Req, UseGuards } from "@nestjs/common";
import { ApiOperation, ApiTags } from "@nestjs/swagger";
import type { ApiSuccessResponse } from "@webdesk/shared-types";
import type { RequestWithCorrelationId } from "../common/correlation-id.middleware.js";
import type { AuthenticatedRequest } from "../auth/session/session.guard.js";
import { SessionGuard } from "../auth/session/session.guard.js";
// eslint-disable-next-line @typescript-eslint/consistent-type-imports -- real (value) import: NestJS constructor injection needs the class reference at runtime, see google-auth.service.ts's note.
import { AuthorizationService } from "./authorization.service.js";

type CapabilitiesRequest = AuthenticatedRequest & RequestWithCorrelationId;

/**
 * `GET /me/capabilities` (task package §15/§20) — the frontend capability
 * model `dashboard-web` uses for UX (hide unavailable nav, disable
 * unavailable actions). Gated only by `SessionGuard`, deliberately no
 * `PermissionGuard`/`@RequirePermission`: every authenticated user may see
 * their *own* effective capabilities — that isn't a privileged action, and
 * a route with no `@RequirePermission` under `PermissionGuard` fails
 * closed by design (see that guard's own doc comment), so this route
 * correctly never uses it. Returns only the calling user's own data —
 * never the full system authorization matrix (§13's own "do not expose
 * sensitive policy details" instruction).
 */
@ApiTags("authz")
@Controller("me")
@UseGuards(SessionGuard)
export class CapabilitiesController {
  constructor(private readonly authorization: AuthorizationService) {}

  @Get("capabilities")
  @ApiOperation({ summary: "The caller's own effective capabilities, grouped by module key" })
  async getCapabilities(
    @Req() req: CapabilitiesRequest,
  ): Promise<ApiSuccessResponse<Readonly<Record<string, readonly string[]>>>> {
    const capabilities = await this.authorization.getEffectiveCapabilities(req.authUser!.id);
    return {
      success: true,
      data: capabilities,
      correlationId: req.correlationId ?? "unknown",
    };
  }
}
