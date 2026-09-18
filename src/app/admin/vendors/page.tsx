import { requireRole } from "@/lib/auth";
import { db } from "@/lib/db";
import { formatDate } from "@/lib/format";
import {
  Badge,
  CopyButton,
  DataTable,
  DetailDrawer,
  IconShieldCheck,
  IconExternal,
  IconPin,
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
import type {
  BusinessCategory,
  VerificationStatus,
} from "@/generated/prisma/enums";
import {
  categoryLabel,
  verificationStatusLabel,
  verificationStatusTone,
} from "@/lib/labels";
import { reviewVendorAction } from "../actions";
import { DecisionForm } from "../decision-form";

const PAGE_SIZE = 10;
const BASE = "/admin/vendors";

export default async function AdminVendorsPage({
  searchParams,
}: {
  searchParams: Promise<{
    q?: string;
    status?: string;
    kategori?: string;
    kota?: string;
    page?: string;
    ukuran?: string;
  }>;
}) {
  await requireRole("ADMIN");
  const params = await searchParams;
  const page = Math.max(1, Number(params.page) || 1);
  const pageSize = resolvePageSize(params.ukuran, PAGE_SIZE);

  // Halaman antrean dibuka untuk mengerjakan yang menunggu, bukan membaca
  // arsip — jadi penyaring status berangkat dari PENDING.
  const status = (params.status ?? "PENDING") as VerificationStatus | "ALL";

  const profilFilter = {
    ...(params.kategori
      ? { category: params.kategori as BusinessCategory }
      : {}),
    ...(params.kota ? { city: params.kota } : {}),
    ...(params.q
      ? {
          OR: [
            {
              businessName: {
                contains: params.q,
                mode: "insensitive" as const,
              },
            },
            { picName: { contains: params.q, mode: "insensitive" as const } },
            { picPhone: { contains: params.q } },
          ],
        }
      : {}),
  };

  const where = {
    role: "VENDOR" as const,
    ...(status === "ALL" ? {} : { status }),
    ...(Object.keys(profilFilter).length > 0
      ? { vendorProfile: { is: profilFilter } }
      : {}),
  };

  const [vendors, total, menunggu, kotaTersedia] = await Promise.all([
    db.user.findMany({
      where,
      include: { vendorProfile: true, _count: { select: { campaigns: true } } },
      orderBy: { createdAt: "asc" },
      ...paginationArgs(page, pageSize),
    }),
    db.user.count({ where }),
    db.user.count({ where: { role: "VENDOR", status: "PENDING" } }),
    db.vendorProfile.findMany({
      select: { city: true },
      distinct: ["city"],
      orderBy: { city: "asc" },
    }),
  ]);

  return (
    <div>
      <PageHeader
        title="Verifikasi vendor"
        description="Cek keabsahan bisnis sebelum vendor boleh membuat campaign. Langkah standarnya: buka titik peta, cocokkan dengan Google Maps, telepon nomor PIC."
      />

      <DataTable
        title="Verifikasi Vendor"
        summary={`${menunggu} menunggu diperiksa`}
        tableClassName="w-full text-sm md:min-w-[52rem]"
        toolbar={
          <TableToolbar
            basePath={BASE}
            params={params}
            searchPlaceholder="Cari nama usaha / PIC..."
            action={
              <PageSizeSelect basePath={BASE} params={params} pageSize={pageSize} />
            }
            filters={[
              {
                name: "kategori",
                label: "Kategori",
                options: [
                  { value: "", label: "Semua kategori" },
                  ...Object.entries(categoryLabel).map(([value, label]) => ({
                    value,
                    label,
                  })),
                ],
              },
              {
                name: "kota",
                label: "Kota",
                options: [
                  { value: "", label: "Semua kota" },
                  ...kotaTersedia.map((row) => ({
                    value: row.city,
                    label: row.city,
                  })),
                ],
              },
              {
                name: "status",
                label: "Status",
                options: [
                  { value: "PENDING", label: "Menunggu" },
                  { value: "VERIFIED", label: "Terverifikasi" },
                  { value: "REJECTED", label: "Ditolak" },
                  { value: "ALL", label: "Semua status" },
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
        {/* Header Tabel — Desktop */}
        <thead className="hidden md:table-header-group">
          <tr>
            <Th className="w-8 px-2.5 py-2 text-center text-xs">No</Th>
            <Th className="px-2.5 py-2 text-xs">Nama Usaha</Th>
            <Th className="px-2.5 py-2 text-xs">Kategori</Th>
            <Th className="px-2.5 py-2 text-xs">Kota</Th>
            <Th className="px-2.5 py-2 text-xs">PIC</Th>
            <Th align="right" className="px-2.5 py-2 text-xs">Foto</Th>
            <Th className="px-2.5 py-2 text-xs">Didaftarkan</Th>
            <Th className="px-2.5 py-2 text-xs">Status</Th>
            <Th className="px-2.5 py-2 text-xs">Aksi</Th>
          </tr>
        </thead>

        {/* Isi Tabel — Desktop */}
        <tbody className="hidden md:table-row-group">
          {vendors.length === 0 ? (
            <TableEmptyRow
              colSpan={9}
              title="Tidak ada vendor pada penyaringan ini"
              description="Ubah kata kunci atau pilih status lain."
            />
          ) : (
            vendors.map((vendor, index) => {
              const profil = vendor.vendorProfile;
              const mapsUrl =
                profil?.mapsUrl ??
                (profil?.latitude && profil?.longitude
                  ? `https://maps.google.com/?q=${profil.latitude},${profil.longitude}`
                  : null);
              const menungguDiperiksa = vendor.status === "PENDING";

              return (
                <tr key={vendor.id}>
                  <Td className="w-8 px-2.5 py-2 text-center tabular text-xs text-muted">
                    {rowNumber(index, page, pageSize)}
                  </Td>
                  <Td className="px-2.5 py-2 font-medium whitespace-nowrap">
                    {profil?.businessName ?? "—"}
                  </Td>
                  <Td className="px-2.5 py-2 whitespace-nowrap">
                    {profil ? categoryLabel[profil.category] : "—"}
                  </Td>
                  <Td className="px-2.5 py-2 whitespace-nowrap">{profil?.city ?? "—"}</Td>
                  <Td className="px-2.5 py-2 whitespace-nowrap">
                    <span className="text-xs sm:text-sm font-medium">{profil?.picName ?? "—"}</span>
                    <p className="tabular text-[11px] text-muted">
                      {profil?.picPhone ?? ""}
                    </p>
                  </Td>
                  <Td align="right" className="px-2.5 py-2 tabular">{profil?.photos.length ?? 0}</Td>
                  <Td className="whitespace-nowrap px-2.5 py-2 text-xs text-muted">
                    {formatDate(vendor.createdAt)}
                  </Td>
                  <Td className="px-2.5 py-2 whitespace-nowrap">
                    <Badge tone={verificationStatusTone[vendor.status]} icon>
                      {verificationStatusLabel[vendor.status]}
                    </Badge>
                  </Td>
                  <Td className="px-2.5 py-2 whitespace-nowrap">
                    <div className="flex items-center gap-2 sm:gap-3">
                      {mapsUrl ? (
                        <a
                          href={mapsUrl}
                          target="_blank"
                          rel="noreferrer"
                          title="Buka di Google Maps"
                          className="text-brand-600 transition-colors hover:text-brand-700"
                        >
                          <IconPin className="h-4 w-4" strokeWidth={2} />
                        </a>
                      ) : null}
                      <DetailDrawer
                        label={menungguDiperiksa ? "Periksa" : "Lihat alasan"}
                        icon={
                          <IconShieldCheck
                            className="h-4 w-4"
                            strokeWidth={2}
                          />
                        }
                        title={profil?.businessName ?? vendor.name}
                        subtitle={
                          profil
                            ? `${categoryLabel[profil.category]} · ${profil.city} · Terdaftar ${formatDate(vendor.createdAt)}`
                            : undefined
                        }
                      >
                        {profil && profil.photos.length > 0 ? (
                          <div className="grid grid-cols-4 gap-2">
                            {profil.photos.map((photo) => (
                              // eslint-disable-next-line @next/next/no-img-element
                              <img
                                key={photo}
                                src={photo}
                                alt=""
                                className="aspect-square w-full rounded-lg object-cover"
                              />
                            ))}
                          </div>
                        ) : (
                          <p className="rounded-xl bg-surface-muted px-3 py-2 text-sm text-muted">
                            Belum ada foto lokasi dilampirkan.
                          </p>
                        )}

                        <dl className="space-y-3 text-sm">
                          <div>
                            <dt className="text-xs font-medium text-muted">
                              Alamat
                            </dt>
                            <dd className="mt-0.5">
                              {profil
                                ? `${profil.address}, ${profil.city}, ${profil.province}`
                                : "—"}
                            </dd>
                          </div>
                          <div className="flex items-start justify-between gap-3">
                            <div className="min-w-0">
                              <dt className="text-xs font-medium text-muted">
                                Maps
                              </dt>
                              <dd className="mt-0.5 truncate text-muted">
                                {mapsUrl ?? "—"}
                              </dd>
                            </div>
                            {mapsUrl ? (
                              <a
                                href={mapsUrl}
                                target="_blank"
                                rel="noreferrer"
                                title="Buka di Google Maps"
                                className="text-brand-600 transition-colors hover:text-brand-700"
                              >
                                <IconExternal
                                  className="h-4 w-4"
                                  strokeWidth={2}
                                />
                              </a>
                            ) : null}
                          </div>
                          <div className="flex items-start justify-between gap-3">
                            <div className="min-w-0">
                              <dt className="text-xs font-medium text-muted">
                                PIC
                              </dt>
                              <dd className="tabular mt-0.5">
                                {profil?.picName ?? "—"} —{" "}
                                {profil?.picPhone ?? "—"}
                              </dd>
                            </div>
                            {profil?.picPhone ? (
                              <CopyButton value={profil.picPhone} iconOnly />
                            ) : null}
                          </div>
                          <div>
                            <dt className="text-xs font-medium text-muted">
                              Deskripsi
                            </dt>
                            <dd className="mt-0.5 text-muted">
                              {profil?.description ?? "—"}
                            </dd>
                          </div>
                          <div>
                            <dt className="text-xs font-medium text-muted">
                              Email akun
                            </dt>
                            <dd className="mt-0.5">
                              {vendor.email} · {vendor._count.campaigns}{" "}
                              campaign
                            </dd>
                          </div>
                          <div>
                            <dt className="text-xs font-medium text-muted">
                              Rekening Bank (Refund)
                            </dt>
                            <dd className="mt-0.5">
                              {profil?.bankName ? (
                                <span>
                                  {profil.bankName}{" "}
                                  <span className="tabular">{profil.bankAccountNumber}</span>{" "}
                                  a.n. {profil.bankAccountName ?? "—"}
                                </span>
                              ) : (
                                <span className="text-muted">Belum diatur</span>
                              )}
                            </dd>
                          </div>
                        </dl>

                        {menungguDiperiksa ? (
                          <div className="border-t border-line pt-4">
                            <DecisionForm
                              action={reviewVendorAction}
                              hiddenField="vendorId"
                              hiddenValue={vendor.id}
                              approveLabel="Verifikasi"
                              rejectLabel="Tolak"
                              noteLabel="Catatan verifikasi"
                              requireNoteOnApprove
                            />
                          </div>
                        ) : profil?.rejectionReason ? (
                          <div className="rounded-xl bg-danger-soft px-3 py-2 text-sm text-danger">
                            <p className="font-medium">Alasan penolakan</p>
                            <p className="mt-0.5">{profil.rejectionReason}</p>
                          </div>
                        ) : profil?.verificationNote ? (
                          <div className="rounded-xl bg-surface-muted px-3 py-2 text-sm">
                            <p className="font-medium">Catatan verifikasi</p>
                            <p className="mt-0.5 text-muted">
                              {profil.verificationNote}
                            </p>
                          </div>
                        ) : null}
                      </DetailDrawer>
                    </div>
                  </Td>
                </tr>
              );
            })
          )}
        </tbody>

        {/* Isi Tabel — Mobile (Baris dengan Grid 2 Kolom Sepanjang Tabel) */}
        <tbody className="md:hidden">
          {vendors.length === 0 ? (
            <TableEmptyRow
              colSpan={1}
              title="Tidak ada vendor pada penyaringan ini"
              description="Ubah kata kunci atau pilih status lain."
            />
          ) : (
            vendors.map((vendor, index) => {
              const profil = vendor.vendorProfile;
              const mapsUrl =
                profil?.mapsUrl ??
                (profil?.latitude && profil?.longitude
                  ? `https://maps.google.com/?q=${profil.latitude},${profil.longitude}`
                  : null);
              const menungguDiperiksa = vendor.status === "PENDING";

              return (
                <tr key={`m-${vendor.id}`} className="border-b border-line last:border-0">
                  <td className="block w-full p-4">
                    {/* Header item */}
                    <div className="flex items-center justify-between gap-2 pb-2.5 border-b border-line">
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="tabular text-xs font-semibold text-muted shrink-0">
                          #{rowNumber(index, page, pageSize)}
                        </span>
                        <h3 className="font-semibold text-sm truncate text-foreground">
                          {profil?.businessName ?? vendor.name}
                        </h3>
                      </div>
                      <Badge tone={verificationStatusTone[vendor.status]} icon>
                        {verificationStatusLabel[vendor.status]}
                      </Badge>
                    </div>

                    {/* Grid data 2 kolom */}
                    <div className="grid grid-cols-2 gap-3 py-3 text-xs border-b border-line">
                      <div>
                        <span className="text-[11px] font-medium text-muted uppercase tracking-wider block">
                          Kategori
                        </span>
                        <span className="font-medium text-foreground mt-0.5 block">
                          {profil ? categoryLabel[profil.category] : "—"}
                        </span>
                      </div>
                      <div>
                        <span className="text-[11px] font-medium text-muted uppercase tracking-wider block">
                          Kota
                        </span>
                        <span className="font-medium text-foreground mt-0.5 block">
                          {profil?.city ?? "—"}
                        </span>
                      </div>
                      <div>
                        <span className="text-[11px] font-medium text-muted uppercase tracking-wider block">
                          PIC
                        </span>
                        <span className="font-medium text-foreground mt-0.5 block">
                          {profil?.picName ?? "—"}
                        </span>
                        <p className="tabular text-muted mt-0.5">{profil?.picPhone ?? ""}</p>
                      </div>
                      <div>
                        <span className="text-[11px] font-medium text-muted uppercase tracking-wider block">
                          Didaftarkan
                        </span>
                        <span className="font-medium text-foreground mt-0.5 block">
                          {formatDate(vendor.createdAt)}
                        </span>
                      </div>
                    </div>

                    {/* Footer baris: foto & aksi */}
                    <div className="flex items-center justify-between pt-2.5">
                      <div className="flex items-center gap-1.5 text-xs text-muted">
                        <span>{profil?.photos.length ?? 0} Foto Lokasi</span>
                      </div>
                      <div className="flex items-center gap-2">
                        {mapsUrl ? (
                          <a
                            href={mapsUrl}
                            target="_blank"
                            rel="noreferrer"
                            title="Buka di Google Maps"
                            className="inline-flex items-center justify-center h-8 px-2.5 rounded-lg border border-line bg-surface text-brand-600 text-xs font-medium hover:bg-surface-muted gap-1 transition-colors"
                          >
                            <IconPin className="h-3.5 w-3.5" strokeWidth={2} />
                            <span>Maps</span>
                          </a>
                        ) : null}
                        <DetailDrawer
                          label={menungguDiperiksa ? "Periksa" : "Lihat"}
                          icon={<IconShieldCheck className="h-3.5 w-3.5" strokeWidth={2} />}
                          title={profil?.businessName ?? vendor.name}
                          subtitle={
                            profil
                              ? `${categoryLabel[profil.category]} · ${profil.city} · Terdaftar ${formatDate(vendor.createdAt)}`
                              : undefined
                          }
                        >
                          {profil && profil.photos.length > 0 ? (
                            <div className="grid grid-cols-4 gap-2">
                              {profil.photos.map((photo) => (
                                // eslint-disable-next-line @next/next/no-img-element
                                <img
                                  key={photo}
                                  src={photo}
                                  alt=""
                                  className="aspect-square w-full rounded-lg object-cover"
                                />
                              ))}
                            </div>
                          ) : (
                            <p className="rounded-xl bg-surface-muted px-3 py-2 text-sm text-muted">
                              Belum ada foto lokasi dilampirkan.
                            </p>
                          )}

                          <dl className="space-y-3 text-sm">
                            <div>
                              <dt className="text-xs font-medium text-muted">Alamat</dt>
                              <dd className="mt-0.5">
                                {profil
                                  ? `${profil.address}, ${profil.city}, ${profil.province}`
                                  : "—"}
                              </dd>
                            </div>
                            <div className="flex items-start justify-between gap-3">
                              <div className="min-w-0">
                                <dt className="text-xs font-medium text-muted">Maps</dt>
                                <dd className="mt-0.5 truncate text-muted">{mapsUrl ?? "—"}</dd>
                              </div>
                              {mapsUrl ? (
                                <a
                                  href={mapsUrl}
                                  target="_blank"
                                  rel="noreferrer"
                                  title="Buka di Google Maps"
                                  className="text-brand-600 transition-colors hover:text-brand-700"
                                >
                                  <IconExternal className="h-4 w-4" strokeWidth={2} />
                                </a>
                              ) : null}
                            </div>
                            <div className="flex items-start justify-between gap-3">
                              <div className="min-w-0">
                                <dt className="text-xs font-medium text-muted">PIC</dt>
                                <dd className="tabular mt-0.5">
                                  {profil?.picName ?? "—"} — {profil?.picPhone ?? "—"}
                                </dd>
                              </div>
                              {profil?.picPhone ? (
                                <CopyButton value={profil.picPhone} iconOnly />
                              ) : null}
                            </div>
                            <div>
                              <dt className="text-xs font-medium text-muted">Deskripsi</dt>
                              <dd className="mt-0.5 text-muted">
                                {profil?.description ?? "—"}
                              </dd>
                            </div>
                            <div>
                              <dt className="text-xs font-medium text-muted">Email akun</dt>
                              <dd className="mt-0.5">
                                {vendor.email} · {vendor._count.campaigns} campaign
                              </dd>
                            </div>
                            <div>
                              <dt className="text-xs font-medium text-muted">
                                Rekening Bank (Refund)
                              </dt>
                              <dd className="mt-0.5">
                                {profil?.bankName ? (
                                  <span>
                                    {profil.bankName}{" "}
                                    <span className="tabular">{profil.bankAccountNumber}</span> a.n.{" "}
                                    {profil.bankAccountName ?? "—"}
                                  </span>
                                ) : (
                                  <span className="text-muted">Belum diatur</span>
                                )}
                              </dd>
                            </div>
                          </dl>

                          {menungguDiperiksa ? (
                            <div className="border-t border-line pt-4">
                              <DecisionForm
                                action={reviewVendorAction}
                                hiddenField="vendorId"
                                hiddenValue={vendor.id}
                                approveLabel="Verifikasi"
                                rejectLabel="Tolak"
                                noteLabel="Catatan verifikasi"
                                requireNoteOnApprove
                              />
                            </div>
                          ) : profil?.rejectionReason ? (
                            <div className="rounded-xl bg-danger-soft px-3 py-2 text-sm text-danger">
                              <p className="font-medium">Alasan penolakan</p>
                              <p className="mt-0.5">{profil.rejectionReason}</p>
                            </div>
                          ) : profil?.verificationNote ? (
                            <div className="rounded-xl bg-surface-muted px-3 py-2 text-sm">
                              <p className="font-medium">Catatan verifikasi</p>
                              <p className="mt-0.5 text-muted">
                                {profil.verificationNote}
                              </p>
                            </div>
                          ) : null}
                        </DetailDrawer>
                      </div>
                    </div>
                  </td>
                </tr>
              );
            })
          )}
        </tbody>
      </DataTable>
    </div>
  );
}
