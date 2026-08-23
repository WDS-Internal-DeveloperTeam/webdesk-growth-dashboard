import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ContentContainer, PageHeader } from "@webdesk/ui";
import { PageForm } from "@/components/page-form";
import { getPage } from "@/lib/page-inventory";
import { getProject } from "@/lib/projects";
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
  const projectIdParam = Array.isArray(rawParams.projectId)
    ? rawParams.projectId[0]
    : rawParams.projectId;
  const project = projectIdParam ? await getProject(projectIdParam) : null;
  if (!project) {
    redirect("/page-inventory");
  }

  const { pageId } = await params;
  const page = await getPage(project.id, pageId);
  if (!page) {
    notFound();
  }

  return (
    <ContentContainer>
      <PageHeader
        title={`Edit ${page.pageName}`}
        breadcrumbs={[
          { label: "Page Inventory", href: "/page-inventory" },
          { label: page.pageName, href: `/page-inventory/${page.id}?projectId=${project.id}` },
          { label: "Edit" },
        ]}
        linkComponent={Link}
      />
      <PageForm mode="edit" projectId={project.id} pageId={page.id} initial={page} />
    </ContentContainer>
  );
}
