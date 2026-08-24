import Link from "next/link";
import { ContentContainer, PageHeader } from "@webdesk/ui";
import { ContentTemplateLibraryForm } from "@/components/content-template-library-form";
import { getServerSession } from "@/lib/server-session";

export const dynamic = "force-dynamic";

export default async function NewContentTemplatePage() {
  const session = await getServerSession();
  if (!session) {
    return null;
  }

  return (
    <ContentContainer>
      <PageHeader
        title="New content template"
        breadcrumbs={[
          { label: "Content Template Library", href: "/content-template-library" },
          { label: "New content template" },
        ]}
        linkComponent={Link}
      />
      <ContentTemplateLibraryForm mode="create" />
    </ContentContainer>
  );
}
