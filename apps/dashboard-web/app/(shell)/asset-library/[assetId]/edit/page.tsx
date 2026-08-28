import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ContentContainer, PageHeader } from "@webdesk/ui";
import { AssetLibraryForm } from "@/components/asset-library-form";
import { getAsset } from "@/lib/asset-library";
import { getServerSession } from "@/lib/server-session";

export const dynamic = "force-dynamic";

interface EditAssetPageProps {
  readonly params: Promise<{ assetId: string }>;
}

export default async function EditAssetPage({ params }: EditAssetPageProps) {
  const session = await getServerSession();
  if (!session) {
    return null;
  }

  const { assetId } = await params;
  const asset = await getAsset(assetId);
  if (!asset) {
    notFound();
  }

  // archived/superseded are terminal — the backend rejects any edit outright
  // (assets.service.ts's own update() guard). The detail page already hides its own Edit link for
  // these two statuses, but that only stops a normal click-through — this route itself needs the
  // same guard for a stale bookmark, a second tab open from before the asset was archived, or a
  // browser back-button return, matching brand-library's own identical guard.
  if (asset.approvalStatus === "archived" || asset.approvalStatus === "superseded") {
    redirect(`/asset-library/${asset.id}`);
  }

  return (
    <ContentContainer>
      <PageHeader
        title={`Edit ${asset.title}`}
        breadcrumbs={[
          { label: "Asset Library", href: "/asset-library" },
          { label: asset.title, href: `/asset-library/${asset.id}` },
          { label: "Edit" },
        ]}
        linkComponent={Link}
      />
      <AssetLibraryForm mode="edit" assetId={asset.id} initial={asset} />
    </ContentContainer>
  );
}
