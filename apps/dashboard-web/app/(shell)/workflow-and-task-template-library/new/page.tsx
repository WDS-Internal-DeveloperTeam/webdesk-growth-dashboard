import Link from "next/link";
import { ContentContainer, PageHeader } from "@webdesk/ui";
import { WorkflowTaskTemplateForm } from "@/components/workflow-task-template-form";
import { getServerSession } from "@/lib/server-session";

export const dynamic = "force-dynamic";

export default async function NewWorkflowTaskTemplatePage() {
  const session = await getServerSession();
  if (!session) {
    return null;
  }

  return (
    <ContentContainer>
      <PageHeader
        title="New workflow task template"
        breadcrumbs={[
          {
            label: "Workflow and Task Template Library",
            href: "/workflow-and-task-template-library",
          },
          { label: "New workflow task template" },
        ]}
        linkComponent={Link}
      />
      <WorkflowTaskTemplateForm mode="create" />
    </ContentContainer>
  );
}
