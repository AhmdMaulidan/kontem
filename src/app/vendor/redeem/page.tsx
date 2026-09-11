import { requireRole } from "@/lib/auth";
import { db } from "@/lib/db";
import { formatDateTime } from "@/lib/format";
import { Badge, Card, CardHeader, EmptyState, PageHeader } from "@/components/ui";
import { RedeemForm } from "./redeem-form";

export default async function RedeemPage() {
  const user = await requireRole("VENDOR");

  const terbaru = await db.redeemCode.findMany({
    where: { campaign: { vendorId: user.id }, status: "USED" },
    include: {
      campaign: { select: { title: true } },
      participation: { include: { creator: { select: { name: true } } } },
    },
    orderBy: { redeemedAt: "desc" },
    take: 10,
  });

  return (
    <div>
      <PageHeader
        title="Cek kode redeem"
        description="Verifikasi kunjungan creator di lokasi sebelum mereka boleh mengirim konten."
      />

      <div className="grid gap-6 lg:grid-cols-3">
        <Card>
          <CardHeader title="Masukkan kode" />
          <RedeemForm />
        </Card>

        <div className="lg:col-span-2">
          <Card>
            <CardHeader
              title="Kunjungan terakhir"
              description="10 kode terakhir yang kamu tandai terpakai."
            />
            {terbaru.length === 0 ? (
              <EmptyState
                title="Belum ada kunjungan tercatat"
                description="Kode yang sudah kamu verifikasi akan muncul di sini."
              />
            ) : (
              <ul className="divide-y divide-line">
                {terbaru.map((item) => (
                  <li
                    key={item.id}
                    className="flex flex-wrap items-center justify-between gap-3 py-3 first:pt-0 last:pb-0"
                  >
                    <div>
                      <p className="font-medium">
                        {item.participation.creator.name}
                      </p>
                      <p className="text-sm text-muted">{item.campaign.title}</p>
                    </div>
                    <div className="text-right">
                      <code className="font-mono text-xs text-muted">
                        {item.code}
                      </code>
                      <p className="mt-1 text-xs text-muted">
                        {item.redeemedAt ? formatDateTime(item.redeemedAt) : "—"}
                      </p>
                    </div>
                    <Badge tone="success">Terverifikasi</Badge>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </div>
      </div>
    </div>
  );
}
