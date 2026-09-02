/**
 * Application-neutral shared types. Phase 1A ships only cross-cutting
 * foundation shapes (results, pagination, API envelopes, health checks) —
 * no business-module types (Project, CaseStudy, etc.) until their owning
 * module is actually authorized and implemented.
 */

export type Result<T, E = Error> =
  { readonly ok: true; readonly value: T } | { readonly ok: false; readonly error: E };

export function ok<T>(value: T): Result<T, never> {
  return { ok: true, value };
}

export function err<E>(error: E): Result<never, E> {
  return { ok: false, error };
}

/** Base shape every persisted entity carries — id + audit timestamps. Not a Sequelize model; see packages/database. */
export interface BaseEntity {
  readonly id: string;
  readonly createdAt: string;
  readonly updatedAt: string;
}

export interface PaginationParams {
  readonly page: number;
  readonly pageSize: number;
}

export interface PaginatedResult<T> {
  readonly items: readonly T[];
  readonly page: number;
  readonly pageSize: number;
  readonly totalItems: number;
  readonly totalPages: number;
}

/** Standard API response envelope used by dashboard-api. */
export interface ApiSuccessResponse<T> {
  readonly success: true;
  readonly data: T;
  readonly correlationId: string;
}

/** A single field-level validation failure — mirrors `ZodValidationPipe`'s `issues` shape. */
export interface ApiErrorIssue {
  readonly path: string;
  readonly message: string;
}

export interface ApiErrorResponse {
  readonly success: false;
  readonly error: {
    readonly code: string;
    readonly message: string;
    /** Present only for a Zod validation failure — see `ZodValidationPipe`/`AllExceptionsFilter`. */
    readonly issues?: readonly ApiErrorIssue[];
  };
  readonly correlationId: string;
}

export type ApiResponse<T> = ApiSuccessResponse<T> | ApiErrorResponse;

export type HealthStatus = "ok" | "degraded" | "down";

/** Safe build/release metadata (Phase 1F brief §24) — see `@webdesk/configuration`'s `getBuildMetadata`. */
export interface HealthCheckBuildInfo {
  readonly version: string;
  readonly commitSha: string;
  readonly commitShaShort: string;
  readonly environment: string;
  readonly deploymentId: string;
  readonly processStartedAt: string;
}

export interface HealthCheckResult {
  readonly status: HealthStatus;
  readonly service: string;
  readonly timestamp: string;
  readonly checks?: Readonly<Record<string, HealthStatus>>;
  readonly build?: HealthCheckBuildInfo;
}

/**
 * Phase 1C — authentication and session shapes (ADR-0008, ADR-0009,
 * docs/contracts/google-workspace-auth-contract.md). Identity only: no
 * role/permission fields here — RBAC (ADR-0010) is a separate, later
 * authorization and layers on top of `AuthenticatedUser.id`, not this type.
 */
export type AuthMethod = "google_sso" | "emergency_local";

export interface AuthenticatedUser {
  readonly id: string;
  readonly email: string;
  readonly displayName: string;
  readonly authMethod: AuthMethod;
}

/** What `GET /auth/session` returns — never includes the raw session token itself. */
export interface SessionInfo {
  readonly user: AuthenticatedUser;
  readonly expiresAt: string;
  /** True once the emergency-local two-step (password, then TOTP) has fully completed. Always true for `google_sso`. */
  readonly mfaVerified: boolean;
}

/**
 * Every event knowledge/05-google-workspace-sso-and-local-admin.md's "Login
 * audit events" section requires. Narrow and login-scoped — not the
 * general-purpose ADR-0017 audit-log subsystem (Task 7, separate
 * authorization); this exists so Task 7 can later adopt/extend it, not so it
 * competes with it.
 */
export type AuthEventType =
  | "sso_login_succeeded"
  | "sso_login_rejected"
  | "session_exchange_redeemed"
  | "emergency_login_succeeded"
  | "emergency_login_failed"
  | "emergency_totp_failed"
  | "account_lockout_triggered"
  | "recovery_request_created"
  | "recovery_request_approved"
  | "recovery_request_denied"
  | "session_revoked"
  | "role_assigned"
  | "role_revoked"
  | "permission_granted"
  | "permission_revoked"
  | "privileged_access_denied"
  | "confidential_field_accessed"
  | "separation_of_duties_denied"
  | "super_admin_bootstrap"
  | "authorization_configuration_changed";

/** Reasons a session can end, per knowledge/05's "Logout / session revocation" requirement. */
export type SessionRevocationReason =
  "user-initiated" | "role-change" | "admin-forced" | "security-incident" | "expired";

/**
 * The `reason` query param `dashboard-web`'s `/auth/error` page renders, set by two independent
 * redirect sites (`dashboard-api`'s `GoogleAuthController#callback`, and `dashboard-web`'s own
 * `/auth/exchange` route). Shared here, not declared separately in each app, specifically so the
 * two apps can't silently drift on the value set — the exact failure mode that let a real backend
 * error get mislabeled `expired` until docs/implementation/session-exchange.md's error-masking fix.
 * `expired` means a genuinely expired/invalid state (OIDC transaction cookie, exchange code, or
 * the backend's `400`); `access_denied` means Google rejected the account; `error` is everything
 * else (a real backend/network failure).
 */
export type AuthErrorReason = "expired" | "access_denied" | "error";

/**
 * Phase 1D — RBAC (ADR-0010). API-facing shape for a role — deliberately
 * omits internal timestamps a client has no use for, same reasoning as
 * `AuthenticatedUser` never including a raw session token.
 */
export interface RoleSummary {
  readonly id: string;
  readonly key: string;
  readonly name: string;
}

/**
 * Phase 1D (expanded) — the 21-row permission-granting module ("permission
 * group") from `06_Roles_and_Permissions.md §3` — see
 * docs/implementation/phase-1d-permission-catalog.md §3 for why this is a
 * separate concept from `ModuleRegistrySummary` below.
 */
export interface ModuleSummary {
  readonly id: string;
  readonly key: string;
  readonly name: string;
}

/**
 * The 43 real dashboard feature modules from `02_Version_1_Module_Inclusion_Matrix.md`, each
 * mapped to the permission group that gates it. Extended by Phase 1F
 * (`docs/task-packages/phase-1f-application-shell.md`) with the full field set the application
 * shell's registry-driven navigation reads — the canonical module registry, not a duplicate.
 */
export interface ModuleRegistrySummary {
  readonly id: string;
  readonly key: string;
  readonly name: string;
  readonly permissionGroupKey: string;
  readonly displayName: string | null;
  readonly description: string | null;
  readonly navigationGroup: string;
  readonly navigationOrder: number;
  readonly route: string;
  readonly iconReference: string | null;
  readonly v1InclusionStatus: "included" | "deferred" | "future";
  readonly implementationStatus:
    | "not_started"
    | "foundation_only"
    | "in_development"
    | "ready_for_review"
    | "approved"
    | "available"
    | "deferred"
    | "blocked"
    | "deprecated";
  readonly viewPermissionAction: string;
  readonly actionPermissions: readonly string[] | null;
  readonly featureStatus: string | null;
  readonly documentationReference: string | null;
  readonly helpDocumentReference: string | null;
  readonly owner: string | null;
  readonly dependencies: readonly string[] | null;
  readonly confidentialityLevel: string | null;
  readonly badgeSupport: boolean;
  readonly deprecationReference: string | null;
  /** Whether the current caller may view this module, per their effective capabilities — set only
   *  by capability-aware endpoints (e.g. navigation); absent/undefined from unfiltered catalog reads. */
  readonly canView?: boolean;
}

/**
 * The 10 approved top-level navigation labels (`07_Low_Fidelity_Wireframes.md` §1). The single
 * source both `dashboard-web`'s navigation rendering and `validate-module-registry.ts` read —
 * changing a module's nav group without updating this list (or vice versa) is exactly the drift
 * the Phase 1F registry validation catches.
 */
export const APPROVED_NAVIGATION_GROUPS: readonly string[] = [
  "home",
  "projects",
  "pages",
  "libraries",
  "workflow",
  "scans",
  "technical",
  "releases",
  "help",
  "settings",
];

/**
 * The subset of `ProjectEntity` (`packages/database/src/projects/entities.ts`) the shell's
 * Project Switcher needs — deliberately not the full backend entity (description, confidentiality,
 * retention category, etc. stay server-side/module-page concerns, not header-chrome concerns).
 * `module-projects-foundation` made `GET /projects` real for the first time
 * (`docs/task-packages/module-projects-foundation.md` D7); this is that module's first
 * cross-boundary type, following this file's own header rule ("no business-module types until
 * their owning module is actually authorized and implemented" — now true for Projects).
 */
export interface ProjectSummary {
  readonly id: string;
  readonly publicId: string;
  readonly name: string;
  readonly status: "active" | "paused" | "archived";
}

/**
 * The read-only identity-lookup capability's own response shape (`GET /users`) — the narrowest
 * projection of `UserEntity` (`packages/database/src/auth/entities.ts`) a picker UI needs to let
 * someone search for and select an existing user. Deliberately excludes `accountStatus` (the
 * endpoint that returns this already filters to active-only) and `lastLoginAt`/timestamps — no
 * picker consumer needs them, and this file's own precedent (`Project` vs `ProjectSummary`) is to
 * project only what a given UI surface actually reads, not the full backend entity. This is the
 * first real user-lookup capability in this app — `Project.ownerUserId` and `ProjectTeamEntry`
 * previously had no name-resolution endpoint to call; this is that endpoint's frontend type.
 */
export interface UserSummary {
  readonly id: string;
  readonly displayName: string;
  readonly email: string;
}

/**
 * The Projects list page's own row shape — a second, wider projection of `ProjectEntity` alongside
 * `ProjectSummary` above, not a replacement for it (the switcher stays on the narrower type it
 * already validated against). Deliberately still not the full backend entity: `activePhaseId` and
 * `ownerUserId` are bare foreign keys, and the list page still doesn't resolve them to a display
 * name — a name-resolution endpoint now exists (`GET /users/:userId`, see `UserSummary` above),
 * but wiring it into this page's per-row rendering (N lookups for N rows) is separate, not-yet-done
 * scope, not a capability gap anymore. `retentionCategory`/`createdBy`/`updatedBy` are operational
 * metadata, not list-page content.
 */
export interface Project {
  readonly id: string;
  readonly publicId: string;
  readonly name: string;
  readonly description: string | null;
  readonly status: "active" | "paused" | "archived";
  readonly confidentiality: "public" | "internal" | "confidential" | "restricted";
  readonly createdAt: string;
  readonly updatedAt: string;
}

/**
 * The Projects detail page's own shape — unlike `Project` above, this legitimately carries
 * `activePhaseId`/`ownerUserId` again: the detail page also fetches the project's own roadmap
 * items in the same request pass, so `activePhaseId` can be resolved to a real name by
 * cross-referencing that array (no fabrication, no raw UUID shown). `ownerUserId`'s raw value is
 * used only to render a boolean "assigned"/"not assigned" state — the create/edit form (not this
 * type) is what actually resolves it to a display identity, via the same `GET /users/:userId`
 * endpoint `UserSummary` above documents; wiring an owner display into the read-only detail view
 * itself remains separate, not-yet-done scope. `retentionCategory`/`createdBy`/`updatedBy` remain
 * operational metadata, out of scope for either shape.
 */
export interface ProjectDetail extends Project {
  readonly activePhaseId: string | null;
  readonly ownerUserId: string | null;
}

/** A project's roadmap "phase" (`RoadmapItemEntity`) — `createdBy`/`updatedBy` omitted as operational metadata, matching `Project`'s own precedent. */
export interface RoadmapItem {
  readonly id: string;
  readonly name: string;
  readonly sequence: number;
  readonly status: "not_started" | "active" | "complete" | "skipped";
  readonly createdAt: string;
  readonly updatedAt: string;
}

export interface ProjectObjective {
  readonly id: string;
  readonly description: string;
  readonly status: "open" | "complete";
  readonly createdAt: string;
  readonly updatedAt: string;
}

export interface ProjectEnvironment {
  readonly id: string;
  readonly name: string;
  readonly url: string | null;
  readonly notes: string | null;
  readonly createdAt: string;
  readonly updatedAt: string;
}

export interface ProjectRepository {
  readonly id: string;
  readonly repoOwner: string;
  readonly repoName: string;
  readonly defaultBranch: string;
  readonly notes: string | null;
  readonly createdAt: string;
  readonly updatedAt: string;
}

/**
 * The project team roster's own entry (`ProjectUserEntity`, `packages/database/src/projects/entities.ts`).
 * `userId` is resolved to a display identity via `GET /users/:userId` — one lookup per roster
 * entry, the same N-lookups approach `ProjectDetail.ownerUserId`'s resolution already established
 * for the edit form, since no batch team-resolve endpoint exists (team rosters are small). `id` is
 * this entry's own row id, needed (not `userId`) to call `DELETE /projects/:projectId/team/:id`.
 * `addedBy` (who added this member) is operational metadata, omitted same as `Project`'s own
 * `createdBy`/`updatedBy`.
 */
