import { requireRole } from "@/lib/auth";
import { db } from "@/lib/db";
import { formatCompact, formatIDR } from "@/lib/format";
import {
  Badge,
  ButtonLink,
  DataTable,
  IconAlert,
  IconArrowLeft,
  IconBanknote,
  PageHeader,
  TableEmptyRow,
  TableCaptionRow,
  TableToolbar,
  Td,
  Th,
  rowNumber,
} from "@/components/ui";
import type { PayoutStatus } from "@/generated/prisma/enums";
import { payoutStatusLabel, payoutStatusTone } from "@/lib/labels";
import { releasePayoutsAction, releaseSinglePayoutAction } from "../../actions";
import { SimpleActionForm } from "../../decision-form";

const BASE = "/admin/payouts/pratinjau";

export default async function AdminPayoutsPratinjauPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; campaign?: string; status?: string }>;
}) {
  await requireRole("ADMIN");
  const params = await searchParams;

  const campaigns = await db.campaign.findMany({
    where: { payouts: { some: {} } },
    include: {
      vendor: { include: { vendorProfile: true } },
      payouts: {
        include: {
          creator: { include: { creatorProfile: true } },
          submission: {
            include: {
              fraudFlags: { where: { status: { in: ["OPEN", "REVIEWING"] } } },
            },
          },
        },
        orderBy: { netAmount: "desc" },
      },
    },
    orderBy: { settledAt: "desc" },
  });

  // Kalau id campaign di query tidak ditemukan di daftar yang sudah disettle
  // (mis. admin mengeklik "Lihat pratinjau" dari campaign yang belum
  // disettle), filter itu diabaikan alih-alih mengosongkan seluruh tabel.
  const campaignIds = new Set(campaigns.map((campaign) => campaign.id));
  const campaignFilter =
    params.campaign && campaignIds.has(params.campaign)
      ? params.campaign
      : undefined;

  const terpilih = campaigns.filter((campaign) => {
    if (campaignFilter && campaign.id !== campaignFilter) return false;
    if (params.q) {
      const kata = params.q.toLowerCase();
      const cocok =
        campaign.title.toLowerCase().includes(kata) ||
        campaign.payouts.some((payout) =>
          payout.creator.name.toLowerCase().includes(kata),
        );
      if (!cocok) return false;
    }
    if (params.status) {
      return campaign.payouts.some(
        (payout) => payout.status === (params.status as PayoutStatus),
      );
    }
    return true;
  });

  return (
    <div>
      <ButtonLink
        href="/admin/payouts"
        variant="secondary"
        size="sm"
        className="mb-4"
      >
        <IconArrowLeft className="h-4 w-4" strokeWidth={2} />
        Kembali ke settlement
      </ButtonLink>

      <PageHeader
        title="Pratinjau pembagian"
        description="Rincian hasil hitung pembagian pool per creator untuk campaign yang sudah disettle. Cairkan setelah dicek."
      />

      <div className="mb-8">
        <TableToolbar
          basePath={BASE}
          params={params}
          searchPlaceholder="Cari creator / campaign..."
          filters={[
            {
              name: "campaign",
              label: "Campaign",
              options: [
                { value: "", label: "Semua campaign" },
                ...campaigns.map((campaign) => ({
                  value: campaign.id,
                  label: campaign.title,
                })),
              ],
            },
            {
              name: "status",
              label: "Status payout",
              options: [
                { value: "", label: "Semua status" },
                ...Object.entries(payoutStatusLabel).map(([value, label]) => ({
                  value,
                  label,
                })),
              ],
            },
          ]}
        />
      </div>

      {terpilih.length === 0 ? (
        <TableEmptyRowStandalone />
      ) : (
        <div className="space-y-8">
          {terpilih.map((campaign) => {
            const siapCair = campaign.payouts.filter(
              (payout) =>
                payout.status === "PENDING" &&
                (payout.submission?.fraudFlags.length ?? 0) === 0,
            );
            const totalSiapCair = siapCair.reduce(
              (sum, payout) => sum + payout.netAmount,
              0,
            );
            const adaTertahan = campaign.payouts.some(
              (payout) => (payout.submission?.fraudFlags.length ?? 0) > 0,
            );
            const totalViews = campaign.payouts.reduce(
              (sum, payout) => sum + payout.viewsCounted,
              0,
            );
            const totalGross = campaign.payouts.reduce(
              (sum, payout) => sum + payout.grossAmount,
              0,
            );
            const totalFeeCampaign = campaign.payouts.reduce(
              (sum, payout) => sum + payout.platformFee,
              0,
            );
            const totalNet = campaign.payouts.reduce(
              (sum, payout) => sum + payout.netAmount,
              0,
            );

            return (
              <DataTable
                key={campaign.id}
                title={`Pratinjau pembagian — ${campaign.title}`}
                summary={`${campaign.payouts.length} creator · ${formatCompact(totalViews)} views`}
                footer={
                  siapCair.length > 0 ? (
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      {adaTertahan ? (
                        <p className="text-xs text-danger">
                          Payout yang ditahan tidak ikut dicairkan sampai flag
                          fraud-nya diselesaikan.
                        </p>
                      ) : (
                        <span />
                      )}
                      <SimpleActionForm
                        action={releasePayoutsAction}
                        hiddenField="campaignId"
                        hiddenValue={campaign.id}
                        label={`Cairkan semua yang siap (${siapCair.length} creator · ${formatIDR(totalSiapCair)})`}
                        pendingLabel="Mencairkan..."
                      />
                    </div>
                  ) : (
                    <p className="text-sm text-muted">
                      Semua payout campaign ini sudah selesai diproses.
                    </p>
                  )
                }
              >
                <thead>
                  <tr>
                    <Th>No</Th>
                    <Th>Creator</Th>
                    <Th align="right">Views</Th>
                    <Th align="right">Porsi</Th>
                    <Th align="right">Payout Kotor</Th>
                    <Th align="right">Fee {campaign.platformFeeRate}%</Th>
                    <Th align="right">Payout Bersih</Th>
                    <Th>Rekening</Th>
                    <Th>Status</Th>
                    <Th>Aksi</Th>
                  </tr>
                </thead>
                <tbody>
                  {campaign.payouts.map((payout, index) => {
                    const tertahan =
                      (payout.submission?.fraudFlags.length ?? 0) > 0;

                    return (
                      <tr key={payout.id}>
                        <Td className="tabular text-muted">
                          {rowNumber(index, 1, campaign.payouts.length)}
                        </Td>
                        <Td className="font-medium">{payout.creator.name}</Td>
                        <Td align="right">
                          {formatCompact(payout.viewsCounted)}
                        </Td>
                        <Td align="right">
                          {payout.sharePercent.toFixed(1)}%
                        </Td>
                        <Td align="right">{formatIDR(payout.grossAmount)}</Td>
                        <Td align="right">{formatIDR(payout.platformFee)}</Td>
                        <Td align="right" className="font-medium">
                          {formatIDR(payout.netAmount)}
                        </Td>
                        <Td className="text-xs text-muted">
                          {payout.creator.creatorProfile?.bankName ?? "—"}{" "}
                          {payout.creator.creatorProfile?.bankAccountNumber ??
                            ""}
                        </Td>
                        <Td>
                          <Badge
                            tone={
                              tertahan ? "danger" : payoutStatusTone[payout.status]
                            }
                            icon
                          >
                            {tertahan
                              ? "Ditahan"
                              : payoutStatusLabel[payout.status]}
                          </Badge>
                        </Td>
                        <Td>
                          {tertahan ? (
                            <a
                              href="/admin/fraud"
                              className="text-brand-600 hover:text-brand-700 transition-colors"
                              title="Lihat flag fraud"
                            >
                              <IconAlert className="h-4 w-4" strokeWidth={2} />
                            </a>
                          ) : payout.status === "PENDING" ? (
                            <SimpleActionForm
                              action={releaseSinglePayoutAction}
                              hiddenField="payoutId"
                              hiddenValue={payout.id}
                              label="Cairkan ke rekening"
                              pendingLabel="Mencairkan..."
                              icon={
                                <IconBanknote
                                  className="h-4 w-4"
                                  strokeWidth={2}
                                />
                              }
                            />
                          ) : (
                            <span className="text-sm text-muted">—</span>
                          )}
                        </Td>
                      </tr>
                    );
                  })}
                  <tr className="bg-surface-muted font-medium">
                    <Td>—</Td>
                    <Td>TOTAL</Td>
                    <Td align="right">{formatCompact(totalViews)}</Td>
                    <Td align="right">100%</Td>
                    <Td align="right">{formatIDR(totalGross)}</Td>
                    <Td align="right">{formatIDR(totalFeeCampaign)}</Td>
                    <Td align="right">{formatIDR(totalNet)}</Td>
                    <Td>—</Td>
                    <Td>—</Td>
                    <Td>—</Td>
                  </tr>
                </tbody>
                {adaTertahan ? (
                  <tfoot>
                    <TableCaptionRow colSpan={10} tone="danger">
                      Baris bertanda &quot;Ditahan&quot; punya flag fraud yang
                      masih terbuka dan tidak ikut dicairkan.
                    </TableCaptionRow>
                  </tfoot>
                ) : null}
              </DataTable>
            );
          })}
        </div>
      )}
    </div>
  );
}

function TableEmptyRowStandalone() {
  return (
    <DataTable title="Pratinjau pembagian" summary="0 campaign">
      <thead>
        <tr>
          <Th>Keterangan</Th>
        </tr>
      </thead>
      <tbody>
        <TableEmptyRow
          colSpan={1}
          title="Belum ada campaign yang sudah disettle"
          description="Hitung pembagian pool dulu dari halaman settlement sebelum pratinjaunya muncul di sini."
        />
      </tbody>
    </DataTable>
  );
}
