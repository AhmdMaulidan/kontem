import Link from "next/link";
import { requireRole } from "@/lib/auth";
import { db } from "@/lib/db";
import { formatCompact, formatDate, formatIDR } from "@/lib/format";
import {
  Badge,
  BarChart,
  ButtonLink,
  Card,
  CardHeader,
  DataTable,
  EmptyState,
  IconBank,
  IconBusiness,
  IconChart,
  IconDownload,
  IconEye,
  IconShieldCheck,
  IconMegaphone,
  IconUsers,
  PageHeader,
  PageSizeSelect,
  Pagination,
  ProgressBar,
  Stat,
  TableEmptyRow,
  Td,
  Th,
  resolvePageSize,
  rowNumber,
} from "@/components/ui";
import {
  campaignStatusLabel,
  campaignStatusTone,
  categoryLabel,
} from "@/lib/labels";
import { PeriodePicker } from "../periode-picker";

const PERIODE: Record<string, { label: string; hari: number }> = {
  "30": { label: "30 hari terakhir", hari: 30 },
  "90": { label: "90 hari terakhir", hari: 90 },
  "365": { label: "12 bulan terakhir", hari: 365 },
};

const namaBulan = new Intl.DateTimeFormat("id-ID", { month: "short" });
const PAGE_SIZE = 10;
const BASE = "/admin/analytics";