export interface ProjectTeamEntry {
  readonly id: string;
  readonly userId: string;
  readonly addedAt: string;
}

/**
 * The 10 "primary record" types the Business Knowledge Center module carries
 * (`03_Detailed_Module_Specifications.md §3`), mirroring
 * `packages/database/src/business-knowledge/entities.ts`'s `BusinessKnowledgeRecordType` —
 * `module-business-knowledge-center.md` D5.
 */
export type BusinessKnowledgeRecordType =
  | "company_profile"
  | "persona_icp"
  | "marketing_profile"
  | "vto"
  | "service_taxonomy"
  | "engagement_model"
  | "approved_messaging"
  | "competitor"
  | "geographic_scope"
  | "strategic_priority";

/** Mirrors `BusinessKnowledgeRecordStatus` in the same backend entities file — doubles as both the
 *  lifecycle state and the confidentiality classification (no separate confidentiality field). */
export type BusinessKnowledgeRecordStatus =
  "mandatory" | "advisory" | "draft" | "deprecated" | "restricted";

/**
 * A business knowledge record, following this file's own header rule ("no business-module types
 * until their owning module is actually authorized and implemented" — now true for Business
 * Knowledge Center). `content`/`notes` are genuinely OPTIONAL, not just nullable: the backend's
 * confidential-field redaction (`apps/dashboard-api/src/business-knowledge/business-knowledge-records.controller.ts`)
 * deletes both keys outright from the JSON response for a `restricted` record when the caller
 * lacks `view_confidential` — currently every caller, since that action is zero-seeded for every
 * role. `createdBy`/`updatedBy` are operational metadata, omitted same as `Project`'s own
 * precedent.
 */
export interface BusinessKnowledgeRecord {
  readonly id: string;
  readonly recordType: BusinessKnowledgeRecordType;
  readonly title: string;
  /** `undefined` — the key is genuinely absent — means redacted (a `restricted` record, no
   *  `view_confidential` grant). `null` means a real, visible record that was created or edited
   *  with no typed content at all (`business-knowledge-center-rich-content-attachments.md` §5 —
   *  migration `00049` made this column nullable, since a record's real content may live entirely
   *  in its attachments). A non-empty string is rich HTML from the editor, already sanitized
   *  server-side. */
  readonly content?: string | null;
  readonly status: BusinessKnowledgeRecordStatus;
  readonly notes?: string | null;
  readonly createdAt: string;
  readonly updatedAt: string;
}

/** The interim, honest file-scan-status vocabulary from
 *  `knowledge/08-vercel-blob-and-file-handling.md` — malware scanning is deferred project-wide, so
 *  none of these values ever asserts a file is malware-free. */
export type BusinessKnowledgeAttachmentScanStatus =
  | "uploaded"
  | "validation_passed"
  | "validation_failed"
  | "scan_not_configured"
  | "externally_approved"
  | "rejected"
  | "deleted";

/**
 * A file attached to a business knowledge record
 * (`business-knowledge-center-rich-content-attachments.md`). `extractedPreviewHtml` is a cached,
 * already-sanitized DOCX/XLSX/Markdown→HTML conversion — `null` for a PDF (rendered as the real
 * file via the content-proxy route, not extracted, task package D4) or any other format with no
 * generated preview. There is no `url` field — a private attachment is never a direct link;
 * `dashboard-web` always reads it through
 * `GET /business-knowledge/records/:id/attachments/:attachmentId/content`, the same
 * cookie-authenticated route every other resource in this app uses.
 */
export interface BusinessKnowledgeAttachment {
  readonly id: string;
  readonly recordId: string;
  readonly filename: string;
  readonly mimeType: string;
  readonly sizeBytes: number;
  readonly checksumSha256: string;
  readonly extractedPreviewHtml: string | null;
  readonly scanStatus: BusinessKnowledgeAttachmentScanStatus;
  readonly uploadedBy: string | null;
  readonly createdAt: string;
}

export type ServiceConfidentiality = "public" | "internal" | "restricted";
export type ServicePublicationStatus = "draft" | "published" | "unpublished";
export type ServiceApprovalStatus =
  | "draft"
  | "submitted"
  | "under_review"
  | "approved"
  | "revision_requested"
  | "rejected"
  | "superseded"
  | "archived";

/**
 * The Service Library list page's own row shape, matching what `GET /service-library/services`
 * actually returns — the bare entity, without `deliverableIds`/`platformIds`/`engagementModelIds`
 * (those are only present on the enriched detail/write-response shape, `ServiceDetail` below,
 * since resolving them per row would be an N+1 query the list endpoint deliberately doesn't pay
 * for — `module-service-library`'s own precedent, matching `Project` vs `ProjectDetail`).
 * `internalDescription` may be absent (not merely `null`) when the record is `confidentiality:
 * "restricted"` and the caller lacks `view_confidential` — an absent key is the redaction signal,
 * the same convention `BusinessKnowledgeRecord.content`/`.notes` already establish, not a
 * placeholder for "genuinely empty."
 */
export interface Service {
  readonly id: string;
  readonly publicId: string;
  readonly canonicalName: string;
  readonly publicName: string | null;
  readonly categoryId: string;
  readonly parentServiceId: string | null;
  readonly shortPublicDescription: string | null;
  readonly audience: string | null;
  readonly problems: string | null;
  readonly capabilities: string | null;
  readonly outcomes: string | null;
  readonly exclusions: string | null;
  readonly internalDescription?: string | null;
  readonly icpIds: readonly string[];
  readonly relatedPageIds: readonly string[];
  readonly relatedCaseStudyIds: readonly string[];
  readonly confidentiality: ServiceConfidentiality;
  readonly publicationStatus: ServicePublicationStatus;
  readonly approvalStatus: ServiceApprovalStatus;
  readonly ownerUserId: string | null;
  readonly createdAt: string;
  readonly updatedAt: string;
}

/** The detail page's and every write response's own shape — `create()`/`update()`/`findById()`
 *  all return this enriched form (`ServiceWithRelationshipIds` on the backend), unlike the plain
 *  list-endpoint rows above (`module-service-library`'s own code-review fix — a client couldn't
 *  otherwise confirm what a create/update request actually linked without an extra `GET`). */
export interface ServiceDetail extends Service {
  readonly deliverableIds: readonly string[];
  readonly platformIds: readonly string[];
  readonly engagementModelIds: readonly string[];
}

/** One of the four read-only dimension tables (`GET /service-library/categories`) — `deliverables`/
 *  `platforms_technologies`/`engagement_models` below share the same base shape; `categories` alone
 *  self-nests via `parentCategoryId`. Authoring these is out of scope for V1 (read-only, per
 *  `docs/task-packages/module-service-library.md` §3/§7) — this app only ever lists them to
 *  populate a picker's option set. */
export interface ServiceCategory {
  readonly id: string;
  readonly publicId: string;
  readonly name: string;
  readonly parentCategoryId: string | null;
}

export interface Deliverable {
  readonly id: string;
  readonly publicId: string;
  readonly name: string;
}

export interface PlatformTechnology {
  readonly id: string;
  readonly publicId: string;
  readonly name: string;
}

export interface EngagementModel {
  readonly id: string;
  readonly publicId: string;
  readonly name: string;
}

export type PersonaApprovalStatus =
  | "draft"
  | "submitted"
  | "under_review"
  | "approved"
  | "revision_requested"
  | "rejected"
  | "superseded"
  | "archived";

/**
 * The Persona Library module's single primary entity — every route (`list`/`findOne`/`create`/
 * `update`/`changeStatus`) returns this exact shape (no `PersonaDetail` split like `Service`'s own
 * `Service`/`ServiceDetail` pair — Persona Library has no sub-resource dimension tables to omit
 * from the list view, so there's no N+1 concern motivating a narrower list-row projection).
 * `relatedServiceIds` is a real, existence-validated identifier array (against the `services`
 * table) — unlike Service Library's own `icpIds`/`relatedPageIds`/`relatedCaseStudyIds`, which stay
 * genuinely unvalidated because their target modules don't exist yet.
 */
export interface Persona {
  readonly id: string;
  readonly publicId: string;
  readonly name: string;
  readonly buyerType: string | null;
  readonly companySize: string | null;
  readonly roles: readonly string[];
  readonly industries: readonly string[];
  readonly geography: string | null;
  readonly goals: string | null;
  readonly pains: string | null;
  readonly triggers: string | null;
  readonly objections: string | null;
  readonly decisionCriteria: string | null;
  readonly relatedServiceIds: readonly string[];
  readonly badFitSignals: string | null;
  readonly messagingTrack: string | null;
  readonly ctaPreferences: string | null;
  readonly approvalStatus: PersonaApprovalStatus;
  readonly version: number;
  readonly createdBy: string | null;
  readonly updatedBy: string | null;
  readonly createdAt: string;
  readonly updatedAt: string;
}

export type ProofClaimVerificationStatus = "unverified" | "pending" | "verified";

// Structurally identical to PersonaApprovalStatus/ServiceApprovalStatus (the shared 8-value
// artifact-approval workflow, D3) — reused as its own named type rather than an alias so this
// module's own `-query.ts` file can still narrow to it directly without a cast, matching
// PersonaApprovalStatus's own precedent.
export type ProofClaimApprovalStatus =
  | "draft"
  | "submitted"
  | "under_review"
  | "approved"
  | "revision_requested"
  | "rejected"
  | "superseded"
  | "archived";

/**
 * The Proof and Claims Library module's parent entity — every route (`list`/`findOne`/`create`/
 * `update`/`changeStatus`) returns this exact shape (no `ProofClaimDetail` split — like Persona,
 * unlike Service, this module has no sub-resource dimension tables to omit from the list view;
 * `claim_sources` is a genuine one-to-many child fetched separately via `ClaimSource` below, not
 * inlined here). `relatedServiceIds` is a real, existence-validated identifier array (against the
 * `services` table); `relatedCaseStudyIds`/`relatedPageIds` stay genuinely unvalidated — their
 * target modules (`case_study_studio`/`page_inventory`) don't exist yet, mirroring Service
 * Library's own precedent. No `version` field, unlike `Persona` — the canonical spec names none
 * for this module.
 */
export interface ProofClaim {
  readonly id: string;
  readonly publicId: string;
  readonly claim: string;
  readonly claimType: string | null;
  readonly beforeValue: string | null;
  readonly afterValue: string | null;
  readonly verificationStatus: ProofClaimVerificationStatus;
  readonly approvedWording: string | null;
  readonly restrictions: string | null;
  readonly expiryReviewDate: string | null;
  readonly relatedServiceIds: readonly string[];
  readonly relatedCaseStudyIds: readonly string[];
  readonly relatedPageIds: readonly string[];
  readonly approvalStatus: ProofClaimApprovalStatus;
  readonly createdBy: string | null;
  readonly updatedBy: string | null;
  readonly createdAt: string;
  readonly updatedAt: string;
}

/** A real one-to-many child of `ProofClaim` (`04_Data_Model_and_Ownership.md:119-120` names
 *  `claim_sources` as its own table, not a JSONB array on the parent) — fetched and managed via
 *  its own `/proof-and-claims-library/claims/:claimId/sources` sub-resource routes, the same
 *  shape as Projects' own roadmap-items/objectives/environments/repositories sub-resources. */
export interface ClaimSource {
  readonly id: string;
  readonly claimId: string;
  readonly source: string;
  readonly sourceUrl: string | null;
  readonly createdAt: string;
  readonly updatedAt: string;
}

/** Task package D5 — the spec's own 9 "Primary records," snake_case. Immutable across a record's
 *  own version chain (set once at creation; a real type change is a different record, not a new
 *  version of this one — never accepted through `update()`). */
export type WebsiteStrategyRecordType =
  | "navigation_plan"
  | "page_clusters"
  | "pillar_strategy"
  | "platform_strategy"
  | "industry_strategy"
  | "location_strategy"
  | "conversion_plan"
  | "search_plan"
  | "internal_link_plan";

// Structurally identical to PersonaApprovalStatus/ServiceApprovalStatus/ProofClaimApprovalStatus
// (the shared 8-value artifact-approval workflow, D6) — reused as its own named type rather than
// an alias so this module's own `-query.ts` file can still narrow to it directly without a cast,
// matching PersonaApprovalStatus's/ProofClaimApprovalStatus's own precedent.
export type WebsiteStrategyApprovalStatus =
  | "draft"
  | "submitted"
  | "under_review"
  | "approved"
  | "revision_requested"
  | "rejected"
  | "superseded"
  | "archived";

/**
 * One row per VERSION, not one row per record — unlike every other module built so far (Business
 * Knowledge Center, Service Library, Persona Library, Proof and Claims Library — each one mutable
 * row per record, no real history), this module implements REAL version history
 * (`packages/database/src/website-strategy-center/entities.ts`'s own doc comment). `id` is unique
 * per physical row/version; `recordId` is the stable logical-record identity shared by every
 * version of the same record (the history/comparison key, and the identifier every `dashboard-web`
 * route/link uses — never `id`, which changes across a fork). `publicId` is likewise stable across
 * every version. `isCurrent` is true for exactly one row per `recordId` at any time. No separate
 * `WebsiteStrategyRecordDetail` shape exists — every version's own row (from `GET
 * .../:recordId/versions`) already carries full `title`/`content`/`notes`, so there is nothing a
 * detail fetch would need to enrich beyond what `GET .../:recordId` (the current version alone)
 * already returns.
 */
