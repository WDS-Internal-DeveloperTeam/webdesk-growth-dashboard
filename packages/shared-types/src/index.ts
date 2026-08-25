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
