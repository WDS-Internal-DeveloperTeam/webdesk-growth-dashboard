import Link from "next/link";
import { redirect } from "next/navigation";
import { ContentContainer, PageHeader } from "@webdesk/ui";
import { InternalLinkForm } from "@/components/internal-link-form";
import { getPagesForInternalLinkPicker } from "@/lib/internal-linking-library";
import { getProject } from "@/lib/projects";
import { firstValue } from "@/lib/search-params";
import { getServerSession } from "@/lib/server-session";

export const dynamic = "force-dynamic";

interface NewInternalLinkPageProps {
  readonly searchParams: Promise<Record<string, string | string[] | undefined>>;
}

/**
 * Requires `?projectId=` — internal links are project-scoped, and the backend's own create route
 * (`internal-linking-library/projects/:projectId/links`) hard-requires it as a real path segment. A
 * missing or unresolvable `projectId` redirects back to the list page's own project-picker prompt,
 * rather than rendering a form with nowhere valid to submit to.
 */
export default async function NewInternalLinkPage({ searchParams }: NewInternalLinkPageProps) {
  const session = await getServerSession();
  if (!session) {
    return null;
  }

  const rawParams = await searchParams;
  const projectIdParam = firstValue(rawParams.projectId);
  const project = projectIdParam ? await getProject(projectIdParam) : null;
  if (!project) {
    redirect("/internal-linking-library");
  }

  const pages = await getPagesForInternalLinkPicker(project.id);

  return (
    <ContentContainer>
      <PageHeader
        title="New link"
        breadcrumbs={[
          { label: "Internal Linking Library", href: "/internal-linking-library" },
          { label: "New link" },
        ]}
        linkComponent={Link}
      />
      <InternalLinkForm mode="create" projectId={project.id} pages={pages} />
    </ContentContainer>
  );
}
