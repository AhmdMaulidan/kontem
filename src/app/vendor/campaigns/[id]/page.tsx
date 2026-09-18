import { notFound } from "next/navigation";
import { requireRole } from "@/lib/auth";
import { db } from "@/lib/db";
import {
  getCampaignPerformance,
  getCampaignSettlementSummary,
} from "@/domain/campaign";
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

import { CampaignSummaryCard } from "./campaign-summary-card";
import { DeleteCampaignCard } from "./delete-campaign-button";
import { ManualDepositCard } from "./manual-deposit-card";
import { RefundCard } from "./refund-card";

// Sama dengan DELETABLE_CAMPAIGN_STATUSES di vendor/actions.ts — begitu
// campaign disetujui admin (ACTIVE) ia sudah terlihat creator dan mungkin
// sudah diklaim, jadi tombol hapus tidak lagi ditampilkan.
const DELETABLE_STATUSES = ["DRAFT", "PENDING_REVIEW", "REJECTED"];

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
      vendor: { include: { vendorProfile: true } },
    },
  });

  if (!campaign || campaign.vendorId !== user.id) notFound();

  const deposit = campaign.escrow.find((trx) => trx.type === "DEPOSIT") ?? null;
  const refundTrx = campaign.escrow.find((trx) => trx.type === "REFUND") ?? null;
  const vendorBank = campaign.vendor.vendorProfile;
  const isFinished = campaign.status === "SETTLED" || campaign.payouts.length > 0;

  const [performance, settlementSummary] = await Promise.all([
    getCampaignPerformance(id),
    isFinished ? getCampaignSettlementSummary(id) : Promise.resolve(null),
  ]);

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

      {refundTrx ? (
        <div className="mb-6">
          <RefundCard
            campaignId={campaign.id}
            refundTrx={refundTrx}
            vendorBank={vendorBank}
          />
        </div>
      ) : null}

      {settlementSummary ? (
        <div className="mb-6">
          <CampaignSummaryCard summary={settlementSummary} />
        </div>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
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
        </>
      )}

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
              <>
                {/* Daftar kartu di ponsel — tabel lebar dengan kolom rata
                    kanan bikin nilainya cuma kebaca lewat scroll ke ujung
                    kanan. Tabel aslinya tetap dipakai mulai lg. */}
                <ul className="space-y-3 lg:hidden">
                  {campaign.participations.map((p) => {
                    const line = performance?.lines.find(
                      (l) => l.creatorId === p.creatorId,
                    );
                    return (
                      <li
                        key={p.id}
                        className="rounded-xl border border-line p-3"
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0">
                            <p className="truncate text-sm font-medium">
                              {p.creator.name}
                            </p>
                            <p className="truncate text-xs text-muted">
                              {p.creator.creatorProfile?.city} · trust{" "}
                              {p.creator.creatorProfile?.trustScore}
                            </p>
                          </div>
                          {p.submission ? (
                            <Badge tone={submissionStatusTone[p.submission.status]}>
                              {submissionStatusLabel[p.submission.status]}
                            </Badge>
                          ) : (
                            <Badge tone={participationStatusTone[p.status]}>
                              {participationStatusLabel[p.status]}
                            </Badge>
                          )}
                        </div>
                        <div className="mt-3 grid grid-cols-3 gap-2 text-xs">
                          <div className="min-w-0">
                            <p className="text-muted">Views</p>
                            <p className="tabular truncate font-medium">
                              {formatCompact(p.submission?.lastViews ?? 0)}
                            </p>
                            {line?.isCapped ? (
                              <p className="truncate font-medium text-amber-600">
                                maks {formatCompact(line.viewsCounted)}
                              </p>
                            ) : null}
                          </div>
                          <div className="min-w-0">
                            <p className="text-muted">Porsi</p>
                            <p className="tabular truncate font-medium">
                              {line ? `${line.sharePercent.toFixed(1)}%` : "—"}
                            </p>
                          </div>
                          <div className="min-w-0">
                            <p className="text-muted">Proyeksi</p>
                            <p className="tabular truncate font-medium">
                              {line ? formatIDR(line.netAmount) : "—"}
                            </p>
                          </div>
                        </div>
                      </li>
                    );
                  })}
                </ul>

                <div className="hidden lg:block">
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
                                <Badge
                                  tone={submissionStatusTone[p.submission.status]}
                                >
                                  {submissionStatusLabel[p.submission.status]}
                                </Badge>
                              ) : (
                                <Badge tone={participationStatusTone[p.status]}>
                                  {participationStatusLabel[p.status]}
                                </Badge>
                              )}
                            </Td>
                            <Td align="right">
                              <span className="tabular">
                                {formatCompact(p.submission?.lastViews ?? 0)}
                              </span>
                              {line?.isCapped ? (
                                <span className="block text-[11px] font-medium text-amber-600">
                                  maks {formatCompact(line.viewsCounted)}
                                </span>
                              ) : null}
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
                </div>
              </>
            )}
          </Card>

          {campaign.payouts.length > 0 ? (
            <Card className="mt-6">
              <CardHeader
                title="Payout final"
                description="Rincian pembagian pool setelah campaign selesai."
              />
              <ul className="space-y-3 lg:hidden">
                {campaign.payouts.map((payout) => (
                  <li key={payout.id} className="rounded-xl border border-line p-3">
                    <p className="truncate text-sm font-medium">
                      {payout.creator.name}
                    </p>
                    <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
                      <div className="min-w-0">
                        <p className="text-muted">Views</p>
                        <p className="tabular truncate font-medium">
                          {formatCompact(payout.viewsCounted)}
                        </p>
                      </div>
                      <div className="min-w-0">
                        <p className="text-muted">Diterima</p>
                        <p className="tabular truncate font-medium">
                          {formatIDR(payout.netAmount)}
                        </p>
                      </div>
                      <div className="min-w-0">
                        <p className="text-muted">Bruto</p>
                        <p className="tabular truncate font-medium">
                          {formatIDR(payout.grossAmount)}
                        </p>
                      </div>
                      <div className="min-w-0">
                        <p className="text-muted">Fee</p>
                        <p className="tabular truncate font-medium">
                          {formatIDR(payout.platformFee)}
                        </p>
                      </div>
                    </div>
                  </li>
                ))}
              </ul>

              <div className="hidden lg:block">
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
              </div>
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
                ...(campaign.maxViewsPerCreator
                  ? [
                      {
                        label: "Plafon per creator",
                        value: `${formatCompact(campaign.maxViewsPerCreator)} views`,
                      },
                    ]
                  : []),
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
            {campaign.escrow.filter((trx) => trx.type !== "PLATFORM_FEE")
              .length === 0 ? (
              <p className="text-sm text-muted">Belum ada transaksi.</p>
            ) : (
              <ul className="space-y-2 text-sm">
                {campaign.escrow
                  .filter((trx) => trx.type !== "PLATFORM_FEE")
                  .map((trx) => (
                    <li
                      key={trx.id}
                      className="flex items-center justify-between gap-2"
                    >
                      <span className="min-w-0 truncate text-muted">
                        {trx.type}
                      </span>
                      <span className="flex shrink-0 items-center gap-2">
                        <span className="tabular">{formatIDR(trx.amount)}</span>
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

          {DELETABLE_STATUSES.includes(campaign.status) ? (
            <DeleteCampaignCard
              campaignId={campaign.id}
              campaignTitle={campaign.title}
            />
          ) : null}
        </div>
      </div>
    </div>
  );
}
