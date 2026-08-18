import { cookies } from "next/headers";
import type { ApiSuccessResponse, RoleSummary } from "@webdesk/shared-types";
import { getApiBaseUrl } from "./auth";

const APPROVER_ROLE_KEY = "owner_growth_approver";

/**
 * Resolves the seeded `owner_growth_approver` role's id — needed to construct
 * `DELETE /authz/users/:userId/roles/:roleId?projectId=` (the approver-revoke call reuses the
 * general role-assignment endpoint; there's no project-approvers-specific revoke route). `GET
 * /authz/roles` is gated on `users_roles:view`, the same permission the approvers list itself
 * requires, so most callers of the Approvers section will never reach this — degrades to `null`
 * (not a thrown error) on any non-OK response, exactly like `fetchProjectSummaries()`'s own
 * never-throws-for-optional-content pattern, so a 403 here doesn't break the rest of the page.
 */
export async function getApproverRoleId(): Promise<string | null> {
  const apiBaseUrl = getApiBaseUrl();
  const cookieStore = await cookies();
  try {
    const response = await fetch(`${apiBaseUrl}/authz/roles`, {
      headers: { cookie: cookieStore.toString() },
      cache: "no-store",
    });
    if (!response.ok) {
      return null;
    }
    const body = (await response.json()) as ApiSuccessResponse<readonly RoleSummary[]>;
    return body.data.find((role) => role.key === APPROVER_ROLE_KEY)?.id ?? null;
  } catch (err) {
    console.error("getApproverRoleId: GET /authz/roles request failed", err);
    return null;
  }
}
