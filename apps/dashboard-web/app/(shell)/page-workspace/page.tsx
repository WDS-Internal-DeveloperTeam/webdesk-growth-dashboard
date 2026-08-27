import { cookies } from "next/headers";
import Link from "next/link";
import { ContentContainer, EmptyState, PageHeader, StatusBadge } from "@webdesk/ui";
import { ProjectPickerForm } from "@/components/project-picker-form";
import { CURRENT_PROJECT_COOKIE } from "@/lib/current-project";
import { listTableCellStyle, listTableHeaderCellStyle } from "@/lib/list-table-styles";
import { getPages, parsePageInventorySearchParams } from "@/lib/page-inventory";
import {
  buildWorkspaceHref,
  DEFAULT_TAB_KEY,
  lifecycleStageBadge,
} from "@/lib/page-workspace-query";
import { getProject, getProjects } from "@/lib/projects";
import { firstValue } from "@/lib/search-params";
import { getServerSession } from "@/lib/server-session";
import { tolerateDiscard } from "@/lib/business-knowledge";

export const dynamic = "force-dynamic";

interface PageWorkspaceListPageProps {
  readonly searchParams: Promise<Record<string, string | string[] | undefined>>;
}

/**
 * The entry point into the Page Workspace (task package D4). `/page-workspace` is the module's own
 * seeded `module_registry.route`, so it already has a sidebar entry — leaving it unreachable would
 * dead-end real navigation.
 *
 * Deliberately NOT a second Page Inventory: it reuses `getPages()` and shows only what is needed to
 * choose a page and see where each one stands in its delivery lifecycle. Filtering, classification
 * and SEO state all remain Page Inventory's job; duplicating them here would create two competing
 * page lists.
 */
export default async function PageWorkspaceListPage({ searchParams }: PageWorkspaceListPageProps) {
  const session = await getServerSession();
  if (!session) {
    return null;
  }

  const rawParams = await searchParams;
  const projectIdParam = firstValue(rawParams.projectId);

  // Fired concurrently with the project-existence check rather than after it, matching Page
  // Inventory's own precedent; tolerateDiscard() keeps the abandoned promise from surfacing an
  // unhandled rejection on the project-picker branch.
  const pagesPromise = projectIdParam
    ? tolerateDiscard(getPages(parsePageInventorySearchParams(projectIdParam, rawParams)))
    : null;

  const project = projectIdParam ? await getProject(projectIdParam) : null;

  if (!project) {
    const cookieStore = await cookies();
    const defaultProjectId = cookieStore.get(CURRENT_PROJECT_COOKIE)?.value ?? null;
    const { items: projects } = await getProjects({
      search: null,
      status: null,
      sortBy: "name",
      sortOrder: "ASC",
      offset: 0,
      pageSize: 100,
    });
    return (
      <ContentContainer>
        <PageHeader title="Page Workspace" />
        <p>Choose a project to see its pages and open a page&rsquo;s workspace.</p>
        <ProjectPickerForm
          projects={projects}
          defaultProjectId={defaultProjectId}
          submitLabel="Open workspace"
        />
      </ContentContainer>
    );
  }

  const { items: pages } = await pagesPromise!;

  return (
    <ContentContainer>
      <PageHeader title="Page Workspace" />
      <p>
        Pages in {project.name}. Open a page to work through its 16 artifact tabs and delivery
        lifecycle.
      </p>
      {pages.length === 0 ? (
        <EmptyState
          title="No pages yet"
          description="Pages are created in Page Inventory. Once a page exists, its workspace opens here."
        />
      ) : (
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead>
            <tr>
              <th style={listTableHeaderCellStyle}>Page</th>
              <th style={listTableHeaderCellStyle}>Lifecycle stage</th>
              <th style={listTableHeaderCellStyle}>Public ID</th>
            </tr>
          </thead>
          <tbody>
            {pages.map((page) => {
              const badge = lifecycleStageBadge(page.lifecycleStage);
              return (
                <tr key={page.id}>
                  <td style={listTableCellStyle}>
                    <Link href={buildWorkspaceHref(page.id, project.id, DEFAULT_TAB_KEY)}>
                      {page.pageName}
                    </Link>
                  </td>
                  <td style={listTableCellStyle}>
                    <StatusBadge status={badge.token} label={badge.label} />
                  </td>
                  <td style={listTableCellStyle}>{page.publicId}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}
    </ContentContainer>
  );
}
