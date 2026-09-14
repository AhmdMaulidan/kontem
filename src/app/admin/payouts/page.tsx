import Link from "next/link";
import { requireRole } from "@/lib/auth";
import { db } from "@/lib/db";
import { getCampaignPerformance } from "@/domain/campaign";
import { formatCompact, formatDate, formatIDR } from "@/lib/format";
import {
  Badge,
  DataTable,
  IconBank,
  IconBanknote,
  IconCalculator,
  IconClock,
  IconDownload,
  IconShieldCheck,
  PageHeader,
  PageSizeSelect,
  Pagination,
  Stat,
  TableEmptyRow,
  TableToolbar,
  Td,
  Th,
  resolvePageSize,
  rowNumber,
} from "@/components/ui";
import { settleCampaignAction } from "../actions";
import { SimpleActionForm } from "../decision-form";
import { NotWiredButton } from "../not-wired";

const BASE = "/admin/payouts";
const PAGE_SIZE = 10;

export default async function AdminPayoutsPage({
  searchParams,
}: {
  searchParams: Promise<{
    tab?: string;
    q?: string;
    campaign?: string;
    page?: string;
    ukuran?: string;
  }>;
}) {
  await requireRole("ADMIN");
  const params = await searchParams;
  const tab = params.tab === "settle" ? "settle" : "siap";
  const page = Math.max(1, Number(params.page) || 1);
  const pageSize = resolvePageSize(params.ukuran, PAGE_SIZE);

  const campaigns = await db.campaign.findMany({
    where: { status: { in: ["ACTIVE", "ENDED", "SETTLING", "SETTLED"] } },
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
      _count: { select: { submissions: true } },
    },
    orderBy: { endDate: "asc" },
  });

  const semuaPayout = campaigns.flatMap((campaign) => campaign.payouts);
  const pending = semuaPayout.filter((payout) => payout.status === "PENDING");
  const totalPending = pending.reduce((sum, payout) => sum + payout.netAmount, 0);
  const totalPaid = semuaPayout
    .filter((payout) => payout.status === "PAID")
    .reduce((sum, payout) => sum + payout.netAmount, 0);
  const totalFee = semuaPayout.reduce((sum, payout) => sum + payout.platformFee, 0);

  // Penyaringan mempersempit campaign yang ditampilkan; kartu ringkasan di
  // atas tetap memakai angka seluruh platform supaya penyaringan tidak
  // terbaca seolah uangnya berkurang.
  const terpilih = campaigns.filter((campaign) => {
    if (params.campaign && campaign.id !== params.campaign) return false;
    if (params.q) {
      const kata = params.q.toLowerCase();
      const cocok =
        campaign.title.toLowerCase().includes(kata) ||
        campaign.payouts.some((payout) =>
          payout.creator.name.toLowerCase().includes(kata),
        );
      if (!cocok) return false;
    }
    return true;
  });

  const detail = await Promise.all(
    terpilih.map(async (campaign) => {
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

  const seluruhSiapSettle = detail.filter(
    ({ campaign }) => campaign.payouts.length === 0,
  );
  const siapSettleTotal = seluruhSiapSettle.length;
  const siapSettle = Number.isFinite(pageSize)
    ? seluruhSiapSettle.slice((page - 1) * pageSize, page * pageSize)
    : seluruhSiapSettle;

  const seluruhSudahSettle = detail.filter(
    ({ campaign }) => campaign.payouts.length > 0,
  );
  const sudahSettleTotal = seluruhSudahSettle.length;
  const sudahSettle = Number.isFinite(pageSize)
    ? seluruhSudahSettle.slice((page - 1) * pageSize, page * pageSize)
    : seluruhSudahSettle;

  return (
    <div>
      <PageHeader
        title="Settlement & payout"
        description="Hitung pembagian pool saat campaign selesai, lalu cairkan ke creator. Pembulatan memakai metode largest remainder supaya total pembagian genap sampai rupiah terakhir."
      />

      <div className="mb-6 grid gap-4 sm:grid-cols-3">
        <Stat
          label="Menunggu pencairan"
          icon={IconClock}
          value={formatIDR(totalPending)}
          hint={`${pending.length} payout`}
          tone={pending.length > 0 ? "danger" : undefined}
        />
        <Stat
          label="Sudah dicairkan"
          icon={IconBanknote}
          value={formatIDR(totalPaid)}
          tone="success"
        />
        <Stat
          label="Fee platform terkumpul"
          icon={IconBank}
          value={formatIDR(totalFee)}
        />
      </div>

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
          ]}
          action={<NotWiredButton label="Export CSV" variant="secondary" icon={<IconDownload className="h-4 w-4" strokeWidth={2} />} iconOnly />}
        />
      </div>

      <div className="mb-6 inline-flex rounded-xl border border-line bg-surface-muted p-1">
        <Link
          href="/admin/payouts?tab=siap"
          className={
            tab === "siap"
              ? "rounded-lg bg-surface px-5 py-2 text-sm font-semibold text-foreground shadow-card"
              : "rounded-lg px-5 py-2 text-sm font-medium text-muted transition-colors hover:text-foreground"
          }
        >
          Campaign siap settle
        </Link>
        <Link
          href="/admin/payouts?tab=settle"
          className={
            tab === "settle"
              ? "rounded-lg bg-surface px-5 py-2 text-sm font-semibold text-foreground shadow-card"
              : "rounded-lg px-5 py-2 text-sm font-medium text-muted transition-colors hover:text-foreground"
          }
        >
          Campaign sudah settle
        </Link>
      </div>

      {tab === "siap" ? (
      <div className="mb-8">
        <DataTable
          title="Campaign siap settle"
          summary={`${siapSettleTotal} campaign`}
          action={
            <PageSizeSelect basePath={BASE} params={params} pageSize={pageSize} />
          }
          footer={
            <Pagination
              basePath={BASE}
              params={params}
              page={page}
              pageSize={pageSize}
              total={siapSettleTotal}
            />
          }
        >
          <thead>
            <tr>
              <Th>No</Th>
              <Th>Campaign</Th>
              <Th>Vendor</Th>
              <Th>Berakhir</Th>
              <Th align="right">Submission</Th>
              <Th align="right">Views</Th>
              <Th align="right">Terserap / Pool</Th>
              <Th align="right">Refund</Th>
              <Th>Aksi</Th>
            </tr>
          </thead>
          <tbody>
            {siapSettle.length === 0 ? (
              <TableEmptyRow
                colSpan={9}
                title="Tidak ada campaign yang menunggu dihitung"
                description="Campaign muncul di sini setelah periodenya berjalan dan seluruh submission selesai direview."
              />
            ) : (
              siapSettle.map(
                (
                  { campaign, performance, sengketaTerbuka, menungguReview },
                  index,
                ) => {
                  const blokir = sengketaTerbuka > 0 || menungguReview > 0;
                  const periodeSelesai = new Date() > campaign.endDate;
                  const terserap = performance?.totalDistributed ?? 0;

                  return (
                    <tr key={campaign.id}>
                      <Td className="tabular text-muted">
                        {rowNumber(index, page, pageSize)}
                      </Td>
                      <Td className="font-medium">{campaign.title}</Td>
                      <Td>{campaign.vendor.vendorProfile?.businessName ?? "—"}</Td>
                      <Td className="whitespace-nowrap text-muted">
                        {formatDate(campaign.endDate)}
                        {!blokir && !periodeSelesai ? (
                          <p className="text-xs">Periode belum berakhir</p>
                        ) : null}
                      </Td>
                      <Td align="right">{campaign._count.submissions}</Td>
                      <Td align="right">
                        {formatCompact(performance?.totalViews ?? 0)}
                      </Td>
                      <Td align="right">
                        <span className="font-medium">{formatIDR(terserap)}</span>
                        <span className="text-muted"> / {formatIDR(campaign.budgetPool)}</span>
                      </Td>
                      <Td align="right">
                        {formatIDR(campaign.budgetPool - terserap)}
                      </Td>
                      <Td>
                        {blokir ? (
                          <Badge tone="warning" icon>
                            Belum bisa disettle
                          </Badge>
                        ) : (
                          <SimpleActionForm
                            action={settleCampaignAction}
                            hiddenField="campaignId"
                            hiddenValue={campaign.id}
                            label="Hitung pembagian pool"
                            icon={
                              <IconCalculator
                                className="h-4 w-4"
                                strokeWidth={2}
                              />
                            }
                          />
                        )}
                        {blokir ? (
                          <p className="mt-1 text-xs text-danger">
                            {sengketaTerbuka > 0
                              ? `${sengketaTerbuka} sengketa masih terbuka. `
                              : ""}
                            {menungguReview > 0
                              ? `${menungguReview} submission belum direview vendor.`
                              : ""}
                          </p>
                        ) : null}
                      </Td>
                    </tr>
                  );
                },
              )
            )}
          </tbody>
        </DataTable>
      </div>
      ) : (
      <DataTable
        title="Campaign sudah settle"
        summary={`${sudahSettleTotal} campaign`}
        action={
          <PageSizeSelect basePath={BASE} params={params} pageSize={pageSize} />
        }
        footer={
          <Pagination
            basePath={BASE}
            params={params}
            page={page}
            pageSize={pageSize}
            total={sudahSettleTotal}
          />
        }
      >
          <thead>
            <tr>
              <Th>No</Th>
              <Th>Campaign</Th>
              <Th>Vendor</Th>
              <Th align="right">Creator</Th>
              <Th align="right">Views</Th>
              <Th align="right">Payout Bersih</Th>
              <Th>Aksi</Th>
            </tr>
          </thead>
          <tbody>
            {sudahSettle.length === 0 ? (
              <TableEmptyRow
                colSpan={7}
                title="Belum ada campaign yang disettle"
                description="Hitung pembagian pool dulu dari tabel di atas."
              />
            ) : (
              sudahSettle.map(({ campaign }, index) => {
                const totalViews = campaign.payouts.reduce(
                  (sum, payout) => sum + payout.viewsCounted,
                  0,
                );
                const totalNet = campaign.payouts.reduce(
                  (sum, payout) => sum + payout.netAmount,
                  0,
                );

                return (
                  <tr key={campaign.id}>
                    <Td className="tabular text-muted">
                      {rowNumber(index, page, pageSize)}
                    </Td>
                    <Td className="font-medium">{campaign.title}</Td>
                    <Td>{campaign.vendor.vendorProfile?.businessName ?? "—"}</Td>
                    <Td align="right">{campaign.payouts.length}</Td>
                    <Td align="right">{formatCompact(totalViews)}</Td>
                    <Td align="right" className="font-medium">
                      {formatIDR(totalNet)}
                    </Td>
                    <Td>
                      <a
                        href={`/admin/payouts/pratinjau?campaign=${campaign.id}`}
                        title="Lihat pratinjau"
                        className="text-brand-600 transition-colors hover:text-brand-700"
                      >
                        <IconShieldCheck className="h-4 w-4" strokeWidth={2} />
                      </a>
                    </Td>
                  </tr>
                );
              })
            )}
          </tbody>
      </DataTable>
      )}
    </div>
  );
}
