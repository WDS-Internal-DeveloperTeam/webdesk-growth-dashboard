import Link from "next/link";
import { notFound } from "next/navigation";
import { ContentContainer, PageHeader } from "@webdesk/ui";
import { ImportTemplateForm } from "@/components/import-template-form";
import { getImportTemplate, sortModulesForPicker } from "@/lib/import-and-export-center";
import { getServerSession } from "@/lib/server-session";

export const dynamic = "force-dynamic";

interface EditImportTemplatePageProps {
  readonly params: Promise<{ templateId: string }>;
}

export default async function EditImportTemplatePage({ params }: EditImportTemplatePageProps) {
  const session = await getServerSession();
  if (!session) {
    return null;
  }

  const { templateId } = await params;
  const template = await getImportTemplate(templateId);
  if (!template) {
    notFound();
  }

  const modules = sortModulesForPicker(session.navigation);

  return (
    <ContentContainer>
      <PageHeader
        title={`Edit ${template.name}`}
        breadcrumbs={[
          { label: "Import and Export Center", href: "/import-and-export-center" },
          { label: template.name, href: `/import-and-export-center/templates/${template.id}` },
          { label: "Edit" },
        ]}
        linkComponent={Link}
      />
      <ImportTemplateForm
        mode="edit"
        templateId={template.id}
        initial={template}
        modules={modules}
      />
    </ContentContainer>
  );
}
