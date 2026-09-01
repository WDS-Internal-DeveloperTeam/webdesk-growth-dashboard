import Link from "next/link";
import { notFound } from "next/navigation";
import { ContentContainer, PageHeader } from "@webdesk/ui";
import { CaseStudyStudioForm } from "@/components/case-study-studio-form";
import { getServerSession } from "@/lib/server-session";
import { getUser } from "@/lib/users";
import {
  getCaseStudy,
  getProofClaimsForCaseStudyPicker,
  getServicesForCaseStudyPicker,
} from "@/lib/case-study-studio";

export const dynamic = "force-dynamic";

interface EditCaseStudyPageProps {
  readonly params: Promise<{ caseStudyId: string }>;
}

export default async function EditCaseStudyPage({ params }: EditCaseStudyPageProps) {
  const session = await getServerSession();
  if (!session) {
    return null;
  }

  const { caseStudyId } = await params;
  const [caseStudy, services, claims] = await Promise.all([
    getCaseStudy(caseStudyId),
    getServicesForCaseStudyPicker(),
    getProofClaimsForCaseStudyPicker(),
  ]);
  if (!caseStudy) {
    notFound();
  }

  // Guarded, not a bare `getUser()` call — `GET /users/:userId` requires `users_roles:view`,
  // which most seeded roles (including marketing_editor) lack, so a caller fully permitted to
  // edit this case study but not to resolve a reviewer's identity would otherwise crash this
  // whole page with an unhandled rejection. Mirrors `ProjectForm`'s edit page's own owner-lookup
  // guard exactly. `CaseStudyStudioForm`'s own `initialReviewer=null` handling already renders a
  // "could not be resolved" notice for this case, so the form is unaffected either way.
  let reviewer = null;
  if (caseStudy.assignedReviewerUserId) {
    try {
      reviewer = await getUser(caseStudy.assignedReviewerUserId);
    } catch (error) {
      console.error("Failed to resolve case study reviewer for the edit form", error);
    }
  }

  return (
    <ContentContainer>
      <PageHeader
        title={`Edit ${caseStudy.publicId}`}
        breadcrumbs={[
          { label: "Case Study Studio", href: "/case-study-studio" },
          { label: caseStudy.publicId, href: `/case-study-studio/${caseStudy.id}` },
          { label: "Edit" },
        ]}
        linkComponent={Link}
      />
      <CaseStudyStudioForm
        mode="edit"
        caseStudyId={caseStudy.id}
        initial={caseStudy}
        services={services}
        claims={claims}
        initialReviewer={reviewer}
      />
    </ContentContainer>
  );
}
