import Link from "next/link";
import { redirect } from "next/navigation";
import { ContentContainer, PageHeader } from "@webdesk/ui";
import { PageForm } from "@/components/page-form";
import { getProject } from "@/lib/projects";
import { firstValue } from "@/lib/search-params";
import { getServerSession } from "@/lib/server-session";

export const dynamic = "force-dynamic";

interface NewPagePageProps {
  readonly searchParams: Promise<Record<string, string | string[] | undefined>>;
}

/**
 * Requires `?projectId=` — pages are project-scoped, and the backend's own create route
 * (`page-inventory/projects/:projectId/pages`) hard-requires it as a real path segment. A missing
 * or unresolvable `projectId` redirects back to the list page's own project-picker prompt, rather
 * than rendering a form with nowhere valid to submit to.
 */
export default async function NewPagePage({ searchParams }: NewPagePageProps) {
  const session = await getServerSession();
  if (!session) {
    return null;
  }

  const rawParams = await searchParams;
  const projectIdParam = firstValue(rawParams.projectId);
  const project = projectIdParam ? await getProject(projectIdParam) : null;
  if (!project) {
    redirect("/page-inventory");
  }

  return (
    <ContentContainer>
      <PageHeader
        title="New page"
        breadcrumbs={[{ label: "Page Inventory", href: "/page-inventory" }, { label: "New page" }]}
        linkComponent={Link}
      />
      <PageForm mode="create" projectId={project.id} />
    </ContentContainer>
  );
}
