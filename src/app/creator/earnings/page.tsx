import { requireRole } from "@/lib/auth";
import { db } from "@/lib/db";
import { formatCompact, formatDate, formatIDR } from "@/lib/format";
import { COUNTABLE_STATUSES } from "@/domain/campaign";
import { calculateCreatorEarning } from "@/domain/withdrawal";
import {
  Badge,
  Card,
  CardHeader,
  EmptyState,
  IconBank,
  IconBanknote,
  IconTrend,
  PageHeader,
  Stat,
  Table,
  Td,
  Th,
} from "@/components/ui";
import {
  payoutStatusLabel,
  payoutStatusTone,
  withdrawalStatusLabel,
  withdrawalStatusTone,
} from "@/lib/labels";
import { BankForm } from "./bank-form";
import { WithdrawalForm } from "./withdrawal-form";

export default async function EarningsPage() {
  const user = await requireRole("CREATOR");

  const [payouts, withdrawals, videoBisaDitarik] = await Promise.all([
    db.payout.findMany({
      where: { creatorId: user.id },
      include: { campaign: { include: { vendor: { include: { vendorProfile: true } } } } },
      orderBy: { createdAt: "desc" },
    }),
    db.withdrawal.findMany({
      where: { creatorId: user.id },
      include: { campaign: true },
      orderBy: { requestedAt: "desc" },
    }),
    db.submission.findMany({
      where: {
        creatorId: user.id,
        status: { in: COUNTABLE_STATUSES },
        campaign: { status: "ACTIVE" },
        withdrawal: null,
      },
      include: { campaign: true },
      orderBy: { submittedAt: "desc" },
    }),
  ]);

  const rekeningLengkap = Boolean(
    user.creatorProfile?.bankName &&
      user.creatorProfile?.bankAccountNumber &&
      user.creatorProfile?.bankAccountName,
  );

  const totalCair = payouts
    .filter((p) => p.status === "PAID")
    .reduce((sum, p) => sum + p.netAmount, 0);
  const totalFee = payouts.reduce((sum, p) => sum + p.platformFee, 0);
  const totalViews = payouts.reduce((sum, p) => sum + p.viewsCounted, 0);

  return (
    <div>
      <PageHeader
        title="Penghasilan"
        description="Riwayat payout dan rekening tujuan pencairan."
      />

      <div className="grid gap-4 sm:grid-cols-3">
        <Stat label="Total diterima"
          icon={IconBanknote} value={formatIDR(totalCair)} tone="success" />
        <Stat
          label="Views dibayar"
          icon={IconTrend}
          value={formatCompact(totalViews)}
          hint="Akumulasi semua campaign"
        />
        <Stat
          label="Fee platform"
          icon={IconBank}
          value={formatIDR(totalFee)}
          hint="Sudah dipotong dari bruto"
        />
      </div>

      <div className="mt-8">
        <Card>
          <CardHeader
            title="Video yang bisa ditarik"
            description="Penarikan dini per video, sebelum campaign berakhir — tidak perlu menunggu settlement."
          />
          {videoBisaDitarik.length === 0 ? (
            <p className="text-sm text-muted">
              Belum ada video yang siap ditarik. Video muncul di sini setelah
              disetujui dan campaign-nya masih berjalan.
            </p>
          ) : (
            <ul className="divide-y divide-line">
              {videoBisaDitarik.map((submission) => {
                const earning = calculateCreatorEarning(
                  submission.lastViews,
                  submission.campaign,
                );
                const minimum = submission.campaign.minWithdrawalAmount;
                const belumCapaiMinimum =
                  typeof minimum === "number" && earning.grossAmount < minimum;

                const disabledReason = !rekeningLengkap
                  ? "Lengkapi rekening bank dulu (lihat panel di kanan)."
                  : belumCapaiMinimum
                    ? `Kurang ${formatIDR(minimum! - earning.grossAmount)} lagi dari minimum penarikan campaign ini.`
                    : earning.grossAmount <= 0
                      ? "Belum ada penghasilan dari video ini."
                      : undefined;

                return (
                  <li
                    key={submission.id}
                    className="flex flex-wrap items-center justify-between gap-3 py-3 first:pt-0 last:pb-0"
                  >
                    <div className="min-w-0">
                      <p className="font-medium">{submission.campaign.title}</p>
                      <p className="mt-0.5 text-sm text-muted">
                        {formatCompact(earning.viewsCounted)} views ·{" "}
                        <span className="tabular font-medium text-brand-600">
                          {formatIDR(earning.grossAmount)}
                        </span>
                      </p>
                    </div>
                    <WithdrawalForm
                      submissionId={submission.id}
                      disabledReason={disabledReason}
                    />
                  </li>
                );
              })}
            </ul>
          )}
        </Card>
      </div>

      <div className="mt-8 grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <Card>
            <CardHeader
              title="Riwayat payout"
              description="Perhitungan per campaign, lengkap dengan proporsi views."
            />
            {payouts.length === 0 ? (
              <EmptyState
                title="Belum ada payout"
                description="Payout muncul setelah campaign yang kamu ikuti selesai dan dihitung admin."
              />
            ) : (
              <Table>
                <thead>
                  <tr>
                    <Th>Campaign</Th>
                    <Th align="right">Views</Th>
                    <Th align="right">Porsi</Th>
                    <Th align="right">Bruto</Th>
                    <Th align="right">Diterima</Th>
                    <Th>Status</Th>
                  </tr>
                </thead>
                <tbody>
                  {payouts.map((payout) => (
                    <tr key={payout.id}>
                      <Td>
                        <p className="font-medium">{payout.campaign.title}</p>
                        <p className="text-xs text-muted">
                          {payout.campaign.vendor.vendorProfile?.businessName}
                          {payout.paidAt ? ` · ${formatDate(payout.paidAt)}` : ""}
                        </p>
                      </Td>
                      <Td align="right">{formatCompact(payout.viewsCounted)}</Td>
                      <Td align="right">{payout.sharePercent.toFixed(1)}%</Td>
                      <Td align="right">{formatIDR(payout.grossAmount)}</Td>
                      <Td align="right" className="font-medium">
                        {formatIDR(payout.netAmount)}
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
            )}
          </Card>

          <div className="mt-6">
            <Card>
              <CardHeader
                title="Riwayat penarikan"
                description="Penarikan dini per video, sebelum campaign selesai."
              />
              {withdrawals.length === 0 ? (
                <EmptyState
                  title="Belum ada penarikan"
                  description="Ajukan lewat daftar video di atas setelah capai minimum campaign."
                />
              ) : (
                <Table>
                  <thead>
                    <tr>
                      <Th>Campaign</Th>
                      <Th align="right">Views</Th>
                      <Th align="right">Fee</Th>
                      <Th align="right">Diterima</Th>
                      <Th>Status</Th>
                    </tr>
                  </thead>
                  <tbody>
                    {withdrawals.map((w) => (
                      <tr key={w.id}>
                        <Td>
                          <p className="font-medium">{w.campaign.title}</p>
                          <p className="text-xs text-muted">
                            Diajukan {formatDate(w.requestedAt)}
                          </p>
                        </Td>
                        <Td align="right">{formatCompact(w.viewsCounted)}</Td>
                        <Td align="right">{formatIDR(w.feeAmount)}</Td>
                        <Td align="right" className="font-medium">
                          {formatIDR(w.netAmount)}
                        </Td>
                        <Td>
                          <Badge tone={withdrawalStatusTone[w.status]}>
                            {withdrawalStatusLabel[w.status]}
                          </Badge>
                        </Td>
                      </tr>
                    ))}
                  </tbody>
                </Table>
              )}
            </Card>
          </div>
        </div>

        <Card>
          <CardHeader
            title="Rekening pencairan"
            description="Payout ditransfer ke rekening ini."
          />
          <BankForm
            defaultValues={{
              bankName: user.creatorProfile?.bankName ?? "",
              bankAccountNumber: user.creatorProfile?.bankAccountNumber ?? "",
              bankAccountName: user.creatorProfile?.bankAccountName ?? "",
            }}
          />
        </Card>
      </div>
    </div>
  );
}
