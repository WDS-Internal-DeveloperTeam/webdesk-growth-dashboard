import Link from "next/link";
import { notFound } from "next/navigation";
import { ContentContainer, PageHeader } from "@webdesk/ui";
import { ProofAndClaimsLibraryForm } from "@/components/proof-and-claims-library-form";
import { getServerSession } from "@/lib/server-session";
import { getProofClaim, getServicesForClaimPicker } from "@/lib/proof-and-claims-library";

export const dynamic = "force-dynamic";

interface EditProofClaimPageProps {
  readonly params: Promise<{ claimId: string }>;
}

export default async function EditProofClaimPage({ params }: EditProofClaimPageProps) {
  const session = await getServerSession();
  if (!session) {
    return null;
  }

  const { claimId } = await params;
  const [claim, services] = await Promise.all([
    getProofClaim(claimId),
    getServicesForClaimPicker(),
  ]);
  if (!claim) {
    notFound();
  }

  return (
    <ContentContainer>
      <PageHeader
        title={`Edit ${claim.publicId}`}
        breadcrumbs={[
          { label: "Proof and Claims Library", href: "/proof-and-claims-library" },
          { label: claim.publicId, href: `/proof-and-claims-library/${claim.id}` },
          { label: "Edit" },
        ]}
        linkComponent={Link}
      />
      <ProofAndClaimsLibraryForm
        mode="edit"
        claimId={claim.id}
        initial={claim}
        services={services}
      />
    </ContentContainer>
  );
}
