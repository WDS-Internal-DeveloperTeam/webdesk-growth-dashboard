import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ContentContainer, PageHeader } from "@webdesk/ui";
import { EntityForm } from "@/components/entity-form";
import { getEntity, withProjectId } from "@/lib/keyword-and-entity-library";
import { getProject } from "@/lib/projects";
import { firstValue } from "@/lib/search-params";
import { getServerSession } from "@/lib/server-session";

export const dynamic = "force-dynamic";

interface EditEntityPageProps {
  readonly params: Promise<{ entityId: string }>;
  readonly searchParams: Promise<Record<string, string | string[] | undefined>>;
}

export default async function EditEntityPage({ params, searchParams }: EditEntityPageProps) {
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

  const { entityId } = await params;
  const entity = await getEntity(project.id, entityId);
  if (!entity) {
    notFound();
  }

  return (
    <ContentContainer>
      <PageHeader
        title={`Edit ${entity.name}`}
        breadcrumbs={[
          { label: "Keyword & Entity Library", href: "/keyword-and-entity-library" },
          { label: "Entities", href: "/keyword-and-entity-library/entities" },
          {
            label: entity.name,
            href: withProjectId(`/keyword-and-entity-library/entities/${entity.id}`, project.id),
          },
          { label: "Edit" },
        ]}
        linkComponent={Link}
      />
      <EntityForm mode="edit" projectId={project.id} entityId={entity.id} initial={entity} />
    </ContentContainer>
  );
}
