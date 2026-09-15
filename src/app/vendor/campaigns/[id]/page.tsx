import Link from "next/link";
import { notFound } from "next/navigation";
import { requireRole } from "@/lib/auth";
import { db } from "@/lib/db";
import { getCampaignPerformance } from "@/domain/campaign";
import { formatCompact, formatDate, formatIDR } from "@/lib/format";
import {
  Badge,
  Callout,
  Card,
  CardHeader,
  DescriptionList,
  EmptyState,
  IconCheck,
  IconX,
  PageHeader,
  ProgressBar,
  Stat,
  Table,
  Td,
  Th,
} from "@/components/ui";
import {
  campaignStatusLabel,
  campaignStatusTone,
  categoryLabel,
  participationStatusLabel,
  participationStatusTone,
  platformLabel,
  submissionStatusLabel,
  submissionStatusTone,
} from "@/lib/labels";

import { ManualDepositCard } from "./manual-deposit-card";

export default async function VendorCampaignDetail({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const user = await requireRole("VENDOR");
  const { id } = await params;

  const campaign = await db.campaign.findUnique({
    where: { id },
    include: {
      participations: {
        include: {
          creator: { include: { creatorProfile: true } },
          submission: true,
        },
        orderBy: { joinedAt: "asc" },
      },
      escrow: { orderBy: { createdAt: "asc" } },
      payouts: { include: { creator: true } },
    },
  });

  if (!campaign || campaign.vendorId !== user.id) notFound();

  const deposit = campaign.escrow.find((trx) => trx.type === "DEPOSIT") ?? null;
  const performance = await getCampaignPerformance(id);
  const terpakai = performance?.totalDistributed ?? 0;
  const menungguReview = campaign.participations.filter(
    (p) => p.submission?.status === "PENDING_REVIEW",
  ).length;

  return (
    <div>
      <PageHeader
        title={campaign.title}
        description={`${categoryLabel[campaign.category]} · ${formatDate(campaign.startDate)} – ${formatDate(campaign.endDate)}`}
        action={
          <Badge tone={campaignStatusTone[campaign.status]}>
            {campaignStatusLabel[campaign.status]}
          </Badge>
        }
      />

      {campaign.status === "PENDING_REVIEW" ? (
        <div className="mb-6 space-y-4">
          <Callout tone="warning" title="Menunggu approval admin & pelunasan escrow">
            Campaign akan live setelah admin menyetujui dan deposit budget pool
            diverifikasi lunas di escrow. Silakan lakukan transfer dana di bawah ini.
          </Callout>

          <ManualDepositCard
            campaignId={campaign.id}
            budgetPool={campaign.budgetPool}
            deposit={deposit}
          />
        </div>
      ) : null}

      {campaign.status === "REJECTED" && campaign.rejectionReason ? (
        <div className="mb-6">
          <Callout tone="danger" title="Campaign ditolak admin">
            {campaign.rejectionReason}
          </Callout>
        </div>
      ) : null}

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Stat
          label="Total views"
          value={formatCompact(performance?.totalViews ?? 0)}
          tone="brand"
        />
        <Stat
          label="Budget terpakai"
          value={formatIDR(terpakai)}
          hint={`dari ${formatIDR(campaign.budgetPool)}`}
        />
        <Stat
          label="Creator bergabung"
          value={campaign.participations.length}
        />
        <Stat
          label="Menunggu review"
          value={menungguReview}
          tone={menungguReview > 0 ? "danger" : undefined}
        />
      </div>

      <div className="mt-6">
        <Card>
          <div className="mb-2 flex justify-between text-sm">
            <span className="text-muted">Serapan budget pool</span>
            <span className="tabular font-medium">
              {formatIDR(terpakai)} / {formatIDR(campaign.budgetPool)}
            </span>
          </div>
          <ProgressBar
            value={terpakai}
            max={campaign.budgetPool}
            tone={performance?.poolExhausted ? "warning" : "brand"}
          />
          <p className="mt-2 text-xs text-muted">
            {performance?.poolExhausted
              ? "Tagihan CPM sudah melampaui pool — pembagian beralih ke proporsi views, kamu tidak membayar lebih dari pool."
              : `Sisa ${formatIDR(performance?.refundToVendor ?? campaign.budgetPool)} akan dikembalikan kalau tidak terserap sampai campaign selesai.`}
          </p>
        </Card>
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <Card>
            <CardHeader
              title="Performa per creator"
              description="Views dan proyeksi bagi hasil berdasarkan kondisi terkini."
            />
            {campaign.participations.length === 0 ? (
              <EmptyState
                title="Belum ada creator bergabung"
                description="Campaign yang sudah live akan muncul di listing creator sekota."
              />
            ) : (
              <Table>
                <thead>
                  <tr>
                    <Th>Creator</Th>
                    <Th>Status</Th>
                    <Th align="right">Views</Th>
                    <Th align="right">Porsi</Th>
                    <Th align="right">Proyeksi</Th>
                  </tr>
                </thead>
                <tbody>
                  {campaign.participations.map((p) => {
                    const line = performance?.lines.find(
                      (l) => l.creatorId === p.creatorId,
                    );
                    return (
                      <tr key={p.id}>
                        <Td>
                          <p className="font-medium">{p.creator.name}</p>
                          <p className="text-xs text-muted">
                            {p.creator.creatorProfile?.city} · trust{" "}
                            {p.creator.creatorProfile?.trustScore}
                          </p>
                        </Td>
                        <Td>
                          {p.submission ? (
                            <Badge tone={submissionStatusTone[p.submission.status]}>
                              {submissionStatusLabel[p.submission.status]}
                            </Badge>
                          ) : (
                            <Badge tone={participationStatusTone[p.status]}>
                              {participationStatusLabel[p.status]}
                            </Badge>
                          )}
                        </Td>
                        <Td align="right">
                          {formatCompact(p.submission?.lastViews ?? 0)}
                        </Td>
                        <Td align="right">
                          {line ? `${line.sharePercent.toFixed(1)}%` : "—"}
                        </Td>
                        <Td align="right">
                          {line ? formatIDR(line.netAmount) : "—"}
                        </Td>
                      </tr>
                    );
                  })}
                </tbody>
              </Table>
            )}
            {menungguReview > 0 ? (
              <p className="mt-4 text-sm">
                <Link
                  href="/vendor/submissions"
                  className="inline-flex items-center gap-1 font-semibold text-brand-600"
                >
                  {menungguReview} submission menunggu review
                </Link>
              </p>
            ) : null}
          </Card>

          {campaign.payouts.length > 0 ? (
            <Card className="mt-6">
              <CardHeader
                title="Payout final"
                description="Rincian pembagian pool setelah campaign selesai."
              />
              <Table>
                <thead>
                  <tr>
                    <Th>Creator</Th>
                    <Th align="right">Views</Th>
                    <Th align="right">Bruto</Th>
                    <Th align="right">Fee</Th>
                    <Th align="right">Diterima</Th>
                  </tr>
                </thead>
                <tbody>
                  {campaign.payouts.map((payout) => (
                    <tr key={payout.id}>
                      <Td>{payout.creator.name}</Td>
                      <Td align="right">{formatCompact(payout.viewsCounted)}</Td>
                      <Td align="right">{formatIDR(payout.grossAmount)}</Td>
                      <Td align="right">{formatIDR(payout.platformFee)}</Td>
                      <Td align="right" className="font-medium">
                        {formatIDR(payout.netAmount)}
                      </Td>
                    </tr>
                  ))}
                </tbody>
              </Table>
            </Card>
          ) : null}
        </div>

        <div className="space-y-6">
          <Card>
            <CardHeader title="Pengaturan campaign" />
            <DescriptionList
              items={[
                { label: "Pool budget", value: formatIDR(campaign.budgetPool) },
                {
                  label: "CPM rate",
                  value: `${formatIDR(campaign.cpmRate)} / 1.000 views`,
                },
                { label: "Fee platform", value: `${campaign.platformFeeRate}%` },
                { label: "Kuota creator", value: campaign.maxCreators },
                {
                  label: "Platform",
                  value: campaign.allowedPlatforms
                    .map((p) => platformLabel[p])
                    .join(", "),
                },
                {
                  label: "Durasi minimum",
                  value: `${campaign.minDurationSec} detik`,
                },
              ]}
            />
          </Card>

          <Card>
            <CardHeader title="Brief" />
            <p className="text-sm">{campaign.briefAngle}</p>
            <ul className="mt-3 space-y-1 text-sm">
              {campaign.briefMustShow.map((item) => (
                <li key={item} className="flex gap-2">
                  <IconCheck className="mt-0.5 h-4 w-4 shrink-0 text-success" />
                  {item}
                </li>
              ))}
              {campaign.briefProhibited.map((item) => (
                <li key={item} className="flex gap-2">
                  <IconX className="mt-0.5 h-4 w-4 shrink-0 text-danger" />
                  {item}
                </li>
              ))}
            </ul>
          </Card>

          <Card>
            <CardHeader title="Escrow" description="Aliran dana campaign ini." />
            {campaign.escrow.length === 0 ? (
              <p className="text-sm text-muted">Belum ada transaksi.</p>
            ) : (
              <ul className="space-y-2 text-sm">
                {campaign.escrow.map((trx) => (
                  <li key={trx.id} className="flex justify-between gap-3">
                    <span className="text-muted">{trx.type}</span>
                    <span className="tabular">
                      {formatIDR(trx.amount)}
                      <Badge
                        tone={trx.status === "COMPLETED" ? "success" : "warning"}
                      >
                        {trx.status === "COMPLETED" ? "lunas" : "pending"}
                      </Badge>
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </div>
      </div>
    </div>
  );
}
