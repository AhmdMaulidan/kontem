import { requireRole } from "@/lib/auth";
import { db } from "@/lib/db";
import { formatCompact, formatDateTime, formatIDR } from "@/lib/format";
import {
  Badge,
  ButtonLink,
  DataTable,
  DetailDrawer,
  IconBank,
  IconBanknote,
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
  paginationArgs,
  resolvePageSize,
  rowNumber,
} from "@/components/ui";
import { payoutStatusLabel, payoutStatusTone } from "@/lib/labels";

const BASE = "/admin/payouts";
const PAGE_SIZE = 15;

export default async function AdminPayoutsPage({
  searchParams,
}: {
  searchParams: Promise<{
    q?: string;
    campaign?: string;
    page?: string;
    ukuran?: string;
  }>;
}) {
  await requireRole("ADMIN");
  const params = await searchParams;
  const page = Math.max(1, Number(params.page) || 1);
  const pageSize = resolvePageSize(params.ukuran, PAGE_SIZE);

  const where = {
    ...(params.campaign ? { campaignId: params.campaign } : {}),
    ...(params.q
      ? {
          OR: [
            {
              campaign: {
                is: {
                  title: { contains: params.q, mode: "insensitive" as const },
                },
              },
            },
            {
              creator: {
                is: { name: { contains: params.q, mode: "insensitive" as const } },
              },
            },
          ],
        }
      : {}),
  };

  const [payouts, total, ringkasan, campaignOptions] = await Promise.all([
    db.payout.findMany({
      where,
      include: {
        campaign: { include: { vendor: { include: { vendorProfile: true } } } },
        creator: { include: { creatorProfile: true } },
      },
      orderBy: { paidAt: "desc" },
      ...paginationArgs(page, pageSize),
    }),
    db.payout.count({ where }),
    db.payout.aggregate({
      _sum: { netAmount: true, platformFee: true },
      _count: true,
    }),
    db.campaign.findMany({
      where: { payouts: { some: {} } },
      select: { id: true, title: true },
      orderBy: { title: "asc" },
    }),
  ]);

  return (
    <div>
      <PageHeader
        title="Riwayat payout"
        description="Settlement dihitung dan dicairkan otomatis oleh sistem begitu masa pelacakan views sebuah campaign selesai — tidak ada lagi langkah manual di sini. Halaman ini murni riwayat untuk audit."
      />

      <div className="mb-8 grid gap-4 sm:grid-cols-3">
        <Stat
          label="Total dicairkan"
          icon={IconBanknote}
          value={formatIDR(ringkasan._sum.netAmount ?? 0)}
          hint={`${ringkasan._count} payout`}
          tone="success"
        />
        <Stat
          label="Fee platform terkumpul"
          icon={IconBank}
          value={formatIDR(ringkasan._sum.platformFee ?? 0)}
        />
        <Stat
          label="Campaign sudah settle"
          icon={IconShieldCheck}
          value={campaignOptions.length}
        />
      </div>

      <DataTable
        title="Riwayat payout"
        summary={`${total} payout`}
        tableClassName="w-full text-sm md:min-w-[52rem]"
        action={
          <PageSizeSelect basePath={BASE} params={params} pageSize={pageSize} />
        }
        toolbar={
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
                  ...campaignOptions.map((c) => ({ value: c.id, label: c.title })),
                ],
              },
            ]}
            action={
              <ButtonLink
                href="/api/admin/export?type=payouts"
                variant="secondary"
                size="sm"
                title="Export CSV"
              >
                <IconDownload className="h-4 w-4" strokeWidth={2} />
              </ButtonLink>
            }
          />
        }
        footer={
          <Pagination
            basePath={BASE}
            params={params}
            page={page}
            pageSize={pageSize}
            total={total}
          />
        }
      >
        {/* Tabel — desktop */}
        <thead className="hidden md:table-header-group">
          <tr>
            <Th>No</Th>
            <Th>Creator</Th>
            <Th>Campaign</Th>
            <Th align="right">Views</Th>
            <Th align="right">Porsi</Th>
            <Th align="right">Bersih</Th>
            <Th>Status</Th>
            <Th>Detail</Th>
          </tr>
        </thead>
        <tbody className="hidden md:table-row-group">
          {payouts.length === 0 ? (
            <TableEmptyRow
              colSpan={8}
              title="Belum ada payout"
              description="Baris pertama muncul otomatis begitu campaign pertama selesai masa pelacakan views."
            />
          ) : (
            payouts.map((payout, index) => (
              <tr key={payout.id}>
                <Td className="tabular text-muted">
                  {rowNumber(index, page, pageSize)}
                </Td>
                <Td className="font-medium">{payout.creator.name}</Td>
                <Td>
                  <p>{payout.campaign.title}</p>
                  <p className="text-xs text-muted">
                    {payout.campaign.vendor.vendorProfile?.businessName ?? "—"}
                  </p>
                </Td>
                <Td align="right">{formatCompact(payout.viewsCounted)}</Td>
                <Td align="right">{payout.sharePercent.toFixed(1)}%</Td>
                <Td align="right" className="font-medium">
                  {formatIDR(payout.netAmount)}
                </Td>
                <Td>
                  <Badge tone={payoutStatusTone[payout.status]} icon>
                    {payoutStatusLabel[payout.status]}
                  </Badge>
                </Td>
                <Td>
                  <DetailDrawer
                    label="Lihat"
                    title={payout.creator.name}
                    subtitle={`${payout.campaign.title} · ${payout.paidAt ? formatDateTime(payout.paidAt) : "belum dicairkan"}`}
                    icon={<IconShieldCheck className="h-4 w-4" strokeWidth={2} />}
                  >
                    <dl className="space-y-3 text-sm">
                      <div>
                        <dt className="text-xs font-medium text-muted">
                          Views dihitung
                        </dt>
                        <dd className="tabular mt-0.5">
                          {formatCompact(payout.viewsCounted)} dari{" "}
                          {formatCompact(payout.totalPoolViews)} total
                        </dd>
                      </div>
                      <div>
                        <dt className="text-xs font-medium text-muted">
                          Bruto / Fee / Bersih
                        </dt>
                        <dd className="tabular mt-0.5">
                          {formatIDR(payout.grossAmount)} −{" "}
                          {formatIDR(payout.platformFee)} ={" "}
                          <span className="font-medium">
                            {formatIDR(payout.netAmount)}
                          </span>
                        </dd>
                      </div>
                      <div>
                        <dt className="text-xs font-medium text-muted">
                          Rekening
                        </dt>
                        <dd className="mt-0.5">
                          {payout.creator.creatorProfile?.bankName
                            ? `${payout.creator.creatorProfile.bankName} ${payout.creator.creatorProfile.bankAccountNumber ?? ""}`
                            : "—"}
                        </dd>
                      </div>
                      {payout.note ? (
                        <div>
                          <dt className="text-xs font-medium text-muted">
                            Catatan
                          </dt>
                          <dd className="mt-0.5 text-muted">{payout.note}</dd>
                        </div>
                      ) : null}
                    </dl>
                  </DetailDrawer>
                </Td>
              </tr>
            ))
          )}
        </tbody>

        {/* Kartu — mobile */}
        <tbody className="md:hidden">
          {payouts.length === 0 ? (
            <TableEmptyRow
              colSpan={8}
              title="Belum ada payout"
              description="Baris pertama muncul otomatis begitu campaign pertama selesai masa pelacakan views."
            />
          ) : (
            payouts.map((payout, index) => (
              <tr key={`m-${payout.id}`} className="border-b border-line last:border-b-0">
                <td colSpan={8} className="p-4">
                  {/* Header: No, Creator, Status */}
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="tabular text-xs font-semibold text-muted">
                          #{rowNumber(index, page, pageSize)}
                        </span>
                        <span className="font-medium text-foreground">
                          {payout.creator.name}
                        </span>
                      </div>
                      <p className="mt-0.5 text-xs text-muted">
                        {payout.campaign.title} ·{" "}
                        <span className="font-medium text-foreground">
                          {payout.campaign.vendor.vendorProfile?.businessName ?? "—"}
                        </span>
                      </p>
                    </div>
                    <div className="shrink-0">
                      <Badge tone={payoutStatusTone[payout.status]} icon>
                        {payoutStatusLabel[payout.status]}
                      </Badge>
                    </div>
                  </div>

                  {/* Grid Data 2 Kolom */}
                  <div className="mt-3 grid grid-cols-2 gap-3 border-y border-line py-3 text-xs">
                    <div>
                      <p className="text-muted">Views & Porsi</p>
                      <p className="tabular mt-0.5 font-medium text-foreground">
                        {formatCompact(payout.viewsCounted)} ({payout.sharePercent.toFixed(1)}%)
                      </p>
                    </div>
                    <div>
                      <p className="text-muted">Payout Bersih</p>
                      <p className="tabular mt-0.5 text-sm font-semibold text-foreground">
                        {formatIDR(payout.netAmount)}
                      </p>
                    </div>
                  </div>

                  {/* Footer: Rekening & Action Drawer */}
                  <div className="mt-3 flex items-center justify-between gap-2 text-xs">
                    <div className="min-w-0 truncate text-muted">
                      <span>Rek: </span>
                      <span className="font-medium text-foreground">
                        {payout.creator.creatorProfile?.bankName
                          ? `${payout.creator.creatorProfile.bankName} ${payout.creator.creatorProfile.bankAccountNumber ?? ""}`
                          : "—"}
                      </span>
                    </div>

                    <DetailDrawer
                      label="Lihat Detail"
                      title={payout.creator.name}
                      subtitle={`${payout.campaign.title} · ${payout.paidAt ? formatDateTime(payout.paidAt) : "belum dicairkan"}`}
                      icon={
                        <span className="inline-flex items-center gap-1 rounded-md border border-line bg-surface px-2.5 py-1 text-xs font-medium text-foreground transition-colors hover:border-brand/40 hover:bg-brand/10 hover:text-brand">
                          <IconShieldCheck className="h-3.5 w-3.5 text-brand" strokeWidth={2} />
                          <span>Lihat Detail</span>
                        </span>
                      }
                    >
                      <dl className="space-y-3 text-sm">
                        <div>
                          <dt className="text-xs font-medium text-muted">
                            Views dihitung
                          </dt>
                          <dd className="tabular mt-0.5">
                            {formatCompact(payout.viewsCounted)} dari{" "}
                            {formatCompact(payout.totalPoolViews)} total
                          </dd>
                        </div>
                        <div>
                          <dt className="text-xs font-medium text-muted">
                            Bruto / Fee / Bersih
                          </dt>
                          <dd className="tabular mt-0.5">
                            {formatIDR(payout.grossAmount)} −{" "}
                            {formatIDR(payout.platformFee)} ={" "}
                            <span className="font-medium">
                              {formatIDR(payout.netAmount)}
                            </span>
                          </dd>
                        </div>
                        <div>
                          <dt className="text-xs font-medium text-muted">
                            Rekening
                          </dt>
                          <dd className="mt-0.5">
                            {payout.creator.creatorProfile?.bankName
                              ? `${payout.creator.creatorProfile.bankName} ${payout.creator.creatorProfile.bankAccountNumber ?? ""}`
                              : "—"}
                          </dd>
                        </div>
                        {payout.note ? (
                          <div>
                            <dt className="text-xs font-medium text-muted">
                              Catatan
                            </dt>
                            <dd className="mt-0.5 text-muted">{payout.note}</dd>
                          </div>
                        ) : null}
                      </dl>
                    </DetailDrawer>
                  </div>
                </td>
              </tr>
            ))
          )}
        </tbody>
      </DataTable>
    </div>
  );
}
