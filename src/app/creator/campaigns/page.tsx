import Link from "next/link";
import { requireRole } from "@/lib/auth";
import { db } from "@/lib/db";
import { formatDate, formatIDR, daysUntil } from "@/lib/format";
import {
  Badge,
  Card,
  EmptyState,
  IconArrowRight,
  PageHeader,
} from "@/components/ui";
import { categoryLabel, categoryTone } from "@/lib/labels";
import type { BusinessCategory } from "@/generated/prisma/enums";
import { CampaignFilters } from "./campaign-filters";

/** Sentinel di URL untuk "Semua kota" — beda dengan string kosong supaya
 * bisa dibedakan dari "belum diisi" (yang jatuh ke kota domisili creator). */
const SEMUA_KOTA = "all";

export default async function BrowseCampaignPage({
  searchParams,
}: {
  searchParams: Promise<{ kota?: string; kategori?: string; q?: string }>;
}) {
  const user = await requireRole("CREATOR");
  const params = await searchParams;

  // Kota belum pernah diisi (param tidak ada sama sekali) -> default ke kota
  // domisili creator, inti dari "campaign terdekat". Begitu creator memilih
  // "Semua kota", param ditulis eksplisit sebagai SEMUA_KOTA supaya tidak
  // jatuh balik ke default ini (lihat campaign-filters.tsx).
  const kota =
    params.kota === undefined
      ? (user.creatorProfile?.city ?? "")
      : params.kota === SEMUA_KOTA
        ? ""
        : params.kota;
  const kategori = params.kategori ?? "";
  const q = params.q ?? "";

  const campaigns = await db.campaign.findMany({
    where: {
      status: "ACTIVE",
      endDate: { gt: new Date() },
      ...(kategori ? { category: kategori as BusinessCategory } : {}),
      ...(q ? { title: { contains: q, mode: "insensitive" as const } } : {}),
      vendor: {
        vendorProfile: kota
          ? { city: { equals: kota, mode: "insensitive" as const } }
          : {},
      },
    },
    include: {
      vendor: { include: { vendorProfile: true } },
      participations: { where: { status: { not: "CANCELLED" } }, select: { creatorId: true } },
    },
    orderBy: { createdAt: "desc" },
  });

  const kotaAktif = await db.vendorProfile.findMany({
    where: { user: { campaigns: { some: { status: "ACTIVE" } } } },
    select: { city: true },
    distinct: ["city"],
    orderBy: { city: "asc" },
  });
  // Kota domisili creator tetap muncul di pilihan walau belum ada campaign
  // aktif di sana — supaya <select> selalu punya opsi yang cocok dengan nilai
  // filter yang sedang aktif (default-nya memang kota domisili).
  const kotaTersedia = Array.from(
    new Set([
      ...kotaAktif.map((item) => item.city),
      ...(user.creatorProfile?.city ? [user.creatorProfile.city] : []),
    ]),
  ).sort((a, b) => a.localeCompare(b));

  return (
    <div>
      <PageHeader
        title="Cari campaign"
        description="Campaign yang sedang berjalan dan masih membuka slot."
      />

      <CampaignFilters
        kota={kota}
        kategori={kategori}
        q={q}
        kotaTersedia={kotaTersedia}
      />

      {campaigns.length === 0 ? (
        <EmptyState
          title="Tidak ada campaign yang cocok"
          description="Coba longgarkan filter kota atau kategori."
        />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {campaigns.map((campaign) => {
            const terisi = campaign.participations.length;
            const sudahIkut = campaign.participations.some(
              (p) => p.creatorId === user.id,
            );
            const sisaHari = daysUntil(campaign.endDate);

            // Foto campaign (diunggah vendor saat membuat campaign) lebih
            // relevan daripada foto outlet umum — dipakai duluan kalau ada.
            const foto =
              campaign.imageUrl ?? campaign.vendor.vendorProfile?.photos[0];

            return (
              <Card key={campaign.id} hover>
                {foto ? (
                  // Data URI (campaign.imageUrl) tidak bisa dioptimasi next/image
                  // tanpa konfigurasi tambahan — img biasa dipakai di sini,
                  // konsisten dengan pola yang sama di /vendor/campaigns.
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={foto}
                    alt=""
                    className="aspect-video w-full rounded-md object-cover"
                  />
                ) : (
                  <div className="aspect-video w-full rounded-md bg-brand-50" />
                )}

                <div className="mt-4 flex items-start justify-between gap-3">
                  <div>
                    <Badge tone={categoryTone[campaign.category]}>
                      {categoryLabel[campaign.category]}
                    </Badge>
                    <h2 className="mt-2 font-medium">
                      <Link
                        href={`/creator/campaigns/${campaign.id}`}
                        className="hover:text-brand"
                      >
                        {campaign.title}
                      </Link>
                    </h2>
                    <p className="mt-1 text-sm text-muted">
                      {campaign.vendor.vendorProfile?.businessName} ·{" "}
                      {campaign.vendor.vendorProfile?.city}
                    </p>
                  </div>
                  <div className="flex flex-col items-end gap-1.5">
                    {sudahIkut ? <Badge tone="success">Sudah ikut</Badge> : null}
                    {sisaHari <= 2 && sisaHari >= 0 ? (
                      <Badge tone="warning">Segera berakhir</Badge>
                    ) : null}
                  </div>
                </div>

                <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
                  <div>
                    <p className="text-xs text-muted">Pool budget</p>
                    <p className="tabular font-medium">
                      {formatIDR(campaign.budgetPool)}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-muted">CPM rate</p>
                    <p className="tabular font-medium">
                      {formatIDR(campaign.cpmRate)}
                      <span className="text-xs text-muted"> /1k views</span>
                    </p>
                  </div>
                </div>

                <div className="mt-4 flex items-center justify-between text-xs text-muted">
                  <span>
                    {terisi > 0 ? `${terisi} creator ikut` : "Baru dibuka"}
                  </span>
                  <span>{sisaHari >= 0 ? `sisa ${sisaHari} hari` : "berakhir"}</span>
                </div>

                <div className="mt-4 flex items-center justify-between">
                  <span className="text-xs text-muted">
                    Berakhir {formatDate(campaign.endDate)}
                  </span>
                  <Link
                    href={`/creator/campaigns/${campaign.id}`}
                    className="inline-flex items-center gap-1 text-sm font-semibold text-brand-600"
                  >
                    Lihat brief
                    <IconArrowRight className="h-3.5 w-3.5" />
                  </Link>
                </div>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