export interface WebsiteStrategyRecord {
  readonly id: string;
  readonly recordId: string;
  readonly publicId: string;
  readonly recordType: WebsiteStrategyRecordType;
  readonly versionNumber: number;
  readonly isCurrent: boolean;
  readonly title: string;
  readonly content: string | null;
  readonly notes: string | null;
  readonly approvalStatus: WebsiteStrategyApprovalStatus;
  readonly createdBy: string | null;
  readonly updatedBy: string | null;
  readonly createdAt: string;
  readonly updatedAt: string;
}

export type PageExistingOrProposed = "existing" | "proposed";
export type PageIndexStatus = "index" | "noindex" | "unknown";

// Structurally identical to PersonaApprovalStatus/ServiceApprovalStatus/ProofClaimApprovalStatus/
// WebsiteStrategyApprovalStatus (the shared 8-value artifact-approval workflow, task package D8) —
// reused as its own named type rather than an alias so this module's own `-query.ts` file can
// still narrow to it directly without a cast, matching every sibling module's own precedent.
export type PageWorkflowStage =
  | "draft"
  | "submitted"
  | "under_review"
  | "approved"
  | "revision_requested"
  | "rejected"
  | "superseded"
  | "archived";

/** Named only in `canonical-inputs/Recommended_Module_Roadmap.md` row 7, absent from the spec/
 *  data-model/wireframe/registry description — a nullable, purely descriptive field with no
 *  governance/workflow attached (task package D9). */
export type PageClassification =
  "keep" | "optimize" | "restructure" | "redesign" | "rebuild" | "consolidate";

/**
 * The Page Inventory module's parent entity — unlike every prior content-library module (Business
 * Knowledge Center, Service/Persona/Proof-and-Claims Library, Website Strategy Center — all
 * organization-wide), `pages` IS project-scoped (`projectId`, task package D2). `roadmapPhaseId` is
 * existence-validated against the same project's own `roadmap_items`; `template`/`targetKeyword`/
 * `wordpressPageId`/`wordpressPostId` are all plain unvalidated fields — Page Template Library and
 * Keyword & Entity Library don't exist yet, and no WordPress integration adapter exists yet either.
 * `repositoryFiles` is plain, unsanitized long text (never rendered as HTML) — deliberately NOT a
 * rich-text field despite the 2026-08-22 standing rich-text rule, since it's almost certainly a list
 * of file paths/references, not narrative prose (see `PageForm`'s own doc comment for the full
 * reasoning).
 */
export interface Page {
  readonly id: string;
  readonly projectId: string;
  readonly publicId: string;
  readonly pageName: string;
  readonly pageType: string | null;
  readonly existingOrProposed: PageExistingOrProposed;
  readonly indexStatus: PageIndexStatus;
  readonly template: string | null;
  readonly roadmapPhaseId: string | null;
  readonly workflowStage: PageWorkflowStage;
  /** The page DELIVERY lifecycle (migration `00068`) — a separate axis from `workflowStage`
   *  above, which governs this page RECORD's own approval. Owned by the Page Workspace module. */
  readonly lifecycleStage: PageLifecycleStage;
  /** Stamped on entering `paused`/`blocked` so those states are resumable inside an allowlist. */
  readonly lifecyclePreviousStage: PageLifecycleStage | null;
  readonly targetKeyword: string | null;
  readonly designVersion: string | null;
  readonly repositoryFiles: string | null;
  readonly wordpressPageId: string | null;
  readonly wordpressPostId: string | null;
  readonly lastScanAt: string | null;
  readonly lastDeploymentAt: string | null;
  readonly classification: PageClassification | null;
  readonly createdBy: string | null;
  readonly updatedBy: string | null;
  readonly createdAt: string;
  readonly updatedAt: string;
}

/** A real one-to-many child of `Page` — one page can have multiple URLs (locale variants, legacy
 *  redirects), each carrying `isCanonical`. Fetched and managed via its own
 *  `/page-inventory/projects/:projectId/pages/:pageId/urls` sub-resource routes, the same shape as
 *  Projects'/Proof and Claims Library's own sub-resource pattern. `PageEntity` itself carries no
 *  `url` field at all — there is no join, so the Page Inventory list page never renders a URL
 *  column (the smallest honest reading of what `GET .../pages` actually returns). */
export interface PageUrl {
  readonly id: string;
  readonly pageId: string;
  readonly projectId: string;
  readonly url: string;
  readonly isCanonical: boolean;
  readonly createdAt: string;
  readonly updatedAt: string;
}

export type KeywordConfidence = "low" | "medium" | "high";

// Structurally identical to PageWorkflowStage/PersonaApprovalStatus/ServiceApprovalStatus/
// ProofClaimApprovalStatus/WebsiteStrategyApprovalStatus (the shared 8-value artifact-approval
// workflow, task package D9) — reused as its own named type rather than an alias so this module's
// own `-query.ts` file can still narrow to it directly without a cast, matching every sibling
// module's own precedent. Applies only to `Keyword` (the primary record) — `EntityRecord` and both
// join types carry no approval status of their own (task package D3/D9).
export type KeywordApprovalStatus =
  | "draft"
  | "submitted"
  | "under_review"
  | "approved"
  | "revision_requested"
  | "rejected"
  | "superseded"
  | "archived";

/**
 * The Keyword & Entity Library module's primary record (module #8) — project-scoped (task package
 * D2), unlike every content-library module before Page Inventory. `keywordType`/`intent`/
 * `funnelStage`/`country`/`source` are all plain free text — the spec names these as fields but
 * gives no discrete value list for any of them (task package D6). `searchVolume`/`difficultyScore`
 * are "metrics" (task package D7) — the two most standard SEO keyword metrics, since the spec
 * names no exhaustive metric list. `cannibalizationNotes` is rich text (`RichTextEditor`), per the
 * 2026-08-22 standing rule — sanitized server-side before storage
 * (`KeywordsService.create()`/`update()`) and again at render time via `SanitizedRichText`.
 */
export interface Keyword {
  readonly id: string;
  readonly projectId: string;
  readonly publicId: string;
  readonly queryText: string;
  readonly keywordType: string | null;
  readonly intent: string | null;
  readonly funnelStage: string | null;
  readonly country: string | null;
  readonly searchVolume: number | null;
  readonly difficultyScore: number | null;
  readonly source: string | null;
  readonly researchDate: string | null;
  readonly cannibalizationNotes: string | null;
  readonly confidence: KeywordConfidence | null;
  readonly approvalStatus: KeywordApprovalStatus;
  readonly createdBy: string | null;
  readonly updatedBy: string | null;
  readonly createdAt: string;
  readonly updatedAt: string;
}

/**
 * Lightweight, project-scoped reference records, not full-lifecycle artifacts (task package D3) —
 * `entityType` is free text (e.g. "Person", "Organization", "Place", "Concept", "Brand"), no enum
 * invented since the spec names no discrete taxonomy. No `approvalStatus` of their own, mirroring
 * Proof and Claims Library's `ClaimSource` sub-resource's own identical precedent. Named
 * `EntityRecord`, not `Entity`, to match the backend's own `EntityRecordEntity` naming and avoid
 * colliding with any other `Entity`-suffixed type in this file. `description` is rich text
 * (`RichTextEditor`), per the 2026-08-22 standing rule — same sanitization pairing as `Keyword`'s
 * own `cannibalizationNotes`.
 */
export interface EntityRecord {
  readonly id: string;
  readonly projectId: string;
  readonly publicId: string;
  readonly name: string;
  readonly entityType: string | null;
  readonly description: string | null;
  readonly createdBy: string | null;
  readonly updatedBy: string | null;
  readonly createdAt: string;
  readonly updatedAt: string;
}

/**
 * A real many-to-many join between `Keyword` and `EntityRecord` — a pure join row with no
 * independent meaning once either parent is gone (`onDelete: "CASCADE"` on both FKs, migration
 * `00060`). No `updatedAt` — the row is either created or removed, never edited in place. Fetched
 * and managed via its own `/keyword-and-entity-library/projects/:projectId/keywords/:keywordId/
 * entity-relationships` sub-resource routes, the same shape as `PageUrl`'s own sub-resource
 * pattern.
 */
export interface KeywordEntityRelationship {
  readonly id: string;
  readonly keywordId: string;
  readonly entityId: string;
  readonly createdBy: string | null;
  readonly createdAt: string;
}

/**
 * A real join between `Keyword` and Page Inventory's own `Page` — `pageId` is existence-and-
 * same-project validated at the service layer (task package D1), via `PagesService.existsInProject()`.
 * No `updatedAt` — the row is either created or removed, never edited in place; `assignmentNote` is
 * carried on create only. Fetched and managed via its own `/keyword-and-entity-library/projects/
 * :projectId/keywords/:keywordId/page-assignments` sub-resource routes.
 */
export interface PageKeywordAssignment {
  readonly id: string;
  readonly keywordId: string;
  readonly pageId: string;
  readonly assignmentNote: string | null;
  readonly createdBy: string | null;
  readonly createdAt: string;
}

export type InternalLinkPriority = "low" | "medium" | "high";

/**
 * A genuinely bespoke, 4-state workflow (task package D1) — the first bespoke workflow vocabulary
 * in this codebase; every prior module (Service/Persona/Proof-and-Claims/Website-Strategy-Center/
 * Page-Inventory/Keyword-and-Entity-Library) reuses the identical 8-value generic artifact
 * lifecycle. NOT structurally identical to `ArtifactApprovalStatus` — do not reuse that shared
 * vocabulary/badge map for this module. See `apps/dashboard-api/src/internal-linking-library/
 * internal-links.service.ts`'s own `TRANSITIONS` table for the exact allowed transitions (no
 * terminal state — every state has at least one valid outbound transition).
 */
export type InternalLinkStatus = "proposed" | "approved" | "implemented" | "verified";

/**
 * The Internal Linking Library module's parent (and only) entity — a single project-scoped table,
 * no sub-resource/join tables (task package D3): a link IS the relationship (source page -> target
 * page), it has no independent sub-resources of its own. `relationship`/`anchor`/`linkType`/
 * `detector` are all plain free text (task package D5). `context` is rich text (`RichTextEditor`),
 * per the 2026-08-22 standing rule — sanitized server-side before storage
 * (`InternalLinksService.create()`/`update()`) and again at render time via `SanitizedRichText`.
 * `sourcePageId`/`targetPageId` are existence-and-same-project validated FKs into Page Inventory's
 * own `pages` table (task package D4) — a link may never have `sourcePageId === targetPageId`.
 * `assignedApproverUserId` is a nullable, existence-validated FK into `users` (task package D7).
 * `relatedStrategyRecordId` is a plain, UNVALIDATED uuid-shaped string — no real FK exists into
 * `website_strategy_records` (task package D8). `implementedAt`/`verifiedAt` are server-stamped
 * only, and never overwritten once first set.
 */
export interface InternalLink {
  readonly id: string;
  readonly projectId: string;
  readonly publicId: string;
  readonly sourcePageId: string;
  readonly targetPageId: string;
  readonly relationship: string | null;
  readonly anchor: string | null;
  readonly context: string | null;
  readonly linkType: string | null;
  readonly priority: InternalLinkPriority | null;
  readonly status: InternalLinkStatus;
  readonly detector: string | null;
  readonly assignedApproverUserId: string | null;
  readonly relatedStrategyRecordId: string | null;
  readonly implementedAt: string | null;
  readonly verifiedAt: string | null;
  readonly createdBy: string | null;
  readonly updatedBy: string | null;
  readonly createdAt: string;
  readonly updatedAt: string;
}

// Structurally identical to PersonaApprovalStatus/ServiceApprovalStatus/ProofClaimApprovalStatus/
// WebsiteStrategyApprovalStatus/KeywordApprovalStatus (the shared 8-value artifact-approval
// workflow, task package D4) — reused as its own named type rather than an alias so this module's
// own `-query.ts` file can still narrow to it directly without a cast, matching every sibling
// module's own precedent.
export type ContentTemplateApprovalStatus =
  | "draft"
  | "submitted"
  | "under_review"
  | "approved"
  | "revision_requested"
  | "rejected"
  | "superseded"
  | "archived";

