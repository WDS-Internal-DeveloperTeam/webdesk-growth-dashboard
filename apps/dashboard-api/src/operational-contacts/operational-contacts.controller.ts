import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Query,
  Req,
  UseGuards,
} from "@nestjs/common";
import { ApiOperation, ApiTags } from "@nestjs/swagger";
import type { OperationalContactEntity } from "@webdesk/database";
import type { ApiSuccessResponse } from "@webdesk/shared-types";
import type { RequestWithCorrelationId } from "../common/correlation-id.middleware.js";
import { OriginCheckGuard } from "../auth/common/origin-check.guard.js";
import type { AuthenticatedRequest } from "../auth/session/session.guard.js";
import { SessionGuard } from "../auth/session/session.guard.js";
import { ZodValidationPipe } from "../common/zod-validation.pipe.js";
import { PermissionGuard } from "../authz/permission.guard.js";
import { RequirePermission } from "../authz/require-permission.decorator.js";
import {
  createContactSchema,
  escalationChainQuerySchema,
  listContactsQuerySchema,
  updateContactSchema,
  type CreateContactDto,
  type EscalationChainQueryDto,
  type ListContactsQueryDto,
  type UpdateContactDto,
} from "./operational-contacts.dto.js";
// eslint-disable-next-line @typescript-eslint/consistent-type-imports -- real (value) import: NestJS constructor injection needs the class reference at runtime, see google-auth.service.ts's note.
import { OperationalContactService } from "./operational-contact.service.js";

type ContactsRequest = AuthenticatedRequest & RequestWithCorrelationId;

/**
 * The operational-contact HTTP surface (brief §28) — same "prove the
 * framework" role every other Phase 1E controller has played. Reuses
 * `system_settings` with new, zero-seeded actions
 * (`contacts_view`/`contacts_configure`) — deny-by-default until a
 * separate, later authorization seeds real grants. See
 * docs/task-packages/phase-1e-operational-contacts.md §7. The
 * `escalation-chain` route is declared before `:id` — NestJS matches
 * routes in declaration order, so `:id` would otherwise swallow it.
 */
@ApiTags("operational-contacts")
@Controller("operational-contacts")
@UseGuards(SessionGuard)
export class OperationalContactsController {
  constructor(private readonly contactService: OperationalContactService) {}

  @Get()
  @UseGuards(PermissionGuard)
  @RequirePermission("system_settings", "contacts_view")
  @ApiOperation({ summary: "List operational contacts, optionally filtered by area/active status" })
  async list(
    @Query(new ZodValidationPipe(listContactsQuerySchema)) query: ListContactsQueryDto,
    @Req() req: ContactsRequest,
  ): Promise<ApiSuccessResponse<readonly OperationalContactEntity[]>> {
    const contacts = await this.contactService.list(query);
    return { success: true, data: contacts, correlationId: req.correlationId ?? "unknown" };
  }

  @Get("escalation-chain")
  @UseGuards(PermissionGuard)
  @RequirePermission("system_settings", "contacts_view")
  @ApiOperation({
    summary: "Resolve the ordered escalation chain for an area/severity (primary before backup)",
  })
  async escalationChain(
    @Query(new ZodValidationPipe(escalationChainQuerySchema)) query: EscalationChainQueryDto,
    @Req() req: ContactsRequest,
  ): Promise<ApiSuccessResponse<readonly OperationalContactEntity[]>> {
    const chain = await this.contactService.resolveEscalationChain(
      query.area,
      query.severity,
      query.atTime,
    );
    return { success: true, data: chain, correlationId: req.correlationId ?? "unknown" };
  }

  @Get(":id")
  @UseGuards(PermissionGuard)
  @RequirePermission("system_settings", "contacts_view")
  @ApiOperation({ summary: "Get a single operational contact by id" })
  async getById(
    @Param("id") id: string,
    @Req() req: ContactsRequest,
  ): Promise<ApiSuccessResponse<OperationalContactEntity>> {
    const contact = await this.contactService.findById(id);
    return { success: true, data: contact, correlationId: req.correlationId ?? "unknown" };
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @UseGuards(OriginCheckGuard, PermissionGuard)
  @RequirePermission("system_settings", "contacts_configure")
  @ApiOperation({ summary: "Create an operational contact" })
  async create(
    @Body(new ZodValidationPipe(createContactSchema)) body: CreateContactDto,
    @Req() req: ContactsRequest,
  ): Promise<ApiSuccessResponse<OperationalContactEntity>> {
    const contact = await this.contactService.create(body, req.authUser!.id);
    return { success: true, data: contact, correlationId: req.correlationId ?? "unknown" };
  }

  @Post(":id/update")
  @HttpCode(HttpStatus.OK)
  @UseGuards(OriginCheckGuard, PermissionGuard)
  @RequirePermission("system_settings", "contacts_configure")
  @ApiOperation({ summary: "Update an operational contact" })
  async update(
    @Param("id") id: string,
    @Body(new ZodValidationPipe(updateContactSchema)) body: UpdateContactDto,
    @Req() req: ContactsRequest,
  ): Promise<ApiSuccessResponse<OperationalContactEntity>> {
    const contact = await this.contactService.update(id, body, req.authUser!.id);
    return { success: true, data: contact, correlationId: req.correlationId ?? "unknown" };
  }

  @Post(":id/deactivate")
  @HttpCode(HttpStatus.OK)
  @UseGuards(OriginCheckGuard, PermissionGuard)
  @RequirePermission("system_settings", "contacts_configure")
  @ApiOperation({ summary: "Deactivate an operational contact" })
  async deactivate(
    @Param("id") id: string,
    @Req() req: ContactsRequest,
  ): Promise<ApiSuccessResponse<OperationalContactEntity>> {
    const contact = await this.contactService.deactivate(id, req.authUser!.id);
    return { success: true, data: contact, correlationId: req.correlationId ?? "unknown" };
  }
}
