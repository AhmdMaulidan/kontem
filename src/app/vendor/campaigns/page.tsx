import Link from "next/link";
import { requireRole } from "@/lib/auth";
import { db } from "@/lib/db";
import { getCampaignPerformance } from "@/domain/campaign";
import { formatCompact, formatDate, formatIDR } from "@/lib/format";
import {
  Badge,
  ButtonLink,
  Callout,
  Card,
  EmptyState,
  PageHeader,
} from "@/components/ui";
import { campaignStatusLabel, campaignStatusTone, categoryLabel } from "@/lib/labels";
import type { CampaignStatus } from "@/generated/prisma/enums";
import { CampaignFilters } from "./campaign-filters";

// Peta nilai dropdown → daftar CampaignStatus yang dicakup
const STATUS_MAP: Record<string, CampaignStatus[]> = {
  ACTIVE: ["ACTIVE"],
  PENDING_REVIEW: ["PENDING_REVIEW"],
  DRAFT: ["DRAFT"],
  SETTLED: ["ENDED", "SETTLING", "SETTLED"],
  REJECTED: ["REJECTED"],
  CANCELLED: ["CANCELLED"],
};

export default async function VendorCampaignsPage(props: {
  searchParams: Promise<{ q?: string; status?: string }>;
}) {
  const user = await requireRole("VENDOR");
  const { q = "", status: statusParam = "" } = await props.searchParams;

  const statusFilter = STATUS_MAP[statusParam] ?? [];

  // Hitung total semua campaign (tanpa filter) untuk label di toolbar
  const totalCount = await db.campaign.count({ where: { vendorId: user.id } });

  // Query dengan filter q + status
  const campaigns = await db.campaign.findMany({
    where: {
      vendorId: user.id,
      ...(statusFilter.length > 0 ? { status: { in: statusFilter } } : {}),
      ...(q ? { title: { contains: q, mode: "insensitive" } } : {}),
    },
    include: {
      _count: {
        select: {
          participations: { where: { status: { not: "CANCELLED" } } },
        },
      },
    },
    orderBy: { createdAt: "desc" },
  });

  // Performance diambil paralel untuk semua campaign yang tampil
  const performances = await Promise.all(
    campaigns.map((c) => getCampaignPerformance(c.id)),
  );

  return (
    <div>
      {/* Baris 1: judul + jumlah, tombol "Buat campaign" di pojok kanan atas */}
      <PageHeader
        title="Semua campaign"
        description={
          campaigns.length === totalCount
            ? `${totalCount} campaign`
            : `${campaigns.length} dari ${totalCount} campaign`
        }
        action={
          <ButtonLink href="/vendor/campaigns/new" size="sm">
            Buat campaign
          </ButtonLink>
        }
      />

      {/* Baris 2: search sejajar dengan filter status */}
      <div className="-mt-2 mb-6">
        <CampaignFilters defaultQ={q} defaultStatus={statusParam} />
      </div>

      {user.status !== "VERIFIED" ? (
        <div className="mb-6">
          <Callout tone="warning" title="Menunggu verifikasi admin">
            Tim kami akan mengecek lokasi di Google Maps dan menghubungi nomor
            PIC yang kamu daftarkan. Campaign baru bisa dipublikasikan setelah
            verifikasi selesai.
          </Callout>
        </div>
      ) : null}

      {/* Grid campaign */}
      {campaigns.length === 0 ? (
        <EmptyState
          title={
            q || statusParam
              ? "Tidak ada campaign yang cocok"
              : "Belum ada campaign"
          }
          description={
            q || statusParam
              ? "Coba ubah kata kunci atau ganti filter status."
              : "Buat campaign pertama untuk mulai menjangkau creator lokal."
          }
          action={undefined}
        />
      ) : (
        <ul className="grid grid-cols-2 gap-3 lg:grid-cols-3 lg:gap-5 xl:grid-cols-4">
          {campaigns.map((campaign, idx) => {
            const performance = performances[idx];
            const totalViews = performance?.totalViews ?? 0;
            const totalDistributed = performance?.totalDistributed ?? 0;
            const cpmEfektif =
              totalViews > 0
                ? formatIDR(
                    Math.round((totalDistributed / totalViews) * 1000),
                  )
                : "—";

            return (
              <li key={campaign.id}>
                <Link
                  href={`/vendor/campaigns/${campaign.id}`}
                  className="block h-full"
                >
                  <Card className="flex h-full flex-col gap-2.5 p-2.5 transition-shadow hover:shadow-float lg:gap-4">
                    {campaign.imageUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={campaign.imageUrl}
                        alt={campaign.title}
                        className="aspect-video w-full rounded-md object-cover"
                      />
                    ) : (
                      <div className="aspect-video w-full rounded-md bg-surface-muted" />
                    )}

                    {/* Judul campaign */}
                    <span className="block truncate font-display text-sm font-semibold leading-snug lg:text-base">
                      {campaign.title}
                    </span>

                    {/* Tanggal di bawah judul */}
                    <span className="block text-[10px] font-medium text-muted lg:text-xs">
                      {formatDate(campaign.startDate)} – {formatDate(campaign.endDate)}
                    </span>

                    <Badge tone={campaignStatusTone[campaign.status]}>
                      {campaignStatusLabel[campaign.status]}
                    </Badge>

                    {/* Fakta kartu — satu baris per info (label kiri, nilai
                        kanan) supaya kebaca jelas di kartu sempit ponsel,
                        bukan dijejalkan dalam grid berkolom. */}
                    <ul className="space-y-1.5 text-[11px] lg:text-sm">
                      <li className="flex items-center justify-between gap-2">
                        <span className="text-muted">Kategori</span>
                        <span className="truncate font-medium">
                          {categoryLabel[campaign.category]}
                        </span>
                      </li>
                      <li className="flex items-center justify-between gap-2">
                        <span className="text-muted">Creator</span>
                        <span className="font-medium">
                          {campaign._count.participations}
                        </span>
                      </li>
                      <li className="flex items-center justify-between gap-2">
                        <span className="text-muted">Views</span>
                        <span className="tabular font-medium">
                          {formatCompact(totalViews)}
                        </span>
                      </li>
                      <li className="flex items-center justify-between gap-2">
                        <span className="text-muted">Terpakai</span>
                        <span className="tabular truncate font-medium">
                          {formatIDR(totalDistributed)}
                          <span className="text-muted">
                            {" / "}
                            {formatIDR(campaign.budgetPool)}
                          </span>
                        </span>
                      </li>
                      <li className="flex items-center justify-between gap-2">
                        <span className="text-muted">CPM</span>
                        <span className="tabular font-medium">{cpmEfektif}</span>
                      </li>
                    </ul>
                  </Card>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
