import Link from "next/link";
import { requireRole } from "@/lib/auth";
import { db } from "@/lib/db";
import { formatDate } from "@/lib/format";
import {
  Badge,
  DataTable,
  IconExternal,
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
import type { DisputeStatus } from "@/generated/prisma/enums";
import { disputeStatusLabel } from "@/lib/labels";

const PAGE_SIZE = 10;
const BASE = "/admin/disputes";

const statusTone: Record<DisputeStatus, BadgeTone> = {
  OPEN: "warning",
  UNDER_REVIEW: "info",
  RESOLVED_UPHELD: "danger",
  RESOLVED_OVERTURNED: "success",
  WITHDRAWN: "neutral",
};

const umurHari = (sejak: Date) =>
  Math.max(
    0,
    Math.floor((Date.now() - sejak.getTime()) / (1000 * 60 * 60 * 24)),
  );

export default async function AdminDisputesPage({
  searchParams,
}: {
  searchParams: Promise<{
    q?: string;
    status?: string;
    campaign?: string;
    urut?: string;
    page?: string;
    ukuran?: string;
  }>;
}) {
  await requireRole("ADMIN");
  const params = await searchParams;
  const page = Math.max(1, Number(params.page) || 1);
  const pageSize = resolvePageSize(params.ukuran, PAGE_SIZE);
  const status = params.status ?? "terbuka";

  const statusFilter =
    status === "terbuka"
      ? { in: ["OPEN", "UNDER_REVIEW"] as DisputeStatus[] }
      : status === "selesai"
        ? {
            in: ["RESOLVED_UPHELD", "RESOLVED_OVERTURNED"] as DisputeStatus[],
          }
        : undefined;

  const submissionFilter = {
    ...(params.campaign ? { campaignId: params.campaign } : {}),
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

  const where = {
    ...(statusFilter ? { status: statusFilter } : {}),
    ...(Object.keys(submissionFilter).length > 0
      ? { submission: { is: submissionFilter } }
      : {}),
  };

  const [disputes, total, terbuka, dalamReview, campaignBersengketa] =
    await Promise.all([
      db.dispute.findMany({
        where,
        include: {
          submission: {
            include: {
              campaign: {
                include: { vendor: { include: { vendorProfile: true } } },
              },
              creator: { select: { name: true } },
            },
          },
        },
        // Yang terlama naik ke atas: sengketa menahan dana creator, jadi umur
        // antrean lebih penting daripada urutan masuk terbaru.
        orderBy: { createdAt: params.urut === "baru" ? "desc" : "asc" },
        ...paginationArgs(page, pageSize),
      }),
      db.dispute.count({ where }),
      db.dispute.count({ where: { status: "OPEN" } }),
      db.dispute.count({ where: { status: "UNDER_REVIEW" } }),
      db.campaign.findMany({
        where: { submissions: { some: { disputes: { some: {} } } } },
        select: { id: true, title: true },
        orderBy: { title: "asc" },
      }),
    ]);

  return (
    <div>
      <PageHeader
        title="Resolusi sengketa"
        description="Penengah saat creator menilai penolakan vendor tidak berdasar. Dana untuk submission yang disengketakan tertahan sampai keputusan keluar."
      />

      <DataTable
        title="Sengketa Submission"
        summary={`${terbuka} terbuka · ${dalamReview} dalam review`}
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
                  { value: "selesai", label: "Sudah diputus" },
                  { value: "semua", label: "Semua status" },
                ],
              },
              {
                name: "campaign",
                label: "Campaign",
                options: [
                  { value: "", label: "Semua campaign" },
                  ...campaignBersengketa.map((campaign) => ({
                    value: campaign.id,
                    label: campaign.title,
                  })),
                ],
              },
              {
                name: "urut",
                label: "Urutkan",
                options: [
                  { value: "", label: "Terlama" },
                  { value: "baru", label: "Terbaru" },
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
            <Th>Creator</Th>
            <Th>Campaign</Th>
            <Th>Vendor</Th>
            <Th>Alasan Tolak Vendor</Th>
            <Th>Dibuka</Th>
            <Th align="right">Umur</Th>
            <Th>Status</Th>
            <Th>Aksi</Th>
          </tr>
        </thead>
        <tbody>
          {disputes.length === 0 ? (
            <TableEmptyRow
              colSpan={9}
              title="Tidak ada sengketa terbuka"
              description="Sengketa muncul ketika creator mengajukan banding atas penolakan vendor."
            />
          ) : (
            disputes.map((dispute, index) => (
              <tr key={dispute.id}>
                <Td className="tabular text-muted">
                  {rowNumber(index, page, pageSize)}
                </Td>
                <Td className="font-medium">
                  {dispute.submission.creator.name}
                </Td>
                <Td>{dispute.submission.campaign.title}</Td>
                <Td>
                  {dispute.submission.campaign.vendor.vendorProfile
                    ?.businessName ?? "—"}
                </Td>
                <Td className="max-w-[16rem] truncate text-muted">
                  {dispute.submission.reviewNote ?? "—"}
                </Td>
                <Td className="whitespace-nowrap text-muted">
                  {formatDate(dispute.createdAt)}
                </Td>
                <Td align="right">{umurHari(dispute.createdAt)} hari</Td>
                <Td>
                  <Badge tone={statusTone[dispute.status]} icon>
                    {disputeStatusLabel[dispute.status]}
                  </Badge>
                </Td>
                <Td>
                  <Link
                    href={`/admin/disputes/${dispute.id}`}
                    title="Lihat detail dan putuskan"
                    className="text-brand-600 transition-colors hover:text-brand-700"
                  >
                    <IconExternal className="h-4 w-4" strokeWidth={2} />
                  </Link>
                </Td>
              </tr>
            ))
          )}
        </tbody>
      </DataTable>
    </div>
  );
}
