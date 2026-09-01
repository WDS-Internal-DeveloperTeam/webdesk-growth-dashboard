import Link from "next/link";
import { ContentContainer, PageHeader } from "@webdesk/ui";
import { CaseStudyStudioForm } from "@/components/case-study-studio-form";
import {
  getProofClaimsForCaseStudyPicker,
  getServicesForCaseStudyPicker,
} from "@/lib/case-study-studio";
import { getServerSession } from "@/lib/server-session";

export const dynamic = "force-dynamic";

export default async function NewCaseStudyPage() {
  const session = await getServerSession();
  if (!session) {
    return null;
  }

  const [services, claims] = await Promise.all([
    getServicesForCaseStudyPicker(),
    getProofClaimsForCaseStudyPicker(),
  ]);

  return (
    <ContentContainer>
      <PageHeader
        title="New case study"
        breadcrumbs={[
          { label: "Case Study Studio", href: "/case-study-studio" },
          { label: "New case study" },
        ]}
        linkComponent={Link}
      />
      <CaseStudyStudioForm mode="create" services={services} claims={claims} />
    </ContentContainer>
  );
}
