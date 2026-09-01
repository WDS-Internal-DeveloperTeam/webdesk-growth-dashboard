import Link from "next/link";
import { ContentContainer, PageHeader } from "@webdesk/ui";
import { PortfolioLibraryForm } from "@/components/portfolio-library-form";
import { getProofClaimsForPortfolioPicker } from "@/lib/portfolio-library";
import { getServerSession } from "@/lib/server-session";

export const dynamic = "force-dynamic";

export default async function NewPortfolioRecordPage() {
  const session = await getServerSession();
  if (!session) {
    return null;
  }

  const claims = await getProofClaimsForPortfolioPicker();

  return (
    <ContentContainer>
      <PageHeader
        title="New portfolio record"
        breadcrumbs={[
          { label: "Portfolio Library", href: "/portfolio-library" },
          { label: "New portfolio record" },
        ]}
        linkComponent={Link}
      />
      <PortfolioLibraryForm mode="create" claims={claims} />
    </ContentContainer>
  );
}