/**
 * The Content Template Library module's single primary entity (module #10) — organization-wide,
 * not project-scoped (task package D9), single table, no sub-resources. `requiredSections`/
 * `optionalSections` are nullable free-text arrays (task package D7) — guidance labels, not FK
 * references, and genuinely nullable at the database layer (unlike Persona Library's own
 * NOT-NULL-default-`[]` array columns). `purpose`/`proofRules`/`seoAeoGeoRequirements`/`schema`/
 * `ctaRules`/`contentDepthGuidance` are rich text (`RichTextEditor`), per the 2026-08-22 standing
 * rule — sanitized server-side before storage (`ContentTemplatesService.create()`/`update()`) and
 * again at render time via `SanitizedRichText`. `isPublished`/`publishedAt` are the first real
 * publish/unpublish mechanism in this codebase (task package D1) — orthogonal to `approvalStatus`
 * (task package D2): `publish()` requires `approvalStatus === "approved"`, but `isPublished` is
 * NOT cleared by a later status transition (D3 — no automatic unpublish) — a template that was
 * `approved` and published when it moved to `archived`/`superseded` stays `isPublished: true`
 * indefinitely (code-review finding: a prior version of this comment incorrectly claimed a
 * template is "never published while in any non-`approved` status," which this exact,
 * intentional case violates). `publishedAt` is server-stamped once on the first successful
 * publish and never cleared by `unpublish()`.
 */
export interface ContentTemplate {
  readonly id: string;
  readonly publicId: string;
  readonly pageType: string;
  readonly purpose: string | null;
  readonly requiredSections: readonly string[] | null;
  readonly optionalSections: readonly string[] | null;
  readonly proofRules: string | null;
  readonly seoAeoGeoRequirements: string | null;
  readonly schema: string | null;
  readonly ctaRules: string | null;
  readonly contentDepthGuidance: string | null;
  readonly approvalStatus: ContentTemplateApprovalStatus;
  readonly version: number;
  readonly isPublished: boolean;
  readonly publishedAt: string | null;
  readonly createdBy: string | null;
  readonly updatedBy: string | null;
  readonly createdAt: string;
  readonly updatedAt: string;
}

// Structurally identical to ContentTemplateApprovalStatus/PersonaApprovalStatus/
// ServiceApprovalStatus/ProofClaimApprovalStatus/WebsiteStrategyApprovalStatus/KeywordApprovalStatus
// (the shared 8-value artifact-approval workflow) — reused verbatim (D4,
// `docs/implementation/module-brand-library.md`) as its own named type rather than an alias so this
// module's own `-query.ts` file can still narrow to it directly without a cast, matching every
// sibling module's own precedent.
export type BrandLibraryApprovalStatus =
  | "draft"
  | "submitted"
  | "under_review"
  | "approved"
  | "revision_requested"
  | "rejected"
  | "superseded"
  | "archived";

/** Mirrors `packages/database/src/brand-library/entities.ts`'s own discriminator-column shape (D1)
 *  — one table, 9 real asset/guidance kinds named by `03_Detailed_Module_Specifications.md §10`.
 *  `deprecated` is modeled as an `approvalStatus` value, not a member here (D3). */
export type BrandLibraryRecordType =
  | "logo"
  | "color"
  | "typography"
  | "photography"
  | "illustration"
  | "icon_rule"
  | "tone"
  | "visual_personality"
  | "dos_dont";

/**
 * The Brand Library module's single primary entity (module #13) — organization-wide, not
 * project-scoped (D1), single table, no sub-resources. `fileReference` is a plain nullable URL
 * string, validated as a safe http(s) URL at the DTO layer only (D2) — rendered as a real link only
 * when `isSafeHttpUrl()` confirms it client-side too, mirroring `ProjectEnvironment.url`'s own
 * guard. `description`/`usageNotes` are rich text (`RichTextEditor`), per the 2026-08-22 standing
 * rule — sanitized server-side before storage (`BrandLibraryService.create()`/`update()`) and again
 * at render time via `SanitizedRichText`. `isPublished`/`publishedAt` mirror Content Template
 * Library's own publish/unpublish mechanism exactly (D5) — orthogonal to `approvalStatus`:
 * `publish()` requires `approvalStatus === "approved"`, but `isPublished` is NOT cleared by a later
 * status transition — a record that was `approved` and published when it moved to
 * `archived`/`superseded` stays `isPublished: true` indefinitely. `publishedAt` is server-stamped
 * once on the first successful publish and never cleared by `unpublish()`.
 */
export interface BrandLibraryRecord {
  readonly id: string;
  readonly publicId: string;
  readonly recordType: BrandLibraryRecordType;
  readonly title: string;
  readonly description: string | null;
  readonly fileReference: string | null;
  readonly usageNotes: string | null;
  readonly approvalStatus: BrandLibraryApprovalStatus;
  readonly version: number;
  readonly isPublished: boolean;
  readonly publishedAt: string | null;
  readonly createdBy: string | null;
  readonly updatedBy: string | null;
  readonly createdAt: string;
  readonly updatedAt: string;
}

// Structurally identical to BrandLibraryApprovalStatus/ContentTemplateApprovalStatus/
// PersonaApprovalStatus/ServiceApprovalStatus/ProofClaimApprovalStatus/
// WebsiteStrategyApprovalStatus/KeywordApprovalStatus (the shared 8-value artifact-approval
// workflow) — reused verbatim as its own named type, matching every sibling module's own
// precedent, rather than an alias, so this module's own `-query.ts` file can narrow to it
// directly without a cast.
export type DesignReferenceApprovalStatus =
  | "draft"
  | "submitted"
  | "under_review"
  | "approved"
  | "revision_requested"
  | "rejected"
  | "superseded"
  | "archived";

/**
 * The Design Reference Library module's single primary entity (module #14) — organization-wide,
 * not project-scoped, single table, no `recordType` discriminator (every record is the same shape
 * — one external design reference). `sourceUrl`/`screenshotUrl` are plain nullable URL strings,
 * validated as safe http(s) URLs at the DTO layer only, rendered as real links/an image only when
 * `isSafeHttpUrl()` confirms it client-side too, mirroring `BrandLibraryRecord.fileReference`'s own
 * guard. `likes`/`dislikes`/`motionNotes`/`accessibilityConcerns`/`performanceConcerns` are rich
 * text (`RichTextEditor`), sanitized server-side before storage and again at render time via
 * `SanitizedRichText`. `pageSectionType`/`desktopBehavior`/`mobileBehavior` are plain text, not rich
 * text. `tags` is a plain, unvalidated, non-nullable string array (defaulting to `[]`). `isPublished`/
 * `publishedAt` mirror Brand Library's own publish/unpublish mechanism exactly — orthogonal to
 * `approvalStatus`: `publish()` requires `approvalStatus === "approved"`, but `isPublished` is NOT
 * cleared by a later status transition. `publishedAt` is server-stamped once on the first successful
 * publish and never cleared by `unpublish()`.
 */
export interface DesignReferenceRecord {
  readonly id: string;
  readonly publicId: string;
  readonly title: string;
  readonly sourceUrl: string | null;
  readonly screenshotUrl: string | null;
  readonly pageSectionType: string | null;
  readonly likes: string | null;
  readonly dislikes: string | null;
  readonly desktopBehavior: string | null;
  readonly mobileBehavior: string | null;
  readonly motionNotes: string | null;
  readonly accessibilityConcerns: string | null;
  readonly performanceConcerns: string | null;
  readonly tags: readonly string[];
  readonly approvalStatus: DesignReferenceApprovalStatus;
  readonly version: number;
  readonly isPublished: boolean;
  readonly publishedAt: string | null;
  readonly createdBy: string | null;
  readonly updatedBy: string | null;
  readonly createdAt: string;
  readonly updatedAt: string;
}

/**
 * The Review and Approval Center module (module #11) — a cross-cutting engine that attaches to
 * records owned by OTHER modules via a polymorphic `(targetModuleKey, targetId)` reference (task
 * package D1, `docs/task-packages/module-review-and-approval-center.md`), not a content-record
 * library of its own. Organization-wide, not project-scoped (D7). Mirrors
 * `packages/database/src/review-and-approval-center/entities.ts` exactly — see that file for the
 * full field-level rationale (why `approve`/`approve_with_notes` share one `status` transition,
 * why `isPaused` is orthogonal to `status`, etc.).
 */

/** The 4-value workflow (task package D2) — `approved`/`rejected` terminal, `submitted`/
 *  `revision_requested` open. Deliberately NOT `ArtifactApprovalStatus` (the 8-value workflow
 *  Service/Persona/Proof-and-Claims/Website Strategy/Content Template Library all share) — this
 *  module's own workflow is a genuinely different, smaller vocabulary. */
export type ReviewStatus = "submitted" | "revision_requested" | "approved" | "rejected";

/** The full action vocabulary a `ReviewDecision` row may record — a strict superset of the 4
 *  approval-shaped `POST .../:id/decide` actions, plus the 3 process-management actions
 *  (`pause`/`resume`/`delegate`) that never change `status`. */
export type ReviewDecisionAction =
  | "approve"
  | "approve_with_notes"
  | "request_revision"
  | "reject"
  | "pause"
  | "resume"
  | "delegate";

/** The primary workflow record. `content`/`notes`-shaped fields don't exist here — this module
 *  attaches to another record's own content via `targetModuleKey`/`targetId`, it doesn't hold
 *  content of its own. `versionALabel`/`versionBLabel` are opaque, human-supplied labels (e.g.
 *  "v3" vs. "v4"), not a real diff — this module has no generic cross-module diffing capability. */
export interface Review {
  readonly id: string;
  readonly targetModuleKey: string;
  readonly targetId: string;
  readonly targetLabel: string | null;
  readonly status: ReviewStatus;
  /** Orthogonal to `status` — advisory only, toggled by pause/resume, never a blocking gate on
   *  other transitions. */
  readonly isPaused: boolean;
  readonly submittedByUserId: string;
  readonly assignedToUserId: string | null;
  /** Stamped on every `decide()` call — records the MOST RECENT decision, overwritten on each
   *  successive call. */
  readonly decidedByUserId: string | null;
  readonly decidedAt: string | null;
  readonly versionALabel: string | null;
  readonly versionBLabel: string | null;
  readonly createdAt: string;
  readonly updatedAt: string;
}

/** A comment thread entry. `body` is real, server-sanitized HTML from `dashboard-web`'s
 *  `RichTextEditor` — rendered exclusively via the shared `SanitizedRichText` component, matching
 *  every sibling module's own rich-text field. */
export interface ReviewComment {
  readonly id: string;
  readonly reviewId: string;
  readonly authorUserId: string;
  readonly body: string;
  readonly createdAt: string;
}

/** An append-only, queryable local action-history row — this module's own history, distinct from
 *  the real, DB-trigger-enforced `audit_events` table, which separately receives a copy of every
 *  genuine approval-shaped decision. */
export interface ReviewDecision {
  readonly id: string;
  readonly reviewId: string;
  readonly action: ReviewDecisionAction;
  readonly actorUserId: string;
  readonly notes: string | null;
  /** Set only when `action === "delegate"`. */
  readonly delegatedToUserId: string | null;
  readonly decidedAt: string;
}

/**
 * Page Workspace (module #12). Mirrors `packages/database/src/page-workspace/entities.ts`.
 *
 * `content`/`notes` are typed as nullable rather than optional: unlike Business Knowledge
 * Center's confidential-field redaction, this module has no redaction mechanism (the module
 * registry's own seeded `confidentialityLevel` for `page_workspace` is `null`), so the keys are
 * always present.
 */
export type PageArtifactType =
  | "overview"
  | "live_snapshot"
  | "audit"
  | "ideal_structure"
  | "search"
  | "content"
  | "creative_direction"
  | "ux_wireframe"
  | "ui_specification"
  | "component_map"
  | "implementation"
  | "code_review"
  | "security"
  | "qa"
  | "deployment";

/** The shared 8-value generic artifact lifecycle (`05_Workflow_State_Machines.md §2`). */
export type PageArtifactVersionStatus =
  | "draft"
  | "submitted"
  | "under_review"
  | "approved"
  | "revision_requested"
  | "rejected"
  | "superseded"
  | "archived";

/** The 22-state page DELIVERY lifecycle (`05_Workflow_State_Machines.md §3`) — a separate axis
 *  from `PageWorkflowStage`, which governs the page RECORD's own approval. */
export type PageLifecycleStage =
  | "proposed"
  | "approved_for_planning"
  | "in_strategy"
  | "search_approved"
  | "content_approved"
  | "design_approved"
  | "ready_for_development"
  | "in_development"
  | "code_review"
  | "security_qa"
  | "ready_for_staging"
  | "staging_deployed"
  | "staging_approved"
  | "production_approved"
  | "production_deployed"
  | "verified"
  | "revision_requested"
  | "blocked"
  | "paused"
  | "failed"
  | "rolled_back"
  | "archived";

export interface PageArtifact {
  readonly id: string;
  readonly pageId: string;
  readonly projectId: string;
  readonly artifactType: PageArtifactType;
  readonly currentVersionId: string | null;
  readonly createdBy: string | null;
  readonly updatedBy: string | null;
  readonly createdAt: string;
  readonly updatedAt: string;
}

export interface PageArtifactVersion {
  readonly id: string;
  readonly artifactId: string;
  readonly pageId: string;
  readonly projectId: string;
  readonly versionNumber: number;
  readonly status: PageArtifactVersionStatus;
  readonly content: string | null;
  readonly notes: string | null;
  readonly repository: string | null;
  readonly path: string | null;
  readonly branch: string | null;
  readonly commitSha: string | null;
  readonly contentChecksum: string | null;
  readonly reopenedReason: string | null;
  readonly reopenedFromVersionId: string | null;
  readonly approvedByUserId: string | null;
  readonly approvedAt: string | null;
  readonly createdBy: string | null;
  readonly updatedBy: string | null;
  readonly createdAt: string;
  readonly updatedAt: string;
}

