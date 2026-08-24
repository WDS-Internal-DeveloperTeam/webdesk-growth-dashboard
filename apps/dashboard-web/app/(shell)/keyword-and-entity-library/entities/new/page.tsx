import Link from "next/link";
import { redirect } from "next/navigation";
import { ContentContainer, PageHeader } from "@webdesk/ui";
import { EntityForm } from "@/components/entity-form";
import { getProject } from "@/lib/projects";
import { firstValue } from "@/lib/search-params";
import { getServerSession } from "@/lib/server-session";

export const dynamic = "force-dynamic";

interface NewEntityPageProps {
  readonly searchParams: Promise<Record<string, string | string[] | undefined>>;
}

export default async function NewEntityPage({ searchParams }: NewEntityPageProps) {
  const session = await getServerSession();
  if (!session) {
    return null;
  }

  const rawParams = await searchParams;
  const projectIdParam = firstValue(rawParams.projectId);
  const project = projectIdParam ? await getProject(projectIdParam) : null;
  if (!project) {
    redirect("/keyword-and-entity-library/entities");
  }

  return (
    <ContentContainer>
      <PageHeader
        title="New entity"
        breadcrumbs={[
          { label: "Keyword & Entity Library", href: "/keyword-and-entity-library" },
          { label: "Entities", href: "/keyword-and-entity-library/entities" },
          { label: "New entity" },
        ]}
        linkComponent={Link}
      />
      <EntityForm mode="create" projectId={project.id} />
    </ContentContainer>
  );
}
