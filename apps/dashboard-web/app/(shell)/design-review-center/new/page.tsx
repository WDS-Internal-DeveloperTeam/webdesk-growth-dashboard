import Link from "next/link";
import { ContentContainer, PageHeader } from "@webdesk/ui";
import { DesignReviewForm } from "@/components/design-review-form";
import { sortModulesForPicker } from "@/lib/design-review-center";
import { getServerSession } from "@/lib/server-session";

export const dynamic = "force-dynamic";

export default async function NewDesignReviewPage() {
  const session = await getServerSession();
  if (!session) {
    return null;
  }

  // Sourced from the session's own already-fetched navigation list, matching ReviewForm's own
  // already-reviewed fix for the identical field.
  const modules = sortModulesForPicker(session.navigation);

  return (
    <ContentContainer>
      <PageHeader
        title="New design review"
        breadcrumbs={[
          { label: "Design Review Center", href: "/design-review-center" },
          { label: "New design review" },
        ]}
        linkComponent={Link}
      />
      <DesignReviewForm modules={modules} />
    </ContentContainer>
  );
}