/** Mirrors `packages/database/src/asset-library/entities.ts`'s `AssetVisibility` (module #15, D2)
 *  — a REAL enforcement axis, not a decorative label: a `restricted` asset has
 *  `fileReference`/`consentReference` redacted server-side for any caller lacking
 *  `view_confidential`. Same 3-value vocabulary as `Service.confidentiality`. */
export type AssetVisibility = "public" | "internal" | "restricted";

/** Mirrors `AssetScanStatus` — `not_configured` is the default and, today, the ONLY value any
 *  backend code path ever writes (D4); no malware scanner exists anywhere in this system, and
 *  nothing may claim a file is `clean`. The remaining values exist for a future scanner
 *  integration. Exposed here only because the list-page filter needs it. */
export type AssetScanStatus = "not_configured" | "pending" | "clean" | "infected" | "failed";

// Structurally identical to BrandLibraryApprovalStatus/ContentTemplateApprovalStatus/
// PersonaApprovalStatus/ServiceApprovalStatus/ProofClaimApprovalStatus/
// WebsiteStrategyApprovalStatus/KeywordApprovalStatus/DesignReferenceApprovalStatus (the shared
// 8-value artifact-approval workflow, reused verbatim byte-for-byte per D5) — its own named type
// rather than an alias, matching every sibling module's own precedent.
export type AssetApprovalStatus =
  | "draft"
  | "submitted"
  | "under_review"
  | "approved"
  | "revision_requested"
  | "rejected"
  | "superseded"
  | "archived";

/**
 * The Asset Library module's single primary entity (module #15) — organization-wide, not
 * project-scoped (D9). `fileReference` is a plain nullable URL string, validated as a safe
 * http(s) URL at the DTO layer only (D1 — metadata-only in this pass, no Vercel Blob store is
 * provisioned yet), rendered as a real link only when `isSafeHttpUrl()` confirms it client-side
 * too, mirroring `BrandLibraryRecord.fileReference`'s own guard. `fileSizeBytes` is a Postgres
 * BIGINT, returned as a string (JavaScript `number` cannot represent every BIGINT value exactly).
 * `mimeType`/`fileSizeBytes`/`checksum`/`widthPx`/`heightPx`/`durationSeconds` are caller-supplied
 * metadata in this pass, not values derived from a file this system actually holds. `visibility`
 * is a REAL confidentiality axis (D2) — on a `restricted` asset, `fileReference` and
 * `consentReference` are genuinely OMITTED (not nulled) from the response for a caller lacking
 * `view_confidential`: `AuthorizationService`'s shared redaction primitive
 * (`confidential-field.util.ts#redactConfidentialFields()`) does `delete redacted[field]`, the
 * same `undefined`-signals-redaction convention `BusinessKnowledgeRecord.content`/`.notes` already
 * establish (code-review finding, `dashboard-web-asset-library` — an earlier revision of this
 * doc comment incorrectly claimed the backend "redacts by nulling," which the code-review pass
 * that added the `?:` below traced back to the real redaction primitive and corrected). `undefined`
 * — the key absent — means redacted; `null` means a real, visible, genuinely-unset value. The edit
 * form must never resubmit an `undefined`-read field as an explicit `null` clear (see
 * `AssetLibraryForm`'s own redaction handling). `isPublished`/`publishedAt` mirror Brand Library's/
 * Content Template Library's own publish/unpublish mechanism exactly (D6) — orthogonal to
 * `approvalStatus`.
 */
export interface Asset {
  readonly id: string;
  readonly publicId: string;
  readonly title: string;
  readonly description: string | null;
  readonly fileReference?: string | null;
  readonly mimeType: string | null;
  readonly fileSizeBytes: string | null;
  readonly checksum: string | null;
  readonly widthPx: number | null;
  readonly heightPx: number | null;
  readonly durationSeconds: number | null;
  readonly licence: string | null;
  readonly licenceHolder: string | null;
  readonly consentReference?: string | null;
  readonly altTextGuidance: string | null;
  readonly visibility: AssetVisibility;
  readonly retentionNote: string | null;
  readonly scanStatus: AssetScanStatus;
  readonly approvalStatus: AssetApprovalStatus;
  readonly version: number;
  readonly isPublished: boolean;
  readonly publishedAt: string | null;
  readonly createdBy: string | null;
  readonly updatedBy: string | null;
  readonly createdAt: string;
  readonly updatedAt: string;
}

/**
 * Spec §12's "related records" (D3) — a real polymorphic reference to a record in any other
 * module, mirroring `Review.targetModuleKey`/`targetId`'s own already-reviewed pattern. `moduleKey`
 * is a `module_registry.key` value, validated against the real registry at the service layer;
 * `recordId` carries no foreign key, deliberately, since the target may live in any of the 43
 * registered modules, most of which have no table yet.
 */
export interface AssetRelatedRecord {
  readonly id: string;
  readonly assetId: string;
  readonly moduleKey: string;
  readonly recordId: string;
  readonly note: string | null;
  readonly createdBy: string | null;
  readonly createdAt: string;
  readonly updatedAt: string;
}

/** The spec's own token-group taxonomy (`03_Detailed_Module_Specifications.md §13`), collapsed
 *  into one flat enum — mirrors
 *  `packages/database/src/design-token-library/entities.ts`'s `DesignTokenGroup` exactly.
 *  Immutable across a record's own version chain (set once at creation; a real group change is a
 *  different record, not a new version of this one), mirroring `WebsiteStrategyRecordType`'s own
 *  immutability discipline. */
export type DesignTokenGroup =
  | "colors"
  | "semantic_statuses"
  | "theme"
  | "typography"
  | "spacing"
  | "grids"
  | "breakpoints"
  | "borders"
  | "shadows"
  | "opacity_and_z_index"
  | "icon_sizes"
  | "media_ratios"
  | "component_sizes"
  | "motion"
  | "interactive_states";

/** Which theme(s) a token's value applies to — the spec's own "theme variation" field. `null`
 *  means the token is theme-independent (most tokens). */
export type DesignTokenThemeVariation = "light" | "dark" | "both";

// Structurally identical to ArtifactApprovalStatus/WebsiteStrategyApprovalStatus/
// ServiceApprovalStatus/PersonaApprovalStatus/ProofClaimApprovalStatus (the shared 8-value
// artifact-approval workflow) — reused as its own named type rather than an alias so this module's
// own `-query.ts` file can still narrow to it directly without a cast, matching every sibling
// module's own precedent.
export type DesignTokenApprovalStatus =
  | "draft"
  | "submitted"
  | "under_review"
  | "approved"
  | "revision_requested"
  | "rejected"
  | "superseded"
  | "archived";

/**
 * One row per VERSION, not one row per record — structurally identical to
 * `WebsiteStrategyRecord`'s own real version-history shape
 * (`packages/database/src/design-token-library/entities.ts`'s own doc comment). `id` is unique per
 * physical row/version; `recordId` is the stable logical-record identity shared by every version of
 * the same record (the history/comparison key, and the identifier every `dashboard-web` route/link
 * uses — never `id`, which changes across a fork). `publicId` is likewise stable across every
 * version. `isCurrent` is true for exactly one row per `recordId` at any time.
 * `usageReferences` is a plain, unvalidated string array — no `component_library`/`page_workspace`
 * module exists yet to link it to for real.
 */
export interface DesignTokenRecord {
  readonly id: string;
  readonly recordId: string;
  readonly publicId: string;
  readonly group: DesignTokenGroup;
  readonly versionNumber: number;
  readonly isCurrent: boolean;
  readonly name: string;
  readonly value: string;
  readonly unit: string | null;
  readonly semanticPurpose: string | null;
  readonly responsiveVariation: string | null;
  readonly themeVariation: DesignTokenThemeVariation | null;
  readonly usageReferences: readonly string[];
  readonly approvalStatus: DesignTokenApprovalStatus;
  readonly createdBy: string | null;
  readonly updatedBy: string | null;
  readonly createdAt: string;
  readonly updatedAt: string;
}

/** The spec's own §15 pattern-type taxonomy, 20 values — mirrors
 *  `packages/database/src/section-and-pattern-library/entities.ts`'s `SectionPatternType` exactly.
 *  Immutable across a record's own version chain (set once at creation; a real pattern-type change
 *  is a different record, not a new version of this one), mirroring `DesignTokenGroup`'s own
 *  immutability discipline. */
export type SectionPatternType =
  | "homepage_storytelling"
  | "service"
  | "industry"
  | "location"
  | "landing_conversion"
  | "portfolio_showcase"
  | "social_proof"
  | "results_metrics"
  | "engagement_models"
  | "team_expertise"
  | "content_hub"
  | "article"
  | "lead_capture"
  | "download"
  | "multi_step_form"
  | "search_filter"
  | "trust"
  | "objection_handling"
  | "cross_sell"
  | "error_no_results";

// Structurally identical to DesignTokenApprovalStatus/ArtifactApprovalStatus (the shared 8-value
// artifact-approval workflow) — reused as its own named type rather than an alias so this module's
// own `-query.ts` file can still narrow to it directly without a cast, matching every sibling
// module's own precedent.
export type SectionPatternApprovalStatus =
  | "draft"
  | "submitted"
  | "under_review"
  | "approved"
  | "revision_requested"
  | "rejected"
  | "superseded"
  | "archived";

/**
 * One row per VERSION, not one row per record — structurally identical to `DesignTokenRecord`'s
 * own real version-history shape
 * (`packages/database/src/section-and-pattern-library/entities.ts`'s own doc comment). `id` is
 * unique per physical row/version; `recordId` is the stable logical-record identity shared by
 * every version of the same record (the history/comparison key, and the identifier every
 * `dashboard-web` route/link uses — never `id`, which changes across a fork). `publicId` is
 * likewise stable across every version. `isCurrent` is true for exactly one row per `recordId` at
 * any time. `jsDependencies`/`tokenReferences`/`relatedComponentIds` are plain, unvalidated string
 * arrays — no `design_token_library`-version-identity linking or `component_library` module
 * exists yet to link them to for real.
 */
export interface SectionPatternRecord {
  readonly id: string;
  readonly recordId: string;
  readonly publicId: string;
  readonly patternType: SectionPatternType;
  readonly versionNumber: number;
  readonly isCurrent: boolean;
  readonly name: string;
  readonly description: string | null;
  readonly designReference: string | null;
  readonly htmlStructure: string | null;
  readonly phpPath: string | null;
  readonly scssReference: string | null;
  readonly jsDependencies: readonly string[];
  readonly responsiveBehavior: string | null;
  readonly accessibilityNotes: string | null;
  readonly browserSupport: string | null;
  readonly tokenReferences: readonly string[];
  readonly relatedComponentIds: readonly string[];
  readonly approvalStatus: SectionPatternApprovalStatus;
  readonly createdBy: string | null;
  readonly updatedBy: string | null;
  readonly createdAt: string;
  readonly updatedAt: string;
}

// Structurally identical to DesignTokenApprovalStatus/ArtifactApprovalStatus/
// WebsiteStrategyApprovalStatus/ServiceApprovalStatus/PersonaApprovalStatus/
// ProofClaimApprovalStatus (the shared 8-value artifact-approval workflow) — reused as its own
// named type rather than an alias so this module's own `-query.ts` file can still narrow to it
// directly without a cast, matching every sibling module's own precedent.
export type ComponentApprovalStatus =
  | "draft"
  | "submitted"
  | "under_review"
  | "approved"
  | "revision_requested"
  | "rejected"
  | "superseded"
  | "archived";

/**
 * One row per VERSION, not one row per record — structurally identical to `DesignTokenRecord`'s/
 * `WebsiteStrategyRecord`'s own real version-history shape
 * (`packages/database/src/component-library/entities.ts`'s own doc comment). `id` is unique per
 * physical row/version; `recordId` is the stable logical-record identity shared by every version of
 * the same record (the history/comparison key, and the identifier every `dashboard-web` route/link
 * uses — never `id`, which changes across a fork). `publicId` is likewise stable across every
 * version. `isCurrent` is true for exactly one row per `recordId` at any time.
 * `tokenIds` is a real, existence-validated relationship into Design Token Library's own
 * `recordId`s. `replacementRecordId` is a nullable self-referential `recordId` into this same
 * table — not immutable across a record's own version chain, unlike `category`.
 */
export interface ComponentRecord {
  readonly id: string;
  readonly recordId: string;
  readonly publicId: string;
  readonly category: string;
  readonly versionNumber: number;
  readonly isCurrent: boolean;
  readonly name: string;
  readonly figmaReference: string | null;
  readonly tokenIds: readonly string[];
  readonly htmlStructure: string | null;
  readonly phpPath: string | null;
  readonly scssClassesPath: string | null;
  readonly jsDependencies: string | null;
  readonly states: string | null;
  readonly responsiveBehavior: string | null;
  readonly browserSupport: string | null;
  readonly accessibility: string | null;
  readonly schema: string | null;
  readonly analytics: string | null;
  readonly tests: string | null;
  readonly replacementRecordId: string | null;
  readonly approvalStatus: ComponentApprovalStatus;
  readonly createdBy: string | null;
  readonly updatedBy: string | null;
  readonly createdAt: string;
  readonly updatedAt: string;
}

