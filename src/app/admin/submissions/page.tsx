import Link from "next/link";
import { requireRole } from "@/lib/auth";
import { db } from "@/lib/db";
import { formatCompact, formatDateTime } from "@/lib/format";
import {
  Badge,
  Callout,
  DataTable,
  DetailDrawer,
  IconShieldCheck,
  PageHeader,
  PageSizeSelect,
  Pagination,
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
import { reviewSubmissionAction } from "../actions";
import { DecisionForm } from "../decision-form";
import { FlagForm } from "./review-form";

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
  const tab = params.tab === "riwayat" ? "riwayat" : "antrean";
  const page = Math.max(1, Number(params.page) || 1);
  const pageSize = resolvePageSize(params.ukuran, PAGE_SIZE);

  const [antreanCount, antrean, riwayat, riwayatTotal] = await Promise.all([
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
      </div>

      {tab === "antrean" ? (
      <div className="mb-6">
        <DataTable
          title="Antrean review"
          summary={`${antreanCount} menunggu, diurutkan dari yang paling lama`}
          action={
            <PageSizeSelect basePath={BASE} params={params} pageSize={pageSize} />
          }
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
          <thead>
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
          <tbody>
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
                        <div className="mt-3">
                          <FlagForm submissionId={submission.id} />
                        </div>
                      </div>
                    </DetailDrawer>
                  </Td>
                </tr>
              ))
            )}
          </tbody>
        </DataTable>
      </div>
      ) : (
      <DataTable
        title="Riwayat keputusan"
        action={
          <PageSizeSelect basePath={BASE} params={params} pageSize={pageSize} />
        }
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
        <thead>
          <tr>
            <Th>No</Th>
            <Th>Creator</Th>
            <Th>Campaign</Th>
            <Th align="right">Views</Th>
            <Th>Status</Th>
          </tr>
        </thead>
        <tbody>
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
      </DataTable>
      )}
    </div>
  );
}
