import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ContentContainer, PageHeader } from "@webdesk/ui";
import { PageForm } from "@/components/page-form";
import { getPage, withProjectId } from "@/lib/page-inventory";
import { getProject } from "@/lib/projects";
import { firstValue } from "@/lib/search-params";
import { getServerSession } from "@/lib/server-session";

export const dynamic = "force-dynamic";

interface EditPagePageProps {
  readonly params: Promise<{ pageId: string }>;
  readonly searchParams: Promise<Record<string, string | string[] | undefined>>;
}

export default async function EditPagePage({ params, searchParams }: EditPagePageProps) {
  const session = await getServerSession();
  if (!session) {
    return null;
  }

  const rawParams = await searchParams;
  const projectIdParam = firstValue(rawParams.projectId);
  const project = projectIdParam ? await getProject(projectIdParam) : null;
  if (!project) {
    redirect("/page-inventory");
  }

  const { pageId } = await params;
  const page = await getPage(project.id, pageId);
  if (!page) {
    notFound();
  }
  // The backend rejects any edit of a terminal (archived/superseded) page with a clean 400
  // (code-review finding — this guard, and the backend check it relies on, were both missing;
  // see `pages.service.ts`'s own `update()` doc comment). Redirect straight back to the detail
  // page rather than rendering a form whose submit is guaranteed to fail — matches the detail
  // page's own precedent of hiding the Edit link entirely for these same two states.
  if (page.workflowStage === "archived" || page.workflowStage === "superseded") {
    redirect(withProjectId(`/page-inventory/${page.id}`, project.id));
  }

  return (
    <ContentContainer>
      <PageHeader
        title={`Edit ${page.pageName}`}
        breadcrumbs={[
          { label: "Page Inventory", href: "/page-inventory" },
          { label: page.pageName, href: withProjectId(`/page-inventory/${page.id}`, project.id) },
          { label: "Edit" },
        ]}
        linkComponent={Link}
      />
      <PageForm mode="edit" projectId={project.id} pageId={page.id} initial={page} />
    </ContentContainer>
  );
}