// Structurally identical to DesignTokenApprovalStatus/ArtifactApprovalStatus/
// ComponentApprovalStatus (the shared 8-value artifact-approval workflow) — reused as its own
// named type rather than an alias so this module's own `-query.ts` file can still narrow to it
// directly without a cast, matching every sibling module's own precedent.
export type PageTemplateApprovalStatus =
  | "draft"
  | "submitted"
  | "under_review"
  | "approved"
  | "revision_requested"
  | "rejected"
  | "superseded"
  | "archived";

/** The spec's own §16 page-type taxonomy, 17 values — mirrors
 *  `packages/database/src/page-template-library/entities.ts`'s `PageType` exactly. Immutable
 *  across a record's own version chain (set once at creation; a real page-type change is a
 *  different record, not a new version of this one), mirroring `SectionPatternType`'s/
 *  `ComponentRecord`'s own `category` immutability discipline. */
export type PageType =
  | "homepage"
  | "service"
  | "platform"
  | "industry"
  | "location"
  | "case_study"
  | "portfolio"
  | "landing"
  | "article"
  | "about"
  | "contact"
  | "team"
  | "careers"
  | "archive_category"
  | "confirmation"
  | "not_found"
  | "campaign_event";

/**
 * One row per VERSION, not one row per record — structurally identical to `ComponentRecord`'s/
 * `SectionPatternRecord`'s own real version-history shape
 * (`packages/database/src/page-template-library/entities.ts`'s own doc comment). `id` is unique
 * per physical row/version; `recordId` is the stable logical-record identity shared by every
 * version of the same record (the history/comparison key, and the identifier every
 * `dashboard-web` route/link uses — never `id`, which changes across a fork). `publicId` is
 * likewise stable across every version. `isCurrent` is true for exactly one row per `recordId` at
 * any time. `requiredSectionIds`/`optionalSectionIds` are real, existence-validated relationships
 * into Section and Pattern Library's own `recordId`s; `supportedComponentIds` is a real,
 * existence-validated relationship into Component Library's own `recordId`s.
 * `wireframeReferences` is a plain, unvalidated string array — no `wireframe_library` module
 * exists yet to link it to for real. `replacementRecordId` is a nullable self-referential
 * `recordId` into this same table — not immutable across a record's own version chain, unlike
 * `pageType`.
 */
export interface PageTemplateRecord {
  readonly id: string;
  readonly recordId: string;
  readonly publicId: string;
  readonly pageType: PageType;
  readonly versionNumber: number;
  readonly isCurrent: boolean;
  readonly name: string;
  readonly requiredSectionIds: readonly string[];
  readonly optionalSectionIds: readonly string[];
  readonly supportedComponentIds: readonly string[];
  readonly wireframeReferences: readonly string[];
  readonly contentRequirements: string | null;
  readonly searchRequirements: string | null;
  readonly conversionGoal: string | null;
  readonly phpTemplateRelationship: string | null;
  readonly replacementRecordId: string | null;
  readonly approvalStatus: PageTemplateApprovalStatus;
  readonly createdBy: string | null;
  readonly updatedBy: string | null;
  readonly createdAt: string;
  readonly updatedAt: string;
}

/** The spec's own §17 viewport field — 3 values. Not immutable across a record's own version
 *  chain (unlike `pageOrModule`) — a later version may legitimately re-plan the same page/module
 *  wireframe at a different viewport. Mirrors
 *  `packages/database/src/wireframe-library/entities.ts`'s own `WireframeViewport`. */
export type WireframeViewport = "mobile" | "tablet" | "desktop";

/** Structurally identical to `PageTemplateApprovalStatus`/`SectionPatternApprovalStatus`/
 *  `ArtifactApprovalStatus` (the shared 8-value artifact-approval workflow) — reused as its own
 *  named type rather than an alias so this module's own `-query.ts` file can still narrow to it
 *  directly without a cast, matching every sibling module's own precedent. */
export type WireframeApprovalStatus =
  | "draft"
  | "submitted"
  | "under_review"
  | "approved"
  | "revision_requested"
  | "rejected"
  | "superseded"
  | "archived";

/**
 * One row per VERSION, not one row per record — structurally identical to `PageTemplateRecord`'s/
 * `SectionPatternRecord`'s own real version-history shape
 * (`packages/database/src/wireframe-library/entities.ts`'s own doc comment). `id` is unique per
 * physical row/version; `recordId` is the stable logical-record identity shared by every version
 * of the same record (the history/comparison key, and the identifier every `dashboard-web`
 * route/link uses — never `id`, which changes across a fork). `publicId` is likewise stable
 * across every version. `isCurrent` is true for exactly one row per `recordId` at any time.
 * `pageOrModule` is immutable across a record's own version chain. `relatedTemplateId` is a
 * plain, unvalidated string — no `page_template_library` FK exists yet (real dependency cycle,
 * see migration `00084`'s own doc comment).
 */
export interface WireframeRecord {
  readonly id: string;
  readonly recordId: string;
  readonly publicId: string;
  readonly pageOrModule: string;
  readonly versionNumber: number;
  readonly isCurrent: boolean;
  readonly viewport: WireframeViewport;
  readonly fileReference: string | null;
  readonly annotations: string | null;
  readonly interactionNotes: string | null;
  readonly relatedTemplateId: string | null;
  readonly reviewerUserId: string | null;
  readonly approvalStatus: WireframeApprovalStatus;
  readonly createdBy: string | null;
  readonly updatedBy: string | null;
  readonly createdAt: string;
  readonly updatedAt: string;
}

/** The spec's own §18 motion/interaction category taxonomy, 26 values — mirrors
 *  `packages/database/src/motion-and-interaction-library/entities.ts`'s
 *  `MotionInteractionCategory` exactly. Immutable across a record's own version chain (set once at
 *  creation; a real category change is a different record, not a new version of this one),
 *  mirroring `SectionPatternType`'s/`PageType`'s own immutability discipline. */
export type MotionInteractionCategory =
  | "page_transition"
  | "focus_state"
  | "active_state"
  | "selected_state"
  | "disabled_state"
  | "form_feedback"
  | "menu"
  | "modal_drawer"
  | "tooltip"
  | "sticky_behavior"
  | "content_reveal"
  | "loader"
  | "progress_indicator"
  | "success_error_state"
  | "notification"
  | "media_control"
  | "filter_search"
  | "pagination"
  | "copy_share"
  | "anchor_scroll"
  | "parallax"
  | "cursor"
  | "dismissal"
  | "screen_reader_announcement"
  | "timing_and_interruption"
  | "analytics_event"
  | "no_js_fallback";

/** Structurally identical to `PageTemplateApprovalStatus`/`SectionPatternApprovalStatus`/
 *  `WireframeApprovalStatus`/`ArtifactApprovalStatus` (the shared 8-value artifact-approval
 *  workflow) — reused as its own named type rather than an alias so this module's own `-query.ts`
 *  file can still narrow to it directly without a cast, matching every sibling module's own
 *  precedent. */
export type MotionInteractionApprovalStatus =
  | "draft"
  | "submitted"
  | "under_review"
  | "approved"
  | "revision_requested"
  | "rejected"
  | "superseded"
  | "archived";

/**
 * One row per VERSION, not one row per record — structurally identical to `WireframeRecord`'s/
 * `PageTemplateRecord`'s/`SectionPatternRecord`'s own real version-history shape
 * (`packages/database/src/motion-and-interaction-library/entities.ts`'s own doc comment). `id` is
 * unique per physical row/version; `recordId` is the stable logical-record identity shared by
 * every version of the same record (the history/comparison key, and the identifier every
 * `dashboard-web` route/link uses — never `id`, which changes across a fork). `publicId` is
 * likewise stable across every version. `isCurrent` is true for exactly one row per `recordId` at
 * any time. `category` is immutable across a record's own version chain. `relatedComponentIds` is
 * a real, existence-validated relationship into Component Library's own `recordId`s — unlike
 * `SectionPatternRecord`'s own `relatedComponentIds`, which predates Component Library and stays
 * unvalidated.
 */
export interface MotionInteractionRecord {
  readonly id: string;
  readonly recordId: string;
  readonly publicId: string;
  readonly category: MotionInteractionCategory;
  readonly versionNumber: number;
  readonly isCurrent: boolean;
  readonly name: string;
  readonly description: string | null;
  readonly triggerAndBehavior: string | null;
  readonly timingAndEasing: string | null;
  readonly implementationSpec: string | null;
  readonly accessibilityNotes: string | null;
  readonly fallbackBehavior: string | null;
  readonly designReference: string | null;
  readonly relatedComponentIds: readonly string[];
  readonly approvalStatus: MotionInteractionApprovalStatus;
  readonly createdBy: string | null;
  readonly updatedBy: string | null;
  readonly createdAt: string;
  readonly updatedAt: string;
}

/** Module #23 — `packages/database/src/case-study-studio/entities.ts`'s own D5 field grouping.
 *  `visibility` reuses the Case Study Library spec's own 4-value vocabulary (Studio is the same
 *  content before it graduates to the Library). */
export type CaseStudyVisibility =
  "public" | "internal_only" | "confidential" | "client_approval_required";

/** D1 — the full bespoke 14-stage lifecycle named in the canonical spec. `archived` is terminal. */
export type CaseStudyStatus =
  | "intake"
  | "upload"
  | "completeness_review"
  | "ready_for_claude"
  | "missing_information"
  | "draft"
  | "search_review"
  | "fact_confidentiality_review"
  | "internal_approval"
  | "client_approval"
  | "scheduled"
  | "published"
  | "unpublished"
  | "archived";

export type CaseStudyApprovalType = "internal" | "client";
export type CaseStudyApprovalDecision = "approved" | "rejected" | "revision_requested";

export type CaseStudyAssetRole =
  "hero_screenshot" | "logo" | "testimonial_screenshot" | "video" | "document" | "other";

export type CaseStudyConsentType = "client_publication" | "testimonial" | "logo_usage" | "other";

/**
 * The Case Study Studio module's parent entity. `relatedServiceIds` is existence-validated against
 * the real `services` table; `relatedClaimIds` is existence-validated against the real
 * `proof_claims` table (D2) — supersedes the canonical data-model doc's own `case_study_claims`
 * table name. No `CaseStudyDetail` split — `case_study_assets`/`case_study_consents`/
 * `case_study_approvals` are all fetched separately via their own sub-resource routes, matching
 * Proof and Claims Library's own precedent (not Service Library's `Detail` split).
 * `clientApprovalRequired` is a one-time intake decision, immutable once set — only accepted by
 * `createCaseStudySchema`, never `updateCaseStudySchema`.
 */
export interface CaseStudy {
  readonly id: string;
  readonly publicId: string;
  readonly clientName: string;
  readonly projectTitle: string;
  readonly industry: string | null;
  readonly platform: string | null;
  readonly visibility: CaseStudyVisibility;
  readonly embargoDate: string | null;
  readonly challenge: string | null;
  readonly solution: string | null;
  readonly implementation: string | null;
  readonly results: string | null;
  readonly relatedServiceIds: readonly string[];
  readonly relatedClaimIds: readonly string[];
  readonly assignedReviewerUserId: string | null;
  readonly clientApprovalRequired: boolean;
  readonly status: CaseStudyStatus;
  readonly scheduledPublishAt: string | null;
  readonly publishedAt: string | null;
  readonly unpublishReason: string | null;
  readonly version: number;
  readonly createdBy: string | null;
  readonly updatedBy: string | null;
  readonly createdAt: string;
  readonly updatedAt: string;
}

/** D3 — a real many-to-many join into the real, already-live `assets` table (Asset Library,
 *  module #15). `assetId` is existence-validated at the app layer, not a DB-level FK. */
export interface CaseStudyAsset {
  readonly id: string;
  readonly caseStudyId: string;
  readonly assetId: string;
  readonly role: CaseStudyAssetRole;
  readonly caption: string | null;
  readonly createdAt: string;
  readonly updatedAt: string;
}

/** Case-study-level consent evidence — client publication/testimonial/logo-usage consent,
 *  distinct from an individual asset's own `consent_reference` (Asset Library). */
export interface CaseStudyConsent {
  readonly id: string;
  readonly caseStudyId: string;
  readonly consentType: CaseStudyConsentType;
  readonly consentEvidenceReference: string | null;
  readonly grantedBy: string | null;
  readonly grantedAt: string | null;
  readonly notes: string | null;
  readonly createdAt: string;
  readonly updatedAt: string;
}

/** A read-only, queryable decision-history log for the two approval stages
 *  (`internal_approval`/`client_approval`), mirroring Review and Approval Center's own
 *  `review_decisions` table shape — written only as a side effect of `changeStatus()` on the
 *  parent, never directly. */
