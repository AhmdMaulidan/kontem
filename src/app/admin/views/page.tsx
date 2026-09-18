import { requireRole } from "@/lib/auth";
import { db } from "@/lib/db";
import { formatCompact, formatDateTime } from "@/lib/format";
import {
  Callout,
  DataTable,
  IconExternal,
  PageHeader,
  PageSizeSelect,
  Pagination,
  TableCaptionRow,
  TableEmptyRow,
  TableToolbar,
  Td,
  Th,
  paginationArgs,
  resolvePageSize,
  rowNumber,
} from "@/components/ui";
import type {
  CampaignStatus,
  SocialPlatform,
  SubmissionStatus,
} from "@/generated/prisma/enums";
import { platformLabel } from "@/lib/labels";
import { isWithinCooldown } from "@/domain/views";
import { ViewsMobileActions, ViewsRowCells } from "./views-form";

const PAGE_SIZE = 15;
const BASE = "/admin/views";

export default async function AdminViewsPage({
  searchParams,
}: {
  searchParams: Promise<{
    q?: string;
    campaign?: string;
    platform?: string;
    page?: string;
    ukuran?: string;
  }>;
}) {
  await requireRole("ADMIN");
  const params = await searchParams;
  const page = Math.max(1, Number(params.page) || 1);
  const pageSize = resolvePageSize(params.ukuran, PAGE_SIZE);

  // Hanya konten dari campaign yang masih dalam masa pelacakan yang perlu
  // diperbarui; campaign yang sudah settle memakai finalViews yang terkunci.
  const where = {
    status: {
      in: ["APPROVED", "PENDING_REVIEW"] as SubmissionStatus[],
    },
    campaign: {
      is: {
        status: { in: ["ACTIVE", "ENDED", "SETTLING"] as CampaignStatus[] },
        ...(params.campaign ? { id: params.campaign } : {}),
      },
    },
    ...(params.platform ? { platform: params.platform as SocialPlatform } : {}),
    ...(params.q
      ? {
          OR: [
            {
              creator: {
                is: {
                  name: { contains: params.q, mode: "insensitive" as const },
                },
              },
            },
            {
              campaign: {
                is: {
                  title: { contains: params.q, mode: "insensitive" as const },
                },
              },
            },
          ],
        }
      : {}),
  };

  const [submissions, total, campaignAktif, terakhirSinkron] =
    await Promise.all([
      db.submission.findMany({
        where,
        include: {
          campaign: { select: { id: true, title: true } },
          creator: { select: { name: true } },
        },
        // Yang paling lama tidak disinkronkan naik ke atas: itulah angka yang
        // paling mungkin sudah basi saat payout dihitung.
        orderBy: [{ lastSyncedAt: "asc" }, { submittedAt: "asc" }],
        ...paginationArgs(page, pageSize),
      }),
      db.submission.count({ where }),
      db.campaign.findMany({
        where: { status: { in: ["ACTIVE", "ENDED", "SETTLING"] } },
        select: { id: true, title: true },
        orderBy: { title: "asc" },
      }),
      db.submission.findFirst({
        where: { lastSyncedAt: { not: null } },
        orderBy: { lastSyncedAt: "desc" },
        select: { lastSyncedAt: true },
      }),
    ]);

  return (
    <div>
      <PageHeader
        title="Update views"
        description="Sinkronisasi angka views konten selama masa pelacakan campaign."
      />

      <div className="mb-6">
        <Callout tone="info" title="Sinkronisasi & Audit Views">
          Gunakan tombol <strong>Tarik</strong> pada kolom aksi untuk memperbarui metrik views otomatis langsung dari platform media sosial (TikTok, Instagram, YouTube). Tombol <strong>Edit</strong> dapat digunakan oleh admin untuk koreksi angka manual atau penyesuaian jika diperlukan.
        </Callout>
      </div>

      <DataTable
        title="Update Views Submission"
        summary={
          terakhirSinkron?.lastSyncedAt
            ? `Terakhir disinkronkan ${formatDateTime(terakhirSinkron.lastSyncedAt)}`
            : "Belum pernah disinkronkan"
        }
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
                  ...campaignAktif.map((campaign) => ({
                    value: campaign.id,
                    label: campaign.title,
                  })),
                ],
              },
              {
                name: "platform",
                label: "Platform",
                options: [
                  { value: "", label: "Semua platform" },
                  ...Object.entries(platformLabel).map(([value, label]) => ({
                    value,
                    label,
                  })),
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
        <thead className="hidden md:table-header-group">
          <tr>
            <Th>No</Th>
            <Th>Creator</Th>
            <Th>Campaign</Th>
            <Th>Platform</Th>
            <Th align="right">Views Tercatat</Th>
            <Th>Terakhir</Th>
            <Th align="right">Aksi</Th>
          </tr>
        </thead>

        {/* Tampilan Desktop */}
        <tbody className="hidden md:table-row-group">
          {submissions.length === 0 ? (
            <TableEmptyRow
              colSpan={7}
              title="Tidak ada konten yang perlu disinkronkan"
              description="Semua submission dalam pelacakan sudah diperbarui."
            />
          ) : (
            submissions.map((submission, index) => (
              <tr key={submission.id}>
                <Td className="tabular text-muted">
                  {rowNumber(index, page, pageSize)}
                </Td>
                <Td className="font-medium">{submission.creator.name}</Td>
                <Td>{submission.campaign.title}</Td>
                <Td>{platformLabel[submission.platform]}</Td>
                <Td align="right">{formatCompact(submission.lastViews)}</Td>
                <Td className="whitespace-nowrap text-xs text-muted">
                  {submission.lastSyncedAt ? (
                    <div className="flex items-center gap-1.5">
                      <span>{formatDateTime(submission.lastSyncedAt)}</span>
                      {isWithinCooldown(submission.lastSyncedAt) ? (
                        <span className="rounded bg-warning/15 px-1.5 py-0.5 text-[10px] font-medium text-warning">
                          Cooldown
                        </span>
                      ) : null}
                    </div>
                  ) : (
                    "Belum pernah"
                  )}
                </Td>
                <ViewsRowCells
                  submissionId={submission.id}
                  contentUrl={submission.contentUrl}
                  currentViews={submission.lastViews}
                  currentLikes={submission.lastLikes}
                  currentComments={submission.lastComments}
                  lastSyncedAt={submission.lastSyncedAt}
                />
              </tr>
            ))
          )}
        </tbody>

        {/* Tampilan Mobile */}
        <tbody className="md:hidden">
          {submissions.length === 0 ? (
            <TableEmptyRow
              colSpan={7}
              title="Tidak ada konten yang perlu disinkronkan"
              description="Semua submission dalam pelacakan sudah diperbarui."
            />
          ) : (
            submissions.map((submission, index) => (
              <tr key={`mobile-${submission.id}`} className="border-b border-line last:border-b-0">
                <td colSpan={7} className="p-4">
                  {/* Header: No, Creator, Platform Badge & Link Eksternal */}
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="tabular text-xs font-semibold text-muted">
                          #{rowNumber(index, page, pageSize)}
                        </span>
                        <span className="font-medium text-foreground">
                          {submission.creator.name}
                        </span>
                      </div>
                      <p className="mt-0.5 text-xs text-muted">
                        Campaign: <span className="font-medium text-foreground">{submission.campaign.title}</span>
                      </p>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <span className="rounded-full bg-surface-muted border border-line px-2 py-0.5 text-[11px] font-medium text-foreground">
                        {platformLabel[submission.platform]}
                      </span>
                      <a
                        href={submission.contentUrl}
                        target="_blank"
                        rel="noreferrer"
                        title="Buka konten di tab baru"
                        className="text-brand-600 transition-colors hover:text-brand-700"
                      >
                        <IconExternal className="h-4 w-4" strokeWidth={2} />
                      </a>
                    </div>
                  </div>

                  {/* Grid Data 2 Kolom */}
                  <div className="mt-3 grid grid-cols-2 gap-3 border-y border-line py-3 text-xs">
                    <div>
                      <p className="text-muted">Views Tercatat</p>
                      <p className="tabular mt-0.5 text-sm font-semibold text-foreground">
                        {formatCompact(submission.lastViews)}
                      </p>
                    </div>
                    <div>
                      <p className="text-muted">Terakhir Sinkron</p>
                      <div className="mt-0.5">
                        {submission.lastSyncedAt ? (
                          <div className="flex flex-wrap items-center gap-1.5">
                            <span className="tabular text-foreground">
                              {formatDateTime(submission.lastSyncedAt)}
                            </span>
                            {isWithinCooldown(submission.lastSyncedAt) ? (
                              <span className="rounded bg-warning/15 px-1.5 py-0.5 text-[10px] font-medium text-warning">
                                Cooldown
                              </span>
                            ) : null}
                          </div>
                        ) : (
                          <span className="text-muted">Belum pernah</span>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Aksi Mobile */}
                  <div className="mt-3 flex items-center justify-between gap-2">
                    <span className="text-[11px] text-muted">Aksi Sinkronisasi</span>
                    <ViewsMobileActions
                      submissionId={submission.id}
                      currentViews={submission.lastViews}
                      currentLikes={submission.lastLikes}
                      currentComments={submission.lastComments}
                      lastSyncedAt={submission.lastSyncedAt}
                    />
                  </div>
                </td>
              </tr>
            ))
          )}
        </tbody>

        {submissions.length > 0 ? (
          <tfoot>
            <TableCaptionRow colSpan={7} tone="danger">
              Views media sosial asli tidak pernah berkurang — kalau angkanya
              turun dari sebelumnya, cek dulu sebelum menyimpan.
            </TableCaptionRow>
          </tfoot>
        ) : null}
      </DataTable>
    </div>
  );
}
