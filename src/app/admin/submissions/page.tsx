import Link from "next/link";
import { requireRole } from "@/lib/auth";
import { db } from "@/lib/db";
import { formatCompact, formatDateTime, formatIDR } from "@/lib/format";
import {
  Badge,
  Callout,
  Card,
  DataTable,
  DetailDrawer,
  EmptyState,
  IconShieldCheck,
  IconWallet,
  PageHeader,
  PageSizeSelect,
  Pagination,
  Table,
  Td,
  Th,
  TableEmptyRow,
  paginationArgs,
  resolvePageSize,
  rowNumber,
} from "@/components/ui";
import {
  platformLabel,
  submissionStatusLabel,
  submissionStatusTone,
} from "@/lib/labels";
import {
  markWithdrawalPaidAction,
  reviewSubmissionAction,
  reviewWithdrawalAction,
} from "../actions";
import { DecisionForm, SimpleActionForm } from "../decision-form";

/**
 * Duplikat dari `/vendor/submissions` (lihat berkas itu untuk pola aslinya),
 * tapi tanpa penyaring `vendorId` — admin melihat antrean review lintas
 * seluruh vendor, bukan hanya satu bisnis. Dipakai saat admin perlu turun
 * tangan menengahi tanpa menunggu vendor login, mis. vendor lambat merespons
 * atau libur.
 */
const PAGE_SIZE = 10;
const BASE = "/admin/submissions";

