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
        action={
          <PageSizeSelect basePath={BASE} params={params} pageSize={pageSize} />
        }
        toolbar={
          <TableToolbar
            basePath={BASE}
            params={params}
            searchPlaceholder="Cari nama usaha / PIC..."
            filters={[
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
        {/* Tabel — desktop */}
        <thead className="hidden md:table-header-group">
          <tr>
            <Th>No</Th>
            <Th>Nama Usaha</Th>
            <Th>Kategori</Th>
            <Th>Kota</Th>
            <Th>PIC</Th>
            <Th align="right">Foto</Th>
            <Th>Didaftarkan</Th>
            <Th>Status</Th>
            <Th>Aksi</Th>
          </tr>
        </thead>
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
                  <Td className="tabular text-muted">
                    {rowNumber(index, page, pageSize)}
                  </Td>
                  <Td className="font-medium">{profil?.businessName ?? "—"}</Td>
                  <Td>{profil ? categoryLabel[profil.category] : "—"}</Td>
                  <Td>{profil?.city ?? "—"}</Td>
                  <Td>
                    <span className="text-sm">{profil?.picName ?? "—"}</span>
                    <p className="tabular text-xs text-muted">
                      {profil?.picPhone ?? ""}
                    </p>
                  </Td>
                  <Td align="right">{profil?.photos.length ?? 0}</Td>
                  <Td className="whitespace-nowrap text-muted">
                    {formatDate(vendor.createdAt)}
                  </Td>
                  <Td>
                    <Badge tone={verificationStatusTone[vendor.status]} icon>
                      {verificationStatusLabel[vendor.status]}
                    </Badge>
                  </Td>
                  <Td>
                    <div className="flex items-center gap-3">
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

        {/* Kartu — mobile */}
        <tbody className="md:hidden">
          {vendors.length === 0 ? (
            <TableEmptyRow
              colSpan={1}
              title="Tidak ada vendor pada penyaringan ini"
              description="Ubah kata kunci atau pilih status lain."
            />
          ) : (
            vendors.map((vendor) => {
              const profil = vendor.vendorProfile;
              const mapsUrl =
                profil?.mapsUrl ??
                (profil?.latitude && profil?.longitude
                  ? `https://maps.google.com/?q=${profil.latitude},${profil.longitude}`
                  : null);
              const menungguDiperiksa = vendor.status === "PENDING";

              return (
                <tr key={`m-${vendor.id}`}>
                  <td className="block px-4 py-3 border-b border-line last:border-0">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0 flex-1">
                        <p className="font-medium text-sm">
                          {profil?.businessName ?? "—"}
                        </p>
                        <p className="text-xs text-muted mt-0.5">
                          {profil ? categoryLabel[profil.category] : "—"} · {profil?.city ?? "—"}
                        </p>
                        <p className="text-xs text-muted mt-0.5">
                          PIC: {profil?.picName ?? "—"} {profil?.picPhone ? `· ${profil.picPhone}` : ""}
                        </p>
                      </div>
                      <div className="shrink-0 flex flex-col items-end gap-2">
                        <Badge tone={verificationStatusTone[vendor.status]} icon>
                          {verificationStatusLabel[vendor.status]}
                        </Badge>
                        <div className="flex items-center gap-2">
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
                            label={menungguDiperiksa ? "Periksa" : "Lihat"}
                            icon={<IconShieldCheck className="h-4 w-4" strokeWidth={2} />}
                            title={profil?.businessName ?? vendor.name}
                            subtitle={
                              profil
                                ? `${categoryLabel[profil.category]} · ${profil.city}`
                                : undefined
                            }
                          >
                            {profil && profil.photos.length > 0 ? (
                              <div className="grid grid-cols-4 gap-2">
                                {profil.photos.map((photo) => (
                                  // eslint-disable-next-line @next/next/no-img-element
                                  <img key={photo} src={photo} alt="" className="aspect-square w-full rounded-lg object-cover" />
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
                                  {profil ? `${profil.address}, ${profil.city}, ${profil.province}` : "—"}
                                </dd>
                              </div>
                              <div className="flex items-start justify-between gap-3">
                                <div className="min-w-0">
                                  <dt className="text-xs font-medium text-muted">Maps</dt>
                                  <dd className="mt-0.5 truncate text-muted">{mapsUrl ?? "—"}</dd>
                                </div>
                                {mapsUrl ? (
                                  <a href={mapsUrl} target="_blank" rel="noreferrer" className="text-brand-600 hover:text-brand-700">
                                    <IconExternal className="h-4 w-4" strokeWidth={2} />
                                  </a>
                                ) : null}
                              </div>
                              <div className="flex items-start justify-between gap-3">
                                <div className="min-w-0">
                                  <dt className="text-xs font-medium text-muted">PIC</dt>
                                  <dd className="tabular mt-0.5">{profil?.picName ?? "—"} — {profil?.picPhone ?? "—"}</dd>
                                </div>
                                {profil?.picPhone ? <CopyButton value={profil.picPhone} iconOnly /> : null}
                              </div>
                              <div>
                                <dt className="text-xs font-medium text-muted">Email akun</dt>
                                <dd className="mt-0.5">{vendor.email} · {vendor._count.campaigns} campaign</dd>
                              </div>
                              <div>
                                <dt className="text-xs font-medium text-muted">Rekening Bank (Refund)</dt>
                                <dd className="mt-0.5">
                                  {profil?.bankName ? (
                                    <span>{profil.bankName} <span className="tabular">{profil.bankAccountNumber}</span> a.n. {profil.bankAccountName ?? "—"}</span>
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
                                <p className="mt-0.5 text-muted">{profil.verificationNote}</p>
                              </div>
                            ) : null}
                          </DetailDrawer>
                        </div>
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
