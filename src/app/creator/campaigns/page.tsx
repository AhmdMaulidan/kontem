import Link from "next/link";
import { requireRole } from "@/lib/auth";
import { db } from "@/lib/db";
import { formatDate, formatIDR } from "@/lib/format";
import {
  Badge,
  Card,
  EmptyState,
  IconArrowRight,
  PageHeader,
} from "@/components/ui";
import { categoryLabel, categoryTone } from "@/lib/labels";
import type { BusinessCategory } from "@/generated/prisma/enums";
import { CampaignFilters } from "./campaign-filters";

export default async function BrowseCampaignPage({
  searchParams,
}: {
  searchParams: Promise<{ kota?: string; kategori?: string; q?: string }>;
}) {
  const user = await requireRole("CREATOR");
  const params = await searchParams;

  // Default ke kota domisili creator — inti dari "campaign terdekat".
  const kota = params.kota ?? user.creatorProfile?.city ?? "";
  const kategori = params.kategori ?? "";
  const q = params.q ?? "";

  const campaigns = await db.campaign.findMany({
    where: {
      status: "ACTIVE",
      endDate: { gt: new Date() },
      ...(kategori ? { category: kategori as BusinessCategory } : {}),
      ...(q ? { title: { contains: q, mode: "insensitive" as const } } : {}),
      vendor: {
        vendorProfile: kota
          ? { city: { equals: kota, mode: "insensitive" as const } }
          : {},
      },
    },
    include: {
      vendor: { include: { vendorProfile: true } },
      participations: { where: { status: { not: "CANCELLED" } }, select: { creatorId: true } },
    },
    orderBy: { createdAt: "desc" },
  });

  const kotaTersedia = await db.vendorProfile.findMany({
    where: { user: { campaigns: { some: { status: "ACTIVE" } } } },
    select: { city: true },
    distinct: ["city"],
    orderBy: { city: "asc" },
  });

  return (
    <div>
      <PageHeader
        title="Cari campaign"
        description="Campaign yang sedang berjalan dan masih membuka slot."
      />

      <Card className="mb-6">
        <CampaignFilters
          defaultQ={q}
          defaultKota={kota}
          defaultKategori={kategori}
          kotaTersedia={kotaTersedia.map((item) => item.city)}
        />
      </Card>

      {campaigns.length === 0 ? (
        <EmptyState
          title="Tidak ada campaign yang cocok"
          description="Coba longgarkan filter kota atau kategori."
        />
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {campaigns.map((campaign) => {
            const sudahIkut = campaign.participations.some(
              (p) => p.creatorId === user.id,
            );

            return (
              <Card key={campaign.id} hover>
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <Badge tone={categoryTone[campaign.category]}>
                      {categoryLabel[campaign.category]}
                    </Badge>
                    <h2 className="mt-2 font-medium">
                      <Link
                        href={`/creator/campaigns/${campaign.id}`}
                        className="hover:text-brand"
                      >
                        {campaign.title}
                      </Link>
                    </h2>
                    <p className="mt-1 text-sm text-muted">
                      {campaign.vendor.vendorProfile?.businessName} ·{" "}
                      {campaign.vendor.vendorProfile?.city}
                    </p>
                  </div>
                  {sudahIkut ? <Badge tone="success">Sudah ikut</Badge> : null}
                </div>

                <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
                  <div>
                    <p className="text-xs text-muted">Pool budget</p>
                    <p className="tabular font-medium">
                      {formatIDR(campaign.budgetPool)}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-muted">CPM rate</p>
                    <p className="tabular font-medium">
                      {formatIDR(campaign.cpmRate)}
                      <span className="text-xs text-muted"> /1k views</span>
                    </p>
                  </div>
                </div>

                <div className="mt-4 flex items-center justify-between">
                  <span className="text-xs text-muted">
                    Berakhir {formatDate(campaign.endDate)}
                  </span>
                  <Link
                    href={`/creator/campaigns/${campaign.id}`}
                    className="inline-flex items-center gap-1 text-sm font-semibold text-brand-600"
                  >
                    Lihat brief
                    <IconArrowRight className="h-3.5 w-3.5" />
                  </Link>
                </div>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
