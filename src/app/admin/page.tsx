import Link from "next/link";
import { requireRole } from "@/lib/auth";
import { db } from "@/lib/db";
import { formatCompact, formatDateTime, formatIDR } from "@/lib/format";
import {
  Badge,
  Card,
  CardHeader,
  EmptyState,
  IconBank,
  IconBanknote,
  IconClock,
  IconTrend,
  PageHeader,
  Stat,
  Table,
  Td,
  Th,
} from "@/components/ui";
import { campaignStatusLabel, campaignStatusTone } from "@/lib/labels";

export default async function AdminDashboard() {
  await requireRole("ADMIN");

  const [
    vendorPending,
    campaignPending,
    sengketaTerbuka,
    fraudTerbuka,
    payoutPending,
    vendorAktif,
    creatorAktif,
    gmv,
    feeAgg,
    viewsAgg,
    campaignTerbaru,
    auditTerbaru,
  ] = await Promise.all([
    db.user.count({ where: { role: "VENDOR", status: "PENDING" } }),
    db.campaign.count({ where: { status: "PENDING_REVIEW" } }),
    db.dispute.count({ where: { status: { in: ["OPEN", "UNDER_REVIEW"] } } }),
    db.fraudFlag.count({ where: { status: { in: ["OPEN", "REVIEWING"] } } }),
    db.payout.aggregate({
      _sum: { netAmount: true },
      _count: true,
      where: { status: "PENDING" },
    }),
    db.user.count({ where: { role: "VENDOR", status: "VERIFIED" } }),
    db.user.count({ where: { role: "CREATOR" } }),
    db.campaign.aggregate({
      _sum: { budgetPool: true },
      where: { status: { in: ["ACTIVE", "ENDED", "SETTLING", "SETTLED"] } },
    }),
    db.payout.aggregate({ _sum: { platformFee: true } }),
    db.submission.aggregate({
      _sum: { lastViews: true },
      where: { status: { in: ["APPROVED", "ADMIN_APPROVED"] } },
    }),
    db.campaign.findMany({
      include: { vendor: { include: { vendorProfile: true } } },
      orderBy: { createdAt: "desc" },
      take: 6,
    }),
    db.auditLog.findMany({
      include: { actor: { select: { name: true, role: true } } },
      orderBy: { createdAt: "desc" },
      take: 8,
    }),
  ]);

  const antrean = [
    {
      label: "Vendor menunggu verifikasi",
      count: vendorPending,
      href: "/admin/vendors",
    },
    {
      label: "Campaign menunggu approval",
      count: campaignPending,
      href: "/admin/campaigns",
    },
    { label: "Sengketa terbuka", count: sengketaTerbuka, href: "/admin/disputes" },
    { label: "Laporan fraud", count: fraudTerbuka, href: "/admin/fraud" },
  ];

  return (
    <div>
      <PageHeader
        title="Ringkasan platform"
        description="Kesehatan marketplace dan antrean kerja yang menunggu admin."
      />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Stat
          label="GMV campaign"
          icon={IconBank}
          value={formatIDR(gmv._sum.budgetPool ?? 0)}
          hint="Nilai campaign yang dikelola platform"
          tone="brand"
        />
        <Stat
          label="Pendapatan fee"
          icon={IconBanknote}
          value={formatIDR(feeAgg._sum.platformFee ?? 0)}
          hint="Komisi dari payout yang sudah dihitung"
          tone="success"
        />
        <Stat
          label="Total views dibayar"
          icon={IconTrend}
          value={formatCompact(viewsAgg._sum.lastViews ?? 0)}
          hint="Konten yang disetujui"
        />
        <Stat
          label="Menunggu pencairan"
          icon={IconClock}
          value={formatIDR(payoutPending._sum.netAmount ?? 0)}
          hint={`${payoutPending._count} payout`}
          tone={payoutPending._count > 0 ? "danger" : undefined}
        />
      </div>

      <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Stat label="Vendor aktif" value={vendorAktif} />
        <Stat label="Creator terdaftar" value={creatorAktif} />
        <Stat
          label="Rasio creator per vendor"
          value={vendorAktif > 0 ? (creatorAktif / vendorAktif).toFixed(1) : "—"}
          hint="Indikator keseimbangan dua sisi"
        />
        <Stat
          label="Antrean kerja admin"
          value={antrean.reduce((sum, item) => sum + item.count, 0)}
        />
      </div>

      <div className="mt-8 grid gap-6 lg:grid-cols-3">
        <Card>
          <CardHeader title="Antrean menunggu" />
          <ul className="space-y-2">
            {antrean.map((item) => (
              <li key={item.href}>
                <Link
                  href={item.href}
                  className="flex items-center justify-between rounded-xl border border-line px-3 py-2.5 text-sm hover:border-brand"
                >
                  <span>{item.label}</span>
                  <Badge tone={item.count > 0 ? "warning" : "neutral"}>
                    {item.count}
                  </Badge>
                </Link>
              </li>
            ))}
          </ul>
        </Card>

        <div className="lg:col-span-2">
          <Card>
            <CardHeader title="Campaign terbaru" />
            {campaignTerbaru.length === 0 ? (
              <EmptyState title="Belum ada campaign" />
            ) : (
              <Table>
                <thead>
                  <tr>
                    <Th>Campaign</Th>
                    <Th>Vendor</Th>
                    <Th align="right">Pool</Th>
                    <Th>Status</Th>
                  </tr>
                </thead>
                <tbody>
                  {campaignTerbaru.map((campaign) => (
                    <tr key={campaign.id}>
                      <Td>{campaign.title}</Td>
                      <Td>{campaign.vendor.vendorProfile?.businessName}</Td>
                      <Td align="right">{formatIDR(campaign.budgetPool)}</Td>
                      <Td>
                        <Badge tone={campaignStatusTone[campaign.status]}>
                          {campaignStatusLabel[campaign.status]}
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

      <div className="mt-6">
        <Card>
          <CardHeader
            title="Audit trail terbaru"
            description="Setiap keputusan yang mengubah status atau uang tercatat di sini."
          />
          {auditTerbaru.length === 0 ? (
            <EmptyState title="Belum ada aktivitas" />
          ) : (
            <ul className="divide-y divide-line text-sm">
              {auditTerbaru.map((log) => (
                <li
                  key={log.id}
                  className="flex flex-wrap items-center justify-between gap-2 py-2.5 first:pt-0 last:pb-0"
                >
                  <span>
                    <code className="font-mono text-xs text-brand">{log.action}</code>{" "}
                    <span className="text-muted">
                      oleh {log.actor?.name ?? "sistem"} pada {log.entity}
                    </span>
                  </span>
                  <span className="text-xs text-muted">
                    {formatDateTime(log.createdAt)}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>
    </div>
  );
}
