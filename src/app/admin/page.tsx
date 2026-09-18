import Link from "next/link";
import { requireRole } from "@/lib/auth";
import { db } from "@/lib/db";
import { formatCompact, formatIDR } from "@/lib/format";
import {
  Badge,
  Card,
  DataTable,
  IconBank,
  IconBusiness,
  IconMegaphone,
  IconTrend,
  IconUsers,
  IconVideo,
  PageHeader,
  PageSizeSelect,
  Pagination,
  Stat,
  TableEmptyRow,
  Td,
  Th,
  cn,
  paginationArgs,
  resolvePageSize,
  rowNumber,
} from "@/components/ui";
import { campaignStatusLabel, campaignStatusTone } from "@/lib/labels";
import { PeriodePicker } from "./periode-picker";

const PERIODE: Record<string, { label: string; hari: number }> = {
  "30": { label: "30 hari terakhir", hari: 30 },
  "90": { label: "90 hari terakhir", hari: 90 },
  "365": { label: "12 bulan terakhir", hari: 365 },
};

const PAGE_SIZE = 10;
const BASE = "/admin";

export default async function AdminDashboard({
  searchParams,
}: {
  searchParams: Promise<{ periode?: string; page?: string; ukuran?: string }>;
}) {
  await requireRole("ADMIN");
  const params = await searchParams;
  const key = params.periode && PERIODE[params.periode] ? params.periode : "30";
  const sejak = new Date();
  sejak.setDate(sejak.getDate() - PERIODE[key].hari);
  const page = Math.max(1, Number(params.page) || 1);
  const pageSize = resolvePageSize(params.ukuran, PAGE_SIZE);

  const [
    vendorPending,
    campaignPending,
    creatorPending,
    submissionPending,
    vendorAktif,
    creatorAktif,
    gmv,
    feeAgg,
    campaignTerbaru,
    campaignTerbaruTotal,
  ] = await Promise.all([
    db.user.count({ where: { role: "VENDOR", status: "PENDING" } }),
    db.campaign.count({ where: { status: "PENDING_REVIEW" } }),
    db.user.count({ where: { role: "CREATOR", status: "PENDING" } }),
    db.submission.count({ where: { status: "PENDING_REVIEW" } }),
    db.user.count({ where: { role: "VENDOR", status: "VERIFIED" } }),
    db.user.count({ where: { role: "CREATOR" } }),
    db.campaign.aggregate({
      _sum: { budgetPool: true },
      where: {
        createdAt: { gte: sejak },
        status: { in: ["ACTIVE", "ENDED", "SETTLING", "SETTLED"] },
      },
    }),
    db.payout.aggregate({
      _sum: { platformFee: true },
      where: { createdAt: { gte: sejak } },
    }),
    db.campaign.findMany({
      include: { vendor: { include: { vendorProfile: true } } },
      orderBy: { createdAt: "desc" },
      ...paginationArgs(page, pageSize),
    }),
    db.campaign.count(),
  ]);

  const antrean = [
    {
      label: "Vendor menunggu",
      value: vendorPending,
      href: "/admin/vendors",
      Ikon: IconBusiness,
    },
    {
      label: "Campaign menunggu",
      value: campaignPending,
      href: "/admin/campaigns",
      Ikon: IconMegaphone,
    },
    {
      label: "Creator menunggu",
      value: creatorPending,
      href: "/admin/creators",
      Ikon: IconUsers,
    },
    {
      label: "Submission menunggu",
      value: submissionPending,
      href: "/admin/submissions",
      Ikon: IconVideo,
    },
  ];

  return (
    <div>
      <PageHeader
        title="Ringkasan admin"
        description="Antrean kerja yang menunggu dan kesehatan platform."
        action={<PeriodePicker value={key} />}
      />

      <section>
        <h2 className="mb-3 text-xs font-semibold tracking-wide text-muted uppercase">
          Antrean kerja
        </h2>
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          {antrean.map(({ href, label, value, Ikon }) => {
            const perluDikerjakan = value > 0;
            return (
              <Link key={label} href={href} className="block">
                <Card className="h-full p-4" hover>
                  <div
                    className={cn(
                      "flex h-9 w-9 items-center justify-center rounded-2xl",
                      perluDikerjakan
                        ? "bg-warning-soft text-warning"
                        : "bg-surface-muted text-muted",
                    )}
                  >
                    <Ikon className="h-4.5 w-4.5" strokeWidth={2} aria-hidden />
                  </div>
                  <p className="mt-3 text-xs font-medium text-muted">{label}</p>
                  <p
                    className={cn(
                      "tabular mt-1 font-display text-xl font-bold",
                      perluDikerjakan ? "text-foreground" : "text-muted/60",
                    )}
                  >
                    {value}
                  </p>
                </Card>
              </Link>
            );
          })}
        </div>
      </section>

      <section className="mt-8">
        <h2 className="mb-3 text-xs font-semibold tracking-wide text-muted uppercase">
          Kesehatan platform
        </h2>
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Stat
            label="GMV berjalan"
            icon={IconBank}
            value={formatIDR(gmv._sum.budgetPool ?? 0)}
            hint={PERIODE[key].label}
          />
          <Stat
            label="Fee platform"
            icon={IconTrend}
            value={formatIDR(feeAgg._sum.platformFee ?? 0)}
            hint={PERIODE[key].label}
            tone="success"
          />
          <Stat label="Vendor aktif" icon={IconBusiness} value={vendorAktif} />
          <Stat label="Creator aktif" icon={IconUsers} value={creatorAktif} />
        </div>
      </section>

      <div className="mt-8">
        <DataTable
          title="Campaign terbaru"
          tableClassName="w-full text-xs sm:text-sm"
          footer={
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex-1 flex justify-center sm:justify-start">
                <Pagination
                  basePath={BASE}
                  params={params}
                  page={page}
                  pageSize={pageSize}
                  total={campaignTerbaruTotal}
                />
              </div>
              <div className="flex justify-end">
                <PageSizeSelect basePath={BASE} params={params} pageSize={pageSize} />
              </div>
            </div>
          }
        >
          <thead>
            <tr>
              <Th className="w-8 px-2 py-2 text-center text-xs">No</Th>
              <Th className="px-2 py-2 text-xs">Campaign</Th>
              <Th className="px-2 py-2 text-xs">Vendor</Th>
              <Th align="right" className="px-2 py-2 text-xs">Budget</Th>
              <Th className="px-2 py-2 text-xs">Status</Th>
            </tr>
          </thead>
          <tbody>
            {campaignTerbaru.length === 0 ? (
              <TableEmptyRow
                colSpan={5}
                title="Belum ada campaign"
                description="Campaign muncul di sini begitu vendor mengirimkannya."
              />
            ) : (
              campaignTerbaru.map((campaign, index) => (
                <tr key={campaign.id}>
                  <Td className="w-8 px-2 py-2 text-center tabular text-xs text-muted">
                    {rowNumber(index, page, pageSize)}
                  </Td>
                  <Td className="px-2 py-2 font-medium text-xs sm:text-sm">
                    <span className="line-clamp-1">{campaign.title}</span>
                  </Td>
                  <Td className="px-2 py-2 text-xs text-muted sm:text-sm">
                    <span className="line-clamp-1">
                      {campaign.vendor.vendorProfile?.businessName ?? "—"}
                    </span>
                  </Td>
                  <Td align="right" className="px-2 py-2 text-xs sm:text-sm whitespace-nowrap">
                    {formatCompact(campaign.budgetPool)}
                  </Td>
                  <Td className="px-2 py-2 whitespace-nowrap">
                    <Badge tone={campaignStatusTone[campaign.status]} icon>
                      {campaignStatusLabel[campaign.status]}
                    </Badge>
                  </Td>
                </tr>
              ))
            )}
          </tbody>
        </DataTable>
      </div>
    </div>
  );
}
