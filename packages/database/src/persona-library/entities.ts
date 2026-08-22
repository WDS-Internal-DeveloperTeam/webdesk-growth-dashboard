/**
 * The Persona Library module foundation — persistence-layer shapes for `personas` (migration
 * `00052`). Organization-wide, not project-scoped (D8) — these describe WebDesk Solution's own
 * buyer-persona catalog, not something that varies per client project.
 */

export type PersonaApprovalStatus =
  | "draft"
  | "submitted"
  | "under_review"
  | "approved"
  | "revision_requested"
  | "rejected"
  | "superseded"
  | "archived";

/** The primary entity. `relatedServiceIds` is an unvalidated identifier list, not a foreign key —
 *  Service Library's own `services` table already exists, but retrofitting a real relationship in
 *  this same pass was explicitly ruled out (D2) — Persona Library stays fully standalone. */
export interface PersonaEntity {
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
