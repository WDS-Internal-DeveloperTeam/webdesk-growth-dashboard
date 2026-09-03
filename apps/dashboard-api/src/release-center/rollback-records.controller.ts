import { Controller, Get, Param, ParseUUIDPipe, Req, UseGuards } from "@nestjs/common";
import { ApiOperation, ApiTags } from "@nestjs/swagger";
import type { RollbackRecordEntity } from "@webdesk/database";
import type { ApiSuccessResponse } from "@webdesk/shared-types";
import type { RequestWithCorrelationId } from "../common/correlation-id.middleware.js";
import type { AuthenticatedRequest } from "../auth/session/session.guard.js";
import { SessionGuard } from "../auth/session/session.guard.js";
import { PermissionGuard } from "../authz/permission.guard.js";
import { RequirePermission } from "../authz/require-permission.decorator.js";
import { RELEASE_CENTER_MODULE_KEY } from "./release-center.constants.js";
// eslint-disable-next-line @typescript-eslint/consistent-type-imports -- real (value) import: NestJS constructor injection needs the class reference at runtime.
import { RollbackRecordsService } from "./rollback-records.service.js";

type ReleaseCenterRequest = AuthenticatedRequest & RequestWithCorrelationId;

/** One route only: `GET .../releases/:id/rollback` — read-only, returns the rollback record if
 *  one exists for this release. */
@ApiTags("release-center")
@Controller("release-center/projects/:projectId/releases/:id/rollback")
@UseGuards(SessionGuard)
export class RollbackRecordsController {
  constructor(private readonly rollbackRecords: RollbackRecordsService) {}

  @Get()
  @UseGuards(PermissionGuard)
  @RequirePermission(RELEASE_CENTER_MODULE_KEY, "view")
  @ApiOperation({ summary: "Get a release's rollback record, if one exists" })
  async findOne(
    @Param("projectId", new ParseUUIDPipe()) projectId: string,
    @Param("id", new ParseUUIDPipe()) id: string,
    @Req() req: ReleaseCenterRequest,
  ): Promise<ApiSuccessResponse<RollbackRecordEntity>> {
    const data = await this.rollbackRecords.findByReleaseId(id, projectId);
    return { success: true, data, correlationId: req.correlationId ?? "unknown" };
  }
}
