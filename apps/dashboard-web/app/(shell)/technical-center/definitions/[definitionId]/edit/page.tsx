import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ContentContainer, PageHeader } from "@webdesk/ui";
import { TechnicalCheckDefinitionForm } from "@/components/technical-check-definition-form";
import { getProject } from "@/lib/projects";
import { firstValue } from "@/lib/search-params";
import { getServerSession } from "@/lib/server-session";
import { getTechnicalCheckDefinition, withProjectId } from "@/lib/technical-center";

export const dynamic = "force-dynamic";

interface EditTechnicalCheckDefinitionPageProps {
  readonly params: Promise<{ definitionId: string }>;
  readonly searchParams: Promise<Record<string, string | string[] | undefined>>;
}

export default async function EditTechnicalCheckDefinitionPage({
  params,
  searchParams,
}: EditTechnicalCheckDefinitionPageProps) {
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

  const { definitionId } = await params;
  const definition = await getTechnicalCheckDefinition(project.id, definitionId);
  if (!definition) {
    notFound();
  }

  return (
    <ContentContainer>
      <PageHeader
        title={`Edit ${definition.name}`}
        breadcrumbs={[
          { label: "Technical Center", href: withProjectId("/technical-center", project.id) },
          {
            label: definition.name,
            href: withProjectId(`/technical-center/definitions/${definition.id}`, project.id),
          },
          { label: "Edit" },
        ]}
        linkComponent={Link}
      />
      <TechnicalCheckDefinitionForm mode="edit" projectId={project.id} initial={definition} />
    </ContentContainer>
  );
}
