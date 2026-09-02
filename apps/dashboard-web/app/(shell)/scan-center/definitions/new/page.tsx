import Link from "next/link";
import { redirect } from "next/navigation";
import { ContentContainer, PageHeader } from "@webdesk/ui";
import { ScanDefinitionForm } from "@/components/scan-definition-form";
import { getProject } from "@/lib/projects";
import { firstValue } from "@/lib/search-params";
import { getServerSession } from "@/lib/server-session";

export const dynamic = "force-dynamic";

interface NewScanDefinitionPageProps {
  readonly searchParams: Promise<Record<string, string | string[] | undefined>>;
}

/**
 * Requires `?projectId=` — scan definitions are project-scoped, and the backend's own create
 * route (`scan-center/projects/:projectId/definitions`) hard-requires it as a real path segment.
 * A missing or unresolvable `projectId` redirects back to the list page's own project-picker
 * prompt, matching `NewPagePage`'s/`NewKeywordPage`'s own identical precedent.
 */
export default async function NewScanDefinitionPage({ searchParams }: NewScanDefinitionPageProps) {
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

  return (
    <ContentContainer>
      <PageHeader
        title="New scan definition"
        breadcrumbs={[{ label: "Scan Center", href: "/scan-center" }, { label: "New definition" }]}
        linkComponent={Link}
      />
      <ScanDefinitionForm mode="create" projectId={project.id} />
    </ContentContainer>
  );
}
