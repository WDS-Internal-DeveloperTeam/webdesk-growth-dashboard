import Link from "next/link";
import { ContentContainer, PageHeader } from "@webdesk/ui";
import { ProofAndClaimsLibraryForm } from "@/components/proof-and-claims-library-form";
import { getServicesForClaimPicker } from "@/lib/proof-and-claims-library";
import { getServerSession } from "@/lib/server-session";

export const dynamic = "force-dynamic";

export default async function NewProofClaimPage() {
  const session = await getServerSession();
  if (!session) {
    return null;
  }

  const services = await getServicesForClaimPicker();

  return (
    <ContentContainer>
      <PageHeader
        title="New proof claim"
        breadcrumbs={[
          { label: "Proof and Claims Library", href: "/proof-and-claims-library" },
          { label: "New proof claim" },
        ]}
        linkComponent={Link}
      />
      <ProofAndClaimsLibraryForm mode="create" services={services} />
    </ContentContainer>
  );
}
