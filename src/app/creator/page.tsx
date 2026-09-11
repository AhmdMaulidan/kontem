import Link from "next/link";
import { requireRole } from "@/lib/auth";
import { db } from "@/lib/db";
import { getCampaignPerformance } from "@/domain/campaign";
import { formatCompact, formatDate, formatIDR, daysUntil } from "@/lib/format";
import {
  Badge,
  ButtonLink,
  Card,
  CardHeader,
  EmptyState,
  IconBanknote,
  IconClock,
  IconTrend,
  IconWallet,
  PageHeader,
  Stat,
} from "@/components/ui";
import {
  participationStatusLabel,
  participationStatusTone,
  submissionStatusLabel,
  submissionStatusTone,
} from "@/lib/labels";

export default async function CreatorDashboard() {
  const user = await requireRole("CREATOR");

  const [participations, payouts, campaignBaru] = await Promise.all([
    db.campaignParticipation.findMany({
      where: { creatorId: user.id, status: { not: "CANCELLED" } },
      include: {
        campaign: { include: { vendor: { include: { vendorProfile: true } } } },
        submission: true,
        redeemCode: true,
      },
      orderBy: { joinedAt: "desc" },
    }),
    db.payout.findMany({ where: { creatorId: user.id } }),
    db.campaign.findMany({
      where: {
        status: "ACTIVE",
        endDate: { gt: new Date() },
        vendor: {
          vendorProfile: { city: user.creatorProfile?.city ?? "" },
        },
        participations: { none: { creatorId: user.id } },
      },
      include: { vendor: { include: { vendorProfile: true } } },
      take: 3,
    }),
  ]);

  const totalCair = payouts
    .filter((p) => p.status === "PAID")
    .reduce((sum, p) => sum + p.netAmount, 0);
  const menungguCair = payouts
    .filter((p) => p.status === "PENDING" || p.status === "PROCESSING")
    .reduce((sum, p) => sum + p.netAmount, 0);

  // Estimasi dari campaign yang masih berjalan: berapa yang akan diterima
  // kalau campaign ditutup dengan komposisi views hari ini.
  const campaignBerjalan = participations.filter((p) =>
    ["ACTIVE", "ENDED", "SETTLING"].includes(p.campaign.status),
  );

  const estimasi = await Promise.all(
    campaignBerjalan.map(async (p) => {
      const performance = await getCampaignPerformance(p.campaignId);
      const line = performance?.lines.find((l) => l.creatorId === user.id);
      return {
        participation: p,
        netAmount: line?.netAmount ?? 0,
        sharePercent: line?.sharePercent ?? 0,
      };
    }),
  );

  const totalEstimasi = estimasi.reduce((sum, e) => sum + e.netAmount, 0);
  const totalViews = participations.reduce(
    (sum, p) => sum + (p.submission?.lastViews ?? 0),
    0,
  );

  return (
    <div>
      <PageHeader
        title={`Halo, ${user.name.split(" ")[0]}`}
        description={`Domisili ${user.creatorProfile?.city ?? "-"} · Trust score ${user.creatorProfile?.trustScore ?? 0}/100`}
        action={<ButtonLink href="/creator/campaigns">Cari campaign</ButtonLink>}
      />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Stat
          label="Estimasi berjalan"
          icon={IconWallet}
          value={formatIDR(totalEstimasi)}
          hint={`${campaignBerjalan.length} campaign aktif`}
          tone="brand"
        />
        <Stat
          label="Menunggu cair"
          icon={IconClock}
          value={formatIDR(menungguCair)}
          hint="Sudah dihitung, belum ditransfer"
        />
        <Stat
          label="Total diterima"
          icon={IconBanknote}
          value={formatIDR(totalCair)}
          hint="Sepanjang waktu"
          tone="success"
        />
        <Stat
          label="Total views"
          icon={IconTrend}
          value={formatCompact(totalViews)}
          hint="Dari semua submission"
        />
      </div>

      <div className="mt-8 grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <Card>
            <CardHeader
              title="Campaign yang kamu ikuti"
              description="Status tiap slot yang sudah kamu klaim."
            />
            {participations.length === 0 ? (
              <EmptyState
                title="Belum ikut campaign apa pun"
                description="Cari campaign di kotamu dan klaim slotnya."
                action={
                  <ButtonLink href="/creator/campaigns">Lihat campaign</ButtonLink>
                }
              />
            ) : (
              <ul className="divide-y divide-line">
                {participations.map((p) => {
                  const estimasiRow = estimasi.find(
                    (e) => e.participation.id === p.id,
                  );
                  const sisaHari = daysUntil(p.campaign.endDate);
                  return (
                    <li key={p.id} className="py-3 first:pt-0 last:pb-0">
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div className="min-w-0">
                          <Link
                            href={`/creator/campaigns/${p.campaignId}`}
                            className="font-medium hover:text-brand"
                          >
                            {p.campaign.title}
                          </Link>
                          <p className="mt-0.5 text-sm text-muted">
                            {p.campaign.vendor.vendorProfile?.businessName} ·{" "}
                            {p.campaign.vendor.vendorProfile?.city}
                          </p>
                          <div className="mt-2 flex flex-wrap items-center gap-2">
                            <Badge tone={participationStatusTone[p.status]}>
                              {participationStatusLabel[p.status]}
                            </Badge>
                            {p.submission ? (
                              <Badge tone={submissionStatusTone[p.submission.status]}>
                                {submissionStatusLabel[p.submission.status]}
                              </Badge>
                            ) : null}
                            {p.campaign.status === "ACTIVE" && sisaHari >= 0 ? (
                              <span className="text-xs text-muted">
                                sisa {sisaHari} hari
                              </span>
                            ) : null}
                          </div>
                        </div>
                        <div className="text-right">
                          <p className="tabular text-sm font-medium">
                            {formatCompact(p.submission?.lastViews ?? 0)} views
                          </p>
                          {estimasiRow && estimasiRow.netAmount > 0 ? (
                            <p className="tabular mt-0.5 text-sm text-brand">
                              ≈ {formatIDR(estimasiRow.netAmount)}
                            </p>
                          ) : null}
                        </div>
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </Card>
        </div>

        <Card>
          <CardHeader
            title="Campaign baru di kotamu"
            description={user.creatorProfile?.city ?? undefined}
          />
          {campaignBaru.length === 0 ? (
            <p className="text-sm text-muted">
              Belum ada campaign baru di kotamu. Coba lihat kota lain di halaman
              pencarian.
            </p>
          ) : (
            <ul className="space-y-3">
              {campaignBaru.map((campaign) => (
                <li key={campaign.id}>
                  <Link
                    href={`/creator/campaigns/${campaign.id}`}
                    className="block rounded-xl border border-line p-3 hover:border-brand"
                  >
                    <p className="text-sm font-medium">{campaign.title}</p>
                    <p className="mt-1 text-xs text-muted">
                      Pool {formatIDR(campaign.budgetPool)} · CPM{" "}
                      {formatIDR(campaign.cpmRate)}
                    </p>
                    <p className="mt-1 text-xs text-muted">
                      Sampai {formatDate(campaign.endDate)}
                    </p>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>
    </div>
  );
}
