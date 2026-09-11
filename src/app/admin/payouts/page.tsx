import { requireRole } from "@/lib/auth";
import { db } from "@/lib/db";
import { getCampaignPerformance } from "@/domain/campaign";
import { formatCompact, formatDate, formatIDR } from "@/lib/format";
import {
  Badge,
  Callout,
  Card,
  CardHeader,
  EmptyState,
  PageHeader,
  Stat,
  Table,
  Td,
  Th,
} from "@/components/ui";
import {
  campaignStatusLabel,
  campaignStatusTone,
  payoutStatusLabel,
  payoutStatusTone,
} from "@/lib/labels";
import { releasePayoutsAction, settleCampaignAction } from "../actions";
import { SimpleActionForm } from "../decision-form";

export default async function AdminPayoutsPage() {
  await requireRole("ADMIN");

  const campaigns = await db.campaign.findMany({
    where: { status: { in: ["ACTIVE", "ENDED", "SETTLING", "SETTLED"] } },
    include: {
      vendor: { include: { vendorProfile: true } },
      payouts: { include: { creator: { include: { creatorProfile: true } } } },
      _count: { select: { submissions: true } },
    },
    orderBy: { endDate: "asc" },
  });

  const detail = await Promise.all(
    campaigns.map(async (campaign) => {
      const [performance, sengketaTerbuka, menungguReview] = await Promise.all([
        getCampaignPerformance(campaign.id),
        db.dispute.count({
          where: {
            submission: { campaignId: campaign.id },
            status: { in: ["OPEN", "UNDER_REVIEW"] },
          },
        }),
        db.submission.count({
          where: { campaignId: campaign.id, status: "PENDING_REVIEW" },
        }),
      ]);
      return { campaign, performance, sengketaTerbuka, menungguReview };
    }),
  );

  const totalPending = campaigns
    .flatMap((c) => c.payouts)
    .filter((p) => p.status === "PENDING")
    .reduce((sum, p) => sum + p.netAmount, 0);
  const totalPaid = campaigns
    .flatMap((c) => c.payouts)
    .filter((p) => p.status === "PAID")
    .reduce((sum, p) => sum + p.netAmount, 0);
  const totalFee = campaigns
    .flatMap((c) => c.payouts)
    .reduce((sum, p) => sum + p.platformFee, 0);

  return (
    <div>
      <PageHeader
        title="Escrow & payout"
        description="Hitung pembagian pool saat campaign selesai, lalu cairkan ke creator."
      />

      <div className="grid gap-4 sm:grid-cols-3">
        <Stat label="Menunggu pencairan"
          icon="⏳" value={formatIDR(totalPending)} tone="danger" />
        <Stat label="Sudah dicairkan"
          icon="💸" value={formatIDR(totalPaid)} tone="success" />
        <Stat label="Fee platform terkumpul"
          icon="🏦" value={formatIDR(totalFee)} />
      </div>

      <div className="mt-8 space-y-6">
        {detail.length === 0 ? (
          <EmptyState title="Belum ada campaign yang bisa disettle" />
        ) : (
          detail.map(({ campaign, performance, sengketaTerbuka, menungguReview }) => {
            const sudahSettle = campaign.payouts.length > 0;
            const adaPending = campaign.payouts.some((p) => p.status === "PENDING");
            const periodeSelesai = new Date() > campaign.endDate;
            const blokir = sengketaTerbuka > 0 || menungguReview > 0;

            return (
              <Card key={campaign.id}>
                <div id={campaign.id} />
                <CardHeader
                  title={campaign.title}
                  description={`${campaign.vendor.vendorProfile?.businessName} · berakhir ${formatDate(campaign.endDate)}`}
                  action={
                    <Badge tone={campaignStatusTone[campaign.status]}>
                      {campaignStatusLabel[campaign.status]}
                    </Badge>
                  }
                />

                <div className="grid gap-4 sm:grid-cols-4">
                  <div>
                    <p className="text-xs text-muted">Pool</p>
                    <p className="tabular font-medium">
                      {formatIDR(campaign.budgetPool)}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-muted">Total views</p>
                    <p className="tabular font-medium">
                      {formatCompact(performance?.totalViews ?? 0)}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-muted">Akan dibagikan</p>
                    <p className="tabular font-medium">
                      {formatIDR(performance?.totalNetToCreators ?? 0)}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-muted">Fee platform</p>
                    <p className="tabular font-medium">
                      {formatIDR(performance?.totalPlatformFee ?? 0)}
                    </p>
                  </div>
                </div>

                {sudahSettle ? (
                  <div className="mt-5">
                    <Table>
                      <thead>
                        <tr>
                          <Th>Creator</Th>
                          <Th align="right">Views</Th>
                          <Th align="right">Porsi</Th>
                          <Th align="right">Diterima</Th>
                          <Th>Rekening</Th>
                          <Th>Status</Th>
                        </tr>
                      </thead>
                      <tbody>
                        {campaign.payouts.map((payout) => (
                          <tr key={payout.id}>
                            <Td>{payout.creator.name}</Td>
                            <Td align="right">
                              {formatCompact(payout.viewsCounted)}
                            </Td>
                            <Td align="right">{payout.sharePercent.toFixed(1)}%</Td>
                            <Td align="right" className="font-medium">
                              {formatIDR(payout.netAmount)}
                            </Td>
                            <Td>
                              <span className="text-xs text-muted">
                                {payout.creator.creatorProfile?.bankName ?? "—"}{" "}
                                {payout.creator.creatorProfile?.bankAccountNumber ??
                                  ""}
                              </span>
                            </Td>
                            <Td>
                              <Badge tone={payoutStatusTone[payout.status]}>
                                {payoutStatusLabel[payout.status]}
                              </Badge>
                            </Td>
                          </tr>
                        ))}
                      </tbody>
                    </Table>
                  </div>
                ) : null}

                <div className="mt-5 border-t border-line pt-4">
                  {blokir && !sudahSettle ? (
                    <Callout tone="warning" title="Belum bisa disettle">
                      {sengketaTerbuka > 0
                        ? `${sengketaTerbuka} sengketa masih terbuka. `
                        : ""}
                      {menungguReview > 0
                        ? `${menungguReview} submission belum direview vendor.`
                        : ""}
                    </Callout>
                  ) : !sudahSettle ? (
                    <div className="space-y-3">
                      {!periodeSelesai ? (
                        <Callout tone="info">
                          Periode campaign belum berakhir. Settle lebih awal hanya
                          kalau vendor memintanya.
                        </Callout>
                      ) : null}
                      <SimpleActionForm
                        action={settleCampaignAction}
                        hiddenField="campaignId"
                        hiddenValue={campaign.id}
                        label="Hitung & kunci payout"
                        pendingLabel="Menghitung..."
                      />
                    </div>
                  ) : adaPending ? (
                    <SimpleActionForm
                      action={releasePayoutsAction}
                      hiddenField="campaignId"
                      hiddenValue={campaign.id}
                      label="Cairkan semua payout"
                      pendingLabel="Mencairkan..."
                    />
                  ) : (
                    <p className="text-sm text-muted">
                      Semua payout campaign ini sudah selesai diproses.
                    </p>
                  )}
                </div>
              </Card>
            );
          })
        )}
      </div>
    </div>
  );
}
