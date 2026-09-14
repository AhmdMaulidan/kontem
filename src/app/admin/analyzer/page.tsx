import Link from "next/link";
import { requireRole } from "@/lib/auth";
import { db } from "@/lib/db";
import { PageHeader, Card, CardHeader, EmptyState, Table, Td, Th } from "@/components/ui";
import { AnalyzeUrlForm } from "./analyze-url-form";
import { RecentAnalyses } from "./recent-analyses";

export default async function AdminAnalyzerPage() {
  await requireRole("ADMIN");

  const [campaigns, recent] = await Promise.all([
    db.campaign.findMany({
      where: { status: { in: ["ACTIVE", "ENDED", "PENDING_REVIEW", "SETTLING"] } },
      include: { _count: { select: { rules: true, analyses: true } } },
      orderBy: { createdAt: "desc" },
      take: 50,
    }),
    db.videoAnalysis.findMany({
      orderBy: { createdAt: "desc" },
      take: 12,
      include: { campaign: { select: { title: true } } },
    }),
  ]);

  return (
    <div>
      <PageHeader
        title="Automated Agentic Analyze"
        description="Aturan kepatuhan bersifat dinamis per campaign. Bangun rule, lalu analisis video otomatis (download + transkrip Whisper + detektor)."
      />

      <Card className="mb-6">
        <CardHeader title="Analisis URL / Submission langsung" />
        <div className="p-4">
          <AnalyzeUrlForm campaigns={campaigns} />
        </div>
      </Card>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader title="Campaign & rule set" description="Klik untuk buka rule builder dinamis." />
          {campaigns.length === 0 ? (
            <EmptyState title="Belum ada campaign" />
          ) : (
            <Table>
              <thead>
                <tr>
                  <Th>Campaign</Th>
                  <Th align="right">Rule</Th>
                  <Th align="right">Analisis</Th>
                  <Th>{" "}</Th>
                </tr>
              </thead>
              <tbody>
                {campaigns.map((c) => (
                  <tr key={c.id}>
                    <Td>
                      <span className="font-medium">{c.title}</span>
                      <div className="text-xs text-muted">{c._count.rules} aturan aktif</div>
                    </Td>
                    <Td align="right">{c._count.rules}</Td>
                    <Td align="right">{c._count.analyses}</Td>
                    <Td align="right">
                      <Link href={`/admin/analyzer/${c.id}`} className="text-brand hover:underline">
                        Buka →
                      </Link>
                    </Td>
                  </tr>
                ))}
              </tbody>
            </Table>
          )}
        </Card>

        <Card>
          <CardHeader title="Analisis terbaru" />
          <RecentAnalyses analyses={recent} />
        </Card>
      </div>
    </div>
  );
}
