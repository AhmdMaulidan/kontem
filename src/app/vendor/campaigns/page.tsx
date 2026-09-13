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
  ProgressBar,
} from "@/components/ui";
import {
  campaignStatusLabel,
  campaignStatusTone,
  categoryLabel,
} from "@/lib/labels";
import type { CampaignStatus } from "@/generated/prisma/enums";

// Filter yang ditampilkan di baris chip
const STATUS_FILTERS: {
  label: string;
  value: string | null;
  statuses: CampaignStatus[];
}[] = [
  {
    label: "Semua",
    value: null,
    statuses: [],
  },
  {
    label: "Berjalan",
    value: "ACTIVE",
    statuses: ["ACTIVE"],
  },
  {
    label: "Menunggu Approval",
    value: "PENDING_REVIEW",
    statuses: ["PENDING_REVIEW"],
  },
  {
    label: "Selesai",
    value: "SETTLED",
    statuses: ["ENDED", "SETTLING", "SETTLED"],
  },
  {
    label: "Ditolak",
    value: "REJECTED",
    statuses: ["REJECTED"],
  },
];

export default async function VendorCampaignsPage(props: {
  searchParams: Promise<{ status?: string }>;
}) {
  const user = await requireRole("VENDOR");
  const { status: statusParam } = await props.searchParams;

  // Tentukan filter status yang aktif berdasarkan URL param
  const activeFilter =
    STATUS_FILTERS.find((f) => f.value === statusParam) ?? STATUS_FILTERS[0];

  // Query campaign milik vendor ini, filter status jika ada
  const campaigns = await db.campaign.findMany({
    where: {
      vendorId: user.id,
      ...(activeFilter.statuses.length > 0
        ? { status: { in: activeFilter.statuses } }
        : {}),
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

  // Hitung total semua campaign (tanpa filter) untuk PageHeader
  const totalCount = await db.campaign.count({
    where: { vendorId: user.id },
  });

  // Ambil performance semua campaign sekaligus
  const performances = await Promise.all(
    campaigns.map((campaign) => getCampaignPerformance(campaign.id)),
  );

  return (
    <div>
      <PageHeader
        title="Semua campaign"
        description={`${totalCount} campaign dibuat`}
        action={
          <ButtonLink href="/vendor/campaigns/new">
            Buat campaign
          </ButtonLink>
        }
      />

      {/* Peringatan jika vendor belum VERIFIED */}
      {user.status !== "VERIFIED" ? (
        <div className="mb-6">
          <Callout tone="warning" title="Menunggu verifikasi admin">
            Tim kami akan mengecek lokasi di Google Maps dan menghubungi nomor
            PIC yang kamu daftarkan. Campaign baru bisa dipublikasikan setelah
            verifikasi selesai.
          </Callout>
        </div>
      ) : null}

      {/* Baris filter status */}
      <div className="mb-6 flex flex-wrap gap-2">
        {STATUS_FILTERS.map((filter) => {
          const isActive = filter.value === (activeFilter.value ?? null);
          const href =
            filter.value === null
              ? "/vendor/campaigns"
              : `/vendor/campaigns?status=${filter.value}`;

          return (
            <Link
              key={filter.value ?? "all"}
              href={href}
              className={[
                "rounded-full border px-4 py-1.5 text-sm font-medium transition-colors",
                isActive
                  ? "border-brand-200 bg-brand-50 text-brand-700"
                  : "border-line bg-surface text-muted hover:bg-surface-muted",
              ].join(" ")}
            >
              {filter.label}
            </Link>
          );
        })}
      </div>

      {/* Grid campaign */}
      {campaigns.length === 0 ? (
        <EmptyState
          title={
            activeFilter.value
              ? `Tidak ada campaign "${activeFilter.label}"`
              : "Belum ada campaign"
          }
          description={
            activeFilter.value
              ? "Coba pilih filter lain untuk melihat campaign kamu."
              : "Buat campaign pertama untuk mulai menjangkau creator lokal."
          }
          action={
            !activeFilter.value ? (
              <ButtonLink href="/vendor/campaigns/new">
                Buat campaign
              </ButtonLink>
            ) : undefined
          }
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
                  <Card className="flex h-full flex-col gap-4">
                    {/* Baris atas: nama + badge status */}
                    <div className="flex items-start justify-between gap-3">
                      <span className="font-display font-semibold leading-snug hover:text-brand">
                        {campaign.title}
                      </span>
                      <Badge tone={campaignStatusTone[campaign.status]}>
                        {campaignStatusLabel[campaign.status]}
                      </Badge>
                    </div>

                    {/* Baris kedua: meta info */}
                    <p className="text-sm text-muted">
                      {categoryLabel[campaign.category]}
                      {" · "}
                      {formatDate(campaign.startDate)}
                      {" – "}
                      {formatDate(campaign.endDate)}
                      {" · "}
                      {campaign._count.participations}/{campaign.maxCreators}{" "}
                      creator
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
                        <p className="text-xs text-muted">Budget terpakai</p>
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

                    {/* Progress bar serapan budget */}
                    <ProgressBar
                      value={totalDistributed}
                      max={campaign.budgetPool}
                      tone={performance?.poolExhausted ? "warning" : "brand"}
                    />
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
