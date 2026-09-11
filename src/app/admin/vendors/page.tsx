import { requireRole } from "@/lib/auth";
import { db } from "@/lib/db";
import { formatDate } from "@/lib/format";
import {
  Badge,
  Card,
  CardHeader,
  DescriptionList,
  EmptyState,
  PageHeader,
} from "@/components/ui";
import {
  categoryLabel,
  verificationStatusLabel,
  verificationStatusTone,
} from "@/lib/labels";
import { reviewVendorAction } from "../actions";
import { DecisionForm } from "../decision-form";

export default async function AdminVendorsPage() {
  await requireRole("ADMIN");

  const [antrean, sudahDiputus] = await Promise.all([
    db.user.findMany({
      where: { role: "VENDOR", status: "PENDING" },
      include: { vendorProfile: true },
      orderBy: { createdAt: "asc" },
    }),
    db.user.findMany({
      where: { role: "VENDOR", status: { in: ["VERIFIED", "REJECTED"] } },
      include: { vendorProfile: true, _count: { select: { campaigns: true } } },
      orderBy: { updatedAt: "desc" },
      take: 20,
    }),
  ]);

  return (
    <div>
      <PageHeader
        title="Verifikasi vendor"
        description="Cek keabsahan bisnis sebelum vendor boleh membuat campaign."
      />

      <Card className="mb-6">
        <CardHeader
          title={`Menunggu verifikasi (${antrean.length})`}
          description="Langkah standar: buka titik peta, cocokkan dengan Google Maps, telepon nomor PIC."
        />
        {antrean.length === 0 ? (
          <EmptyState
            title="Tidak ada antrean"
            description="Semua pengajuan vendor sudah diputuskan."
          />
        ) : (
          <ul className="space-y-5">
            {antrean.map((vendor) => (
              <li key={vendor.id} className="rounded-xl border border-line p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <h3 className="font-medium">
                      {vendor.vendorProfile?.businessName}
                    </h3>
                    <p className="mt-0.5 text-sm text-muted">
                      Diajukan {formatDate(vendor.createdAt)}
                    </p>
                  </div>
                  <Badge tone="info">
                    {vendor.vendorProfile
                      ? categoryLabel[vendor.vendorProfile.category]
                      : "—"}
                  </Badge>
                </div>

                <div className="mt-4">
                  <DescriptionList
                    items={[
                      {
                        label: "Alamat",
                        value: `${vendor.vendorProfile?.address}, ${vendor.vendorProfile?.city}, ${vendor.vendorProfile?.province}`,
                      },
                      {
                        label: "Titik peta",
                        value: vendor.vendorProfile ? (
                          <a
                            className="text-brand"
                            href={`https://maps.google.com/?q=${vendor.vendorProfile.latitude},${vendor.vendorProfile.longitude}`}
                            target="_blank"
                            rel="noreferrer"
                          >
                            Cek di Google Maps →
                          </a>
                        ) : (
                          "—"
                        ),
                      },
                      {
                        label: "PIC",
                        value: `${vendor.vendorProfile?.picName} · ${vendor.vendorProfile?.picPhone}`,
                      },
                      { label: "Email akun", value: vendor.email },
                      {
                        label: "Foto lokasi",
                        value:
                          (vendor.vendorProfile?.photos.length ?? 0) > 0
                            ? `${vendor.vendorProfile?.photos.length} foto dilampirkan`
                            : "Belum ada foto",
                      },
                      {
                        label: "Deskripsi",
                        value: vendor.vendorProfile?.description ?? "—",
                      },
                    ]}
                  />
                </div>

                <div className="mt-4 border-t border-line pt-4">
                  <DecisionForm
                    action={reviewVendorAction}
                    hiddenField="vendorId"
                    hiddenValue={vendor.id}
                    approveLabel="Verifikasi vendor"
                    rejectLabel="Tolak"
                    noteLabel="Alasan penolakan"
                    requireNoteOnApprove
                  />
                </div>
              </li>
            ))}
          </ul>
        )}
      </Card>

      <Card>
        <CardHeader title="Vendor yang sudah diputus" />
        {sudahDiputus.length === 0 ? (
          <EmptyState title="Belum ada riwayat" />
        ) : (
          <ul className="divide-y divide-line">
            {sudahDiputus.map((vendor) => (
              <li
                key={vendor.id}
                className="flex flex-wrap items-center justify-between gap-3 py-3 first:pt-0 last:pb-0"
              >
                <div>
                  <p className="font-medium">
                    {vendor.vendorProfile?.businessName}
                  </p>
                  <p className="text-sm text-muted">
                    {vendor.vendorProfile?.city} · {vendor._count.campaigns} campaign
                    {vendor.vendorProfile?.rejectionReason
                      ? ` · ${vendor.vendorProfile.rejectionReason}`
                      : ""}
                  </p>
                </div>
                <Badge tone={verificationStatusTone[vendor.status]}>
                  {verificationStatusLabel[vendor.status]}
                </Badge>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}
