import type { ModuleRegistrySummary } from "@webdesk/shared-types";
import type { StatusBadgeToken } from "@webdesk/ui";

/**
 * Maps `ModuleRegistrySummary.implementationStatus` (a real, backend-owned enum — see
 * `packages/shared-types`) onto the 5-bucket status-badge vocabulary from
 * `docs/design/dashboard-ui/10-status-and-workflow-system.md` §1. No status name, no meaning is
 * invented — this only assigns each existing value a visual bucket, following that document's own
 * "Do not assign arbitrary colors independently" instruction. Distinct from `projectStatusBadge`
 * (`lib/projects.ts`), which reuses the older `StatusBadge`/`statusTokens` pair for business-record
 * status; module implementation status has no earlier precedent, so this uses the newer, general-
 * purpose `Badge`/`statusBadgeTokens` pair the design system built for exactly this kind of case.
 */
const MODULE_STATUS_BADGE: Readonly<
  Record<ModuleRegistrySummary["implementationStatus"], { bucket: StatusBadgeToken; label: string }>
> = {
  not_started: { bucket: "neutral", label: "Not started" },
  foundation_only: { bucket: "neutral", label: "Foundation only" },
  in_development: { bucket: "informational", label: "In development" },
  ready_for_review: { bucket: "attention", label: "Ready for review" },
  approved: { bucket: "healthy", label: "Approved" },
  available: { bucket: "healthy", label: "Available" },
  deferred: { bucket: "neutral", label: "Deferred" },
  blocked: { bucket: "blocked", label: "Blocked" },
  deprecated: { bucket: "neutral", label: "Deprecated" },
};

export function moduleImplementationStatusBadge(
  status: ModuleRegistrySummary["implementationStatus"],
): { readonly bucket: StatusBadgeToken; readonly label: string } {
  return MODULE_STATUS_BADGE[status];
}
