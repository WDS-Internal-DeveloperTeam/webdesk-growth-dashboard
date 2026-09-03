import Link from "next/link";
import { notFound } from "next/navigation";
import { ContentContainer, Fact, PageHeader, StatusBadge } from "@webdesk/ui";
import { HelpCenterPublishActions } from "@/components/help-center-publish-actions";
import { SanitizedRichText } from "@/components/sanitized-rich-text";
import { primaryActionLinkStyle } from "@/lib/action-link-style";
import { dlStyle, h2Style, richContentStyle, sectionStyle } from "@/lib/detail-section-styles";
import {
  CATEGORY_LABEL,
  formatTimestamp,
  getHelpArticle,
  helpArticlePublishBadge,
} from "@/lib/help-center";
import { getServerSession } from "@/lib/server-session";

export const dynamic = "force-dynamic";

interface HelpCenterDetailPageProps {
  readonly params: Promise<{ articleId: string }>;
}

/**
 * No approved wireframe exists for this module — sections mirror
 * `03_Detailed_Module_Specifications.md §38`'s own field grouping (Identity, Content, Status),
 * rendered as sections rather than client-side tabs, the same simplification the Content Template/
 * Persona Library detail pages already establish. No Status Actions component — this module has
 * no `approvalStatus`, only the plain publish/unpublish toggle (`HelpCenterPublishActions`).
 */
export default async function HelpCenterDetailPage({ params }: HelpCenterDetailPageProps) {
  const session = await getServerSession();
  if (!session) {
    return null;
  }

  const { articleId } = await params;
  const article = await getHelpArticle(articleId);
  if (!article) {
    notFound();
  }

  const publishBadge = helpArticlePublishBadge(article.isPublished);

  return (
    <ContentContainer>
      <PageHeader
        title={article.title}
        breadcrumbs={[{ label: "Help Center", href: "/help-center" }, { label: article.title }]}
        linkComponent={Link}
        statusBadge={<StatusBadge status={publishBadge.token} label={publishBadge.label} />}
        contextActions={
          <>
            <HelpCenterPublishActions articleId={article.id} isPublished={article.isPublished} />
            <Link href={`/help-center/${article.id}/edit`} style={primaryActionLinkStyle}>
              Edit
            </Link>
          </>
        }
      />

      <section style={sectionStyle}>
        <h2 style={h2Style}>Identity</h2>
        <dl style={dlStyle}>
          <Fact label="Category">{CATEGORY_LABEL[article.category]}</Fact>
          <Fact label="Created">{formatTimestamp(article.createdAt)}</Fact>
          <Fact label="Updated">{formatTimestamp(article.updatedAt)}</Fact>
        </dl>
      </section>

      <section style={sectionStyle}>
        <h2 style={h2Style}>Content</h2>
        <SanitizedRichText html={article.content} style={richContentStyle} />
      </section>

      <section style={sectionStyle}>
        <h2 style={h2Style}>Status</h2>
        <dl style={dlStyle}>
          <Fact label="Publish status">
            <StatusBadge status={publishBadge.token} label={publishBadge.label} />
          </Fact>
          <Fact label="Published">
            {article.publishedAt ? formatTimestamp(article.publishedAt) : "Never"}
          </Fact>
        </dl>
      </section>
    </ContentContainer>
  );
}
