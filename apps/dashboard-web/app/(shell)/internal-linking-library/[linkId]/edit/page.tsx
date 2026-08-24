import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ContentContainer, PageHeader, type RelationshipOption } from "@webdesk/ui";
import { InternalLinkForm } from "@/components/internal-link-form";
import { tolerateDiscard } from "@/lib/business-knowledge";
import {
  getInternalLink,
  getPagesForInternalLinkPicker,
  withProjectId,
} from "@/lib/internal-linking-library";
import { getPage } from "@/lib/page-inventory";
import { getProject } from "@/lib/projects";
import { firstValue } from "@/lib/search-params";
import { getServerSession } from "@/lib/server-session";
import { getUser } from "@/lib/users";

export const dynamic = "force-dynamic";

interface EditInternalLinkPageProps {
  readonly params: Promise<{ linkId: string }>;
  readonly searchParams: Promise<Record<string, string | string[] | undefined>>;
}

/** Resolves a page id to a `RelationshipOption`, falling back to the raw id as its own option when
 *  the page can't be resolved (deleted, or simply outside the create/edit form's own picker's
 *  bounded top-100 fetch window) — mirrors `PersonaLibraryForm`'s own raw-id fallback precedent for
 *  the identical case, so a real relationship is never invisible or unremovable in this form. */
function toPageOptionOrRawId(
  pageId: string,
  page: Awaited<ReturnType<typeof getPage>>,
): RelationshipOption {
  return page ? { id: page.id, displayName: page.pageName } : { id: pageId, displayName: pageId };
}

export default async function EditInternalLinkPage({
  params,
  searchParams,
}: EditInternalLinkPageProps) {
  const session = await getServerSession();
  if (!session) {
    return null;
  }

  const rawParams = await searchParams;
  const projectIdParam = firstValue(rawParams.projectId);
  const { linkId } = await params;

  // Fired concurrently with the project-existence check below, not sequentially after it —
  // getInternalLink()/getPagesForInternalLinkPicker() only need the already-known projectId
  // string, no field resolved from the Project entity itself, mirroring every sibling edit page's
  // own identical fix.
  const linkPromise = projectIdParam
    ? tolerateDiscard(getInternalLink(projectIdParam, linkId))
    : null;
  const pagesPromise = projectIdParam
    ? tolerateDiscard(getPagesForInternalLinkPicker(projectIdParam))
    : null;

  const project = projectIdParam ? await getProject(projectIdParam) : null;
  if (!project) {
    redirect("/internal-linking-library");
  }

  const [link, pages] = await Promise.all([linkPromise!, pagesPromise!]);
  if (!link) {
    notFound();
  }

  // Resolved once the link itself is known — always awaited immediately below, never
  // conditionally discarded, so no tolerateDiscard() here.
  const [sourcePage, targetPage, approver] = await Promise.all([
    getPage(project.id, link.sourcePageId),
    getPage(project.id, link.targetPageId),
    link.assignedApproverUserId ? getUser(link.assignedApproverUserId) : Promise.resolve(null),
  ]);

  return (
    <ContentContainer>
      <PageHeader
        title={`Edit ${link.publicId}`}
        breadcrumbs={[
          { label: "Internal Linking Library", href: "/internal-linking-library" },
          {
            label: link.publicId,
            href: withProjectId(`/internal-linking-library/${link.id}`, project.id),
          },
          { label: "Edit" },
        ]}
        linkComponent={Link}
      />
      <InternalLinkForm
        mode="edit"
        projectId={project.id}
        linkId={link.id}
        initial={link}
        pages={pages}
        initialSourcePage={toPageOptionOrRawId(link.sourcePageId, sourcePage)}
        initialTargetPage={toPageOptionOrRawId(link.targetPageId, targetPage)}
        initialApprover={approver}
      />
    </ContentContainer>
  );
}