export default async function AdminSubmissionsPage({
  searchParams,
}: {
  searchParams: Promise<{
    tab?: string;
    page?: string;
    ukuran?: string;
  }>;
}) {
  await requireRole("ADMIN");
  const params = await searchParams;
  const tab =
    params.tab === "riwayat"
      ? "riwayat"
      : params.tab === "penarikan"
        ? "penarikan"
        : "antrean";
  const page = Math.max(1, Number(params.page) || 1);
  const pageSize = resolvePageSize(params.ukuran, PAGE_SIZE);

  const [
    antreanCount,
    antrean,
    riwayat,
    riwayatTotal,
    withdrawalMenunggu,
    withdrawalDisetujui,
  ] = await Promise.all([
    db.submission.count({ where: { status: "PENDING_REVIEW" } }),
    tab === "antrean"
      ? db.submission.findMany({
          where: { status: "PENDING_REVIEW" },
          include: {
            campaign: {
              include: { vendor: { include: { vendorProfile: true } } },
            },
            creator: { include: { creatorProfile: true } },
          },
          orderBy: { submittedAt: "asc" },
          ...paginationArgs(page, pageSize),
        })
      : Promise.resolve([]),
    tab === "riwayat"
      ? db.submission.findMany({
          where: { status: { not: "PENDING_REVIEW" } },
          include: {
            campaign: {
              include: { vendor: { include: { vendorProfile: true } } },
            },
            creator: true,
          },
          orderBy: { reviewedAt: "desc" },
          ...paginationArgs(page, pageSize),
        })
      : Promise.resolve([]),
    tab === "riwayat"
      ? db.submission.count({ where: { status: { not: "PENDING_REVIEW" } } })
      : Promise.resolve(0),
    tab === "penarikan"
      ? db.withdrawal.findMany({
          where: { status: "PENDING_ADMIN_APPROVAL" },
          include: {
            campaign: true,
            creator: true,
            submission: true,
          },
          orderBy: { requestedAt: "asc" },
        })
      : Promise.resolve([]),
    tab === "penarikan"
      ? db.withdrawal.findMany({
          where: { status: "APPROVED" },
          include: { campaign: true, creator: true },
          orderBy: { approvedAt: "asc" },
        })
      : Promise.resolve([]),
  ]);

  return (
    <div>
      <PageHeader
        title="Review submission"
        description="Turun tangan menengahi submission lintas vendor. Penolakan wajib disertai alasan, sama seperti review yang dilakukan vendor sendiri."
      />

      <div className="mb-6">
        <Callout tone="info">
          Keputusan di sini tercatat di audit trail yang sama dengan review
          vendor. Gunakan saat vendor belum sempat merespons — bukan pengganti
          alur review vendor sehari-hari.
        </Callout>
      </div>

      <div className="mb-6 inline-flex rounded-xl border border-line bg-surface-muted p-1">
        <Link
          href="/admin/submissions?tab=antrean"
          className={
            tab === "antrean"
              ? "rounded-lg bg-surface px-5 py-2 text-sm font-semibold text-foreground shadow-card"
              : "rounded-lg px-5 py-2 text-sm font-medium text-muted transition-colors hover:text-foreground"
          }
        >
          Lihat antrean
        </Link>
        <Link
          href="/admin/submissions?tab=riwayat"
          className={
            tab === "riwayat"
              ? "rounded-lg bg-surface px-5 py-2 text-sm font-semibold text-foreground shadow-card"
              : "rounded-lg px-5 py-2 text-sm font-medium text-muted transition-colors hover:text-foreground"
          }
        >
          Riwayat keputusan
        </Link>
        <Link
          href="/admin/submissions?tab=penarikan"
          className={
            tab === "penarikan"
              ? "rounded-lg bg-surface px-5 py-2 text-sm font-semibold text-foreground shadow-card"
              : "rounded-lg px-5 py-2 text-sm font-medium text-muted transition-colors hover:text-foreground"
          }
        >
          Penarikan Dana
        </Link>
      </div>

      {tab === "antrean" ? (
      <div className="mb-6">
        <DataTable
          title="Antrean review"
          summary={`${antreanCount} menunggu, diurutkan dari yang paling lama`}
          action={
            <PageSizeSelect basePath={BASE} params={params} pageSize={pageSize} />
          }
          tableClassName="w-full text-sm md:min-w-[52rem]"
          footer={
            <Pagination
              basePath={BASE}
              params={params}
              page={page}
              pageSize={pageSize}
              total={antreanCount}
            />
          }
        >
          {/* Tabel — desktop */}
          <thead className="hidden md:table-header-group">
            <tr>
              <Th>No</Th>
              <Th>Creator</Th>
              <Th>Campaign</Th>
              <Th>Platform</Th>
              <Th>Disubmit</Th>
              <Th align="right">Views</Th>
              <Th>Trust score</Th>
              <Th>Aksi</Th>
            </tr>
          </thead>
          <tbody className="hidden md:table-row-group">
            {antrean.length === 0 ? (
              <TableEmptyRow
                colSpan={8}
                title="Tidak ada antrean"
                description="Semua submission sudah diputuskan vendornya masing-masing."
              />
            ) : (
              antrean.map((submission, index) => (
                <tr key={submission.id}>
                  <Td className="tabular text-muted">
                    {rowNumber(index, page, pageSize)}
                  </Td>
                  <Td className="font-medium">{submission.creator.name}</Td>
                  <Td>
                    <span>{submission.campaign.title}</span>
                    <p className="text-xs text-muted">
                      {submission.campaign.vendor.vendorProfile
                        ?.businessName ?? "—"}
                    </p>
                  </Td>
                  <Td>{platformLabel[submission.platform]}</Td>
                  <Td className="whitespace-nowrap text-muted">
                    {formatDateTime(submission.submittedAt)}
                  </Td>
                  <Td align="right" className="tabular">
                    {formatCompact(submission.lastViews)}
                  </Td>
                  <Td className="tabular text-muted">
                    {submission.creator.creatorProfile?.trustScore ?? "—"}/100
                  </Td>
                  <Td>
                    <DetailDrawer
                      label="Review"
                      icon={
                        <IconShieldCheck className="h-4 w-4" strokeWidth={2} />
                      }
                      title={submission.creator.name}
                      subtitle={`${submission.campaign.title} · ${
                        submission.campaign.vendor.vendorProfile
                          ?.businessName ?? "—"
                      } · ${platformLabel[submission.platform]}`}
                    >
                      <a
                        href={submission.contentUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="block truncate text-sm text-brand"
                      >
                        {submission.contentUrl}
                      </a>
                      {submission.caption ? (
                        <p className="text-sm text-muted">
                          &ldquo;{submission.caption}&rdquo;
                        </p>
                      ) : null}

                      <div>
                        <p className="mb-2 text-xs font-medium uppercase tracking-wide text-muted">
                          Cek terhadap brief
                        </p>
                        <ul className="space-y-1 text-sm">
                          {submission.campaign.briefMustShow.map((item) => (
                            <li key={item} className="flex gap-2 text-muted">
                              <span>•</span>
                              {item}
                            </li>
                          ))}
                        </ul>
                      </div>

                      <div className="border-t border-line pt-4">
                        <DecisionForm
                          action={reviewSubmissionAction}
                          hiddenField="submissionId"
                          hiddenValue={submission.id}
                          approveLabel="Terima"
                          rejectLabel="Tolak"
                          requireNoteOnApprove
                        />
                      </div>
                    </DetailDrawer>
                  </Td>
                </tr>
              ))
            )}
          </tbody>

          {/* Isi Tabel — Mobile (Baris dengan Grid 2 Kolom) */}
          <tbody className="md:hidden">
            {antrean.length === 0 ? (
              <TableEmptyRow
                colSpan={1}
                title="Tidak ada antrean"
                description="Semua submission sudah diputuskan vendornya masing-masing."
              />
            ) : (
              antrean.map((submission, index) => (
                <tr key={`m-${submission.id}`} className="border-b border-line last:border-0">
                  <td className="block w-full p-4">
                    {/* Header item */}
                    <div className="flex items-center justify-between gap-2 pb-2.5 border-b border-line">
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="tabular text-xs font-semibold text-muted shrink-0">
                          #{rowNumber(index, page, pageSize)}
                        </span>
                        <h3 className="font-semibold text-sm truncate text-foreground">
                          {submission.creator.name}
                        </h3>
                      </div>
                      <span className="text-xs font-medium px-2 py-0.5 rounded-md bg-surface-muted text-muted">
                        {platformLabel[submission.platform]}
                      </span>
                    </div>

                    {/* Grid data 2 kolom */}
                    <div className="grid grid-cols-2 gap-3 py-3 text-xs border-b border-line">
                      <div>
                        <span className="text-[11px] font-medium text-muted uppercase tracking-wider block">
                          Campaign & Vendor
                        </span>
                        <span className="font-medium text-foreground mt-0.5 block truncate">
                          {submission.campaign.title}
                        </span>
                        <p className="text-muted text-xs mt-0.5 truncate">
                          {submission.campaign.vendor.vendorProfile?.businessName ?? "—"}
                        </p>
                      </div>
                      <div>
                        <span className="text-[11px] font-medium text-muted uppercase tracking-wider block">
                          Views Tercatat
                        </span>
                        <span className="font-semibold text-foreground mt-0.5 block tabular">
                          {formatCompact(submission.lastViews)} Views
                        </span>
                      </div>
                      <div>
                        <span className="text-[11px] font-medium text-muted uppercase tracking-wider block">
                          Trust Score
                        </span>
                        <span className="font-medium text-foreground mt-0.5 block">
                          {submission.creator.creatorProfile?.trustScore ?? "—"} / 100
                        </span>
                      </div>
                      <div>
                        <span className="text-[11px] font-medium text-muted uppercase tracking-wider block">
                          Disubmit
                        </span>
                        <span className="font-medium text-foreground mt-0.5 block">
                          {formatDateTime(submission.submittedAt)}
                        </span>
                      </div>
                    </div>

                    {/* Footer baris: Video link & Aksi */}
                    <div className="flex items-center justify-between pt-2.5 gap-2">
                      <a
                        href={submission.contentUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="text-xs text-brand hover:underline truncate max-w-[180px]"
                      >
                        {submission.contentUrl}
                      </a>
                      <DetailDrawer
                        label="Review"
                        icon={<IconShieldCheck className="h-3.5 w-3.5" strokeWidth={2} />}
                        title={submission.creator.name}
                        subtitle={`${submission.campaign.title} · ${platformLabel[submission.platform]}`}
                      >
                        <a href={submission.contentUrl} target="_blank" rel="noreferrer" className="block truncate text-sm text-brand">
                          {submission.contentUrl}
                        </a>
                        {submission.caption ? <p className="text-sm text-muted mt-2">&ldquo;{submission.caption}&rdquo;</p> : null}
                        <div className="mt-3">
                          <p className="mb-2 text-xs font-medium uppercase tracking-wide text-muted">Cek terhadap brief</p>
                          <ul className="space-y-1 text-sm">
                            {submission.campaign.briefMustShow.map((item) => (
                              <li key={item} className="flex gap-2 text-muted"><span>•</span>{item}</li>
                            ))}
                          </ul>
                        </div>
                        <div className="border-t border-line pt-4 mt-4">
                          <DecisionForm
                            action={reviewSubmissionAction}
                            hiddenField="submissionId"
                            hiddenValue={submission.id}
                            approveLabel="Terima"
                            rejectLabel="Tolak"
                            requireNoteOnApprove
                          />
                        </div>
                      </DetailDrawer>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </DataTable>
      </div>
      ) : tab === "riwayat" ? (
      <DataTable
        title="Riwayat keputusan"
        action={
          <PageSizeSelect basePath={BASE} params={params} pageSize={pageSize} />
        }
        tableClassName="w-full text-sm md:min-w-[52rem]"
        footer={
          <Pagination
            basePath={BASE}
            params={params}
            page={page}
            pageSize={pageSize}
            total={riwayatTotal}
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
            <Th>Status</Th>
          </tr>
        </thead>
        <tbody className="hidden md:table-row-group">
          {riwayat.length === 0 ? (
            <TableEmptyRow colSpan={5} title="Belum ada riwayat" />
          ) : (
            riwayat.map((submission, index) => (
              <tr key={submission.id}>
                <Td className="tabular text-muted">
                  {rowNumber(index, page, pageSize)}
                </Td>
                <Td className="font-medium">{submission.creator.name}</Td>
                <Td>
                  <Link
                    href="/admin/campaigns"
                    className="text-muted hover:text-brand"
                  >
                    {submission.campaign.title} ·{" "}
                    {submission.campaign.vendor.vendorProfile?.businessName ??
                      "—"}
                  </Link>
                  {submission.reviewNote ? (
                    <p className="mt-0.5 text-xs text-muted">
                      Catatan: {submission.reviewNote}
                    </p>
                  ) : null}
                </Td>
                <Td align="right" className="tabular">
                  {formatCompact(submission.lastViews)}
                </Td>
                <Td>
                  <Badge tone={submissionStatusTone[submission.status]}>
                    {submissionStatusLabel[submission.status]}
                  </Badge>
                </Td>
              </tr>
            ))
          )}
        </tbody>

        {/* Isi Tabel — Mobile (Baris dengan Grid 2 Kolom) */}
        <tbody className="md:hidden">
          {riwayat.length === 0 ? (
            <TableEmptyRow colSpan={1} title="Belum ada riwayat" />
          ) : (
            riwayat.map((submission, index) => (
              <tr key={`m-${submission.id}`} className="border-b border-line last:border-0">
                <td className="block w-full p-4">
                  {/* Header item */}
                  <div className="flex items-center justify-between gap-2 pb-2.5 border-b border-line">
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="tabular text-xs font-semibold text-muted shrink-0">
                        #{rowNumber(index, page, pageSize)}
                      </span>
                      <h3 className="font-semibold text-sm truncate text-foreground">
                        {submission.creator.name}
                      </h3>
                    </div>
                    <Badge tone={submissionStatusTone[submission.status]}>
                      {submissionStatusLabel[submission.status]}
                    </Badge>
                  </div>

                  {/* Grid data 2 kolom */}
                  <div className="grid grid-cols-2 gap-3 py-3 text-xs">
                    <div>
                      <span className="text-[11px] font-medium text-muted uppercase tracking-wider block">
                        Campaign & Vendor
                      </span>
                      <span className="font-medium text-foreground mt-0.5 block truncate">
                        {submission.campaign.title}
                      </span>
                      <p className="text-muted text-xs mt-0.5 truncate">
                        {submission.campaign.vendor.vendorProfile?.businessName ?? "—"}
                      </p>
                    </div>
                    <div>
                      <span className="text-[11px] font-medium text-muted uppercase tracking-wider block">
                        Views Tercatat
                      </span>
                      <span className="font-semibold text-foreground mt-0.5 block tabular">
                        {formatCompact(submission.lastViews)} Views
                      </span>
                    </div>
                    {submission.reviewNote ? (
                      <div className="col-span-2 pt-1 border-t border-line">
                        <span className="text-[11px] font-medium text-muted block">Catatan Review:</span>
                        <p className="text-foreground mt-0.5">{submission.reviewNote}</p>
                      </div>
                    ) : null}
                  </div>
                </td>
              </tr>
            ))
          )}
        </tbody>
      </DataTable>
      ) : (
      <div className="space-y-6">
        <Card>
          <div className="mb-4">
            <h2 className="font-display text-lg font-semibold">
              Menunggu approval
            </h2>
            <p className="mt-1 text-sm text-muted">
              Video sudah capai minimum penarikan campaign-nya. Cek video dan
              brief sebelum menyetujui.
            </p>
          </div>
          {withdrawalMenunggu.length === 0 ? (
            <EmptyState
              title="Tidak ada permintaan menunggu"
              description="Semua permintaan penarikan sudah diputuskan."
            />
          ) : (
            <Table>
              {/* Tabel — desktop */}
              <thead className="hidden md:table-header-group">
                <tr>
                  <Th>Creator</Th>
                  <Th>Campaign</Th>
                  <Th align="right">Views</Th>
                  <Th align="right">Diajukan</Th>
                  <Th>Aksi</Th>
                </tr>
              </thead>
              <tbody className="hidden md:table-row-group">
                {withdrawalMenunggu.map((w) => (
                  <tr key={w.id}>
                    <Td className="font-medium">{w.creator.name}</Td>
                    <Td>{w.campaign.title}</Td>
                    <Td align="right" className="tabular">
                      {formatCompact(w.viewsCounted)}
                    </Td>
                    <Td align="right" className="tabular font-medium">
                      {formatIDR(w.netAmount)}
                    </Td>
                    <Td>
                      <DetailDrawer
                        label="Review"
                        icon={
                          <IconWallet className="h-4 w-4" strokeWidth={2} />
                        }
                        title={w.creator.name}
                        subtitle={`${w.campaign.title} · diajukan ${formatDateTime(w.requestedAt)}`}
                      >
                        <a href={w.submission.contentUrl} target="_blank" rel="noreferrer" className="block truncate text-sm text-brand">
                          {w.submission.contentUrl}
                        </a>
                        <div className="rounded-xl bg-surface-muted p-3 text-sm mt-3">
                          <div className="flex justify-between"><span className="text-muted">Views dihitung</span><span className="tabular">{formatCompact(w.viewsCounted)}</span></div>
                          <div className="mt-1 flex justify-between"><span className="text-muted">Fee penarikan</span><span className="tabular">{formatIDR(w.feeAmount)}</span></div>
                          <div className="mt-1 flex justify-between font-medium"><span>Diterima creator</span><span className="tabular">{formatIDR(w.netAmount)}</span></div>
                          <div className="mt-2 border-t border-line/60 pt-2 flex justify-between text-xs"><span className="text-muted">Rekening Tujuan</span><span className="font-semibold text-foreground">{w.bankName ?? "—"} {w.bankAccountNumber ?? ""} ({w.bankAccountName ?? "—"})</span></div>
                        </div>
                        <div className="border-t border-line pt-4 mt-4">
                          <DecisionForm action={reviewWithdrawalAction} hiddenField="withdrawalId" hiddenValue={w.id} approveLabel="Setujui" rejectLabel="Tolak" />
                        </div>
                      </DetailDrawer>
                    </Td>
                  </tr>
                ))}
              </tbody>

              {/* Isi Tabel — Mobile (Baris dengan Grid 2 Kolom) */}
              <tbody className="md:hidden">
                {withdrawalMenunggu.map((w, index) => (
                  <tr key={`m-${w.id}`} className="border-b border-line last:border-0">
                    <td className="block w-full p-4">
                      {/* Header item */}
                      <div className="flex items-center justify-between gap-2 pb-2.5 border-b border-line">
                        <div className="flex items-center gap-2 min-w-0">
                          <span className="tabular text-xs font-semibold text-muted shrink-0">
                            #{index + 1}
                          </span>
                          <h3 className="font-semibold text-sm truncate text-foreground">
                            {w.creator.name}
                          </h3>
                        </div>
                        <span className="tabular text-sm font-semibold text-foreground">
                          {formatIDR(w.netAmount)}
                        </span>
                      </div>

                      {/* Grid data 2 kolom */}
                      <div className="grid grid-cols-2 gap-3 py-3 text-xs border-b border-line">
                        <div>
                          <span className="text-[11px] font-medium text-muted uppercase tracking-wider block">
                            Campaign
                          </span>
                          <span className="font-medium text-foreground mt-0.5 block truncate">
                            {w.campaign.title}
                          </span>
                        </div>
                        <div>
                          <span className="text-[11px] font-medium text-muted uppercase tracking-wider block">
                            Views Dihitung
                          </span>
                          <span className="font-medium text-foreground mt-0.5 block tabular">
                            {formatCompact(w.viewsCounted)} Views
                          </span>
                        </div>
                        <div>
                          <span className="text-[11px] font-medium text-muted uppercase tracking-wider block">
                            Diajukan
                          </span>
                          <span className="font-medium text-foreground mt-0.5 block">
                            {formatDateTime(w.requestedAt)}
                          </span>
                        </div>
                        <div>
                          <span className="text-[11px] font-medium text-muted uppercase tracking-wider block">
                            Fee Penarikan
                          </span>
                          <span className="font-medium text-foreground mt-0.5 block tabular">
                            {formatIDR(w.feeAmount)}
                          </span>
                        </div>
                      </div>

                      {/* Footer baris: Aksi */}
                      <div className="flex items-center justify-end pt-2.5">
                        <DetailDrawer
                          label="Review Penarikan"
                          icon={<IconWallet className="h-3.5 w-3.5" strokeWidth={2} />}
                          title={w.creator.name}
                          subtitle={`${w.campaign.title} · diajukan ${formatDateTime(w.requestedAt)}`}
                        >
                          <a href={w.submission.contentUrl} target="_blank" rel="noreferrer" className="block truncate text-sm text-brand">{w.submission.contentUrl}</a>
                          <div className="rounded-xl bg-surface-muted p-3 text-sm mt-3">
                            <div className="flex justify-between"><span className="text-muted">Views dihitung</span><span className="tabular">{formatCompact(w.viewsCounted)}</span></div>
                            <div className="mt-1 flex justify-between"><span className="text-muted">Fee penarikan</span><span className="tabular">{formatIDR(w.feeAmount)}</span></div>
                            <div className="mt-1 flex justify-between font-medium"><span>Diterima creator</span><span className="tabular">{formatIDR(w.netAmount)}</span></div>
                            <div className="mt-2 border-t border-line/60 pt-2 flex justify-between text-xs"><span className="text-muted">Rekening Tujuan</span><span className="font-semibold text-foreground">{w.bankName ?? "—"} {w.bankAccountNumber ?? ""} ({w.bankAccountName ?? "—"})</span></div>
                          </div>
                          <div className="border-t border-line pt-4 mt-4">
                            <DecisionForm action={reviewWithdrawalAction} hiddenField="withdrawalId" hiddenValue={w.id} approveLabel="Setujui" rejectLabel="Tolak" />
                          </div>
                        </DetailDrawer>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </Table>
          )}
        </Card>

        <Card>
          <div className="mb-4">
            <h2 className="font-display text-lg font-semibold">
              Disetujui, menunggu transfer
            </h2>
            <p className="mt-1 text-sm text-muted">
              Transfer manual ke rekening creator, lalu tandai selesai di sini.
            </p>
          </div>
          {withdrawalDisetujui.length === 0 ? (
            <EmptyState
              title="Tidak ada yang menunggu transfer"
              description="Semua penarikan yang disetujui sudah dicairkan."
            />
          ) : (
            <Table>
              {/* Tabel — desktop */}
              <thead className="hidden md:table-header-group">
                <tr>
                  <Th>Creator</Th>
                  <Th>Campaign</Th>
                  <Th align="right">Jumlah</Th>
                  <Th>Aksi</Th>
                </tr>
              </thead>
              <tbody className="hidden md:table-row-group">
                {withdrawalDisetujui.map((w) => (
                  <tr key={w.id}>
                    <Td className="font-medium">
                      {w.creator.name}
                      <p className="text-xs text-muted font-normal mt-0.5">
                        {w.bankName ?? "—"} {w.bankAccountNumber ?? ""} ({w.bankAccountName ?? "—"})
                      </p>
                    </Td>
                    <Td>{w.campaign.title}</Td>
                    <Td align="right" className="tabular font-medium">
                      {formatIDR(w.netAmount)}
                    </Td>
                    <Td>
                      <SimpleActionForm
                        action={markWithdrawalPaidAction}
                        hiddenField="withdrawalId"
                        hiddenValue={w.id}
                        label="Tandai sudah ditransfer"
                        size="sm"
                      />
                    </Td>
                  </tr>
                ))}
              </tbody>

              {/* Isi Tabel — Mobile (Baris dengan Grid 2 Kolom) */}
              <tbody className="md:hidden">
                {withdrawalDisetujui.map((w, index) => (
                  <tr key={`m-${w.id}`} className="border-b border-line last:border-0">
                    <td className="block w-full p-4">
                      {/* Header item */}
                      <div className="flex items-center justify-between gap-2 pb-2.5 border-b border-line">
                        <div className="flex items-center gap-2 min-w-0">
                          <span className="tabular text-xs font-semibold text-muted shrink-0">
                            #{index + 1}
                          </span>
                          <h3 className="font-semibold text-sm truncate text-foreground">
                            {w.creator.name}
                          </h3>
                        </div>
                        <span className="tabular text-sm font-semibold text-foreground">
                          {formatIDR(w.netAmount)}
                        </span>
                      </div>

                      {/* Grid data 2 kolom */}
                      <div className="grid grid-cols-2 gap-3 py-3 text-xs border-b border-line">
                        <div>
                          <span className="text-[11px] font-medium text-muted uppercase tracking-wider block">
                            Campaign
                          </span>
                          <span className="font-medium text-foreground mt-0.5 block truncate">
                            {w.campaign.title}
                          </span>
                        </div>
                        <div>
                          <span className="text-[11px] font-medium text-muted uppercase tracking-wider block">
                            Status
                          </span>
                          <span className="font-medium text-warning mt-0.5 block">
                            Menunggu Transfer
                          </span>
                        </div>
                      </div>

                      {/* Footer baris: Aksi */}
                      <div className="flex items-center justify-end pt-2.5">
                        <SimpleActionForm
                          action={markWithdrawalPaidAction}
                          hiddenField="withdrawalId"
                          hiddenValue={w.id}
                          label="Tandai ditransfer"
                          size="sm"
                        />
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </Table>
          )}
        </Card>
      </div>
      )}
    </div>
  );
}
