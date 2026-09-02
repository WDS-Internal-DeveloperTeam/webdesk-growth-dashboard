import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ContentContainer, PageHeader } from "@webdesk/ui";
import { ChangeRecordForm } from "@/components/change-record-form";
import {
  EDITABLE_STATUSES,
  getChangeRecord,
  sortModulesForPicker,
  tolerateDiscard,
  withProjectId,
} from "@/lib/change-center";
import { getProject } from "@/lib/projects";
import { firstValue } from "@/lib/search-params";
import { getServerSession } from "@/lib/server-session";
import { getUser } from "@/lib/users";

export const dynamic = "force-dynamic";

interface EditChangeRecordPageProps {
  readonly params: Promise<{ recordId: string }>;
  readonly searchParams: Promise<Record<string, string | string[] | undefined>>;
}

/**
 * Requires `?projectId=` — same rule as every other route in this module. A record that has left
 * `detected`/`under_review` (`EDITABLE_STATUSES`) redirects straight back to its own detail page —
 * the backend rejects any edit attempt on any other status with a clean 400, so this page has
 * nowhere valid to submit to (mirrors the detail page's own Edit-link-hiding precedent, applied
 * here as a real navigation guard rather than just a hidden link, since this route is directly
 * reachable by URL).
 */
export default async function EditChangeRecordPage({
  params,
  searchParams,
}: EditChangeRecordPageProps) {
  const session = await getServerSession();
  if (!session) {
    return null;
  }

  const rawParams = await searchParams;
  const projectIdParam = firstValue(rawParams.projectId);
  const { recordId } = await params;

  const recordPromise = projectIdParam
    ? tolerateDiscard(getChangeRecord(projectIdParam, recordId))
    : null;

  const project = projectIdParam ? await getProject(projectIdParam) : null;
  if (!project) {
    redirect("/change-center");
  }

  const record = await recordPromise!;
  if (!record) {
    notFound();
  }
  if (!EDITABLE_STATUSES.has(record.status)) {
    redirect(withProjectId(`/change-center/${record.id}`, project.id));
  }

  // A non-essential enrichment lookup, same guard as the detail page's own identical fetch.
  const assignee = record.assignedToUserId
    ? await getUser(record.assignedToUserId).catch((error: unknown) => {
        console.error("Failed to resolve change record assignee", error);
        return null;
      })
    : null;

  const modules = sortModulesForPicker(session.navigation);

  return (
    <ContentContainer>
      <PageHeader
        title={`Edit ${record.publicId}`}
        breadcrumbs={[
          { label: "Change Center", href: "/change-center" },
          {
            label: record.publicId,
            href: withProjectId(`/change-center/${record.id}`, project.id),
          },
          { label: "Edit" },
        ]}
        linkComponent={Link}
      />
      <ChangeRecordForm
        mode="edit"
        projectId={project.id}
        recordId={record.id}
        initial={record}
        modules={modules}
        initialAssignee={assignee}
      />
    </ContentContainer>
  );
}
