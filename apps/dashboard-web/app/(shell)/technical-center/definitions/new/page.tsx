import Link from "next/link";
import { redirect } from "next/navigation";
import { ContentContainer, PageHeader } from "@webdesk/ui";
import { TechnicalCheckDefinitionForm } from "@/components/technical-check-definition-form";
import { getProject } from "@/lib/projects";
import { firstValue } from "@/lib/search-params";
import { getServerSession } from "@/lib/server-session";

export const dynamic = "force-dynamic";

interface NewTechnicalCheckDefinitionPageProps {
  readonly searchParams: Promise<Record<string, string | string[] | undefined>>;
}

/**
 * Requires `?projectId=` — technical check definitions are project-scoped, and the backend's own
 * create route (`technical-center/projects/:projectId/definitions`) hard-requires it as a real
 * path segment. A missing or unresolvable `projectId` redirects back to the list page's own
 * project-picker prompt, matching `NewScanDefinitionPage`'s own identical precedent.
 */
export default async function NewTechnicalCheckDefinitionPage({
  searchParams,
}: NewTechnicalCheckDefinitionPageProps) {
  const session = await getServerSession();
  if (!session) {
    return null;
  }

  const rawParams = await searchParams;
  const projectIdParam = firstValue(rawParams.projectId);
  const project = projectIdParam ? await getProject(projectIdParam) : null;
  if (!project) {
    redirect("/technical-center");
  }

  return (
    <ContentContainer>
      <PageHeader
        title="New technical check definition"
        breadcrumbs={[
          { label: "Technical Center", href: "/technical-center" },
          { label: "New definition" },
        ]}
        linkComponent={Link}
      />
      <TechnicalCheckDefinitionForm mode="create" projectId={project.id} />
    </ContentContainer>
  );
}
