import { requireRole } from "@/lib/auth";
import { db } from "@/lib/db";
import { formatCompact, formatDate, formatDateTime } from "@/lib/format";
import {
  Badge,
  BarChart,
  Callout,
  DataTable,
  DetailDrawer,
  IconExternal,
  IconShieldCheck,
  PageHeader,
  PageSizeSelect,
  Pagination,
  TableEmptyRow,
  TableToolbar,
  Td,
  Th,
  paginationArgs,
  resolvePageSize,
  rowNumber,
} from "@/components/ui";
import type { BadgeTone } from "@/lib/labels";
import type { FraudFlagStatus, FraudFlagType } from "@/generated/prisma/enums";
import { fraudFlagLabel } from "@/lib/labels";
import { resolveFlagAction } from "../actions";
import { DecisionForm } from "../decision-form";
import { NotWiredButton } from "../not-wired";

const PAGE_SIZE = 10;
const BASE = "/admin/fraud";

const tingkatLabel: Record<number, string> = {
  1: "Rendah",
  2: "Sedang",
  3: "Tinggi",
};
const tingkatTone: Record<number, BadgeTone> = {
  1: "info",
  2: "warning",
  3: "danger",
};

export default async function AdminFraudPage({
  searchParams,
}: {
  searchParams: Promise<{
    q?: string;
    status?: string;
    jenis?: string;
    tingkat?: string;
    sumber?: string;
    page?: string;
    ukuran?: string;
  }>;
}) {
  await requireRole("ADMIN");
  const params = await searchParams;
  const page = Math.max(1, Number(params.page) || 1);
  const pageSize = resolvePageSize(params.ukuran, PAGE_SIZE);
  const status = params.status ?? "terbuka";

  const where = {
    ...(status === "terbuka"
      ? { status: { in: ["OPEN", "REVIEWING"] as FraudFlagStatus[] } }
      : status === "selesai"
        ? { status: { in: ["CONFIRMED", "DISMISSED"] as FraudFlagStatus[] } }
        : {}),
    ...(params.jenis ? { type: params.jenis as FraudFlagType } : {}),
    ...(params.tingkat ? { severity: Number(params.tingkat) } : {}),
    // Flag tanpa pelapor berarti dihasilkan otomatis oleh sistem.
    ...(params.sumber === "sistem" ? { reportedById: null } : {}),
    ...(params.sumber === "manual" ? { reportedById: { not: null } } : {}),
    ...(params.q
      ? {
          OR: [
            {
              flaggedUser: {
                is: {
                  name: { contains: params.q, mode: "insensitive" as const },
                },
              },
            },
            {
              submission: {
                is: {
                  campaign: {
                    is: {
                      title: {
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

  const [flags, total, terbuka, tinggi, akunGanda] = await Promise.all([
    db.fraudFlag.findMany({
      where,
      include: {
        submission: {
          include: {
            campaign: { select: { title: true } },
            viewSnapshots: { orderBy: { capturedAt: "asc" }, take: 12 },
          },
        },
        flaggedUser: { include: { creatorProfile: true } },
        reportedBy: { select: { name: true, role: true } },
      },
      orderBy: [{ severity: "desc" }, { createdAt: "asc" }],
      ...paginationArgs(page, pageSize),
    }),
    db.fraudFlag.count({ where }),
    db.fraudFlag.count({ where: { status: { in: ["OPEN", "REVIEWING"] } } }),
    db.fraudFlag.count({
      where: { status: { in: ["OPEN", "REVIEWING"] }, severity: 3 },
    }),
    // Indikasi akun ganda sederhana: satu nomor HP dipakai lebih dari satu user.
    db.user.groupBy({
      by: ["phone"],
      _count: { _all: true },
      where: { role: "CREATOR", phone: { not: null } },
      having: { phone: { _count: { gt: 1 } } },
    }),
  ]);

  return (
    <div>
      <PageHeader
        title="Monitor fraud"
        description="Flag otomatis dari sistem dan laporan manual dari vendor, diurutkan dari tingkat keparahan tertinggi."
      />

      {akunGanda.length > 0 ? (
        <div className="mb-6">
          <Callout tone="warning" title="Indikasi akun ganda">
            {akunGanda.length} nomor HP terdaftar di lebih dari satu akun
            creator. Periksa sebelum payout dicairkan.
          </Callout>
        </div>
      ) : null}

      <DataTable
        title="Monitor Fraud"
        summary={`${terbuka} terbuka · ${tinggi} tingkat tinggi`}
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
                name: "status",
                label: "Status",
                options: [
                  { value: "terbuka", label: "Terbuka" },
                  { value: "selesai", label: "Sudah ditangani" },
                  { value: "semua", label: "Semua status" },
                ],
              },
              {
                name: "jenis",
                label: "Jenis",
                options: [
                  { value: "", label: "Semua jenis" },
                  ...Object.entries(fraudFlagLabel).map(([value, label]) => ({
                    value,
                    label,
                  })),
                ],
              },
              {
                name: "tingkat",
                label: "Tingkat",
                options: [
                  { value: "", label: "Semua tingkat" },
                  { value: "3", label: "Tinggi" },
                  { value: "2", label: "Sedang" },
                  { value: "1", label: "Rendah" },
                ],
              },
              {
                name: "sumber",
                label: "Sumber",
                options: [
                  { value: "", label: "Semua sumber" },
                  { value: "sistem", label: "Sistem" },
                  { value: "manual", label: "Laporan orang" },
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
        <thead>
          <tr>
            <Th>No</Th>
            <Th>Tingkat</Th>
            <Th>Jenis</Th>
            <Th>Terlapor</Th>
            <Th>Campaign</Th>
            <Th>Detail</Th>
            <Th>Sumber</Th>
            <Th>Dibuat</Th>
            <Th>Aksi</Th>
          </tr>
        </thead>
        <tbody>
          {flags.length === 0 ? (
            <TableEmptyRow
              colSpan={9}
              title="Tidak ada laporan terbuka"
              description="Sistem menandai otomatis kalau views turun tidak wajar."
            />
          ) : (
            flags.map((flag, index) => {
              const belumDitangani =
                flag.status === "OPEN" || flag.status === "REVIEWING";
              const snapshots = flag.submission?.viewSnapshots ?? [];

              return (
                <tr key={flag.id}>
                  <Td className="tabular text-muted">
                    {rowNumber(index, page, pageSize)}
                  </Td>
                  <Td>
                    <Badge tone={tingkatTone[flag.severity] ?? "neutral"} icon>
                      {tingkatLabel[flag.severity] ?? "—"}
                    </Badge>
                  </Td>
                  <Td className="font-medium">{fraudFlagLabel[flag.type]}</Td>
                  <Td>{flag.flaggedUser?.name ?? "—"}</Td>
                  <Td>{flag.submission?.campaign.title ?? "—"}</Td>
                  <Td className="max-w-[18rem] truncate text-muted">
                    {flag.detail}
                  </Td>
                  <Td>{flag.reportedBy ? flag.reportedBy.name : "Sistem"}</Td>
                  <Td className="whitespace-nowrap text-muted">
                    {formatDateTime(flag.createdAt)}
                  </Td>
                  <Td>
                    <DetailDrawer
                      label={
                        belumDitangani ? "Tangani fraud flag" : "Lihat detail"
                      }
                      title={`${fraudFlagLabel[flag.type]} — tingkat ${tingkatLabel[flag.severity] ?? "—"}`}
                      subtitle={`${flag.flaggedUser?.name ?? "—"} · ${flag.submission?.campaign.title ?? "tanpa campaign"} · ${flag.reportedBy ? `dilaporkan ${flag.reportedBy.name}` : "flag sistem"} ${formatDate(flag.createdAt)}`}
                      icon={<IconShieldCheck className="h-4 w-4" strokeWidth={2} />}
                    >
                      <p className="rounded-xl bg-surface-muted px-3 py-2.5 text-sm">
                        {flag.detail}
                      </p>

                      {snapshots.length > 1 ? (
                        <div>
                          <p className="mb-2 text-sm font-semibold">
                            Grafik views
                          </p>
                          <BarChart
                            data={snapshots.map((snapshot, i) => ({
                              label: formatDate(snapshot.capturedAt),
                              value: snapshot.views,
                              // Titik yang lebih rendah dari sebelumnya
                              // dimerahkan — di sanalah anomalinya terlihat.
                              danger:
                                i > 0 &&
                                snapshot.views < snapshots[i - 1].views,
                            }))}
                            formatValue={formatCompact}
                          />
                        </div>
                      ) : null}

                      <dl className="space-y-3 text-sm">
                        <div>
                          <dt className="text-xs font-medium text-muted">
                            Views tercatat
                          </dt>
                          <dd className="tabular mt-0.5">
                            {flag.submission
                              ? formatCompact(flag.submission.lastViews)
                              : "—"}
                          </dd>
                        </div>
                        <div>
                          <dt className="text-xs font-medium text-muted">
                            Trust creator
                          </dt>
                          <dd className="mt-0.5">
                            {flag.flaggedUser?.creatorProfile
                              ? `${flag.flaggedUser.creatorProfile.trustScore}/100`
                              : "—"}
                          </dd>
                        </div>
                      </dl>

                      {flag.submission ? (
                        <a
                          href={flag.submission.contentUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="flex items-center gap-2 rounded-xl bg-surface-muted px-3 py-2.5 text-sm text-brand-600"
                        >
                          <IconExternal className="h-4 w-4 shrink-0" />
                          <span className="truncate">
                            {flag.submission.contentUrl}
                          </span>
                        </a>
                      ) : null}

                      {belumDitangani ? (
                        <div className="space-y-3 border-t border-line pt-4">
                          <DecisionForm
                            action={resolveFlagAction}
                            hiddenField="flagId"
                            hiddenValue={flag.id}
                            approveValue="dismiss"
                            rejectValue="confirm"
                            approveLabel="Tolak flag"
                            rejectLabel="Konfirmasi kecurangan"
                            noteLabel="Catatan resolusi"
                            noteHint="Trust score creator turun 15 poin dan payout yang belum cair ditahan."
                            requireNoteOnApprove
                          />
                          <NotWiredButton
                            label="Tahan payout tanpa memutus"
                            variant="secondary"
                          />
                        </div>
                      ) : flag.resolutionNote ? (
                        <div className="rounded-xl bg-surface-muted px-3 py-2.5 text-sm">
                          <p className="font-medium">Catatan resolusi</p>
                          <p className="mt-0.5 text-muted">
                            {flag.resolutionNote}
                          </p>
                        </div>
                      ) : null}
                    </DetailDrawer>
                  </Td>
                </tr>
              );
            })
          )}
        </tbody>
      </DataTable>
    </div>
  );
}
