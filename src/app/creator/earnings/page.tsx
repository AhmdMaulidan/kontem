import { requireRole } from "@/lib/auth";
import { db } from "@/lib/db";
import { formatCompact, formatDate, formatIDR } from "@/lib/format";
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
import { payoutStatusLabel, payoutStatusTone } from "@/lib/labels";
import { BankForm } from "./bank-form";

export default async function EarningsPage() {
  const user = await requireRole("CREATOR");

  const payouts = await db.payout.findMany({
    where: { creatorId: user.id },
    include: { campaign: { include: { vendor: { include: { vendorProfile: true } } } } },
    orderBy: { createdAt: "desc" },
  });

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