export default async function AdminAnalyticsPage({
  searchParams,
}: {
  searchParams: Promise<{ periode?: string; page?: string; ukuran?: string }>;
}) {
  await requireRole("ADMIN");
  const params = await searchParams;
  const key = params.periode && PERIODE[params.periode] ? params.periode : "30";
  const { hari, label: periodeLabel } = PERIODE[key];
  const page = Math.max(1, Number(params.page) || 1);
  const pageSize = resolvePageSize(params.ukuran, PAGE_SIZE);

  const mulai = new Date();
  mulai.setDate(mulai.getDate() - hari);
  // Pembanding sepanjang periode berjalan, tepat sebelum periode itu.
  const mulaiSebelum = new Date(mulai);
  mulaiSebelum.setDate(mulaiSebelum.getDate() - hari);

  const LIVE = ["ACTIVE", "ENDED", "SETTLING", "SETTLED"] as const;

  const [
    gmvAgg,
    gmvSebelumAgg,
    feeAgg,
    feeSebelumAgg,
    viewsAgg,
    viewsSebelumAgg,
    campaignLive,
    vendorAktif,
    vendorSebelum,
    creatorAktif,
    creatorSebelum,
    perKategori,
    campaignPeriode,
    campaignEnamBulan,
    vendorBerulang,
    creatorBerulang,
    totalVendor,
    totalCreator,
  ] = await Promise.all([
    db.campaign.aggregate({
      _sum: { budgetPool: true },
      where: { createdAt: { gte: mulai }, status: { in: [...LIVE] } },
    }),
    db.campaign.aggregate({
      _sum: { budgetPool: true },
      where: {
        createdAt: { gte: mulaiSebelum, lt: mulai },
        status: { in: [...LIVE] },
      },
    }),
    db.payout.aggregate({
      _sum: { platformFee: true },
      where: { createdAt: { gte: mulai } },
    }),
    db.payout.aggregate({
      _sum: { platformFee: true },
      where: { createdAt: { gte: mulaiSebelum, lt: mulai } },
    }),
    db.submission.aggregate({
      _sum: { lastViews: true },
      where: { submittedAt: { gte: mulai } },
    }),
    db.submission.aggregate({
      _sum: { lastViews: true },
      where: { submittedAt: { gte: mulaiSebelum, lt: mulai } },
    }),
    db.campaign.count({ where: { status: "ACTIVE" } }),
    db.user.count({ where: { role: "VENDOR", status: "VERIFIED" } }),
    db.user.count({
      where: { role: "VENDOR", status: "VERIFIED", createdAt: { lt: mulai } },
    }),
    db.user.count({ where: { role: "CREATOR" } }),
    db.user.count({ where: { role: "CREATOR", createdAt: { lt: mulai } } }),
    db.campaign.groupBy({
      by: ["category"],
      _count: { _all: true },
      where: { status: { in: [...LIVE] } },
    }),
    db.campaign.findMany({
      where: { createdAt: { gte: mulai }, status: { in: [...LIVE] } },
      include: {
        vendor: { include: { vendorProfile: true } },
        submissions: { select: { lastViews: true, finalViews: true } },
        _count: { select: { participations: true } },
      },
    }),
    db.campaign.findMany({
      where: { status: { in: [...LIVE] } },
      select: { createdAt: true, budgetPool: true },
    }),
    db.campaign.groupBy({
      by: ["vendorId"],
      _count: { _all: true },
      having: { vendorId: { _count: { gt: 1 } } },
    }),
    db.campaignParticipation.groupBy({
      by: ["creatorId"],
      _count: { _all: true },
      having: { creatorId: { _count: { gt: 1 } } },
    }),
    db.user.count({ where: { role: "VENDOR", status: "VERIFIED" } }),
    db.user.count({ where: { role: "CREATOR" } }),
  ]);

  const gmv = gmvAgg._sum.budgetPool ?? 0;
  const fee = feeAgg._sum.platformFee ?? 0;
  const views = viewsAgg._sum.lastViews ?? 0;

  /** Selisih terhadap periode sebelumnya; null kalau tidak ada pembanding. */
  const delta = (sekarang: number, sebelum: number) =>
    sebelum === 0
      ? null
      : `${sekarang >= sebelum ? "+" : ""}${Math.round(((sekarang - sebelum) / sebelum) * 100)}% vs periode sebelumnya`;

  // GMV enam bulan terakhir, dihitung dari campaign yang pernah live.
  const bulanTerakhir = Array.from({ length: 6 }, (_, i) => {
    const tanggal = new Date();
    tanggal.setDate(1);
    tanggal.setMonth(tanggal.getMonth() - (5 - i));
    return tanggal;
  });
  const gmvPerBulan = bulanTerakhir.map((bulan) => {
    const berikut = new Date(bulan);
    berikut.setMonth(berikut.getMonth() + 1);
    const total = campaignEnamBulan
      .filter(
        (campaign) =>
          campaign.createdAt >= bulan && campaign.createdAt < berikut,
      )
      .reduce((sum, campaign) => sum + campaign.budgetPool, 0);
    return { label: namaBulan.format(bulan), value: total };
  });

  const kategoriTerbanyak = Math.max(
    1,
    ...perKategori.map((row) => row._count._all),
  );

  const seluruhPeringkat = campaignPeriode
    .map((campaign) => {
      const totalViews = campaign.submissions.reduce(
        (sum, submission) => sum + (submission.finalViews ?? submission.lastViews),
        0,
      );
      return {
        id: campaign.id,
        title: campaign.title,
        vendor: campaign.vendor.vendorProfile?.businessName ?? "—",
        budget: campaign.budgetPool,
        creator: campaign._count.participations,
        endDate: campaign.endDate,
        status: campaign.status,
        totalViews,
        // CPM efektif = rupiah yang benar-benar dibayar per 1.000 views. Angka
        // ini yang membedakan campaign "mahal di atas kertas" dari yang
        // benar-benar mahal.
        cpmEfektif:
          totalViews > 0
            ? Math.round(campaign.budgetPool / (totalViews / 1000))
            : 0,
      };
    })
    .sort((a, b) => b.totalViews - a.totalViews);

  const peringkatTotal = seluruhPeringkat.length;
  const peringkat = Number.isFinite(pageSize)
    ? seluruhPeringkat.slice((page - 1) * pageSize, page * pageSize)
    : seluruhPeringkat;

  const retensiVendor =
    totalVendor > 0 ? Math.round((vendorBerulang.length / totalVendor) * 100) : 0;
  const retensiCreator =
    totalCreator > 0
      ? Math.round((creatorBerulang.length / totalCreator) * 100)
      : 0;

  return (
    <div>
      <PageHeader
        title="Analitik platform"
        description="Angka kesehatan ekosistem dua sisi — dipakai untuk laporan internal dan materi pitch."
        action={
          <div className="hidden md:flex items-center gap-3">
            <PeriodePicker value={key} basePath="/admin/analytics" />
            <ButtonLink
              href="/api/admin/export?type=analytics"
              variant="secondary"
              size="sm"
              title="Export CSV"
            >
              <IconDownload className="h-4 w-4" strokeWidth={2} />
            </ButtonLink>
          </div>
        }
      />

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <Stat
          label="GMV"
          icon={IconChart}
          value={formatIDR(gmv)}
          hint={delta(gmv, gmvSebelumAgg._sum.budgetPool ?? 0) ?? periodeLabel}
        />
        <Stat
          label="Fee platform"
          icon={IconBank}
          value={formatIDR(fee)}
          hint={delta(fee, feeSebelumAgg._sum.platformFee ?? 0) ?? periodeLabel}
          tone="success"
        />
        <Stat
          label="Views total"
          icon={IconEye}
          value={formatCompact(views)}
          hint={delta(views, viewsSebelumAgg._sum.lastViews ?? 0) ?? periodeLabel}
        />
        <Stat label="Campaign live" icon={IconMegaphone} value={campaignLive} />
        <Stat
          label="Vendor aktif"
          icon={IconBusiness}
          value={vendorAktif}
          hint={delta(vendorAktif, vendorSebelum) ?? "Belum ada pembanding"}
        />
        <Stat
          label="Creator aktif"
          icon={IconUsers}
          value={creatorAktif}
          hint={delta(creatorAktif, creatorSebelum) ?? "Belum ada pembanding"}
        />
      </div>

      <div className="mt-8 grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader
            title="GMV per bulan"
            description="Enam bulan terakhir, dari campaign yang pernah live."
          />
          <BarChart data={gmvPerBulan} formatValue={formatCompact} />
        </Card>

        <Card>
          <CardHeader
            title="Campaign per kategori"
            description="Sebaran seluruh campaign yang pernah live."
          />
          {perKategori.length === 0 ? (
            <EmptyState title="Belum ada campaign yang pernah live" />
          ) : (
            <ul className="space-y-3">
              {perKategori.map((row) => (
                <li key={row.category}>
                  <div className="flex items-center justify-between text-sm">
                    <span>{categoryLabel[row.category]}</span>
                    <span className="tabular font-medium">{row._count._all}</span>
                  </div>
                  <div className="mt-1.5">
                    <ProgressBar value={row._count._all} max={kategoriTerbanyak} />
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>

      <Card className="mt-6">
        <CardHeader
          title="Retensi"
          description="Berapa persen yang kembali untuk campaign kedua — ukuran paling jujur bahwa platform ini dipakai, bukan sekadar dicoba."
        />
        <ul className="space-y-4">
          <li>
            <div className="flex items-center justify-between text-sm">
              <span>Vendor yang bikin campaign kedua</span>
              <span className="tabular font-medium">
                {retensiVendor}% ({vendorBerulang.length} dari {totalVendor})
              </span>
            </div>
            <div className="mt-1.5">
              <ProgressBar value={retensiVendor} max={100} tone="success" />
            </div>
          </li>
          <li>
            <div className="flex items-center justify-between text-sm">
              <span>Creator yang ikut campaign kedua</span>
              <span className="tabular font-medium">
                {retensiCreator}% ({creatorBerulang.length} dari {totalCreator})
              </span>
            </div>
            <div className="mt-1.5">
              <ProgressBar value={retensiCreator} max={100} tone="success" />
            </div>
          </li>
        </ul>
      </Card>

      <div className="mt-8">
        <DataTable
          title="Campaign terbaik periode ini"
          summary={<span className="hidden md:inline">{periodeLabel}</span>}
          tableClassName="w-full text-sm md:min-w-[52rem]"
          action={
            <div className="hidden md:block">
              <PageSizeSelect
                basePath={BASE}
                params={params}
                pageSize={pageSize}
              />
            </div>
          }
          toolbar={
            <div className="grid grid-cols-2 items-center gap-2 md:hidden">
              {/* Baris 1: Kiri = Filter Periode, Kanan = Tampilkan */}
              <div className="col-span-1">
                <PeriodePicker
                  value={key}
                  basePath="/admin/analytics"
                  className="w-full text-xs py-1.5"
                />
              </div>
              <div className="col-span-1 flex justify-end">
                <PageSizeSelect
                  basePath={BASE}
                  params={params}
                  pageSize={pageSize}
                />
              </div>

              {/* Baris 2: Kanan (di bawah Tampilkan) = Ikon Unduh */}
              <div className="col-span-1 col-start-2 flex justify-end">
                <ButtonLink
                  href="/api/admin/export?type=analytics"
                  variant="secondary"
                  size="sm"
                  title="Export CSV"
                >
                  <IconDownload className="h-4 w-4" strokeWidth={2} />
                </ButtonLink>
              </div>
            </div>
          }
          footer={
            <Pagination
              basePath={BASE}
              params={params}
              page={page}
              pageSize={pageSize}
              total={peringkatTotal}
            />
          }
        >
          {/* Tabel — desktop */}
          <thead className="hidden md:table-header-group">
            <tr>
              <Th>No</Th>
              <Th>Campaign</Th>
              <Th>Vendor</Th>
              <Th align="right">Budget</Th>
              <Th align="right">Views</Th>
              <Th align="right">CPM Efektif</Th>
              <Th align="right">Creator</Th>
              <Th>Selesai</Th>
              <Th>Aksi</Th>
            </tr>
          </thead>
          <tbody className="hidden md:table-row-group">
            {peringkat.length === 0 ? (
              <TableEmptyRow
                colSpan={9}
                title="Belum ada campaign pada periode ini"
                description="Pilih rentang periode yang lebih panjang."
              />
            ) : (
              peringkat.map((campaign, index) => (
                <tr key={campaign.id}>
                  <Td className="tabular text-muted">
                    {rowNumber(index, page, pageSize)}
                  </Td>
                  <Td className="font-medium">{campaign.title}</Td>
                  <Td>{campaign.vendor}</Td>
                  <Td align="right">{formatIDR(campaign.budget)}</Td>
                  <Td align="right">{formatCompact(campaign.totalViews)}</Td>
                  <Td align="right">
                    {campaign.cpmEfektif > 0 ? formatIDR(campaign.cpmEfektif) : "—"}
                  </Td>
                  <Td align="right">{campaign.creator}</Td>
                  <Td className="whitespace-nowrap text-muted">
                    {campaign.status === "ACTIVE"
                      ? "berjalan"
                      : formatDate(campaign.endDate)}
                  </Td>
                  <Td>
                    <Link
                      href={`/admin/campaigns?q=${encodeURIComponent(campaign.title)}&status=ALL`}
                      className="text-brand-600 hover:text-brand-700 transition-colors"
                      title="Lihat campaign"
                    >
                      <IconShieldCheck className="h-4 w-4" strokeWidth={2} />
                    </Link>
                  </Td>
                </tr>
              ))
            )}
          </tbody>

          {/* Kartu — mobile */}
          <tbody className="md:hidden">
            {peringkat.length === 0 ? (
              <TableEmptyRow
                colSpan={9}
                title="Belum ada campaign pada periode ini"
                description="Pilih rentang periode yang lebih panjang."
              />
            ) : (
              peringkat.map((campaign, index) => (
                <tr
                  key={`m-${campaign.id}`}
                  className="border-b border-line last:border-b-0"
                >
                  <td colSpan={9} className="p-4">
                    {/* Header: No, Title, Status */}
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="tabular text-xs font-semibold text-muted">
                            #{rowNumber(index, page, pageSize)}
                          </span>
                          <span className="font-medium text-foreground">
                            {campaign.title}
                          </span>
                        </div>
                        <p className="mt-0.5 text-xs text-muted">
                          Vendor:{" "}
                          <span className="font-medium text-foreground">
                            {campaign.vendor}
                          </span>
                        </p>
                      </div>
                      <div className="shrink-0">
                        <Badge tone={campaignStatusTone[campaign.status]} icon>
                          {campaignStatusLabel[campaign.status]}
                        </Badge>
                      </div>
                    </div>

                    {/* Grid Data 2x2 */}
                    <div className="mt-3 grid grid-cols-2 gap-3 border-y border-line py-3 text-xs">
                      <div>
                        <p className="text-muted">Budget Pool</p>
                        <p className="tabular mt-0.5 font-medium text-foreground">
                          {formatIDR(campaign.budget)}
                        </p>
                      </div>
                      <div>
                        <p className="text-muted">Total Views</p>
                        <p className="tabular mt-0.5 font-medium text-foreground">
                          {formatCompact(campaign.totalViews)}
                        </p>
                      </div>
                      <div>
                        <p className="text-muted">CPM Efektif</p>
                        <p className="tabular mt-0.5 text-foreground">
                          {campaign.cpmEfektif > 0
                            ? formatIDR(campaign.cpmEfektif)
                            : "—"}
                        </p>
                      </div>
                      <div>
                        <p className="text-muted">Partisipan</p>
                        <p className="tabular mt-0.5 text-foreground">
                          {campaign.creator} creator
                        </p>
                      </div>
                    </div>

                    {/* Footer: Selesai & Action Link */}
                    <div className="mt-3 flex items-center justify-between gap-2 text-xs">
                      <span className="text-muted">
                        {campaign.status === "ACTIVE"
                          ? "Sedang berjalan"
                          : `Selesai: ${formatDate(campaign.endDate)}`}
                      </span>

                      <Link
                        href={`/admin/campaigns?q=${encodeURIComponent(campaign.title)}&status=ALL`}
                        className="inline-flex items-center gap-1 rounded-md border border-line bg-surface px-2.5 py-1 text-xs font-medium text-brand transition-colors hover:border-brand/40 hover:bg-brand/10"
                      >
                        <IconShieldCheck
                          className="h-3.5 w-3.5"
                          strokeWidth={2}
                        />
                        <span>Lihat Campaign</span>
                      </Link>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </DataTable>
      </div>
    </div>
  );
}
