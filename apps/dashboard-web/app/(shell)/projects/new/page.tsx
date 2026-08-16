import Link from "next/link";
import { ContentContainer, PageHeader } from "@webdesk/ui";
import { getServerSession } from "@/lib/server-session";
import { ProjectForm } from "@/components/project-form";

export const dynamic = "force-dynamic";

export default async function NewProjectPage() {
  // The (shell) layout already redirects unauthenticated callers before this page renders — a
  // defensive fallback only, same pattern as the list and detail pages.
  const session = await getServerSession();
  if (!session) {
    return null;
  }

  return (
    <ContentContainer>
      <PageHeader
        title="New project"
        breadcrumbs={[{ label: "Projects", href: "/projects" }, { label: "New project" }]}
        linkComponent={Link}
      />
      <ProjectForm mode="create" />
    </ContentContainer>
  );
}
