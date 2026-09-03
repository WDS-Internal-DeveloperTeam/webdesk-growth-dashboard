import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ContentContainer, PageHeader } from "@webdesk/ui";
import { ReleaseForm } from "@/components/release-form";
import { getProject } from "@/lib/projects";
import { getRelease, withProjectId } from "@/lib/release-center";
import { firstValue } from "@/lib/search-params";
import { getServerSession } from "@/lib/server-session";
import { getUsersByIds } from "@/lib/users";

export const dynamic = "force-dynamic";

interface EditReleasePageProps {
  readonly params: Promise<{ releaseId: string }>;
  readonly searchParams: Promise<Record<string, string | string[] | undefined>>;
}

/** Mirrors `ReleasesService`'s own `EDIT_BLOCKED_STATUSES` — kept in sync by hand. A release that
 *  has reached `completed`/`rolled_back`/`checks_failed` redirects straight back to its own detail
 *  page — the backend rejects any edit attempt on any of these statuses with a clean 400, so this
 *  page has nowhere valid to submit to (mirrors `EditChangeRecordPage`'s own identical navigation
 *  guard, applied here as a real redirect rather than just a hidden link, since this route is
 *  directly reachable by URL). */
const EDIT_BLOCKED_STATUSES: ReadonlySet<string> = new Set([
  "completed",
  "rolled_back",
  "checks_failed",
]);

export default async function EditReleasePage({ params, searchParams }: EditReleasePageProps) {
  const session = await getServerSession();
  if (!session) {
    return null;
  }

  const rawParams = await searchParams;
  const projectIdParam = firstValue(rawParams.projectId);
  const project = projectIdParam ? await getProject(projectIdParam) : null;
  if (!project) {
    redirect("/release-center");
  }

  const { releaseId } = await params;
  const release = await getRelease(project.id, releaseId);
  if (!release) {
    notFound();
  }
  if (EDIT_BLOCKED_STATUSES.has(release.status)) {
    redirect(withProjectId(`/release-center/${release.id}`, project.id));
  }

  const userIds = new Set<string>();
  if (release.assignedDeveloperUserId) userIds.add(release.assignedDeveloperUserId);
  if (release.assignedReviewerUserId) userIds.add(release.assignedReviewerUserId);
  const users = await getUsersByIds([...userIds]);
  const assignedDeveloper = release.assignedDeveloperUserId
    ? (users.get(release.assignedDeveloperUserId) ?? null)
    : null;
  const assignedReviewer = release.assignedReviewerUserId
    ? (users.get(release.assignedReviewerUserId) ?? null)
    : null;

  return (
    <ContentContainer>
      <PageHeader
        title={`Edit ${release.title}`}
        breadcrumbs={[
          { label: "Release Center", href: withProjectId("/release-center", project.id) },
          {
            label: release.title,
            href: withProjectId(`/release-center/${release.id}`, project.id),
          },
          { label: "Edit" },
        ]}
        linkComponent={Link}
      />
      <ReleaseForm
        mode="edit"
        projectId={project.id}
        releaseId={release.id}
        initial={release}
        assignedDeveloper={assignedDeveloper}
        assignedReviewer={assignedReviewer}
      />
    </ContentContainer>
  );
}
