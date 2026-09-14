import Link from "next/link";
import { requireRole } from "@/lib/auth";
import { db } from "@/lib/db";
import { PageHeader, Badge, Card, CardHeader, EmptyState, Table, Td, Th } from "@/components/ui";
import { formatDateTime } from "@/lib/format";

type ResultRow = {
  rule_id: string;
  label: string;
  type: string;
  passed: boolean;
  value: unknown;
  detail: string;
  weight: number;
};

export default async function AdminAnalysisReportPage({
  params,
}: {
  params: Promise<{ analysisId: string }>;
}) {
  await requireRole("ADMIN");
  const { analysisId } = await params;

  const a = await db.videoAnalysis.findUnique({ where: { id: analysisId } });
  if (!a) return <EmptyState title="Laporan tidak ditemukan" />;

  const results = (Array.isArray(a.results) ? a.results : []) as ResultRow[];

  return (
    <div>
      <Link href="/admin/analyzer" className="text-sm text-brand hover:underline">
        ← Kembali ke Analyzer
      </Link>
      <PageHeader
        title="Laporan analisis"
        description={a.sourceUrl}
      />

      <div className="mb-6 grid gap-4 sm:grid-cols-4">
        <Card>
          <CardHeader title="Skor" />
          <p className={`p-4 text-3xl font-bold ${a.compliant ? "text-success" : "text-danger"}`}>
            {a.score === null ? "—" : Math.round(a.score)}
            <span className="text-base font-normal text-muted">/100</span>
          </p>
        </Card>
        <Card>
          <CardHeader title="Kepatuhan" />
          <div className="p-4">
            <Badge tone={a.compliant ? "success" : a.compliant === false ? "danger" : "neutral"} icon>
              {a.compliant ? "PATUH" : a.compliant === false ? "TIDAK PATUH" : "—"}
            </Badge>
          </div>
        </Card>
        <Card>
          <CardHeader title="Status" />
          <div className="p-4">
            <Badge tone="info" icon>{a.status}</Badge>
          </div>
        </Card>
        <Card>
          <CardHeader title="Durasi" />
          <p className="p-4 text-2xl font-semibold">
            {a.durationSec ? `${a.durationSec.toFixed(1)}s` : "—"}
          </p>
        </Card>
      </div>

      {a.error ? (
        <Card className="mb-6">
          <CardHeader title="Error" />
          <p className="p-4 text-sm text-danger">{a.error}</p>
        </Card>
      ) : null}

      {a.transcript ? (
        <Card className="mb-6">
          <CardHeader title="Transkrip (Whisper · id)" />
          <p className="whitespace-pre-wrap p-4 text-sm text-muted">{a.transcript}</p>
        </Card>
      ) : null}

      <Card>
        <CardHeader
          title="Hasil per-rule"
          description="Struktur laporan dibangkitkan dari rule aktif campaign — beda campaign, beda laporan."
        />
        {results.length === 0 ? (
          <EmptyState title="Belum ada hasil rule" />
        ) : (
          <Table>
            <thead>
              <tr>
                <Th>Rule</Th>
                <Th>Hasil</Th>
                <Th>Detail</Th>
                <Th align="right">Bobot</Th>
              </tr>
            </thead>
            <tbody>
              {results.map((r) => (
                <tr key={r.rule_id}>
                  <Td>
                    <div className="font-medium">{r.label}</div>
                    <div className="text-xs text-muted">{r.type}</div>
                  </Td>
                  <Td>
                    <Badge tone={r.passed ? "success" : "danger"} icon>
                      {r.passed ? "LULUS" : "GAGAL"}
                    </Badge>
                  </Td>
                  <Td>
                    <div className="text-sm">{r.detail}</div>
                    {r.value !== null && r.value !== undefined ? (
                      <div className="text-xs text-muted">value: {JSON.stringify(r.value)}</div>
                    ) : null}
                  </Td>
                  <Td align="right">{r.weight}</Td>
                </tr>
              ))}
            </tbody>
          </Table>
        )}
      </Card>

      <p className="mt-4 text-xs text-muted">Dianalisis: {formatDateTime(a.createdAt)}</p>
    </div>
  );
}
