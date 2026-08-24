import Link from "next/link";
import { redirect } from "next/navigation";
import { ContentContainer, PageHeader } from "@webdesk/ui";
import { KeywordForm } from "@/components/keyword-form";
import { getProject } from "@/lib/projects";
import { firstValue } from "@/lib/search-params";
import { getServerSession } from "@/lib/server-session";

export const dynamic = "force-dynamic";

interface NewKeywordPageProps {
  readonly searchParams: Promise<Record<string, string | string[] | undefined>>;
}

/**
 * Requires `?projectId=` — keywords are project-scoped, and the backend's own create route
 * (`keyword-and-entity-library/projects/:projectId/keywords`) hard-requires it as a real path
 * segment. A missing or unresolvable `projectId` redirects back to the list page's own
 * project-picker prompt, rather than rendering a form with nowhere valid to submit to.
 */
export default async function NewKeywordPage({ searchParams }: NewKeywordPageProps) {
  const session = await getServerSession();
  if (!session) {
    return null;
  }

  const rawParams = await searchParams;
  const projectIdParam = firstValue(rawParams.projectId);
  const project = projectIdParam ? await getProject(projectIdParam) : null;
  if (!project) {
    redirect("/keyword-and-entity-library");
  }

  return (
    <ContentContainer>
      <PageHeader
        title="New keyword"
        breadcrumbs={[
          { label: "Keyword & Entity Library", href: "/keyword-and-entity-library" },
          { label: "New keyword" },
        ]}
        linkComponent={Link}
      />
      <KeywordForm mode="create" projectId={project.id} />
    </ContentContainer>
  );
}
