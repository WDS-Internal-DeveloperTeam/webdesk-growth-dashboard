import Link from "next/link";
import type { PermissionMatrixGrant } from "@webdesk/shared-types";
import { ContentContainer, PageHeader } from "@webdesk/ui";
import { listTableCellStyle, listTableHeaderCellStyle } from "@/lib/list-table-styles";
import { getServerSession } from "@/lib/server-session";
import { getPermissionMatrix } from "@/lib/users-roles-permissions";

export const dynamic = "force-dynamic";

/**
 * Same single-letter action codes `06_Roles_and_Permissions.md §3`/
 * `packages/database/src/migrations/00013-seed-rbac-matrix.ts`'s own `LETTER_ACTIONS` use — this
 * is the display-side reverse of that map (action name → its letter), kept local to this one
 * read-only page rather than promoted to a shared lib, since nothing else in `dashboard-web`
 * needs it. `publish`/`unpublish` both map to `P`; `release`/`rollback` both map to `L`, matching
 * the seed script's own many-to-one letter grouping exactly.
 */
const ACTION_TO_LETTER: Readonly<Record<string, string>> = {
  view: "V",
  create: "C",
  edit: "E",
  submit: "S",
  review: "R",
  approve: "A",
  publish: "P",
  unpublish: "P",
  release: "L",
  rollback: "L",
  export: "X",
  configure: "M",
};

/**
 * A read-only viewer over the real seeded RBAC matrix (all 7 roles × all 21 permission-group
 * modules × every global-scope grant) — deliberately read-only, confirmed with the project owner
 * before building: the matrix itself stays migration-seeded, no grant-editing endpoint exists.
 * No approved wireframe exists for this screen; renders the same roles-as-rows,
 * modules-as-columns grid `06_Roles_and_Permissions.md §3` itself uses, with each cell showing
 * the granted actions' letter codes (or an em dash for no access) rather than a full action-name
 * list, matching that source document's own compact notation.
 */
export default async function PermissionMatrixPage() {
  const session = await getServerSession();
  if (!session) {
    return null;
  }

  const { roles, modules, grants } = await getPermissionMatrix();

  const grantsByRoleAndModule = new Map<string, readonly PermissionMatrixGrant[]>();
  for (const grant of grants) {
    const key = `${grant.roleId}:${grant.moduleId}`;
    const existing = grantsByRoleAndModule.get(key) ?? [];
    grantsByRoleAndModule.set(key, [...existing, grant]);
  }

  return (
    <ContentContainer>
      <PageHeader
        title="Permission matrix"
        breadcrumbs={[
          { label: "Users, Roles and Permissions", href: "/users-roles-and-permissions" },
          { label: "Permission matrix" },
        ]}
        linkComponent={Link}
      />

      <p
        style={{
          fontSize: "0.875rem",
          color: "var(--webdesk-dashboard-color-foreground-muted)",
          marginBottom: "1.5rem",
        }}
      >
        Global-scope grants only. V=view, C=create, E=edit, S=submit, R=review, A=approve,
        P=publish/unpublish, L=release/rollback, X=export, M=configure.
      </p>

      <div style={{ overflowX: "auto" }}>
        <table style={{ borderCollapse: "collapse", fontSize: "0.8125rem" }}>
          <thead>
            <tr>
              <th
                style={{
                  ...listTableHeaderCellStyle,
                  position: "sticky",
                  left: 0,
                  background: "var(--webdesk-dashboard-color-surface)",
                }}
              >
                Role
              </th>
              {modules.map((module) => (
                <th
                  key={module.id}
                  style={{ ...listTableHeaderCellStyle, whiteSpace: "nowrap" }}
                  title={module.name}
                >
                  {module.key}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {roles.map((role) => (
              <tr key={role.id}>
                <td
                  style={{
                    ...listTableCellStyle,
                    fontWeight: 600,
                    position: "sticky",
                    left: 0,
                    background: "var(--webdesk-dashboard-color-surface)",
                  }}
                >
                  {role.name}
                </td>
                {modules.map((module) => {
                  const cellGrants = grantsByRoleAndModule.get(`${role.id}:${module.id}`) ?? [];
                  const letters = [
                    ...new Set(
                      cellGrants.map((grant) => ACTION_TO_LETTER[grant.action] ?? grant.action),
                    ),
                  ].sort();
                  return (
                    <td
                      key={module.id}
                      style={{
                        ...listTableCellStyle,
                        textAlign: "center",
                        color:
                          letters.length === 0
                            ? "var(--webdesk-dashboard-color-foreground-subtle)"
                            : undefined,
                      }}
                    >
                      {letters.length > 0 ? letters.join("") : "—"}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </ContentContainer>
  );
}
