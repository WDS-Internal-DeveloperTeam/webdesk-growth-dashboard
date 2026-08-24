import Link from "next/link";
import { notFound } from "next/navigation";
import { ContentContainer, PageHeader } from "@webdesk/ui";
import { ContentTemplateLibraryForm } from "@/components/content-template-library-form";
import { getContentTemplate } from "@/lib/content-template-library";
import { getServerSession } from "@/lib/server-session";

export const dynamic = "force-dynamic";

interface EditContentTemplatePageProps {
  readonly params: Promise<{ templateId: string }>;
}

export default async function EditContentTemplatePage({ params }: EditContentTemplatePageProps) {
  const session = await getServerSession();
  if (!session) {
    return null;
  }

  const { templateId } = await params;
  const template = await getContentTemplate(templateId);
  if (!template) {
    notFound();
  }

  return (
    <ContentContainer>
      <PageHeader
        title={`Edit ${template.pageType}`}
        breadcrumbs={[
          { label: "Content Template Library", href: "/content-template-library" },
          { label: template.pageType, href: `/content-template-library/${template.id}` },
          { label: "Edit" },
        ]}
        linkComponent={Link}
      />
      <ContentTemplateLibraryForm mode="edit" templateId={template.id} initial={template} />
    </ContentContainer>
  );
}
