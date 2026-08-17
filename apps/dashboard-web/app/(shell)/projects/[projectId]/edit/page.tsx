import Link from "next/link";
import { notFound } from "next/navigation";
import { ContentContainer, PageHeader } from "@webdesk/ui";
import type { UserSummary } from "@webdesk/shared-types";
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
  // assigned owner no longer resolves" (disabled/removed) identically. Wrapped in try/catch: this
  // is a secondary, non-essential lookup (the page's primary content — name/description/
  // confidentiality — doesn't depend on it), so a transient backend failure here must degrade to
  // "owner unresolved" rather than crashing the whole edit page via the error boundary. The raw
  // project.ownerUserId is still passed through separately below regardless of resolution success,
  // so ProjectForm can preserve an unresolvable owner assignment rather than silently clearing it.
  let owner: UserSummary | null = null;
  if (project.ownerUserId) {
    try {
      owner = await getUser(project.ownerUserId);
    } catch (error) {
      console.error("Failed to resolve project owner for the edit form", error);
    }
  }

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
          ownerUserId: project.ownerUserId,
        }}
      />
    </ContentContainer>
  );
}
