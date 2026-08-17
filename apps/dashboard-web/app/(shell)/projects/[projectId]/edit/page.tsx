import Link from "next/link";
import { notFound } from "next/navigation";
import { ContentContainer, PageHeader } from "@webdesk/ui";
import { ProjectForm } from "@/components/project-form";
import { getProject } from "@/lib/projects";
import { getServerSession } from "@/lib/server-session";
import { getUser } from "@/lib/users";

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
  const project = await getProject(projectId);
  if (!project) {
    notFound();
  }
  // Resolved server-side, alongside the project itself, so the picker never flashes an empty
  // state before a client-side lookup lands — null covers both "no owner assigned" and "the
  // assigned owner no longer resolves" (disabled/removed) identically.
  const owner = project.ownerUserId ? await getUser(project.ownerUserId) : null;

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
          owner,
        }}
      />
    </ContentContainer>
  );
}