export interface CaseStudyApproval {
  readonly id: string;
  readonly caseStudyId: string;
  readonly approvalType: CaseStudyApprovalType;
  readonly decision: CaseStudyApprovalDecision;
  readonly decidedByUserId: string | null;
  readonly decidedAt: string;
  readonly notes: string | null;
  readonly createdAt: string;
  readonly updatedAt: string;
}

/**
 * Case Study Library (module #24). An EXTENSION table over Case Study Studio's own `case_studies`
 * (D1, `packages/database/src/case-study-library/entities.ts`) — deliberately does not duplicate
 * any `CaseStudy` field; a caller reads those via the nested `caseStudy` on
 * `CaseStudyLibraryRecordWithCaseStudy`. A short, structured plain-text testimonial — not
 * rich-text/HTML (D4).
 */
export interface CaseStudyLibraryTestimonial {
  readonly quote: string;
  readonly author: string | null;
  readonly role: string | null;
}

export interface CaseStudyLibraryRecord {
  readonly id: string;
  readonly publicId: string;
  /** The one parent case study this record extends — a real DB-level FK, enforced unique (one
   *  library record per case study, D1). Create-only; never re-pointed via edit. */
  readonly caseStudyId: string;
  /** Existence-validated against the real `pages` table (D2) — NOT a DB-level FK. */
  readonly relatedPageIds: readonly string[];
  /** Plain, unvalidated (D3) — no dedicated "technologies" module exists. */
  readonly technologies: readonly string[];
  readonly testimonials: readonly CaseStudyLibraryTestimonial[];
  readonly createdBy: string | null;
  readonly updatedBy: string | null;
  readonly createdAt: string;
  readonly updatedAt: string;
}

/** `GET .../records` and `GET .../records/:id` both nest the full, already-permission-filtered
 *  parent case study under `caseStudy` rather than duplicating its fields — `null` only if the
 *  parent lookup itself fails (case study data is otherwise never hard-deleted). */
export interface CaseStudyLibraryRecordWithCaseStudy extends CaseStudyLibraryRecord {
  readonly caseStudy: CaseStudy | null;
}

/**
 * Design Review Center (module #21). Mirrors `packages/database/src/design-review-center/
 * entities.ts` — a cross-cutting engine that attaches to records owned by OTHER modules
 * (`targetModuleKey`/`targetId`, no foreign key), not a single content-record library of its own.
 * Structurally close to `Review`/`ReviewDecision` (Review and Approval Center, module #11), with a
 * dedicated `reviewType` vocabulary and an automatic-supersede mechanism neither of those have.
 */
export type DesignReviewType =
  | "creative_direction"
  | "ux"
  | "conversion"
  | "ui"
  | "accessibility_by_design"
  | "responsive_behavior"
  | "component_consistency"
  | "motion"
  | "performance_impact";

/** `approved`/`rejected`/`superseded` are all terminal. `superseded` is reached ONLY as the
 *  automatic side effect of a DIFFERENT review (sharing the same `targetModuleKey`/`targetId`/
 *  `reviewType`) being approved — never as a directly-requested `decide()` action. */
export type DesignReviewStatus =
  "submitted" | "revision_requested" | "approved" | "rejected" | "superseded";

/** The full action vocabulary a `DesignReviewDecision` row may record — the 4 approval-shaped
 *  `decide()` actions plus `supersede`, which is NEVER a directly-requested `decide()` action; it
 *  is written only by the automatic supersede side effect. Unlike `ReviewDecisionAction`, there is
 *  no `pause`/`resume`/`delegate` — this module has no process-management actions. */
export type DesignReviewDecisionAction =
  "approve" | "approve_with_notes" | "request_revision" | "reject" | "supersede";

/** The primary workflow record. No `isPaused`/process-management fields — this module has none. */
export interface DesignReview {
  readonly id: string;
  readonly targetModuleKey: string;
  readonly targetId: string;
  readonly targetLabel: string | null;
  readonly reviewType: DesignReviewType;
  readonly status: DesignReviewStatus;
  readonly submittedByUserId: string;
  readonly assignedToUserId: string | null;
  /** Stamped on every `decide()` call — records the MOST RECENT decision, overwritten on each
   *  successive call. Not stamped by the automatic supersede side effect. */
  readonly decidedByUserId: string | null;
  readonly decidedAt: string | null;
  readonly versionALabel: string | null;
  readonly versionBLabel: string | null;
  readonly createdAt: string;
  readonly updatedAt: string;
}

/** An append-only, queryable local action-history row — this module's own history, distinct from
 *  the real, DB-trigger-enforced `audit_events` table, which separately receives a copy of every
 *  genuine approval-shaped decision, including the automatic supersede side effect. `notes` is
 *  real, server-sanitized HTML from `dashboard-web`'s `RichTextEditor` — rendered exclusively via
 *  the shared `SanitizedRichText` component, matching every sibling module's own rich-text field. */
export interface DesignReviewDecision {
  readonly id: string;
  readonly reviewId: string;
  readonly action: DesignReviewDecisionAction;
  readonly actorUserId: string;
  readonly notes: string | null;
  readonly decidedAt: string;
}

/**
 * Portfolio Library (module #25). Mirrors `packages/database/src/portfolio-library/entities.ts` —
 * a single flat table (D1), organization-wide, no `recordType` discriminator, reusing the shared
 * 8-value `ArtifactApprovalStatus` workflow verbatim (D6). `relatedProofIds` is
 * existence-validated against the real `proof_claims` table (D3); `additionalCategories`/`tags`
 * are plain, unvalidated, non-nullable string arrays (default `[]`, D8). `isPublished`/
 * `publishedAt` mirror Brand/Content Template/Design Reference Library's own identical
 * publish/unpublish mechanism — orthogonal to `approvalStatus`: `publish()` requires
 * `approvalStatus === "approved"`, but `isPublished` is NOT cleared by a later status transition,
 * and `unpublish()` carries no such gate (D5).
 */
export type PortfolioApprovalStatus =
  | "draft"
  | "submitted"
  | "under_review"
  | "approved"
  | "revision_requested"
  | "rejected"
  | "superseded"
  | "archived";

/** Reuses Case Study Studio's own 4-value vocabulary (D4). */
export type PortfolioVisibility =
  "public" | "internal_only" | "confidential" | "client_approval_required";

export interface PortfolioRecord {
  readonly id: string;
  readonly publicId: string;
  readonly projectOrClientName: string;
  readonly url: string | null;
  readonly primaryCategory: string | null;
  readonly additionalCategories: readonly string[];
  readonly tags: readonly string[];
  readonly industry: string | null;
  readonly platform: string | null;
  readonly serviceType: string | null;
  /** `DATEONLY` — a plain `YYYY-MM-DD` string, not a `Date` instance. */
  readonly launchDate: string | null;
  readonly relatedProofIds: readonly string[];
  readonly visibility: PortfolioVisibility;
  readonly approvalStatus: PortfolioApprovalStatus;
  readonly isPublished: boolean;
  readonly publishedAt: string | null;
  readonly version: number;
  readonly createdBy: string | null;
  readonly updatedBy: string | null;
  readonly createdAt: string;
  readonly updatedAt: string;
}

/** D2 — a real many-to-many join into the real, already-live `assets` table (Asset Library).
 *  `assetId` is existence-validated at the app layer, not a DB-level FK. `role` is a plain,
 *  free-text string (unlike `CaseStudyAssetRole`'s closed enum) — no fixed screenshot-role
 *  taxonomy is named anywhere in the canonical spec for this module. */
export interface PortfolioAsset {
  readonly id: string;
  readonly portfolioRecordId: string;
  readonly assetId: string;
  readonly role: string;
  readonly caption: string | null;
  readonly createdAt: string;
  readonly updatedAt: string;
}

/** D3 — Business Knowledge Center's own 5-value vocabulary with `restricted` removed, since
 *  confidentiality is now a real, separate field (`KnowledgeLibraryRecordConfidentiality` below) —
 *  unlike Business Knowledge Center, where `restricted` doubles as both lifecycle and
 *  confidentiality. `deprecated` is terminal (no hard delete, ADR-0016). */
export type KnowledgeLibraryRecordStatus = "draft" | "mandatory" | "advisory" | "deprecated";

/** D1 — a real, separate confidentiality enum (Service Library's own already-reviewed pattern),
 *  independent of `status` — a record may be `restricted` at any lifecycle stage, including
 *  `draft`. */
export type KnowledgeLibraryRecordConfidentiality = "public" | "internal" | "restricted";

/**
 * The Knowledge Library module's single primary entity — every route (`list`/`findOne`/`create`/
 * `update`/`changeStatus`) returns this exact shape, matching Business Knowledge Center's own
 * single-table design (D2). A `restricted` record's `sourceType`/`location`/`notes` may be
 * redacted for a viewer without a real `view_confidential` grant (currently every viewer, since
 * that action is zero-seeded for every role) — `undefined` means redacted, `null` means a real,
 * visible record with that field genuinely unset, matching `Service.internalDescription`'s own
 * redaction contract, not `BusinessKnowledgeRecord.content`'s status-tied one. */
export interface KnowledgeLibraryRecord {
  readonly id: string;
  readonly title: string;
  readonly sourceType: string | null | undefined;
  readonly location: string | null | undefined;
  readonly ownerUserId: string | null;
  /** `DATEONLY` — a plain `YYYY-MM-DD` string, not a `Date` instance. */
  readonly sourceDate: string | null;
  readonly confidentiality: KnowledgeLibraryRecordConfidentiality;
  /** D10 — no enforcement point exists yet anywhere in this codebase; stored, not yet acted on. */
  readonly approvedForAgentUse: boolean;
  readonly status: KnowledgeLibraryRecordStatus;
  readonly notes: string | null | undefined;
  /** D7 — a plain, unvalidated string array; "related entities" isn't scoped to any single other
   *  module in the spec, so no existence-check target exists. */
  readonly relatedEntityIds: readonly string[];
  /** D8 — a server-managed integer counter incremented on every real `update()` call, mirroring
   *  Persona Library's own pattern (not real multi-row version history). */
  readonly version: number;
  readonly lastReviewedAt: string | null;
  readonly createdBy: string | null;
  readonly updatedBy: string | null;
  readonly createdAt: string;
  readonly updatedAt: string;
}

// Structurally identical to BrandLibraryApprovalStatus/ContentTemplateApprovalStatus/
// PersonaApprovalStatus/ServiceApprovalStatus (the shared 8-value artifact-approval workflow) —
// reused verbatim as its own named type rather than an alias so this module's own `-query.ts`
// file can still narrow to it directly without a cast, matching every sibling module's own
// precedent.
export type WorkflowTaskTemplateApprovalStatus =
  | "draft"
  | "submitted"
  | "under_review"
  | "approved"
  | "revision_requested"
  | "rejected"
  | "superseded"
  | "archived";

/** Mirrors `packages/database/src/workflow-and-task-template-library/entities.ts`'s own
 *  discriminator-column shape — one table, 11 real task/template kinds named by
 *  `03_Detailed_Module_Specifications.md §29`. Immutable once created — changing it would be a
 *  different record. */
export type WorkflowTaskTemplateType =
  | "existing_page_audit"
  | "new_page_opportunity"
  | "search_brief"
  | "content"
  | "case_study"
  | "design"
  | "development"
  | "code_review"
  | "security"
  | "qa"
  | "release";

/**
 * The Workflow and Task Template Library module's single primary entity (module #23 on the
 * Recommended Module Roadmap) — organization-wide, not project-scoped, single table, no
 * sub-resources, no cross-module relationship fields, no confidentiality mechanism, no
 * publish/unpublish action. `requiredInputs`/`expectedOutputs`/`restrictions`/
 * `validationCriteria` are rich text (`RichTextEditor`), per the 2026-08-22 standing rule —
 * sanitized server-side before storage
 * (`WorkflowAndTaskTemplateLibraryService.create()`/`update()`) and again at render time via
 * `SanitizedRichText`. `agentAssignment`/`requiredApprovals` stay plain descriptive text — neither
 * is ever read by any status-transition or execution gate in this codebase (the roadmap's own
 * "Templates never authorize execution by themselves" note).
 */
export interface WorkflowTaskTemplate {
  readonly id: string;
  readonly publicId: string;
  readonly templateType: WorkflowTaskTemplateType;
  readonly title: string;
  readonly authorizedStage: string;
  readonly requiredInputs: string | null;
  readonly expectedOutputs: string | null;
  readonly restrictions: string | null;
  readonly agentAssignment: string | null;
  readonly validationCriteria: string | null;
  readonly requiredApprovals: string | null;
  readonly approvalStatus: WorkflowTaskTemplateApprovalStatus;
  readonly version: number;
  readonly createdBy: string | null;
  readonly updatedBy: string | null;
  readonly createdAt: string;
  readonly updatedAt: string;
}

/**
 * The Ready for Claude Queue module (module #30) — a manual execution queue, one row per unit of
 * work handed to Claude Code (`canonical-inputs/Recommended_Module_Roadmap.md` row 30: "V1 is
 * manual Claude Code execution. No Anthropic API automation"). Organization-wide, not
 * project-scoped (`projectId` is an OPTIONAL context field, not an access boundary — RBAC for
 * this module is flat). Mirrors `packages/database/src/ready-for-claude-queue/entities.ts`
 * exactly — see that file and `apps/dashboard-api/src/ready-for-claude-queue/
 * ready-for-claude-tasks.service.ts`'s own `TRANSITIONS` table for the full field-level/workflow
 * rationale.
 */

