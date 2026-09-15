import { requireRole } from "@/lib/auth";
import { db } from "@/lib/db";
import { formatDateTime, formatIDR } from "@/lib/format";
import {
  Badge,
  ButtonLink,
  DataTable,
  DetailDrawer,
  IconBank,
  IconBanknote,
  IconDownload,
  IconShieldCheck,
  IconLock,
  IconWallet,
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
import type { BadgeTone } from "@/lib/labels";
import type { EscrowStatus, EscrowType } from "@/generated/prisma/enums";
import { confirmDepositAction, confirmRefundAction } from "../actions";
import { SimpleActionForm } from "../decision-form";

const PAGE_SIZE = 15;
const BASE = "/admin/escrow";

const jenisLabel: Record<EscrowType, string> = {
  DEPOSIT: "Deposit",
  PAYOUT: "Payout",
  PLATFORM_FEE: "Fee platform",
  REFUND: "Refund",
};

const statusLabel: Record<EscrowStatus, string> = {
  PENDING: "Menunggu",
  COMPLETED: "Selesai",
  FAILED: "Gagal",
};

const statusTone: Record<EscrowStatus, BadgeTone> = {
  PENDING: "warning",
  COMPLETED: "success",
  FAILED: "danger",
};

const PERIODE: Record<string, { label: string; hari: number }> = {
  "30": { label: "30 hari terakhir", hari: 30 },
  "90": { label: "90 hari terakhir", hari: 90 },
  "0": { label: "Semua waktu", hari: 0 },
};

export default async function AdminEscrowPage({
  searchParams,
}: {
  searchParams: Promise<{
    q?: string;
    jenis?: string;
    status?: string;
    periode?: string;
    page?: string;
    ukuran?: string;
  }>;
}) {
  await requireRole("ADMIN");
  const params = await searchParams;
  const page = Math.max(1, Number(params.page) || 1);
  const pageSize = resolvePageSize(params.ukuran, PAGE_SIZE);
  const periodeKey =
    params.periode && PERIODE[params.periode] ? params.periode : "30";
  const hari = PERIODE[periodeKey].hari;

  const sejak = new Date();
  sejak.setDate(sejak.getDate() - hari);

  const where = {
    ...(hari > 0 ? { createdAt: { gte: sejak } } : {}),
    ...(params.jenis ? { type: params.jenis as EscrowType } : {}),
    ...(params.status ? { status: params.status as EscrowStatus } : {}),
    ...(params.q
      ? {
          campaign: {
            is: {
              OR: [
                { title: { contains: params.q, mode: "insensitive" as const } },
                {
                  vendor: {
                    is: {
                      vendorProfile: {
                        is: {
                          businessName: {
                            contains: params.q,
                            mode: "insensitive" as const,
                          },
                        },
                      },
                    },
                  },
                },
              ],
            },
          },
        }
      : {}),
  };

  const [transaksi, total, ringkasan] = await Promise.all([
    db.escrowTransaction.findMany({
      where,
      include: {
        campaign: { include: { vendor: { include: { vendorProfile: true } } } },
      },
      orderBy: { createdAt: "desc" },
      ...paginationArgs(page, pageSize),
    }),
    db.escrowTransaction.count({ where }),
    // Kartu ringkasan sengaja memakai seluruh riwayat, bukan hasil
    // penyaringan: saldo yang dipegang platform tidak berubah hanya karena
    // admin sedang melihat 30 hari terakhir.
    db.escrowTransaction.groupBy({
      by: ["type"],
      _sum: { amount: true },
      where: { status: "COMPLETED" },
    }),
  ]);

  const jumlah = (type: EscrowType) =>
    ringkasan.find((row) => row.type === type)?._sum.amount ?? 0;

  const masuk = jumlah("DEPOSIT");
  const keluar = jumlah("PAYOUT");
  const fee = jumlah("PLATFORM_FEE");
  const refund = jumlah("REFUND");
  // Dana yang masih dipegang platform: deposit masuk dikurangi semua yang
  // sudah keluar — ke creator, ke kas platform, dan kembali ke vendor.
  const terkunci = masuk - keluar - fee - refund;

  return (
    <div>
      <PageHeader
        title="Escrow & dana tertahan"
        description="Vendor menyetor di muka sebelum campaign live. Halaman ini mencatat setiap pergerakan dana yang dipegang platform."
      />

      <div className="mb-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Stat label="Deposit masuk" icon={IconBank} value={formatIDR(masuk)} />
        <Stat
          label="Dana terkunci"
          icon={IconLock}
          value={formatIDR(terkunci)}
          hint="Belum dibagikan ke siapa pun"
        />
        <Stat
          label="Sudah dibayarkan"
          icon={IconBanknote}
          value={formatIDR(keluar)}
          tone="success"
        />
        <Stat
          label="Refund ke vendor"
          icon={IconWallet}
          value={formatIDR(refund)}
        />
      </div>

      <DataTable
        title="Escrow & Dana Tertahan"
        summary={`Saldo dikelola ${formatIDR(terkunci)}`}
        action={
          <PageSizeSelect basePath={BASE} params={params} pageSize={pageSize} />
        }
        toolbar={
          <TableToolbar
            basePath={BASE}
            params={params}
            searchPlaceholder="Cari campaign / vendor..."
            filters={[
              {
                name: "jenis",
                label: "Jenis",
                options: [
                  { value: "", label: "Semua jenis" },
                  ...Object.entries(jenisLabel).map(([value, label]) => ({
                    value,
                    label,
                  })),
                ],
              },
              {
                name: "status",
                label: "Status",
                options: [
                  { value: "", label: "Semua status" },
                  ...Object.entries(statusLabel).map(([value, label]) => ({
                    value,
                    label,
                  })),
                ],
              },
              {
                name: "periode",
                label: "Periode",
                options: Object.entries(PERIODE).map(([value, isi]) => ({
                  value,
                  label: isi.label,
                })),
              },
            ]}
            action={
              <ButtonLink
                href="/api/admin/export?type=escrow"
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
        <thead>
          <tr>
            <Th>No</Th>
            <Th>Waktu</Th>
            <Th>Campaign</Th>
            <Th>Vendor</Th>
            <Th>Jenis</Th>
            <Th align="right">Nominal</Th>
            <Th>Referensi</Th>
            <Th>Status</Th>
            <Th>Aksi</Th>
          </tr>
        </thead>
        <tbody>
          {transaksi.length === 0 ? (
            <TableEmptyRow
              colSpan={9}
              title="Belum ada mutasi escrow pada periode ini"
              description="Baris pertama muncul saat vendor menyetor deposit campaign."
            />
          ) : (
            transaksi.map((trx, index) => (
              <tr key={trx.id}>
                <Td className="tabular text-muted">
                  {rowNumber(index, page, pageSize)}
                </Td>
                <Td className="whitespace-nowrap text-muted">
                  {formatDateTime(trx.createdAt)}
                </Td>
                <Td className="font-medium">{trx.campaign.title}</Td>
                <Td>
                  {trx.campaign.vendor.vendorProfile?.businessName ?? "—"}
                </Td>
                <Td>{jenisLabel[trx.type]}</Td>
                <Td align="right" className="font-medium">
                  {formatIDR(trx.amount)}
                </Td>
                <Td className="text-muted">{trx.reference ?? "—"}</Td>
                <Td>
                  <Badge tone={statusTone[trx.status]} icon>
                    {statusLabel[trx.status]}
                  </Badge>
                </Td>
                <Td>
                  {trx.type === "DEPOSIT" && trx.status === "PENDING" ? (
                    <div className="flex items-center gap-2">
                      <SimpleActionForm
                        action={confirmDepositAction}
                        hiddenField="campaignId"
                        hiddenValue={trx.campaignId}
                        label="Konfirmasi"
                        variant="secondary"
                        size="compact"
                        icon={<IconBank className="h-4 w-4" strokeWidth={2} />}
                      />
                      <DetailDrawer
                        label="Detail"
                        title={`${jenisLabel[trx.type]} — ${formatIDR(trx.amount)}`}
                        subtitle={`${trx.campaign.title} · ${formatDateTime(trx.createdAt)}`}
                        icon={<IconShieldCheck className="h-4 w-4" strokeWidth={2} />}
                      >
                        <dl className="space-y-3 text-sm">
                          <div>
                            <dt className="text-xs font-medium text-muted">
                              Vendor
                            </dt>
                            <dd className="mt-0.5">
                              {trx.campaign.vendor.vendorProfile?.businessName ??
                                "—"}
                            </dd>
                          </div>
                          <div>
                            <dt className="text-xs font-medium text-muted">
                              Status
                            </dt>
                            <dd className="mt-0.5">
                              {statusLabel[trx.status]}
                            </dd>
                          </div>
                          <div>
                            <dt className="text-xs font-medium text-muted">
                              Info Transfer / Catatan
                            </dt>
                            <dd className="mt-0.5 font-medium text-foreground">
                              {trx.note ?? "Belum ada konfirmasi transfer dari vendor."}
                            </dd>
                          </div>
                          <div>
                            <dt className="text-xs font-medium text-muted">
                              Referensi
                            </dt>
                            <dd className="tabular mt-0.5">
                              {trx.reference ?? "—"}
                            </dd>
                          </div>
                        </dl>
                      </DetailDrawer>
                    </div>
                  ) : trx.type === "REFUND" && trx.status === "PENDING" ? (
                    <div className="flex items-center gap-2">
                      <SimpleActionForm
                        action={confirmRefundAction}
                        hiddenField="transactionId"
                        hiddenValue={trx.id}
                        label="Konfirmasi Refund"
                        variant="secondary"
                        size="compact"
                        icon={<IconWallet className="h-4 w-4" strokeWidth={2} />}
                      />
                      <DetailDrawer
                        label="Detail"
                        title={`${jenisLabel[trx.type]} — ${formatIDR(trx.amount)}`}
                        subtitle={`${trx.campaign.title} · ${formatDateTime(trx.createdAt)}`}
                        icon={<IconShieldCheck className="h-4 w-4" strokeWidth={2} />}
                      >
                        <dl className="space-y-3 text-sm">
                          <div>
                            <dt className="text-xs font-medium text-muted">
                              Vendor
                            </dt>
                            <dd className="mt-0.5">
                              {trx.campaign.vendor.vendorProfile?.businessName ??
                                "—"}
                            </dd>
                          </div>
                          <div>
                            <dt className="text-xs font-medium text-muted">
                              Rekening Tujuan Refund
                            </dt>
                            <dd className="mt-0.5 font-medium text-foreground">
                              {trx.campaign.vendor.vendorProfile?.bankName &&
                              trx.campaign.vendor.vendorProfile?.bankAccountNumber ? (
                                <span>
                                  {trx.campaign.vendor.vendorProfile.bankName}{" "}
                                  <span className="tabular">
                                    {trx.campaign.vendor.vendorProfile.bankAccountNumber}
                                  </span>{" "}
                                  a.n.{" "}
                                  {trx.campaign.vendor.vendorProfile.bankAccountName ?? "—"}
                                </span>
                              ) : (
                                <span className="text-amber-500 font-normal">
                                  Vendor belum mengatur rekening bank di profil.
                                </span>
                              )}
                            </dd>
                          </div>
                          <div>
                            <dt className="text-xs font-medium text-muted">
                              Status
                            </dt>
                            <dd className="mt-0.5">
                              {statusLabel[trx.status]}
                            </dd>
                          </div>
                          <div>
                            <dt className="text-xs font-medium text-muted">
                              Catatan
                            </dt>
                            <dd className="mt-0.5 text-muted">
                              {trx.note ?? "—"}
                            </dd>
                          </div>
                        </dl>
                      </DetailDrawer>
                    </div>
                  ) : (
                    <DetailDrawer
                      label="Lihat detail"
                      title={`${jenisLabel[trx.type]} — ${formatIDR(trx.amount)}`}
                      subtitle={`${trx.campaign.title} · ${formatDateTime(trx.createdAt)}`}
                      icon={<IconShieldCheck className="h-4 w-4" strokeWidth={2} />}
                    >
                      <dl className="space-y-3 text-sm">
                        <div>
                          <dt className="text-xs font-medium text-muted">
                            Vendor
                          </dt>
                          <dd className="mt-0.5">
                            {trx.campaign.vendor.vendorProfile?.businessName ??
                              "—"}
                          </dd>
                        </div>
                        {trx.type === "REFUND" && (
                          <div>
                            <dt className="text-xs font-medium text-muted">
                              Rekening Tujuan Refund
                            </dt>
                            <dd className="mt-0.5 font-medium text-foreground">
                              {trx.campaign.vendor.vendorProfile?.bankName ? (
                                <span>
                                  {trx.campaign.vendor.vendorProfile.bankName}{" "}
                                  <span className="tabular">
                                    {trx.campaign.vendor.vendorProfile.bankAccountNumber}
                                  </span>{" "}
                                  a.n.{" "}
                                  {trx.campaign.vendor.vendorProfile.bankAccountName ?? "—"}
                                </span>
                              ) : (
                                "—"
                              )}
                            </dd>
                          </div>
                        )}
                        <div>
                          <dt className="text-xs font-medium text-muted">
                            Referensi
                          </dt>
                          <dd className="tabular mt-0.5">
                            {trx.reference ?? "—"}
                          </dd>
                        </div>
                        <div>
                          <dt className="text-xs font-medium text-muted">
                            Status
                          </dt>
                          <dd className="mt-0.5">
                            {statusLabel[trx.status]}
                            {trx.completedAt
                              ? ` · ${formatDateTime(trx.completedAt)}`
                              : ""}
                          </dd>
                        </div>
                        <div>
                          <dt className="text-xs font-medium text-muted">
                            Catatan
                          </dt>
                          <dd className="mt-0.5 text-muted">
                            {trx.note ?? "—"}
                          </dd>
                        </div>
                      </dl>
                    </DetailDrawer>
                  )}
                </Td>
              </tr>
            ))
          )}
        </tbody>
      </DataTable>
    </div>
  );
}
