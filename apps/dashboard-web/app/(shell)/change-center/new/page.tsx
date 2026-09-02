import Link from "next/link";
import { redirect } from "next/navigation";
import { ContentContainer, PageHeader } from "@webdesk/ui";
import { ChangeRecordForm } from "@/components/change-record-form";
import { sortModulesForPicker } from "@/lib/change-center-query";
import { getProject } from "@/lib/projects";
import { firstValue } from "@/lib/search-params";
import { getServerSession } from "@/lib/server-session";

export const dynamic = "force-dynamic";

interface NewChangeRecordPageProps {
  readonly searchParams: Promise<Record<string, string | string[] | undefined>>;
}

/**
 * Requires `?projectId=` — change records are project-scoped, and the backend's own create route
 * (`change-center/projects/:projectId/records`) hard-requires it as a real path segment. A missing
 * or unresolvable `projectId` redirects back to the list page's own project-picker prompt, rather
 * than rendering a form with nowhere valid to submit to.
 *
 * The `targetModuleKey` picker's own options come from the session's own already-fetched
 * `session.navigation`, mirroring `ReviewForm`'s/`ReadyForClaudeTaskForm`'s own identical
 * reasoning (`GET /authz/module-registry` is gated on a permission most roles lack).
 */
export default async function NewChangeRecordPage({ searchParams }: NewChangeRecordPageProps) {
  const session = await getServerSession();
  if (!session) {
    return null;
  }

  const rawParams = await searchParams;
  const projectIdParam = firstValue(rawParams.projectId);

  const project = projectIdParam ? await getProject(projectIdParam) : null;
  if (!project) {
    redirect("/change-center");
  }

  const modules = sortModulesForPicker(session.navigation);

  return (
    <ContentContainer>
      <PageHeader
        title="New change record"
        breadcrumbs={[{ label: "Change Center", href: "/change-center" }, { label: "New record" }]}
        linkComponent={Link}
      />
      <ChangeRecordForm mode="create" projectId={project.id} modules={modules} />
    </ContentContainer>
  );
}
