import Link from "next/link";
import { requireRole } from "@/lib/auth";
import { db } from "@/lib/db";
import { PageHeader, Card, CardHeader, EmptyState, Table, Th } from "@/components/ui";
import { DETECTOR_META, DETECTOR_TYPES } from "@/domain/analyze";
import { RuleRow } from "../rule-row";
import { SeedRulesForm, AddRuleForm } from "../rule-forms";

export default async function AdminCampaignRulesPage({
  params,
}: {
  params: Promise<{ campaignId: string }>;
}) {
  await requireRole("ADMIN");
  const { campaignId } = await params;

  const campaign = await db.campaign.findUnique({
    where: { id: campaignId },
    select: { id: true, title: true },
  });
  if (!campaign) {
    return <EmptyState title="Campaign tidak ditemukan" />;
  }

  const rules = await db.campaignRule.findMany({
    where: { campaignId },
    orderBy: { createdAt: "asc" },
  });

  return (
    <div>
      <Link href="/admin/analyzer" className="text-sm text-brand hover:underline">
        ← Kembali ke Analyzer
      </Link>
      <PageHeader
        title={`Rule set: ${campaign.title}`}
        description="Aturan kepatuhan dinamis. Tambah, aktifkan, atur bobot & parameter. Laporan dibangkitkan HANYA dari rule aktif — campaign lain punya struktur berbeda."
      />

      <Card className="mb-6">
        <CardHeader
          title="Tambah rule baru"
          description={`${DETECTOR_TYPES.length} tipe detector tersedia.`}
        />
        <div className="p-4">
          <AddRuleForm campaignId={campaignId} detectorTypes={DETECTOR_TYPES} meta={DETECTOR_META} />
        </div>
      </Card>

      <Card className="mb-6">
        <CardHeader title="Cepat isi" description="Tambahkan 14 kriteria GSTMC default sekaligus." />
        <div className="p-4">
          <SeedRulesForm campaignId={campaignId} />
        </div>
      </Card>

      <Card>
        <CardHeader title={`Rule aktif (${rules.length})`} />
        {rules.length === 0 ? (
          <EmptyState title="Belum ada rule. Tambah di atas atau pakai seed." />
        ) : (
          <Table>
            <thead>
              <tr>
                <Th>Label</Th>
                <Th>Tipe</Th>
                <Th align="right">Bobot</Th>
                <Th align="right">Status</Th>
                <Th>{" "}</Th>
              </tr>
            </thead>
            <tbody>
              {rules.map((r) => (
                <RuleRow key={r.id} rule={r} meta={DETECTOR_META[r.type]} />
              ))}
            </tbody>
          </Table>
        )}
      </Card>
    </div>
  );
}
