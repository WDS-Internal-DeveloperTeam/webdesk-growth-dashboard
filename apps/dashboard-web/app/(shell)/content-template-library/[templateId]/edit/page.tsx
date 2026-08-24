import Link from "next/link";
import { notFound, redirect } from "next/navigation";
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

  // archived/superseded are terminal — the backend rejects any edit outright
  // (content-templates.service.ts's own update() guard). The detail page already hides its own
  // Edit link for these two statuses, but that only stops a normal click-through — this route
  // itself needs the same guard for a stale bookmark, a second tab open from before the record was
  // archived, or a browser back-button return (code-review finding: this route previously rendered
  // the form unconditionally, letting a user do real editing work only to have Save reject it).
  if (template.approvalStatus === "archived" || template.approvalStatus === "superseded") {
    redirect(`/content-template-library/${template.id}`);
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
