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
  CardHeader,
  EmptyState,
  IconCard,
  IconClock,
  IconLock,
  IconTrend,
  PageHeader,
  ProgressBar,
  Stat,
} from "@/components/ui";
import { campaignStatusLabel, campaignStatusTone } from "@/lib/labels";

export default async function VendorDashboard() {
  const user = await requireRole("VENDOR");

  const campaigns = await db.campaign.findMany({
    where: { vendorId: user.id },
    include: {
      _count: {
        select: {
          participations: { where: { status: { not: "CANCELLED" } } },
          submissions: true,
        },
      },
    },
    orderBy: { createdAt: "desc" },
  });

  const performances = await Promise.all(
    campaigns.map(async (campaign) => ({
      campaign,
      performance: await getCampaignPerformance(campaign.id),
    })),
  );

  const menungguReview = await db.submission.count({
    where: { campaign: { vendorId: user.id }, status: "PENDING_REVIEW" },
  });

  const totalViews = performances.reduce(
    (sum, item) => sum + (item.performance?.totalViews ?? 0),
    0,
  );
  const totalTerpakai = performances.reduce(
    (sum, item) => sum + (item.performance?.totalDistributed ?? 0),
    0,
  );
  const totalPool = campaigns
    .filter((c) => c.status !== "DRAFT" && c.status !== "REJECTED")
    .reduce((sum, c) => sum + c.budgetPool, 0);

  return (
    <div>
      <PageHeader
        title={user.vendorProfile?.businessName ?? "Dashboard vendor"}
        description={`${user.vendorProfile?.city ?? ""} · ${campaigns.length} campaign dibuat`}
        action={<ButtonLink href="/vendor/campaigns/new">Buat campaign</ButtonLink>}
      />

      {user.status !== "VERIFIED" ? (
        <div className="mb-6">
          <Callout tone="warning" title="Menunggu verifikasi admin">
            Tim kami akan mengecek lokasi di Google Maps dan menghubungi nomor PIC
            yang kamu daftarkan. Campaign baru bisa dipublikasikan setelah
            verifikasi selesai.
          </Callout>
        </div>
      ) : null}

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Stat
          label="Total views didapat"
          icon={IconTrend}
          value={formatCompact(totalViews)}
          hint="Dari konten yang disetujui"
          tone="brand"
        />
        <Stat label="Budget dikunci"
          icon={IconLock} value={formatIDR(totalPool)} />
        <Stat
          label="Terpakai"
          icon={IconCard}
          value={formatIDR(totalTerpakai)}
          hint={`Sisa ${formatIDR(Math.max(0, totalPool - totalTerpakai))}`}
        />
        <Stat
          label="Menunggu review"
          icon={IconClock}
          value={menungguReview}
          hint="Submission belum diputuskan"
          tone={menungguReview > 0 ? "danger" : undefined}
        />
      </div>

      {menungguReview > 0 ? (
        <div className="mt-6">
          <Callout tone="warning">
            Ada {menungguReview} submission menunggu keputusanmu.{" "}
            <Link href="/vendor/submissions" className="font-medium underline">
              Review sekarang
            </Link>
          </Callout>
        </div>
      ) : null}

      <div className="mt-8">
        <Card>
          <CardHeader
            title="Campaign kamu"
            description="Pantau serapan budget dan perolehan views tiap campaign."
            action={<ButtonLink href="/vendor/campaigns" size="compact" variant="secondary">Lihat semua</ButtonLink>}
          />

          {campaigns.length === 0 ? (
            <EmptyState
              title="Belum ada campaign"
              description="Buat campaign pertama untuk mulai menjangkau creator lokal."
              action={
                <ButtonLink href="/vendor/campaigns/new">Buat campaign</ButtonLink>
              }
            />
          ) : (
            <ul className="divide-y divide-line">
              {performances.map(({ campaign, performance }) => (
                <li key={campaign.id} className="py-4 first:pt-0 last:pb-0">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0">
                      <Link
                        href={`/vendor/campaigns/${campaign.id}`}
                        className="font-medium hover:text-brand"
                      >
                        {campaign.title}
                      </Link>
                      <p className="mt-0.5 text-sm text-muted">
                        {formatDate(campaign.startDate)} –{" "}
                        {formatDate(campaign.endDate)} ·{" "}
                        {campaign._count.participations}/{campaign.maxCreators}{" "}
                        creator · {campaign._count.submissions} submission
                      </p>
                    </div>
                    <Badge tone={campaignStatusTone[campaign.status]}>
                      {campaignStatusLabel[campaign.status]}
                    </Badge>
                  </div>

                  <div className="mt-3 grid gap-4 sm:grid-cols-3">
                    <div>
                      <p className="text-xs text-muted">Views terkumpul</p>
                      <p className="tabular font-medium">
                        {formatCompact(performance?.totalViews ?? 0)}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-muted">Budget terpakai</p>
                      <p className="tabular font-medium">
                        {formatIDR(performance?.totalDistributed ?? 0)}
                        <span className="text-xs text-muted">
                          {" "}
                          / {formatIDR(campaign.budgetPool)}
                        </span>
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-muted">CPM efektif</p>
                      <p className="tabular font-medium">
                        {performance && performance.totalViews > 0
                          ? formatIDR(
                              Math.round(
                                (performance.totalDistributed /
                                  performance.totalViews) *
                                  1000,
                              ),
                            )
                          : "—"}
                      </p>
                    </div>
                  </div>

                  <div className="mt-3">
                    <ProgressBar
                      value={performance?.totalDistributed ?? 0}
                      max={campaign.budgetPool}
                      tone={performance?.poolExhausted ? "warning" : "brand"}
                    />
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>
    </div>
  );
}
