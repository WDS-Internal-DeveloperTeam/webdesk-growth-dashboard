import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ContentContainer, PageHeader } from "@webdesk/ui";
import { WorkflowTaskTemplateForm } from "@/components/workflow-task-template-form";
import { getServerSession } from "@/lib/server-session";
import { getWorkflowTaskTemplate } from "@/lib/workflow-and-task-template-library";

export const dynamic = "force-dynamic";

interface EditWorkflowTaskTemplatePageProps {
  readonly params: Promise<{ templateId: string }>;
}

export default async function EditWorkflowTaskTemplatePage({
  params,
}: EditWorkflowTaskTemplatePageProps) {
  const session = await getServerSession();
  if (!session) {
    return null;
  }

  const { templateId } = await params;
  const template = await getWorkflowTaskTemplate(templateId);
  if (!template) {
    notFound();
  }

  // archived/superseded are terminal — the backend rejects any edit outright
  // (workflow-and-task-template-library.service.ts's own update() guard). The detail page already
  // hides its own Edit link for these two statuses, but that only stops a normal click-through —
  // this route itself needs the same guard for a stale bookmark, a second tab open from before the
  // record was archived, or a browser back-button return, matching brand-library's own identical
  // guard.
  if (template.approvalStatus === "archived" || template.approvalStatus === "superseded") {
    redirect(`/workflow-and-task-template-library/${template.id}`);
  }

  return (
    <ContentContainer>
      <PageHeader
        title={`Edit ${template.title}`}
        breadcrumbs={[
          {
            label: "Workflow and Task Template Library",
            href: "/workflow-and-task-template-library",
          },
          { label: template.title, href: `/workflow-and-task-template-library/${template.id}` },
          { label: "Edit" },
        ]}
        linkComponent={Link}
      />
      <WorkflowTaskTemplateForm mode="edit" templateId={template.id} initial={template} />
    </ContentContainer>
  );
}
