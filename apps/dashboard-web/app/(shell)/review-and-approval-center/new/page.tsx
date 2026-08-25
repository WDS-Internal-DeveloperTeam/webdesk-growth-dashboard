import Link from "next/link";
import { ContentContainer, PageHeader } from "@webdesk/ui";
import { ReviewForm } from "@/components/review-form";
import { getModuleRegistry, sortModulesForPicker } from "@/lib/review-and-approval-center";
import { getServerSession } from "@/lib/server-session";

export const dynamic = "force-dynamic";

export default async function NewReviewPage() {
  const session = await getServerSession();
  if (!session) {
    return null;
  }

  const modules = sortModulesForPicker(await getModuleRegistry());

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
