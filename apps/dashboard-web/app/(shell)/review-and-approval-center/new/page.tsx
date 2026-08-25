import Link from "next/link";
import { ContentContainer, PageHeader } from "@webdesk/ui";
import { ReviewForm } from "@/components/review-form";
import { sortModulesForPicker } from "@/lib/review-and-approval-center";
import { getServerSession } from "@/lib/server-session";

export const dynamic = "force-dynamic";

export default async function NewReviewPage() {
  const session = await getServerSession();
  if (!session) {
    return null;
  }

  // Sourced from the session's own already-fetched navigation list (code-review finding) — see
  // lib/review-and-approval-center.ts's removed-getModuleRegistry() doc comment for why.
  const modules = sortModulesForPicker(session.navigation);

  return (
    <ContentContainer>
      <PageHeader
        title="New review"
        breadcrumbs={[
          { label: "Review and Approval Center", href: "/review-and-approval-center" },
          { label: "New review" },
        ]}
        linkComponent={Link}
      />
      <ReviewForm modules={modules} />
    </ContentContainer>
  );
}
