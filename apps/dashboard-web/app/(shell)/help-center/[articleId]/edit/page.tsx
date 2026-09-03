import Link from "next/link";
import { notFound } from "next/navigation";
import { ContentContainer, PageHeader } from "@webdesk/ui";
import { HelpCenterForm } from "@/components/help-center-form";
import { getHelpArticle } from "@/lib/help-center";
import { getServerSession } from "@/lib/server-session";

export const dynamic = "force-dynamic";

interface EditHelpArticlePageProps {
  readonly params: Promise<{ articleId: string }>;
}

export default async function EditHelpArticlePage({ params }: EditHelpArticlePageProps) {
  const session = await getServerSession();
  if (!session) {
    return null;
  }

  const { articleId } = await params;
  const article = await getHelpArticle(articleId);
  if (!article) {
    notFound();
  }

  return (
    <ContentContainer>
      <PageHeader
        title={`Edit ${article.title}`}
        breadcrumbs={[
          { label: "Help Center", href: "/help-center" },
          { label: article.title, href: `/help-center/${article.id}` },
          { label: "Edit" },
        ]}
        linkComponent={Link}
      />
      <HelpCenterForm mode="edit" articleId={article.id} initial={article} />
    </ContentContainer>
  );
}
