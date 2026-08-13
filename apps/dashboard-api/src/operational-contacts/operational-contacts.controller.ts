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
// eslint-disable-next-line @typescript-eslint/consistent-type-imports -- real (value) import: NestJS constructor injection needs the class reference at runtime, see google-auth.service.ts's note.
import { AuthorizationService } from "../authz/authorization.service.js";
import {
  redactConfidentialFields,
  redactConfidentialFieldsFromList,
} from "../authz/confidential-field.util.js";
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
 * PII fields per `docs/security/threat-model-phase-1e-operational-infrastructure.md`'s
 * Information Disclosure finding — previously returned unfiltered to any caller with plain
 * `contacts_view`, unlike the `view_confidential`/`edit_confidential` precedent Phase 1D-expanded
 * set elsewhere in this codebase. Gated behind the existing generic `view_confidential` action on
 * the same `system_settings` module key every contacts route already uses (no dedicated
 * contacts-specific confidential action exists or is needed).
 */
const CONFIDENTIAL_CONTACT_FIELDS: readonly (keyof OperationalContactEntity)[] = [
  "contactName",
  "contactEmail",
  "contactPhone",
];

/**
 * `redactConfidentialFields`'s generic constraint (`T extends Record<string, unknown>`) doesn't
 * structurally match a plain interface without an index signature — `OperationalContactEntity`
 * has none, same as every other entity in `packages/database`, so TypeScript rejects passing it
 * directly. These wrappers contain the one necessary cast in one place rather than repeating it
 * at each of the three call sites below.
 */
function redactContact(
  record: OperationalContactEntity,
  canViewConfidential: boolean,
): OperationalContactEntity {
  return redactConfidentialFields(
    record as unknown as Record<string, unknown>,
    CONFIDENTIAL_CONTACT_FIELDS,
    canViewConfidential,
  ) as unknown as OperationalContactEntity;
}

function redactContacts(
  records: readonly OperationalContactEntity[],
  canViewConfidential: boolean,
): readonly OperationalContactEntity[] {
  return redactConfidentialFieldsFromList(
    records as unknown as Record<string, unknown>[],
    CONFIDENTIAL_CONTACT_FIELDS,
    canViewConfidential,
  ) as unknown as readonly OperationalContactEntity[];
}

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
  constructor(
    private readonly contactService: OperationalContactService,
    private readonly authorizationService: AuthorizationService,
  ) {}

  @Get()
  @UseGuards(PermissionGuard)
  @RequirePermission("system_settings", "contacts_view")
  @ApiOperation({ summary: "List operational contacts, optionally filtered by area/active status" })
  async list(
    @Query(new ZodValidationPipe(listContactsQuerySchema)) query: ListContactsQueryDto,
    @Req() req: ContactsRequest,
  ): Promise<ApiSuccessResponse<readonly OperationalContactEntity[]>> {
    const contacts = await this.contactService.list(query);
    const canViewConfidential = await this.authorizationService.canViewConfidential(
      req.authUser!.id,
      "system_settings",
    );
    const data = redactContacts(contacts, canViewConfidential);
    return { success: true, data, correlationId: req.correlationId ?? "unknown" };
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
    const canViewConfidential = await this.authorizationService.canViewConfidential(
      req.authUser!.id,
      "system_settings",
    );
    const data = redactContacts(chain, canViewConfidential);
    return { success: true, data, correlationId: req.correlationId ?? "unknown" };
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
    const canViewConfidential = await this.authorizationService.canViewConfidential(
      req.authUser!.id,
      "system_settings",
    );
    const data = redactContact(contact, canViewConfidential);
    return { success: true, data, correlationId: req.correlationId ?? "unknown" };
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
