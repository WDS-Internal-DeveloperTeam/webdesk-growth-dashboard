import Link from "next/link";
import { ContentContainer, PageHeader } from "@webdesk/ui";
import { ImportTemplateForm } from "@/components/import-template-form";
import { sortModulesForPicker } from "@/lib/import-and-export-center";
import { getServerSession } from "@/lib/server-session";

export const dynamic = "force-dynamic";

export default async function NewImportTemplatePage() {
  const session = await getServerSession();
  if (!session) {
    return null;
  }

  const modules = sortModulesForPicker(session.navigation);

  return (
    <ContentContainer>
      <PageHeader
        title="New import template"
        breadcrumbs={[
          { label: "Import and Export Center", href: "/import-and-export-center" },
          { label: "New template" },
        ]}
        linkComponent={Link}
      />
      <ImportTemplateForm mode="create" modules={modules} />
    </ContentContainer>
  );
}
