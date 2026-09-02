import Link from "next/link";
import { notFound } from "next/navigation";
import { ContentContainer, PageHeader } from "@webdesk/ui";
import { ReadyForClaudeTaskForm } from "@/components/ready-for-claude-task-form";
import {
  getProjectsForTaskPicker,
  getReadyForClaudeTask,
  getReadyForClaudeTasksForDependencyPicker,
  sortModulesForPicker,
} from "@/lib/ready-for-claude-queue";
import { getServerSession } from "@/lib/server-session";

export const dynamic = "force-dynamic";

interface EditReadyForClaudeTaskPageProps {
  readonly params: Promise<{ taskId: string }>;
}

const TERMINAL_STATUSES = new Set(["completed", "cancelled", "failed"]);

/**
 * No server-side redirect here for a terminal-status task reached by direct URL navigation — the
 * detail page's own "Edit" link is already hidden for these three statuses (the real, honest
 * signal), and the backend's own `update()` rejects the write outright with a clean 400 regardless
 * of how this route was reached, matching `SectionAndPatternLibraryEdit`'s own already-accepted
 * precedent for the identical situation.
 */
export default async function EditReadyForClaudeTaskPage({
  params,
}: EditReadyForClaudeTaskPageProps) {
  const session = await getServerSession();
  if (!session) {
    return null;
  }

  const { taskId } = await params;
  const [task, modules, projects, otherTasks] = await Promise.all([
    getReadyForClaudeTask(taskId),
    Promise.resolve(sortModulesForPicker(session.navigation)),
    getProjectsForTaskPicker(),
    getReadyForClaudeTasksForDependencyPicker(),
  ]);
  if (!task) {
    notFound();
  }

  return (
    <ContentContainer>
      <PageHeader
        title={`Edit ${task.title}`}
        breadcrumbs={[
          { label: "Ready for Claude Queue", href: "/ready-for-claude-queue" },
          { label: task.title, href: `/ready-for-claude-queue/${task.id}` },
          { label: "Edit" },
        ]}
        linkComponent={Link}
      />
      {TERMINAL_STATUSES.has(task.status) ? (
        <p style={{ fontSize: "0.875rem", marginBottom: "1rem" }}>
          This task is {task.status} and can no longer be edited.
        </p>
      ) : (
        <ReadyForClaudeTaskForm
          mode="edit"
          taskId={task.id}
          initial={task}
          modules={modules}
          projects={projects}
          otherTasks={otherTasks}
        />
      )}
    </ContentContainer>
  );
}
