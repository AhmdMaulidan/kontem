import Link from "next/link";
import { requireRole } from "@/lib/auth";
import { db } from "@/lib/db";
import { formatDateTime, formatIDR } from "@/lib/format";
import {
  Badge,
  Card,
  CardHeader,
  EmptyState,
  PageHeader,
  Table,
  Td,
  Th,
} from "@/components/ui";
import { RedeemForm } from "./redeem-form";

export default async function VendorRedeemPage() {
  const user = await requireRole("VENDOR");

  const riwayat = await db.redeemCode.findMany({
    where: {
      campaign: { vendorId: user.id },
      status: "USED",
    },
    include: {
      campaign: {
        select: {
          id: true,
          title: true,
          complimentType: true,
          complimentValue: true,
        },
      },
      participation: {
        include: {
          creator: {
            select: { name: true, phone: true },
          },
        },
      },
    },
    orderBy: { redeemedAt: "desc" },
    take: 20,
  });

  return (
    <div className="space-y-6">
      <PageHeader
        title="Verifikasi Kode Redeem"
        description="Validasi kehadiran kreator di lokasi usahamu, berikan komplimen yang dijanjikan, dan izinkan kreator mengunggah konten."
      />

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-1">
          <Card>
            <CardHeader
              title="Masukkan Kode"
              description="Kreator akan menunjukkan kode saat tiba di tempatmu."
            />
            <RedeemForm />
          </Card>
        </div>

        <div className="lg:col-span-2">
          <Card>
            <CardHeader
              title={`Riwayat Kunjungan Terkonfirmasi (${riwayat.length})`}
              description="Kreator yang sudah menukarkan kode di lokasi usahamu."
            />
            {riwayat.length === 0 ? (
              <EmptyState
                title="Belum ada kode yang ditukarkan"
                description="Ketika kreator datang dan menukarkan kode, riwayatnya akan tercatat di sini."
              />
            ) : (
              <Table>
                <thead>
                  <tr>
                    <Th>Kode</Th>
                    <Th>Creator</Th>
                    <Th>Campaign & Komplimen</Th>
                    <Th>Waktu Ditukarkan</Th>
                    <Th>Status</Th>
                  </tr>
                </thead>
                <tbody>
                  {riwayat.map((item) => (
                    <tr key={item.id}>
                      <Td className="font-mono font-medium text-foreground">
                        {item.code}
                      </Td>
                      <Td>
                        <p className="font-medium text-body">
                          {item.participation.creator.name}
                        </p>
                        {item.participation.creator.phone ? (
                          <p className="text-xs text-muted">
                            {item.participation.creator.phone}
                          </p>
                        ) : null}
                      </Td>
                      <Td>
                        <Link
                          href={`/vendor/campaigns/${item.campaign.id}`}
                          className="font-medium text-brand hover:underline"
                        >
                          {item.campaign.title}
                        </Link>
                        <p className="mt-0.5 text-xs text-muted">
                          {item.campaign.complimentType} (
                          {formatIDR(item.campaign.complimentValue)})
                        </p>
                      </Td>
                      <Td className="whitespace-nowrap text-xs text-muted">
                        {item.redeemedAt
                          ? formatDateTime(item.redeemedAt)
                          : "—"}
                      </Td>
                      <Td>
                        <Badge tone="sky">Hadir</Badge>
                      </Td>
                    </tr>
                  ))}
                </tbody>
              </Table>
            )}
          </Card>
        </div>
      </div>
    </div>
  );
}
