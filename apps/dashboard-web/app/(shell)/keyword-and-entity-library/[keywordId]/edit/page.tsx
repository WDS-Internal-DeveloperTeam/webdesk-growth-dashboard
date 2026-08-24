import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ContentContainer, PageHeader } from "@webdesk/ui";
import { KeywordForm } from "@/components/keyword-form";
import { getKeyword, withProjectId } from "@/lib/keyword-and-entity-library";
import { getProject } from "@/lib/projects";
import { firstValue } from "@/lib/search-params";
import { getServerSession } from "@/lib/server-session";

export const dynamic = "force-dynamic";

interface EditKeywordPageProps {
  readonly params: Promise<{ keywordId: string }>;
  readonly searchParams: Promise<Record<string, string | string[] | undefined>>;
}

export default async function EditKeywordPage({ params, searchParams }: EditKeywordPageProps) {
  const session = await getServerSession();
  if (!session) {
    return null;
  }

  const rawParams = await searchParams;
  const projectIdParam = firstValue(rawParams.projectId);
  const project = projectIdParam ? await getProject(projectIdParam) : null;
  if (!project) {
    redirect("/keyword-and-entity-library");
  }

  const { keywordId } = await params;
  const keyword = await getKeyword(project.id, keywordId);
  if (!keyword) {
    notFound();
  }
  // The backend rejects any edit of a terminal (archived/superseded) keyword with a clean 400
  // (`KeywordsService.update()`'s own guard). Redirect straight back to the detail page rather than
  // rendering a form whose submit is guaranteed to fail — matches the detail page's own precedent
  // of hiding the Edit link entirely for these same two states.
  if (keyword.approvalStatus === "archived" || keyword.approvalStatus === "superseded") {
    redirect(withProjectId(`/keyword-and-entity-library/${keyword.id}`, project.id));
  }

  return (
    <ContentContainer>
      <PageHeader
        title={`Edit ${keyword.queryText}`}
        breadcrumbs={[
          { label: "Keyword & Entity Library", href: "/keyword-and-entity-library" },
          {
            label: keyword.queryText,
            href: withProjectId(`/keyword-and-entity-library/${keyword.id}`, project.id),
          },
          { label: "Edit" },
        ]}
        linkComponent={Link}
      />
      <KeywordForm mode="edit" projectId={project.id} keywordId={keyword.id} initial={keyword} />
    </ContentContainer>
  );
}
