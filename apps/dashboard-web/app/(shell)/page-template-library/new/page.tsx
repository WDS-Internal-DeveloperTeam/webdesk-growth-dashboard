import Link from "next/link";
import { ContentContainer, PageHeader } from "@webdesk/ui";
import { PageTemplateLibraryForm } from "@/components/page-template-library-form";
import {
  getComponentsForPageTemplatePicker,
  getPageTemplatesForReplacementPicker,
  getSectionPatternsForPageTemplatePicker,
} from "@/lib/page-template-library";
import { getServerSession } from "@/lib/server-session";

export const dynamic = "force-dynamic";

export default async function NewPageTemplatePage() {
  const session = await getServerSession();
  if (!session) {
    return null;
  }

  // Independent fetches (none depends on another's result) — run concurrently rather than as
  // sequential round trips, mirroring PersonasService.create()'s own Promise.all reasoning.
  const [sectionPatterns, components, pageTemplates] = await Promise.all([
    getSectionPatternsForPageTemplatePicker(),
    getComponentsForPageTemplatePicker(),
    getPageTemplatesForReplacementPicker(),
  ]);

  return (
    <ContentContainer>
      <PageHeader
        title="New page template"
        breadcrumbs={[
          { label: "Page Template Library", href: "/page-template-library" },
          { label: "New page template" },
        ]}
        linkComponent={Link}
      />
      <PageTemplateLibraryForm
        mode="create"
        sectionPatterns={sectionPatterns}
        components={components}
        pageTemplates={pageTemplates}
      />
    </ContentContainer>
  );
}
