import { Controller, Get } from "@nestjs/common";
import { ApiOkResponse, ApiOperation, ApiTags } from "@nestjs/swagger";
import { getBuildMetadata } from "@webdesk/configuration";
import type { HealthCheckResult } from "@webdesk/shared-types";
import { API_VERSION } from "../version.js";

const buildMetadata = getBuildMetadata(API_VERSION);

@ApiTags("health")
@Controller()
export class HealthController {
  /**
   * Liveness — "is this process running at all." Never checks downstream
   * dependencies (no database exists yet at Phase 1A; once one does,
   * liveness still shouldn't depend on it — that's what /ready is for).
   */
  @Get("health")
  @ApiOperation({ summary: "Liveness probe" })
  @ApiOkResponse({ description: "Process is running." })
  getHealth(): HealthCheckResult {
    return {
      status: "ok",
      service: "dashboard-api",
      timestamp: new Date().toISOString(),
      build: buildMetadata,
    };
  }

  /**
   * Readiness — "is this process ready to serve real traffic." At Phase 1A
   * there are no real dependencies to check (no database, no integrations)
   * so this reports the same as /health; it will grow real dependency
   * checks (database reachability, etc.) as Phase 1B+ introduces them —
   * never claimed as checked before it actually is.
   */
  @Get("ready")
  @ApiOperation({ summary: "Readiness probe" })
  @ApiOkResponse({ description: "Process is ready to serve traffic." })
  getReady(): HealthCheckResult {
    return {
      status: "ok",
      service: "dashboard-api",
      timestamp: new Date().toISOString(),
      checks: {},
      build: buildMetadata,
    };
  }
}
