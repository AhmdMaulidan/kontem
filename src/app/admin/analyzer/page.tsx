import Link from "next/link";
import { requireRole } from "@/lib/auth";
import { db } from "@/lib/db";
import { formatDate } from "@/lib/format";
import {
  Badge,
  DataTable,
  PageHeader,
  Pagination,
  TableEmptyRow,
  Td,
  Th,
  paginationArgs,
  resolvePageSize,
  rowNumber,
} from "@/components/ui";
import {
  analysisStatusLabel,
  analysisStatusTone,
  analysisVerdictLabel,
  analysisVerdictTone,
} from "@/lib/labels";
import { AnalyzeForm } from "./analyze-form";

const PAGE_SIZE = 10;
const BASE = "/admin/analyzer";

export default async function AdminAnalyzerPage({
  searchParams,
}: {
  searchParams: Promise<{
    page?: string;
    ukuran?: string;
    url?: string;
    campaignId?: string;
  }>;
}) {
  await requireRole("ADMIN");
  const params = await searchParams;
  const page = Math.max(1, Number(params.page) || 1);
  const pageSize = resolvePageSize(params.ukuran, PAGE_SIZE);

  const initialUrl = params.url ?? "";
  const initialCampaignId = params.campaignId ?? "";

  // Hanya campaign yang sudah punya brief yang boleh dianalisis.
  const campaigns = await db.campaign.findMany({
    where: { NOT: { brief: "" } },
    select: { id: true, title: true },
    orderBy: { createdAt: "desc" },
    take: 200,
  });

  const [analyses, total] = await Promise.all([
    db.videoAnalysis.findMany({
      include: { campaign: { select: { title: true } } },
      orderBy: { createdAt: "desc" },
      ...paginationArgs(page, pageSize),
    }),
    db.videoAnalysis.count(),
  ]);

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Automated Analyzer"
        description="Engine compliance menilai video terhadap brief campaign secara otomatis dan memberi verdict: diterima, ditolak, atau perlu verifikasi manual."
      />

      <AnalyzeForm
        campaigns={campaigns}
        initialUrl={initialUrl}
        initialCampaignId={initialCampaignId}
      />

      <DataTable
        title="Daftar Analisis"
        summary={`${total} analisis`}
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
          <tr className="border-b border-line text-left text-xs font-semibold text-muted uppercase">
            <Th>No</Th>
            <Th>Tanggal</Th>
            <Th>URL</Th>
            <Th>Campaign</Th>
            <Th>Verdict</Th>
            <Th>Skor</Th>
            <Th>Status</Th>
            <Th>Keputusan Admin</Th>
            <Th>Aksi</Th>
          </tr>
        </thead>
        <tbody>
          {analyses.length === 0 ? (
            <TableEmptyRow
              colSpan={9}
              title="Belum ada analisis"
              description="Tempel URL video di form di atas untuk menjalankan analisis pertama."
            />
          ) : (
            analyses.map((a, i) => (
              <tr
                key={a.id}
                className="border-b border-line/60 transition-colors hover:bg-surface-muted"
              >
                <Td>{rowNumber(i, page, pageSize)}</Td>
                <Td className="whitespace-nowrap">{formatDate(a.createdAt)}</Td>
                <Td className="max-w-[16rem]">
                  <Link
                    href={`/admin/analyses/${a.id}`}
                    className="block truncate text-brand-600 hover:underline"
                    title={a.sourceUrl}
                  >
                    {a.sourceUrl}
                  </Link>
                </Td>
                <Td>{a.campaign?.title ?? "—"}</Td>
                <Td>
                  {a.status === "FAILED" ? (
                    <Badge tone="neutral">GAGAL</Badge>
                  ) : a.verdict ? (
                    <Badge tone={analysisVerdictTone[a.verdict]}>
                      {analysisVerdictLabel[a.verdict]}
                    </Badge>
                  ) : (
                    <Badge tone={analysisStatusTone.PROCESSING}>
                      {analysisStatusLabel.PROCESSING}...
                    </Badge>
                  )}
                </Td>
                <Td>
                  {typeof a.score === "number" ? a.score.toFixed(1) : "—"}
                </Td>
                <Td>
                  <Badge tone={analysisStatusTone[a.status]}>
                    {analysisStatusLabel[a.status]}
                  </Badge>
                </Td>
                <Td>
                  {a.humanDecision ? (
                    <Badge tone={analysisVerdictTone[a.humanDecision]}>
                      {analysisVerdictLabel[a.humanDecision]}
                    </Badge>
                  ) : (
                    "—"
                  )}
                </Td>
                <Td>
                  <Link
                    href={`/admin/analyses/${a.id}`}
                    className="text-sm font-semibold text-brand-600 hover:underline"
                  >
                    Detail
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
