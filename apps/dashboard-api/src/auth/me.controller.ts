import {
  Controller,
  Get,
  Inject,
  InternalServerErrorException,
  Req,
  UseGuards,
} from "@nestjs/common";
import { ApiOperation, ApiTags } from "@nestjs/swagger";
import type { UserRepository } from "@webdesk/database";
import type { ApiSuccessResponse } from "@webdesk/shared-types";
import type { RequestWithCorrelationId } from "../common/correlation-id.middleware.js";
import { USER_REPOSITORY } from "./config/auth.constants.js";
import type { AuthenticatedRequest } from "./session/session.guard.js";
import { SessionGuard } from "./session/session.guard.js";

type MeRequest = AuthenticatedRequest & RequestWithCorrelationId;

export interface MeProfile {
  readonly id: string;
  readonly email: string;
  readonly displayName: string;
}

/**
 * `GET /me` (Phase 1F application shell §8's "user/account area") — the
 * caller's own basic identity only (id/email/displayName). Gated only by
 * `SessionGuard`, same reasoning as `/me/capabilities`/`/me/navigation`:
 * every authenticated user may see their own identity, and this never
 * returns another user's data.
 */
@ApiTags("auth")
@Controller("me")
@UseGuards(SessionGuard)
export class MeController {
  constructor(@Inject(USER_REPOSITORY) private readonly users: UserRepository) {}

  @Get()
  @ApiOperation({ summary: "The caller's own basic identity" })
  async getMe(@Req() req: MeRequest): Promise<ApiSuccessResponse<MeProfile>> {
    const user = await this.users.findById(req.authUser!.id);
    if (!user) {
      // A valid session referenced a user row that no longer exists — should never happen
      // (sessions are revoked on user removal), but fail safely rather than leak a stack trace.
      throw new InternalServerErrorException("Unable to load your profile");
    }
    return {
      success: true,
      data: { id: user.id, email: user.email, displayName: user.displayName },
      correlationId: req.correlationId ?? "unknown",
    };
  }
}
