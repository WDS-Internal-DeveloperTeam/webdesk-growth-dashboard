import Link from "next/link";
import { notFound } from "next/navigation";
import { ContentContainer, PageHeader } from "@webdesk/ui";
import { PortfolioLibraryForm } from "@/components/portfolio-library-form";
import { getPortfolioRecord, getProofClaimsForPortfolioPicker } from "@/lib/portfolio-library";
import { getServerSession } from "@/lib/server-session";

export const dynamic = "force-dynamic";

interface EditPortfolioRecordPageProps {
  readonly params: Promise<{ recordId: string }>;
}

export default async function EditPortfolioRecordPage({ params }: EditPortfolioRecordPageProps) {
  const session = await getServerSession();
  if (!session) {
    return null;
  }

  const { recordId } = await params;
  const [record, claims] = await Promise.all([
    getPortfolioRecord(recordId),
    getProofClaimsForPortfolioPicker(),
  ]);
  if (!record) {
    notFound();
  }

  return (
    <ContentContainer>
      <PageHeader
        title={`Edit ${record.projectOrClientName}`}
        breadcrumbs={[
          { label: "Portfolio Library", href: "/portfolio-library" },
          { label: record.projectOrClientName, href: `/portfolio-library/${record.id}` },
          { label: "Edit" },
        ]}
        linkComponent={Link}
      />
      <PortfolioLibraryForm mode="edit" recordId={record.id} initial={record} claims={claims} />
    </ContentContainer>
  );
}
