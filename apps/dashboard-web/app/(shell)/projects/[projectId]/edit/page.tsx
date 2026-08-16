import Link from "next/link";
import { notFound } from "next/navigation";
import { ContentContainer, PageHeader } from "@webdesk/ui";
import { getServerSession } from "@/lib/server-session";
import { getProjectDetail } from "@/lib/projects";
import { ProjectForm } from "@/components/project-form";

export const dynamic = "force-dynamic";

interface EditProjectPageProps {
  readonly params: Promise<{ projectId: string }>;
}

export default async function EditProjectPage({ params }: EditProjectPageProps) {
  const session = await getServerSession();
  if (!session) {
    return null;
  }

  const { projectId } = await params;
  const detail = await getProjectDetail(projectId);
  if (!detail) {
    notFound();
  }

  const { project } = detail;

  return (
    <ContentContainer>
      <PageHeader
        title={`Edit ${project.name}`}
        breadcrumbs={[
          { label: "Projects", href: "/projects" },
          { label: project.name, href: `/projects/${project.id}` },
          { label: "Edit" },
        ]}
        linkComponent={Link}
      />
      <ProjectForm
        mode="edit"
        projectId={project.id}
        initial={{
          publicId: project.publicId,
          name: project.name,
          description: project.description,
          confidentiality: project.confidentiality,
        }}
      />
    </ContentContainer>
  );
}
