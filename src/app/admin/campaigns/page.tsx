import { requireRole } from "@/lib/auth";
import { db } from "@/lib/db";
import { getCampaignPerformance } from "@/domain/campaign";
import { daysUntil, formatCompact, formatDate, formatIDR } from "@/lib/format";
import {
  Badge,
  Callout,
  DataTable,
  DetailDrawer,
  IconCheck,
  IconShieldCheck,
  IconX,
  PageHeader,
  PageSizeSelect,
  Pagination,
  ProgressBar,
  TableEmptyRow,
  TableToolbar,
  Td,
  Th,
  paginationArgs,
  resolvePageSize,
  rowNumber,
} from "@/components/ui";
import type {
  BusinessCategory,
  CampaignStatus,
} from "@/generated/prisma/enums";
import {
  campaignStatusLabel,
  campaignStatusTone,
  categoryLabel,
  platformLabel,
} from "@/lib/labels";
import {
  confirmDepositAction,
  reviewCampaignAction,
  triggerLifecycleCheckAction,
} from "../actions";
import { DecisionForm, SimpleActionForm } from "../decision-form";

const PAGE_SIZE = 10;
const BASE = "/admin/campaigns";

export default async function AdminCampaignsPage({
  searchParams,
}: {
  searchParams: Promise<{
    q?: string;
    status?: string;
    kategori?: string;
    kota?: string;
    urut?: string;
    page?: string;
    ukuran?: string;
  }>;
}) {
  await requireRole("ADMIN");
  const params = await searchParams;
  const page = Math.max(1, Number(params.page) || 1);
  const pageSize = resolvePageSize(params.ukuran, PAGE_SIZE);
  const status = (params.status ?? "PENDING_REVIEW") as CampaignStatus | "ALL";

  const where = {
    ...(status === "ALL" ? {} : { status }),
    ...(params.kategori
      ? { category: params.kategori as BusinessCategory }
      : {}),
    ...(params.kota
      ? { vendor: { is: { vendorProfile: { is: { city: params.kota } } } } }
      : {}),
    ...(params.q
      ? {
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
        }
      : {}),
  };

  const [campaigns, total, menunggu, kotaTersedia] = await Promise.all([
    db.campaign.findMany({
      where,
      include: {
        vendor: { include: { vendorProfile: true } },
        escrow: true,
        _count: { select: { participations: true, submissions: true } },
      },
      orderBy:
        params.urut === "budget"
          ? { budgetPool: "desc" }
          : { createdAt: "desc" },
      ...paginationArgs(page, pageSize),
    }),
    db.campaign.count({ where }),
    db.campaign.count({ where: { status: "PENDING_REVIEW" } }),
    db.vendorProfile.findMany({
      select: { city: true },
      distinct: ["city"],
      orderBy: { city: "asc" },
    }),
  ]);

  // Serapan hanya dihitung untuk campaign yang sudah live — yang masih
  // menunggu approval belum punya views sama sekali.
  const serapan = new Map(
    await Promise.all(
      campaigns
        .filter((campaign) =>
          ["ACTIVE", "ENDED", "SETTLING", "SETTLED"].includes(campaign.status),
        )
        .map(
          async (campaign) =>
            [campaign.id, await getCampaignPerformance(campaign.id)] as const,
        ),
    ),
  );

  return (
    <div>
      <PageHeader
        title="Approval & monitoring campaign"
        description="Campaign hanya boleh live kalau vendor terverifikasi dan deposit pool sudah lunas."
        action={
          <SimpleActionForm
            action={triggerLifecycleCheckAction}
            hiddenField="action"
            hiddenValue="sync"
            label="Periksa Siklus Kampanye"
            pendingLabel="Memeriksa siklus..."
            variant="secondary"
            size="sm"
          />
        }
      />

      <DataTable
        title="Approval & Monitoring Campaign"
        summary={`${menunggu} menunggu approval`}
        action={
          <PageSizeSelect basePath={BASE} params={params} pageSize={pageSize} />
        }
        toolbar={
          <TableToolbar
            basePath={BASE}
            params={params}
            searchPlaceholder="Cari judul / vendor..."
            filters={[
              {
                name: "status",
                label: "Status",
                options: [
                  { value: "PENDING_REVIEW", label: "Menunggu" },
                  { value: "ACTIVE", label: "Berjalan" },
                  { value: "ENDED", label: "Periode selesai" },
                  { value: "SETTLED", label: "Selesai" },
                  { value: "REJECTED", label: "Ditolak" },
                  { value: "ALL", label: "Semua status" },
                ],
              },
              {
                name: "kategori",
                label: "Kategori",
                options: [
                  { value: "", label: "Semua kategori" },
                  ...Object.entries(categoryLabel).map(([value, label]) => ({
                    value,
                    label,
                  })),
                ],
              },
              {
                name: "kota",
                label: "Kota",
                options: [
                  { value: "", label: "Semua kota" },
                  ...kotaTersedia.map((row) => ({
                    value: row.city,
                    label: row.city,
                  })),
                ],
              },
              {
                name: "urut",
                label: "Urutkan",
                options: [
                  { value: "", label: "Terbaru" },
                  { value: "budget", label: "Budget tertinggi" },
                ],
              },
            ]}
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
            <Th>Campaign</Th>
            <Th>Vendor</Th>
            <Th>Kategori</Th>
            <Th align="right">Budget</Th>
            <Th align="right">Creator</Th>
            <Th>Periode</Th>
            <Th>Escrow</Th>
            <Th>Status</Th>
            <Th>Aksi</Th>
          </tr>
        </thead>
        <tbody className="hidden md:table-row-group">
          {campaigns.length === 0 ? (
            <TableEmptyRow
              colSpan={11}
              title="Tidak ada campaign pada penyaringan ini"
              description="Ubah kata kunci atau pilih status lain."
            />
          ) : (
            campaigns.map((campaign, index) => {
              const deposit = campaign.escrow.find(
                (trx) => trx.type === "DEPOSIT",
              );
              const depositLunas = deposit?.status === "COMPLETED";
              const vendorTerverifikasi = campaign.vendor.status === "VERIFIED";
              const performance = serapan.get(campaign.id);
              const menungguApproval = campaign.status === "PENDING_REVIEW";
              const durasiHari = Math.max(
                1,
                Math.round(
                  (campaign.endDate.getTime() - campaign.startDate.getTime()) /
                    (1000 * 60 * 60 * 24),
                ),
              );

              return (
                <tr key={campaign.id}>
                  <Td className="tabular text-muted">
                    {rowNumber(index, page, pageSize)}
                  </Td>
                  <Td className="font-medium">{campaign.title}</Td>
                  <Td>{campaign.vendor.vendorProfile?.businessName ?? "—"}</Td>
                  <Td>{categoryLabel[campaign.category]}</Td>
                  <Td align="right">
                    <div className="flex flex-col">
                      <span className="font-medium">
                        {formatIDR(campaign.budgetPool)}
                      </span>
                      <span className="text-xs text-muted">
                        {formatIDR(campaign.cpmRate)}/cpm
                      </span>
                    </div>
                  </Td>
                  <Td align="right">{campaign._count.participations}</Td>
                  <Td className="whitespace-nowrap text-muted">
                    <div className="flex flex-col">
                      <span>{formatDate(campaign.startDate)}</span>
                      <span>{formatDate(campaign.endDate)}</span>
                    </div>
                  </Td>
                  <Td>
                    <Badge tone={depositLunas ? "success" : "warning"} icon>
                      {depositLunas ? "Lunas" : "Belum"}
                    </Badge>
                  </Td>
                  <Td>
                    <Badge tone={campaignStatusTone[campaign.status]} icon>
                      {campaignStatusLabel[campaign.status]}
                    </Badge>
                  </Td>
                  <Td>
                    <DetailDrawer
                      label={menungguApproval ? "Periksa" : "Pantau"}
                      icon={
                        <IconShieldCheck className="h-4 w-4" strokeWidth={2} />
                      }
                      title={campaign.title}
                      subtitle={`${campaign.vendor.vendorProfile?.businessName ?? "—"} · ${categoryLabel[campaign.category]} · ${campaign.vendor.vendorProfile?.city ?? "—"}`}
                    >
                      <div className="flex flex-wrap gap-2">
                        <Badge
                          tone={vendorTerverifikasi ? "success" : "danger"}
                          icon
                        >
                          {vendorTerverifikasi
                            ? "Vendor terverifikasi"
                            : "Vendor belum terverifikasi"}
                        </Badge>
                        <Badge tone={campaignStatusTone[campaign.status]} icon>
                          {campaignStatusLabel[campaign.status]}
                        </Badge>
                      </div>

                      <dl className="grid grid-cols-2 gap-4 text-sm">
                        <div>
                          <dt className="text-xs font-medium text-muted">
                            Budget pool
                          </dt>
                          <dd className="tabular mt-0.5 font-medium">
                            {formatIDR(campaign.budgetPool)}
                          </dd>
                        </div>
                        <div>
                          <dt className="text-xs font-medium text-muted">
                            CPM
                          </dt>
                          <dd className="tabular mt-0.5 font-medium">
                            {formatIDR(campaign.cpmRate)} / 1k
                          </dd>
                        </div>
                        <div>
                          <dt className="text-xs font-medium text-muted">
                            Target views
                          </dt>
                          <dd className="tabular mt-0.5">
                            {formatCompact(
                              Math.floor(
                                (campaign.budgetPool / campaign.cpmRate) * 1000,
                              ),
                            )}
                          </dd>
                        </div>
                        <div>
                          <dt className="text-xs font-medium text-muted">
                            Creator ikut
                          </dt>
                          <dd className="tabular mt-0.5">
                            {campaign._count.participations} creator
                          </dd>
                        </div>
                        {campaign.complimentType ? (
                          <div className="col-span-2">
                            <dt className="text-xs font-medium text-muted">
                              Komplimen
                            </dt>
                            <dd className="mt-0.5">
                              {campaign.complimentType}
                              {campaign.complimentValue
                                ? ` (${formatIDR(campaign.complimentValue)})`
                                : ""}
                            </dd>
                          </div>
                        ) : null}
                        <div className="col-span-2">
                          <dt className="text-xs font-medium text-muted">
                            Periode
                          </dt>
                          <dd className="mt-0.5">
                            {formatDate(campaign.startDate)} –{" "}
                            {formatDate(campaign.endDate)} ({durasiHari} hari)
                          </dd>
                        </div>
                      </dl>

                      <div className="rounded-xl bg-surface-muted p-3 text-sm">
                        <p className="font-medium">Brief</p>
                        <p className="mt-1 text-muted">
                          <span className="font-medium">Angle wajib:</span>{" "}
                          {campaign.briefAngle}
                        </p>
                        <ul className="mt-2 space-y-0.5 text-muted">
                          {campaign.briefMustShow.map((item) => (
                            <li key={item} className="flex items-start gap-2">
                              <IconCheck className="mt-0.5 h-3.5 w-3.5 shrink-0 text-success" />
                              {item}
                            </li>
                          ))}
                          {campaign.briefProhibited.map((item) => (
                            <li key={item} className="flex items-start gap-2">
                              <IconX className="mt-0.5 h-3.5 w-3.5 shrink-0 text-danger" />
                              {item}
                            </li>
                          ))}
                        </ul>
                        <p className="mt-2 text-xs text-muted">
                          Durasi min {campaign.minDurationSec} detik ·{" "}
                          {campaign.allowedPlatforms
                            .map((platform) => platformLabel[platform])
                            .join(", ")}
                        </p>
                      </div>

                      {performance ? (
                        <div>
                          <div className="flex items-center justify-between text-sm">
                            <span className="text-muted">Serapan budget</span>
                            <span className="tabular font-medium">
                              {formatIDR(performance.totalDistributed)} /{" "}
                              {formatIDR(campaign.budgetPool)}
                            </span>
                          </div>
                          <div className="mt-2">
                            <ProgressBar
                              value={performance.totalDistributed}
                              max={campaign.budgetPool}
                            />
                          </div>
                          <p className="mt-2 text-sm text-muted">
                            {formatCompact(performance.totalViews)} views dari{" "}
                            {campaign._count.submissions} submission ·{" "}
                            {daysUntil(campaign.endDate) > 0
                              ? `${daysUntil(campaign.endDate)} hari lagi`
                              : "periode selesai"}
                          </p>
                        </div>
                      ) : null}

                      <div className="space-y-3 border-t border-line pt-4">
                        {!depositLunas ? (
                          <>
                            <Callout
                              tone={
                                deposit?.note &&
                                !deposit.note.toLowerCase().includes("menunggu pembayaran")
                                  ? "info"
                                  : "warning"
                              }
                              title={
                                deposit?.note &&
                                !deposit.note.toLowerCase().includes("menunggu pembayaran")
                                  ? "Konfirmasi Transfer Vendor Diterima"
                                  : "Deposit Escrow Belum Lunas"
                              }
                            >
                              {deposit?.note &&
                              !deposit.note.toLowerCase().includes("menunggu pembayaran") ? (
                                <div className="space-y-1 text-xs">
                                  <p>
                                    <strong className="text-foreground">Info transfer vendor: </strong>
                                    {deposit.note}
                                  </p>
                                  <p className="text-muted">
                                    Nominal pool: {formatIDR(campaign.budgetPool)}. Cocokkan dengan mutasi rekening BCA sebelum konfirmasi lunas.
                                  </p>
                                </div>
                              ) : (
                                `Escrow: belum ada deposit ${formatIDR(campaign.budgetPool)} tercatat. Campaign yang disetujui tetap belum tampil di listing creator sampai dananya masuk.`
                              )}
                            </Callout>
                            <SimpleActionForm
                              action={confirmDepositAction}
                              hiddenField="campaignId"
                              hiddenValue={campaign.id}
                              label="Konfirmasi deposit diterima"
                              variant="secondary"
                            />
                          </>
                        ) : null}

                        {menungguApproval ? (
                          <DecisionForm
                            action={reviewCampaignAction}
                            hiddenField="campaignId"
                            hiddenValue={campaign.id}
                            approveLabel="Setujui"
                            rejectLabel="Tolak"
                            noteLabel="Alasan penolakan"
                          />
                        ) : campaign.rejectionReason ? (
                          <div className="rounded-xl bg-danger-soft px-3 py-2 text-sm text-danger">
                            <p className="font-medium">Alasan penolakan</p>
                            <p className="mt-0.5">{campaign.rejectionReason}</p>
                          </div>
                        ) : null}
                      </div>
                    </DetailDrawer>
                  </Td>
                </tr>
              );
            })
          )}
        </tbody>

        {/* Kartu — mobile */}
        <tbody className="md:hidden">
          {campaigns.length === 0 ? (
            <TableEmptyRow
              colSpan={1}
              title="Tidak ada campaign pada penyaringan ini"
              description="Ubah kata kunci atau pilih status lain."
            />
          ) : (
            campaigns.map((campaign) => {
              const deposit = campaign.escrow.find((trx) => trx.type === "DEPOSIT");
              const depositLunas = deposit?.status === "COMPLETED";
              const vendorTerverifikasi = campaign.vendor.status === "VERIFIED";
              const performance = serapan.get(campaign.id);
              const menungguApproval = campaign.status === "PENDING_REVIEW";
              const durasiHari = Math.max(
                1,
                Math.round(
                  (campaign.endDate.getTime() - campaign.startDate.getTime()) /
                    (1000 * 60 * 60 * 24),
                ),
              );

              return (
                <tr key={`m-${campaign.id}`}>
                  <td className="block px-4 py-3 border-b border-line last:border-0">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0 flex-1">
                        <p className="font-medium text-sm truncate">{campaign.title}</p>
                        <p className="text-xs text-muted mt-0.5">
                          {campaign.vendor.vendorProfile?.businessName ?? "—"} · {categoryLabel[campaign.category]}
                        </p>
                        <p className="tabular text-xs font-medium mt-0.5">
                          {formatIDR(campaign.budgetPool)}
                        </p>
                        <div className="flex items-center gap-2 mt-1.5">
                          <Badge tone={depositLunas ? "success" : "warning"} icon>
                            {depositLunas ? "Lunas" : "Belum"}
                          </Badge>
                          <Badge tone={campaignStatusTone[campaign.status]} icon>
                            {campaignStatusLabel[campaign.status]}
                          </Badge>
                        </div>
                      </div>
                      <div className="shrink-0 flex flex-col items-end gap-2">
                        <DetailDrawer
                          label={menungguApproval ? "Periksa" : "Pantau"}
                          icon={<IconShieldCheck className="h-4 w-4" strokeWidth={2} />}
                          title={campaign.title}
                          subtitle={`${campaign.vendor.vendorProfile?.businessName ?? "—"} · ${categoryLabel[campaign.category]}`}
                        >
                          <div className="flex flex-wrap gap-2">
                            <Badge tone={vendorTerverifikasi ? "success" : "danger"} icon>
                              {vendorTerverifikasi ? "Vendor terverifikasi" : "Vendor belum terverifikasi"}
                            </Badge>
                            <Badge tone={campaignStatusTone[campaign.status]} icon>
                              {campaignStatusLabel[campaign.status]}
                            </Badge>
                          </div>

                          <dl className="grid grid-cols-2 gap-4 text-sm">
                            <div>
                              <dt className="text-xs font-medium text-muted">Budget pool</dt>
                              <dd className="tabular mt-0.5 font-medium">{formatIDR(campaign.budgetPool)}</dd>
                            </div>
                            <div>
                              <dt className="text-xs font-medium text-muted">CPM</dt>
                              <dd className="tabular mt-0.5 font-medium">{formatIDR(campaign.cpmRate)} / 1k</dd>
                            </div>
                            <div>
                              <dt className="text-xs font-medium text-muted">Creator ikut</dt>
                              <dd className="tabular mt-0.5">{campaign._count.participations} creator</dd>
                            </div>
                            <div>
                              <dt className="text-xs font-medium text-muted">Escrow</dt>
                              <dd className="mt-0.5"><Badge tone={depositLunas ? "success" : "warning"} icon>{depositLunas ? "Lunas" : "Belum"}</Badge></dd>
                            </div>
                            <div className="col-span-2">
                              <dt className="text-xs font-medium text-muted">Periode</dt>
                              <dd className="mt-0.5">{formatDate(campaign.startDate)} – {formatDate(campaign.endDate)} ({durasiHari} hari)</dd>
                            </div>
                          </dl>

                          <div className="rounded-xl bg-surface-muted p-3 text-sm">
                            <p className="font-medium">Brief</p>
                            <p className="mt-1 text-muted">
                              <span className="font-medium">Angle wajib:</span>{" "}
                              {campaign.briefAngle}
                            </p>
                            <ul className="mt-2 space-y-0.5 text-muted">
                              {campaign.briefMustShow.map((item) => (
                                <li key={item} className="flex items-start gap-2">
                                  <IconCheck className="mt-0.5 h-3.5 w-3.5 shrink-0 text-success" />
                                  {item}
                                </li>
                              ))}
                              {campaign.briefProhibited.map((item) => (
                                <li key={item} className="flex items-start gap-2">
                                  <IconX className="mt-0.5 h-3.5 w-3.5 shrink-0 text-danger" />
                                  {item}
                                </li>
                              ))}
                            </ul>
                          </div>

                          {performance ? (
                            <div>
                              <div className="flex items-center justify-between text-sm">
                                <span className="text-muted">Serapan budget</span>
                                <span className="tabular font-medium">
                                  {formatIDR(performance.totalDistributed)} / {formatIDR(campaign.budgetPool)}
                                </span>
                              </div>
                              <div className="mt-2">
                                <ProgressBar value={performance.totalDistributed} max={campaign.budgetPool} />
                              </div>
                              <p className="mt-2 text-sm text-muted">
                                {formatCompact(performance.totalViews)} views dari {campaign._count.submissions} submission ·{" "}
                                {daysUntil(campaign.endDate) > 0 ? `${daysUntil(campaign.endDate)} hari lagi` : "periode selesai"}
                              </p>
                            </div>
                          ) : null}

                          <div className="space-y-3 border-t border-line pt-4">
                            {!depositLunas ? (
                              <>
                                <Callout
                                  tone={deposit?.note && !deposit.note.toLowerCase().includes("menunggu pembayaran") ? "info" : "warning"}
                                  title={deposit?.note && !deposit.note.toLowerCase().includes("menunggu pembayaran") ? "Konfirmasi Transfer Vendor Diterima" : "Deposit Escrow Belum Lunas"}
                                >
                                  {deposit?.note && !deposit.note.toLowerCase().includes("menunggu pembayaran") ? (
                                    <div className="space-y-1 text-xs">
                                      <p><strong className="text-foreground">Info transfer vendor: </strong>{deposit.note}</p>
                                      <p className="text-muted">Nominal pool: {formatIDR(campaign.budgetPool)}. Cocokkan dengan mutasi rekening BCA sebelum konfirmasi lunas.</p>
                                    </div>
                                  ) : (
                                    `Escrow: belum ada deposit ${formatIDR(campaign.budgetPool)} tercatat.`
                                  )}
                                </Callout>
                                <SimpleActionForm
                                  action={confirmDepositAction}
                                  hiddenField="campaignId"
                                  hiddenValue={campaign.id}
                                  label="Konfirmasi deposit diterima"
                                  variant="secondary"
                                />
                              </>
                            ) : null}
                            {menungguApproval ? (
                              <DecisionForm
                                action={reviewCampaignAction}
                                hiddenField="campaignId"
                                hiddenValue={campaign.id}
                                approveLabel="Setujui"
                                rejectLabel="Tolak"
                                noteLabel="Alasan penolakan"
                              />
                            ) : campaign.rejectionReason ? (
                              <div className="rounded-xl bg-danger-soft px-3 py-2 text-sm text-danger">
                                <p className="font-medium">Alasan penolakan</p>
                                <p className="mt-0.5">{campaign.rejectionReason}</p>
                              </div>
                            ) : null}
                          </div>
                        </DetailDrawer>
                      </div>
                    </div>
                  </td>
                </tr>
              );
            })
          )}
        </tbody>
      </DataTable>
    </div>
  );
}
