import Link from "next/link";
import { notFound } from "next/navigation";
import { ContentContainer, PageHeader } from "@webdesk/ui";
import { ServiceLibraryForm } from "@/components/service-library-form";
import { getServerSession } from "@/lib/server-session";
import {
  getDeliverables,
  getEngagementModels,
  getPlatforms,
  getService,
  getServiceCategories,
} from "@/lib/service-library";

export const dynamic = "force-dynamic";

interface EditServicePageProps {
  readonly params: Promise<{ serviceId: string }>;
}

export default async function EditServicePage({ params }: EditServicePageProps) {
  const session = await getServerSession();
  if (!session) {
    return null;
  }

  const { serviceId } = await params;
  const [service, categories, deliverables, platforms, engagementModels] = await Promise.all([
    getService(serviceId),
    getServiceCategories(),
    getDeliverables(),
    getPlatforms(),
    getEngagementModels(),
  ]);
  if (!service) {
    notFound();
  }

  return (
    <ContentContainer>
      <PageHeader
        title={`Edit ${service.canonicalName}`}
        breadcrumbs={[
          { label: "Service Library", href: "/service-library" },
          { label: service.canonicalName, href: `/service-library/${service.id}` },
          { label: "Edit" },
        ]}
        linkComponent={Link}
      />
      <ServiceLibraryForm
        mode="edit"
        serviceId={service.id}
        initial={service}
        categories={categories}
        deliverables={deliverables}
        platforms={platforms}
        engagementModels={engagementModels}
      />
    </ContentContainer>
  );
}
