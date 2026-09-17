import Link from "next/link";
import { requireRole } from "@/lib/auth";
import { db } from "@/lib/db";
import { getCampaignPerformance } from "@/domain/campaign";
import { formatCompact, formatDate, formatIDR, daysUntil } from "@/lib/format";
import {
  Badge,
  ButtonLink,
  Callout,
  Card,
  CardHeader,
  EmptyState,
  IconLock,
  IconMegaphone,
  IconTrend,
  PageHeader,
  Stat,
} from "@/components/ui";
import { campaignStatusLabel, campaignStatusTone } from "@/lib/labels";

function hariSisa(endDate: Date) {
  return Math.max(0, daysUntil(endDate));
}

export default async function VendorDashboard() {
  const user = await requireRole("VENDOR");

  // --- Data kampanye ---
  const campaigns = await db.campaign.findMany({
    where: { vendorId: user.id },
    include: {
      _count: {
        select: {
          participations: { where: { status: { not: "CANCELLED" } } },
        },
      },
    },
    orderBy: { createdAt: "desc" },
  });

  const activeCampaigns = campaigns.filter((c) => c.status === "ACTIVE");

  // Performance hanya untuk campaign aktif — yang lain tidak perlu estimasi real-time.
  const activePerformances = await Promise.all(
    activeCampaigns.map(async (c) => ({
      campaign: c,
      performance: await getCampaignPerformance(c.id),
    })),
  );

  // --- Keuangan: transaksi escrow yang sudah selesai (dari campaign settled) ---
  const escrowItems = await db.escrowTransaction.findMany({
    where: {
      campaign: { vendorId: user.id },
      status: "COMPLETED",
      type: { in: ["DEPOSIT", "PAYOUT", "REFUND"] },
    },
    select: { type: true, amount: true },
  });

  const escrowByType = { DEPOSIT: 0, PAYOUT: 0, REFUND: 0 };
  for (const item of escrowItems) {
    escrowByType[item.type as "DEPOSIT" | "PAYOUT" | "REFUND"] += item.amount;
  }

  // --- Stat agregat header ---
  const totalViewsAktif = activePerformances.reduce(
    (sum, { performance }) => sum + (performance?.totalViews ?? 0),
    0,
  );

  // Budget yang masih terkunci (campaign belum settled)
  const escrowAktif = campaigns
    .filter((c) =>
      ["ACTIVE", "PENDING_REVIEW", "ENDED", "SETTLING"].includes(c.status),
    )
    .reduce((sum, c) => sum + c.budgetPool, 0);

  return (
    <div>
      <PageHeader
        title={user.vendorProfile?.businessName ?? "Dashboard"}
        description={`${user.vendorProfile?.city ?? ""} · ${campaigns.length} campaign dibuat`}
      />

      {user.status !== "VERIFIED" ? (
        <div className="mb-6">
          <Callout tone="warning" title="Menunggu verifikasi admin">
            Tim kami akan mengecek lokasi di Google Maps dan menghubungi nomor
            PIC yang kamu daftarkan. Campaign baru bisa dipublikasikan setelah
            verifikasi selesai.
          </Callout>
        </div>
      ) : null}

      {/* ── Stat cards ─────────────────────────────────────────────────── */}
      <div className="grid gap-4 sm:grid-cols-3">
        <Stat
          label="Campaign aktif"
          icon={IconMegaphone}
          value={activeCampaigns.length}
          tone="brand"
        />
        <Stat
          label="Total views (aktif)"
          icon={IconTrend}
          value={formatCompact(totalViewsAktif)}
          hint="Dari konten yang disetujui"
        />
        <Stat
          label="Budget di escrow"
          icon={IconLock}
          value={formatIDR(escrowAktif)}
          hint="Campaign berjalan & pending"
        />
      </div>

      {/* ── Main content ────────────────────────────────────────────────── */}
      <div className="mt-8 grid gap-6 lg:grid-cols-3">
        {/* Kolom kiri — campaign */}
        <div className="space-y-6 lg:col-span-2">
          {/* Campaign berjalan */}
          <Card>
            <CardHeader
              title="Campaign berjalan"
              description="Performa views campaign yang sedang aktif."
              action={
                <ButtonLink
                  href="/vendor/campaigns?status=ACTIVE"
                  size="compact"
                  variant="secondary"
                >
                  Lihat semua
                </ButtonLink>
              }
            />

            {activeCampaigns.length === 0 ? (
              <EmptyState
                title="Tidak ada campaign aktif"
                description="Campaign yang sudah disetujui admin akan muncul di sini."
                action={
                  <ButtonLink href="/vendor/campaigns/new">
                    Buat campaign
                  </ButtonLink>
                }
              />
            ) : (
              <ul className="divide-y divide-line">
                {activePerformances.map(({ campaign, performance }) => {
                  const sisa = hariSisa(campaign.endDate);
                  const terpakai = performance?.totalDistributed ?? 0;
                  return (
                    <li key={campaign.id} className="py-4 first:pt-0 last:pb-0">
                      <div className="min-w-0">
                        <Link
                          href={`/vendor/campaigns/${campaign.id}`}
                          className="font-medium hover:text-brand"
                        >
                          {campaign.title}
                        </Link>
                        <p className="mt-0.5 text-sm text-muted">
                          {campaign._count.participations} creator ·{" "}
                          <span
                            className={
                              sisa <= 3 ? "font-medium text-warning" : ""
                            }
                          >
                            {sisa > 0
                              ? `${sisa} hari lagi`
                              : "Berakhir hari ini"}
                          </span>
                        </p>
                      </div>

                      <div className="mt-3 grid grid-cols-3 gap-4 text-sm">
                        <div>
                          <p className="text-xs text-muted">Views</p>
                          <p className="tabular font-medium">
                            {formatCompact(performance?.totalViews ?? 0)}
                          </p>
                        </div>
                        <div>
                          <p className="text-xs text-muted">Terpakai</p>
                          <p className="tabular font-medium">
                            {formatIDR(terpakai)}
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
                                    (terpakai / performance.totalViews) * 1000,
                                  ),
                                )
                              : "—"}
                          </p>
                        </div>
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </Card>

          {/* Riwayat campaign — 5 terbaru ringkas */}
          <Card>
            <CardHeader
              title="Riwayat campaign"
              description="Semua campaign yang pernah kamu ajukan."
              action={
                <ButtonLink
                  href="/vendor/campaigns"
                  size="compact"
                  variant="secondary"
                >
                  Lihat semua
                </ButtonLink>
              }
            />

            {campaigns.length === 0 ? (
              <EmptyState
                title="Belum ada campaign"
                description="Buat campaign pertama untuk mulai menjangkau creator lokal."
                action={
                  <ButtonLink href="/vendor/campaigns/new">
                    Buat campaign
                  </ButtonLink>
                }
              />
            ) : (
              <ul className="divide-y divide-line">
                {campaigns.slice(0, 5).map((campaign) => (
                  <li
                    key={campaign.id}
                    className="flex flex-wrap items-center justify-between gap-3 py-3 first:pt-0 last:pb-0"
                  >
                    <div className="min-w-0">
                      <Link
                        href={`/vendor/campaigns/${campaign.id}`}
                        className="text-sm font-medium hover:text-brand"
                      >
                        {campaign.title}
                      </Link>
                      <p className="text-xs text-muted">
                        {formatDate(campaign.startDate)} –{" "}
                        {formatDate(campaign.endDate)} ·{" "}
                        {campaign._count.participations} creator
                      </p>
                    </div>
                    <Badge tone={campaignStatusTone[campaign.status]}>
                      {campaignStatusLabel[campaign.status]}
                    </Badge>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </div>

        {/* Kolom kanan — keuangan */}
        <div className="space-y-6">
          {/* Ringkasan keuangan */}
          <Card>
            <CardHeader
              title="Ringkasan keuangan"
              description="Dari campaign yang sudah selesai (settled)."
            />
            <dl className="space-y-3 text-sm">
              <div className="flex justify-between gap-3">
                <dt className="text-muted">Total disetor ke escrow</dt>
                <dd className="tabular font-medium">
                  {formatIDR(escrowByType.DEPOSIT)}
                </dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt className="text-muted">Dicairkan ke creator</dt>
                <dd className="tabular font-medium">
                  {formatIDR(escrowByType.PAYOUT)}
                </dd>
              </div>
              <div className="flex justify-between gap-3 border-t border-line pt-3">
                <dt className="font-medium">Dikembalikan ke kamu</dt>
                <dd className="tabular font-semibold text-success">
                  {formatIDR(escrowByType.REFUND)}
                </dd>
              </div>
            </dl>
            {escrowAktif > 0 ? (
              <p className="mt-4 text-xs text-muted">
                + {formatIDR(escrowAktif)} masih terkunci di campaign yang
                belum selesai.
              </p>
            ) : null}
          </Card>
        </div>
      </div>
    </div>
  );
}
