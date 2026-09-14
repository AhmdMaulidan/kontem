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
  IconImage,
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
      {/* Baris 1: judul + jumlah */}
      <PageHeader
        title="Semua campaign"
        description={
          campaigns.length === totalCount
            ? `${totalCount} campaign`
            : `${campaigns.length} dari ${totalCount} campaign`
        }
      />

      {/* Baris 2: search + status kiri, button kanan */}
      <div className="-mt-2 mb-6 flex items-center gap-2">
        <CampaignFilters defaultQ={q} defaultStatus={statusParam} />
        <div className="flex-1" />
        <ButtonLink href="/vendor/campaigns/new" size="sm">
          Buat campaign
        </ButtonLink>
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
        <ul className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
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
                  <Card className="flex h-full flex-col gap-4 transition-shadow hover:shadow-float">
                    {/* Foto tempat. Belum ada campaign yang punya foto asli
                        (unggahan belum tersambung ke penyimpanan), jadi
                        selalu tampil bidang polos — lebih jujur daripada
                        foto stok yang bukan milik outletnya. */}
                    <div className="flex aspect-video w-full items-center justify-center rounded-md bg-brand-50">
                      <IconImage className="h-8 w-8 text-brand-200" strokeWidth={1.5} />
                    </div>

                    {/* Baris atas: nama + badge status */}
                    <div className="flex items-start justify-between gap-3">
                      <span className="font-display font-semibold leading-snug">
                        {campaign.title}
                      </span>
                      <Badge tone={campaignStatusTone[campaign.status]}>
                        {campaignStatusLabel[campaign.status]}
                      </Badge>
                    </div>

                    {/* Meta */}
                    <p className="text-sm text-muted">
                      {categoryLabel[campaign.category]}
                      {" · "}
                      {formatDate(campaign.startDate)}
                      {" – "}
                      {formatDate(campaign.endDate)}
                      {" · "}
                      {campaign._count.participations} creator
                    </p>

                    {/* Stats row */}
                    <div className="grid grid-cols-3 gap-2 text-sm">
                      <div>
                        <p className="text-xs text-muted">Views</p>
                        <p className="tabular font-medium">
                          {formatCompact(totalViews)}
                        </p>
                      </div>
                      <div>
                        <p className="text-xs text-muted">Terpakai</p>
                        <p className="tabular font-medium">
                          {formatIDR(totalDistributed)}
                          <span className="text-xs text-muted">
                            {" / "}
                            {formatIDR(campaign.budgetPool)}
                          </span>
                        </p>
                      </div>
                      <div>
                        <p className="text-xs text-muted">CPM efektif</p>
                        <p className="tabular font-medium">{cpmEfektif}</p>
                      </div>
                    </div>
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
