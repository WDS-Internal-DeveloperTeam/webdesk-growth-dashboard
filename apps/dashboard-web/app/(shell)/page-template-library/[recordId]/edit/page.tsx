import Link from "next/link";
import { notFound } from "next/navigation";
import { ContentContainer, PageHeader } from "@webdesk/ui";
import { PageTemplateLibraryForm } from "@/components/page-template-library-form";
import {
  getComponentsForPageTemplatePicker,
  getPageTemplate,
  getPageTemplatesForReplacementPicker,
  getSectionPatternsForPageTemplatePicker,
} from "@/lib/page-template-library";
import { getServerSession } from "@/lib/server-session";

export const dynamic = "force-dynamic";

interface EditPageTemplatePageProps {
  readonly params: Promise<{ recordId: string }>;
}

export default async function EditPageTemplatePage({ params }: EditPageTemplatePageProps) {
  const session = await getServerSession();
  if (!session) {
    return null;
  }

  const { recordId } = await params;
  const [pageTemplate, sectionPatterns, components, pageTemplates] = await Promise.all([
    getPageTemplate(recordId),
    getSectionPatternsForPageTemplatePicker(),
    getComponentsForPageTemplatePicker(),
    getPageTemplatesForReplacementPicker(),
  ]);
  if (!pageTemplate) {
    notFound();
  }

  return (
    <ContentContainer>
      <PageHeader
        title={`Edit ${pageTemplate.name}`}
        breadcrumbs={[
          { label: "Page Template Library", href: "/page-template-library" },
          { label: pageTemplate.name, href: `/page-template-library/${pageTemplate.recordId}` },
          { label: "Edit" },
        ]}
        linkComponent={Link}
      />
      <PageTemplateLibraryForm
        mode="edit"
        recordId={pageTemplate.recordId}
        initial={pageTemplate}
        sectionPatterns={sectionPatterns}
        components={components}
        pageTemplates={pageTemplates}
      />
    </ContentContainer>
  );
}