/** Ordinal. `critical` exists (unlike `InternalLinkPriority`'s three values) because an execution
 *  queue genuinely distinguishes "do this next" from "stop everything". */
export type ReadyForClaudeTaskPriority = "low" | "medium" | "high" | "critical";

/**
 * A genuinely bespoke, 11-state workflow — NOT the 8-value generic `ArtifactApprovalStatus` every
 * content-library module reuses, and a DIFFERENT bespoke shape than Internal Linking Library's own
 * 4-state workflow. `completed`, `cancelled`, and `failed` are TERMINAL — no outbound transition
 * exists from any of them, and the backend additionally rejects a plain content edit on a task
 * sitting in one. See `ReadyForClaudeTasksService`'s own `TRANSITIONS` table for the exact legal
 * edges and the real, seeded RBAC action each one requires.
 */
export type ReadyForClaudeTaskStatus =
  | "draft"
  | "ready_for_claude"
  | "claimed"
  | "in_progress"
  | "awaiting_review"
  | "changes_requested"
  | "approved"
  | "completed"
  | "cancelled"
  | "paused"
  | "failed";

/**
 * The primary (and only) record.
 * - `targetModuleKey`/`targetId` are the polymorphic record link Review and Approval Center
 *   already established: the module key is validated against the real module registry at the
 *   service layer, the id is deliberately opaque and unvalidated. Both nullable — a task need not
 *   be about any specific record.
 * - `dependencies` holds other Ready for Claude task ids, each existence-validated at the service
 *   layer against this same table. Always an array, never `null`.
 * - `agent`/`agentVersion` are plain, unvalidated text — Agent Directory (#26) and Agent
 *   Specification Library (#27) do not exist yet.
 * - `projectId` is OPTIONAL, unlike every prior project-scoped module — a task may be
 *   organization-wide. RBAC stays organization-wide regardless.
 * - `prUrl`/`stagingUrl` are validated with the shared `safeHttpUrlSchema` at the DTO layer —
 *   render only via a client-side `isSafeHttpUrl()` guard, matching every other stored-URL field
 *   in this app.
 * - `status` is server-managed: only the dedicated status route may change it, never the generic
 *   edit route. `productionApproval`/`productionApproverUserId` are likewise server-managed,
 *   stamped only when the `approve`-gated `approved -> completed` transition actually happens —
 *   never a form field.
 * - Every long-text field (`description`/`dashboardReview`/`changesRequestedNotes`/
 *   `productionVerification`/`failureReason`) stays plain, unsanitized text — this module was
 *   deliberately excluded from the 2026-08-22 rich-text-editor standing rule, since the backend
 *   DTO stores these fields as plain text on purpose (D8) and converting the frontend alone
 *   without a paired backend sanitization change would be dishonest.
 */
export interface ReadyForClaudeTask {
  readonly id: string;
  readonly publicId: string;
  readonly title: string;
  readonly description: string | null;
  readonly priority: ReadyForClaudeTaskPriority;
  readonly agent: string | null;
  readonly agentVersion: string | null;
  readonly projectId: string | null;
  readonly targetModuleKey: string | null;
  readonly targetId: string | null;
  readonly status: ReadyForClaudeTaskStatus;
  readonly stage: string | null;
  readonly dependencies: readonly string[];
  readonly operatorUserId: string | null;
  readonly developerUserId: string | null;
  readonly featureBranch: string | null;
  readonly sourceCommit: string | null;
  readonly prId: string | null;
  readonly prUrl: string | null;
  readonly prStatus: string | null;
  readonly reviewerUserId: string | null;
  readonly codeReviewResult: string | null;
  readonly stagingCommit: string | null;
  readonly stagingDeployment: string | null;
  readonly stagingUrl: string | null;
  readonly dashboardReview: string | null;
  readonly changesRequestedNotes: string | null;
  readonly productionApproval: boolean;
  readonly productionApproverUserId: string | null;
  readonly productionCommit: string | null;
  readonly productionDeployment: string | null;
  readonly productionVerification: string | null;
  readonly rollbackVersion: string | null;
  readonly failureReason: string | null;
  readonly retryCount: number;
  readonly dueDate: string | null;
  readonly auditReference: string | null;
  readonly createdBy: string | null;
  readonly updatedBy: string | null;
  readonly createdAt: string;
  readonly updatedAt: string;
}

/**
 * Scan Center (module #31) — a real pipeline across four tables: a `ScanDefinition` describes
 * WHAT to scan (and how); a `ScanRun` is one execution of a definition, progressing through a
 * bespoke 8-state lifecycle; a `ScanFinding` is a discrete issue surfaced by a completed/
 * partially-completed run; `ScanEvidence` is immutable supporting material attached to one
 * finding. Record-keeping only — no real scanner/crawler/WordPress-adapter execution engine exists
 * anywhere in this codebase yet, matching Ready for Claude Queue's/Review and Approval Center's own
 * precedent for a mechanism with no execution engine yet. All four tables are project-scoped
 * (`scan-center/projects/:projectId/...`). See
 * `apps/dashboard-api/src/scan-center/scan-center.dto.ts`/`scan-center.constants.ts` and
 * `packages/database/src/scan-center/entities.ts` for the full backend contract this mirrors.
 */
export type ScanType =
  | "full_website"
  | "selected_page"
  | "repository"
  | "wordpress_health"
  | "theme_plugin_core_currency"
  | "security_indicators"
  | "accessibility"
  | "performance"
  | "links"
  | "metadata"
  | "structured_data";

export type ScanMode = "manual" | "scheduled";

/**
 * A saved scan configuration — what to scan, and (optionally) on what schedule. Has no workflow
 * of its own; only `isEnabled` toggles whether it may currently be run. `target` is deliberately
 * plain free text, not URL-validated — a repository ref or a "selected page" slug is not always a
 * URL. `scanType` is create-only (immutable), mirroring every sibling module's own discriminator-
 * field create-only contract.
 */
export interface ScanDefinition {
  readonly id: string;
  readonly projectId: string;
  readonly publicId: string;
  readonly name: string;
  readonly scanType: ScanType;
  readonly mode: ScanMode;
  readonly target: string | null;
  readonly environment: string | null;
  readonly scheduleCron: string | null;
  readonly isEnabled: boolean;
  readonly createdBy: string | null;
  readonly updatedBy: string | null;
  readonly createdAt: string;
  readonly updatedAt: string;
}

/**
 * A run's real 8-state lifecycle: `requested -> queued -> running ->` one of five terminal
 * outcomes (`completed`/`partially_completed`/`failed`/`timed_out`/`cancelled`), plus two
 * direct-to-`cancelled` shortcuts from `queued`/`running`. Every terminal state has no outbound
 * transition — unlike Internal Linking Library's own 4-state loop, this workflow really does end.
 * See `apps/dashboard-api/src/scan-center/scan-runs.service.ts`'s own `TRANSITIONS` table for the
 * exact allowed edges.
 */
export type ScanRunStatus =
  | "requested"
  | "queued"
  | "running"
  | "completed"
  | "partially_completed"
  | "failed"
  | "timed_out"
  | "cancelled";

export type ScanRunTriggerType = "manual" | "scheduled";

/**
 * One execution of a `ScanDefinition`. `startedAt`/`completedAt` are server-stamped only, by the
 * repository's own atomic conditional write — never accepted as caller input on the create route,
 * never overwritten once first set. `errorSummary`/`findings` may only be supplied alongside a
 * transition into `failed`/`timed_out` and `completed`/`partially_completed` respectively — there
 * is no standalone create route for `ScanFinding`.
 */
export interface ScanRun {
  readonly id: string;
  readonly projectId: string;
  readonly publicId: string;
  readonly scanDefinitionId: string;
  readonly status: ScanRunStatus;
  readonly triggerType: ScanRunTriggerType;
  readonly startedAt: string | null;
  readonly completedAt: string | null;
  readonly errorSummary: string | null;
  readonly requestedBy: string | null;
  readonly createdAt: string;
  readonly updatedAt: string;
}

export type ScanFindingSeverity = "critical" | "high" | "medium" | "low" | "info";

/** `open`/`acknowledged` may move to any of the three dispositional states (or back to `open` to
 *  reconsider); `resolved`/`dismissed` are both terminal — findings, once disposed, are not
 *  reopened in this pass. */
export type ScanFindingStatus = "open" | "acknowledged" | "resolved" | "dismissed";

/**
 * A discrete issue surfaced by a run. `category` is plain free text (no canonical value list
 * exists for this field). Created only as a side effect of a run transitioning to
 * `completed`/`partially_completed` with a non-empty `findings` payload — there is no standalone
 * create route for this table.
 */
export interface ScanFinding {
  readonly id: string;
  readonly projectId: string;
  readonly publicId: string;
  readonly scanRunId: string;
  readonly category: string | null;
  readonly severity: ScanFindingSeverity;
  readonly title: string;
  readonly description: string | null;
  readonly location: string | null;
  readonly status: ScanFindingStatus;
  readonly resolvedBy: string | null;
  readonly resolvedAt: string | null;
  readonly createdAt: string;
  readonly updatedAt: string;
}

/**
 * Immutable supporting material attached to one finding — no update/delete route exists for this
 * table (append-only, ADR-0016). `reference` is validated (when present) via the shared
 * `safeHttpUrlSchema` at the DTO layer server-side; render only via a client-side `isSafeHttpUrl()`
 * guard before ever showing it as a link, matching every other stored-URL field in this app.
 */
export interface ScanEvidence {
  readonly id: string;
  readonly projectId: string;
  readonly publicId: string;
  readonly scanFindingId: string;
  readonly evidenceType: string | null;
  readonly reference: string | null;
  readonly notes: string | null;
  readonly capturedAt: string | null;
  readonly createdBy: string | null;
  readonly createdAt: string;
  readonly updatedAt: string;
}

export type ChangeRecordCategory =
  | "theme"
  | "plugin"
  | "core"
  | "database"
  | "integration"
  | "seo_metadata"
  | "analytics_tracking"
  | "security"
  | "accessibility"
  | "performance"
  | "redirects_urls"
  | "assets"
  | "conflicts_failed_sync"
  | "rollback_history";

export type ChangeRecordSeverity = "critical" | "high" | "medium" | "low" | "info";

/**
 * A genuinely bespoke, 10-state workflow — a decision loop (`under_review`/`manual_merge_required`/
 * `deferred` -> `accepted`/`rejected`/`deferred`/`manual_merge_required`) followed by a separate
 * apply+verify tail (`accepted -> applying -> applied|apply_failed -> ... -> verified`).
 * `rejected`/`verified` are terminal — no outbound transition. See `ChangeRecordsService`'s own
 * `TRANSITIONS` table for the exact legal edges and the real, seeded RBAC action each requires.
 */
export type ChangeRecordStatus =
  | "detected"
  | "under_review"
  | "accepted"
  | "rejected"
  | "deferred"
  | "manual_merge_required"
  | "applying"
  | "applied"
  | "verified"
  | "apply_failed";

/**
 * The Change Center module's primary (and only) record — project-scoped
 * (`change-center/projects/:projectId/records`). `scanFindingId` is a nullable, existence-and-
 * same-project-validated FK into Scan Center's own `scan_findings`. `targetModuleKey`/`targetId`
 * mirror Review and Approval Center's/Ready for Claude Queue's own polymorphic record link — the
 * module key is validated against the real module registry, the id is deliberately opaque and
 * unvalidated; always either both present or both absent. `beforeValue`/`afterValue`/
 * `recommendation`/`decisionNotes` all stay plain, unsanitized text — this module was deliberately
 * excluded from the 2026-08-22 rich-text-editor standing rule, since the backend DTO stores these
 * fields as raw detected/proposed data (a version string, a config diff snippet, a URL), not prose.
 * `status`/`rollbackGuidance` are server-managed — only the dedicated status route may change
 * either; `rollbackGuidance` is only ever meaningful on a transition INTO `apply_failed`.
 * `severity`, unlike `category`, is NOT create-only — a triager may correct an initially
 * miscategorized severity before the record is decided.
 */
export interface ChangeRecord {
  readonly id: string;
  readonly projectId: string;
  readonly publicId: string;
  readonly category: ChangeRecordCategory;
  readonly severity: ChangeRecordSeverity;
  readonly scanFindingId: string | null;
  readonly source: string | null;
  readonly targetModuleKey: string | null;
  readonly targetId: string | null;
  readonly recordLabel: string;
  readonly beforeValue: string | null;
  readonly afterValue: string | null;
  readonly confidence: number | null;
  readonly recommendation: string | null;
  readonly status: ChangeRecordStatus;
  readonly assignedToUserId: string | null;
  readonly decisionNotes: string | null;
  readonly rollbackGuidance: string | null;
  readonly createdBy: string | null;
  readonly updatedBy: string | null;
  readonly createdAt: string;
  readonly updatedAt: string;
}
