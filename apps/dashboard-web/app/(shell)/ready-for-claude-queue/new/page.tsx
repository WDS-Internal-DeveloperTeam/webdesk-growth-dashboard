import Link from "next/link";
import { ContentContainer, PageHeader } from "@webdesk/ui";
import { ReadyForClaudeTaskForm } from "@/components/ready-for-claude-task-form";
import {
  getProjectsForTaskPicker,
  getReadyForClaudeTasksForDependencyPicker,
  sortModulesForPicker,
} from "@/lib/ready-for-claude-queue";
import { getServerSession } from "@/lib/server-session";

export const dynamic = "force-dynamic";

export default async function NewReadyForClaudeTaskPage() {
  const session = await getServerSession();
  if (!session) {
    return null;
  }

  // Sourced from the session's own already-fetched navigation list, matching `NewReviewPage`'s own
  // identical reasoning — see `lib/ready-for-claude-queue-query.ts`'s re-exported
  // `sortModulesForPicker()` doc comment.
  const modules = sortModulesForPicker(session.navigation);
  const [projects, otherTasks] = await Promise.all([
    getProjectsForTaskPicker(),
    getReadyForClaudeTasksForDependencyPicker(),
  ]);

  return (
    <ContentContainer>
      <PageHeader
        title="New Ready for Claude task"
        breadcrumbs={[
          { label: "Ready for Claude Queue", href: "/ready-for-claude-queue" },
          { label: "New task" },
        ]}
        linkComponent={Link}
      />
      <ReadyForClaudeTaskForm
        mode="create"
        modules={modules}
        projects={projects}
        otherTasks={otherTasks}
      />
    </ContentContainer>
  );
}
