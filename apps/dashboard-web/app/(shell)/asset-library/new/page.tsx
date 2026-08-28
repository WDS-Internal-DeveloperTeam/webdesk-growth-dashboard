import Link from "next/link";
import { ContentContainer, PageHeader } from "@webdesk/ui";
import { AssetLibraryForm } from "@/components/asset-library-form";
import { getServerSession } from "@/lib/server-session";

export const dynamic = "force-dynamic";

export default async function NewAssetPage() {
  const session = await getServerSession();
  if (!session) {
    return null;
  }

  return (
    <ContentContainer>
      <PageHeader
        title="New asset"
        breadcrumbs={[{ label: "Asset Library", href: "/asset-library" }, { label: "New asset" }]}
        linkComponent={Link}
      />
      <AssetLibraryForm mode="create" />
    </ContentContainer>
  );
}
