import Link from "next/link";
import { notFound } from "next/navigation";
import type { AdminUserRoleAssignment } from "@webdesk/shared-types";
import { ContentContainer, EmptyState, Fact, PageHeader, StatusBadge } from "@webdesk/ui";
import { UserStatusActions } from "@/components/user-status-actions";
import { dlStyle, h2Style, sectionStyle } from "@/lib/detail-section-styles";
import { listTableCellStyle, listTableHeaderCellStyle } from "@/lib/list-table-styles";
import { getServerSession } from "@/lib/server-session";
import {
  adminUserStatusBadge,
  formatTimestamp,
  getAdminUserDetail,
} from "@/lib/users-roles-permissions";

export const dynamic = "force-dynamic";

interface UsersRolesPermissionsDetailPageProps {
  readonly params: Promise<{ userId: string }>;
}

/**
 * No approved wireframe exists for this module — sections mirror the backend's own field grouping
 * (Identity, Role assignments, Status), rendered as sections rather than client-side tabs, the
 * same simplification every sibling detail page already establishes. Global-scope assignments
 * (`projectId: null`) render first, then project-scoped ones — no project-name resolution here
 * (this page shows only the raw project id for a scoped assignment; resolving it to a project
 * name would mean a `getProjectsByIds()`-shaped batch fetch this module's own scope explicitly
 * declined to build, matching `getUsersByIds()`'s own already-accepted N-fetch debt elsewhere in
 * this app rather than adding a new one here).
 */
export default async function UsersRolesPermissionsDetailPage({
  params,
}: UsersRolesPermissionsDetailPageProps) {
  const session = await getServerSession();
  if (!session) {
    return null;
  }

  const { userId } = await params;
  const detail = await getAdminUserDetail(userId);
  if (!detail) {
    notFound();
  }

  const { user, roleAssignments } = detail;
  const badge = adminUserStatusBadge(user.accountStatus);
  const globalAssignments = roleAssignments.filter((assignment) => assignment.projectId === null);
  const projectAssignments = roleAssignments.filter((assignment) => assignment.projectId !== null);

  return (
    <ContentContainer>
      <PageHeader
        title={user.displayName}
        breadcrumbs={[
          { label: "Users, Roles and Permissions", href: "/users-roles-and-permissions" },
          { label: user.displayName },
        ]}
        linkComponent={Link}
        statusBadge={<StatusBadge status={badge.token} label={badge.label} />}
        contextActions={<UserStatusActions userId={user.id} accountStatus={user.accountStatus} />}
      />

      <section style={sectionStyle}>
        <h2 style={h2Style}>Identity</h2>
        <dl style={dlStyle}>
          <Fact label="Email">{user.email}</Fact>
          <Fact label="Last login">
            {user.lastLoginAt ? formatTimestamp(user.lastLoginAt) : "Never"}
          </Fact>
          <Fact label="Created">{formatTimestamp(user.createdAt)}</Fact>
          <Fact label="Updated">{formatTimestamp(user.updatedAt)}</Fact>
        </dl>
      </section>

      <section style={sectionStyle}>
        <h2 style={h2Style}>Role assignments</h2>
        {roleAssignments.length === 0 ? (
          <EmptyState
            title="No role assignments"
            description="This user holds no role — global or project-scoped."
          />
        ) : (
          <RoleAssignmentTable
            globalAssignments={globalAssignments}
            projectAssignments={projectAssignments}
          />
        )}
      </section>

      <section style={sectionStyle}>
        <h2 style={h2Style}>Status</h2>
        <dl style={dlStyle}>
          <Fact label="Account status">
            <StatusBadge status={badge.token} label={badge.label} />
          </Fact>
        </dl>
      </section>
    </ContentContainer>
  );
}

function RoleAssignmentTable({
  globalAssignments,
  projectAssignments,
}: {
  readonly globalAssignments: readonly AdminUserRoleAssignment[];
  readonly projectAssignments: readonly AdminUserRoleAssignment[];
}) {
  return (
    <div style={{ overflowX: "auto" }}>
      <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.875rem" }}>
        <thead>
          <tr>
            <th style={listTableHeaderCellStyle}>Role</th>
            <th style={listTableHeaderCellStyle}>Scope</th>
          </tr>
        </thead>
        <tbody>
          {globalAssignments.map((assignment) => (
            <tr key={`${assignment.roleId}-global`}>
              <td style={listTableCellStyle}>{assignment.roleName}</td>
              <td style={listTableCellStyle}>Global</td>
            </tr>
          ))}
          {projectAssignments.map((assignment) => (
            <tr key={`${assignment.roleId}-${assignment.projectId}`}>
              <td style={listTableCellStyle}>{assignment.roleName}</td>
              <td style={listTableCellStyle}>Project {assignment.projectId}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
