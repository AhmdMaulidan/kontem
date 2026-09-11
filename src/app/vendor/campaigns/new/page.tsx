import { requireRole } from "@/lib/auth";
import { db } from "@/lib/db";
import { Callout, PageHeader } from "@/components/ui";
import { CampaignForm, type TemplateOption } from "./campaign-form";

export default async function NewCampaignPage() {
  const user = await requireRole("VENDOR");

  const templates = await db.briefTemplate.findMany({
    where: { isActive: true },
    orderBy: { category: "asc" },
  });

  // Rekomendasi CPM diambil dari rata-rata campaign yang sudah berjalan di
  // kategori yang sama, supaya vendor baru punya titik acuan.
  const rataCpm = await db.campaign.groupBy({
    by: ["category"],
    _avg: { cpmRate: true },
    where: { status: { in: ["ACTIVE", "ENDED", "SETTLED"] } },
  });

  const options: TemplateOption[] = templates.map((template) => ({
    id: template.id,
    category: template.category,
    name: template.name,
    fields: template.fields as {
      angleSaran?: string[];
      wajibTampil?: string[];
      larangan?: string[];
      durasiMinimalDetik?: number;
    },
  }));

  const cpmRekomendasi = Object.fromEntries(
    rataCpm.map((row) => [row.category, Math.round(row._avg.cpmRate ?? 0)]),
  );

  return (
    <div>
      <PageHeader
        title="Buat campaign"
        description="Tentukan budget, brief, dan komplimen. Campaign live setelah disetujui admin."
      />

      {user.status !== "VERIFIED" ? (
        <div className="mb-6">
          <Callout tone="warning" title="Akun belum terverifikasi">
            Kamu masih bisa menyusun campaign, tapi pengajuan baru diproses setelah
            verifikasi bisnis selesai.
          </Callout>
        </div>
      ) : null}

      <CampaignForm
        templates={options}
        cpmRekomendasi={cpmRekomendasi}
        defaultCategory={user.vendorProfile?.category ?? "KULINER"}
      />
    </div>
  );
}
