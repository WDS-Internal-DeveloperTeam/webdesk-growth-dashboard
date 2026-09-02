import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ContentContainer, PageHeader } from "@webdesk/ui";
import { ScanDefinitionForm } from "@/components/scan-definition-form";
import { getProject } from "@/lib/projects";
import { getScanDefinition, withProjectId } from "@/lib/scan-center";
import { firstValue } from "@/lib/search-params";
import { getServerSession } from "@/lib/server-session";

export const dynamic = "force-dynamic";

interface EditScanDefinitionPageProps {
  readonly params: Promise<{ definitionId: string }>;
  readonly searchParams: Promise<Record<string, string | string[] | undefined>>;
}

export default async function EditScanDefinitionPage({
  params,
  searchParams,
}: EditScanDefinitionPageProps) {
  const session = await getServerSession();
  if (!session) {
    return null;
  }

  const rawParams = await searchParams;
  const projectIdParam = firstValue(rawParams.projectId);
  const project = projectIdParam ? await getProject(projectIdParam) : null;
  if (!project) {
    redirect("/scan-center");
  }

  const { definitionId } = await params;
  const definition = await getScanDefinition(project.id, definitionId);
  if (!definition) {
    notFound();
  }

  return (
    <ContentContainer>
      <PageHeader
        title={`Edit ${definition.name}`}
        breadcrumbs={[
          { label: "Scan Center", href: withProjectId("/scan-center", project.id) },
          {
            label: definition.name,
            href: withProjectId(`/scan-center/definitions/${definition.id}`, project.id),
          },
          { label: "Edit" },
        ]}
        linkComponent={Link}
      />
      <ScanDefinitionForm mode="edit" projectId={project.id} initial={definition} />
    </ContentContainer>
  );
}
