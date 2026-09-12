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
  IconBusiness,
  IconClock,
  IconGavel,
  IconMegaphone,
  IconShieldAlert,
  IconTrend,
  PageHeader,
  Stat,
  Table,
  Td,
  Th,
  cn,
} from "@/components/ui";
import { campaignStatusLabel, campaignStatusTone } from "@/lib/labels";

/**
 * Nama aksi audit ditulis sebagai kalimat, bukan kode mentah.
 *
 * `vendor.verify` benar sebagai kunci di database, tapi di layar ia menuntut
 * pembacanya menerjemahkan sendiri. Aksi yang belum punya terjemahan tetap
 * ditampilkan apa adanya — lebih baik terbaca teknis daripada hilang.
 */
const auditLabel = (action: string) =>
  ({
    "vendor.verify": "Vendor diverifikasi",
    "vendor.reject": "Vendor ditolak",
    "campaign.approve": "Campaign disetujui",
    "campaign.reject": "Campaign ditolak",
    "submission.approve": "Submission disetujui",
    "submission.reject": "Submission ditolak",
    "dispute.resolve": "Sengketa diputus",
    "payout.release": "Payout dicairkan",
    "campaign.settle": "Campaign disettle",
    "views.update": "Views diperbarui",
  })[action] ?? action;

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
      Ikon: IconBusiness,
    },
    {
      label: "Campaign menunggu approval",
      count: campaignPending,
      href: "/admin/campaigns",
      Ikon: IconMegaphone,
    },
    {
      label: "Sengketa terbuka",
      count: sengketaTerbuka,
      href: "/admin/disputes",
      Ikon: IconGavel,
    },
    {
      label: "Laporan fraud",
      count: fraudTerbuka,
      href: "/admin/fraud",
      Ikon: IconShieldAlert,
    },
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

      {/* Empat angka pendukung digabung jadi satu panel berpembatas, bukan
          empat kartu tersendiri: kartu sebanyak itu berjejer di bawah baris
          metrik utama membuat keduanya terbaca setara, padahal yang di atas
          yang penting (design.md bagian 6.2 — maksimal tiga kartu menonjol
          per layar). */}
      <Card className="mt-4 p-0">
        <dl className="grid divide-y divide-line sm:grid-cols-2 sm:divide-y-0 lg:grid-cols-4 lg:divide-x">
          {[
            { label: "Vendor aktif", value: vendorAktif },
            { label: "Creator terdaftar", value: creatorAktif },
            {
              label: "Rasio creator per vendor",
              value:
                vendorAktif > 0
                  ? (creatorAktif / vendorAktif).toFixed(1)
                  : "—",
            },
            {
              label: "Antrean kerja admin",
              value: antrean.reduce((sum, item) => sum + item.count, 0),
            },
          ].map((item) => (
            <div key={item.label} className="px-5 py-4">
              <dt className="text-xs font-medium text-muted">{item.label}</dt>
              <dd className="tabular mt-1 font-display text-xl font-bold text-foreground">
                {item.value}
              </dd>
            </div>
          ))}
        </dl>
      </Card>

      <div className="mt-8 grid gap-6 lg:grid-cols-3">
        <Card>
          <CardHeader title="Antrean menunggu" />
          <ul className="space-y-1.5">
            {antrean.map(({ href, label, count, Ikon }) => {
              const menunggu = count > 0;
              return (
                <li key={href}>
                  <Link
                    href={href}
                    className="group flex items-center gap-3 rounded-xl px-3 py-2.5 transition-colors hover:bg-surface-muted"
                  >
                    <span
                      className={cn(
                        "flex h-9 w-9 shrink-0 items-center justify-center rounded-2xl transition-colors",
                        menunggu
                          ? "bg-warning-soft text-warning"
                          : "bg-surface-muted text-muted",
                      )}
                    >
                      <Ikon className="h-4.5 w-4.5" strokeWidth={2} />
                    </span>
                    <span className="min-w-0 flex-1 text-sm text-body group-hover:text-foreground">
                      {label}
                    </span>
                    {/* Angka nol ditulis abu tanpa badge: antrean kosong itu
                        kabar baik, bukan status yang perlu menarik mata. */}
                    <span
                      className={cn(
                        "tabular font-display text-lg font-bold",
                        menunggu ? "text-warning" : "text-muted/60",
                      )}
                    >
                      {count}
                    </span>
                  </Link>
                </li>
              );
            })}
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
            <ol className="relative space-y-4 pl-5">
              {/* Garis waktu vertikal: jejak audit dibaca sebagai urutan
                  kejadian, dan garis ini yang membuat urutannya terlihat
                  tanpa perlu membaca tanggalnya satu per satu. */}
              <span
                className="absolute top-1.5 bottom-1.5 left-[3px] w-px bg-line"
                aria-hidden
              />
              {auditTerbaru.map((log) => (
                <li key={log.id} className="relative">
                  <span
                    className="absolute top-1.5 -left-5 h-[7px] w-[7px] rounded-full bg-brand-200 ring-4 ring-surface"
                    aria-hidden
                  />
                  <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5">
                    <p className="text-sm text-body">
                      <span className="font-medium text-foreground">
                        {auditLabel(log.action)}
                      </span>{" "}
                      oleh {log.actor?.name ?? "sistem"}
                    </p>
                    <span className="tabular text-xs text-muted">
                      {formatDateTime(log.createdAt)}
                    </span>
                  </div>
                </li>
              ))}
            </ol>
          )}
        </Card>
      </div>
    </div>
  );
}
