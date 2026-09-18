import { requireRole } from "@/lib/auth";
import { db } from "@/lib/db";
import { formatCompact, formatDate } from "@/lib/format";
import {
  Badge,
  DataTable,
  DetailDrawer,
  IconShieldCheck,
  IconExternal,
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
  SocialPlatform,
  VerificationStatus,
} from "@/generated/prisma/enums";
import {
  creatorAccountStatusLabel,
  creatorAccountStatusTone,
  platformLabel,
} from "@/lib/labels";
import { reviewCreatorAction } from "../actions";
import { DecisionForm } from "../decision-form";

const PAGE_SIZE = 10;
const BASE = "/admin/creators";

export default async function AdminCreatorsPage({
  searchParams,
}: {
  searchParams: Promise<{
    q?: string;
    status?: string;
    platform?: string;
    kota?: string;
    urut?: string;
    page?: string;
    ukuran?: string;
  }>;
}) {
  await requireRole("ADMIN");
  const params = await searchParams;
  const page = Math.max(1, Number(params.page) || 1);
  const pageSize = resolvePageSize(params.ukuran, PAGE_SIZE);
  const status = (params.status ?? "ALL") as VerificationStatus | "ALL";

  const where = {
    role: "CREATOR" as const,
    ...(status === "ALL" ? {} : { status }),
    ...(params.kota ? { creatorProfile: { is: { city: params.kota } } } : {}),
    ...(params.platform
      ? {
          socialAccounts: {
            some: { platform: params.platform as SocialPlatform },
          },
        }
      : {}),
    ...(params.q
      ? {
          OR: [
            { name: { contains: params.q, mode: "insensitive" as const } },
            { email: { contains: params.q, mode: "insensitive" as const } },
            {
              socialAccounts: {
                some: {
                  handle: { contains: params.q, mode: "insensitive" as const },
                },
              },
            },
          ],
        }
      : {}),
  };

  // Trust terendah lebih dulu: itu yang paling perlu diperiksa manusia, bukan
  // yang paling baru mendaftar. Diurutkan di query, bukan setelah paging —
  // mengurutkan hasil satu halaman hanya menata ulang sepuluh baris yang
  // kebetulan terambil.
  const orderBy =
    params.urut === "baru"
      ? ({ createdAt: "desc" } as const)
      : ({ creatorProfile: { trustScore: "asc" } } as const);

  const [creators, total, belumCek, kotaTersedia] = await Promise.all([
    db.user.findMany({
      where,
      include: {
        creatorProfile: true,
        socialAccounts: true,
        _count: {
          select: {
            participations: true,
            submissions: true,
          },
        },
      },
      orderBy,
      ...paginationArgs(page, pageSize),
    }),
    db.user.count({ where }),
    db.user.count({
      where: { role: "CREATOR", status: { in: ["UNVERIFIED", "PENDING"] } },
    }),
    db.creatorProfile.findMany({
      select: { city: true },
      distinct: ["city"],
      orderBy: { city: "asc" },
    }),
  ]);

  return (
    <div>
      <PageHeader
        title="Verifikasi creator"
        description="Pastikan akun media sosial benar milik creator, bukan akun bot atau hasil beli followers. Kepemilikan dibuktikan lewat kode unik yang ditempel di bio."
      />

      <DataTable
        title="Verifikasi Creator"
        summary={`${belumCek} akun belum diverifikasi`}
        tableClassName="w-full text-sm md:min-w-[52rem]"
        toolbar={
          <TableToolbar
            basePath={BASE}
            params={params}
            searchPlaceholder="Cari nama / handle..."
            action={
              <PageSizeSelect basePath={BASE} params={params} pageSize={pageSize} />
            }
            filters={[
              {
                name: "platform",
                label: "Platform",
                options: [
                  { value: "", label: "Semua platform" },
                  ...Object.entries(platformLabel).map(([value, label]) => ({
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
                  { value: "ALL", label: "Semua status" },
                  { value: "UNVERIFIED", label: "Belum cek" },
                  { value: "VERIFIED", label: "Aktif" },
                  { value: "REJECTED", label: "Non-aktif" },
                ],
              },
              {
                name: "urut",
                label: "Urutkan",
                options: [
                  { value: "", label: "Trust terendah" },
                  { value: "baru", label: "Pendaftar terbaru" },
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
            <Th>Creator</Th>
            <Th>Kota</Th>
            <Th>Akun Medsos</Th>
            <Th align="right">Follower</Th>
            <Th align="right">Trust</Th>
            <Th align="right">Campaign</Th>
            <Th>Status</Th>
            <Th>Aksi</Th>
          </tr>
        </thead>
        <tbody className="hidden md:table-row-group">
          {creators.length === 0 ? (
            <TableEmptyRow
              colSpan={10}
              title="Tidak ada creator pada penyaringan ini"
              description="Ubah kata kunci atau pilih status lain."
            />
          ) : (
            creators.map((creator, index) => {
              const totalFollower = creator.socialAccounts.reduce(
                (sum, akun) => sum + akun.followerCount,
                0,
              );
              const sudahDiperiksa =
                creator.status === "VERIFIED" || creator.status === "REJECTED";

              return (
                <tr key={creator.id}>
                  <Td className="tabular text-muted">
                    {rowNumber(index, page, pageSize)}
                  </Td>
                  <Td className="font-medium">{creator.name}</Td>
                  <Td>{creator.creatorProfile?.city ?? "—"}</Td>
                  <Td className="text-muted">
                    {creator.socialAccounts.length === 0
                      ? "—"
                      : creator.socialAccounts
                          .map(
                            (akun) =>
                              `${platformLabel[akun.platform]} @${akun.handle}`,
                          )
                          .join(" · ")}
                  </Td>
                  <Td align="right">{formatCompact(totalFollower)}</Td>
                  <Td align="right">
                    {creator.creatorProfile?.trustScore ?? "—"}
                  </Td>
                  <Td align="right">{creator._count.participations}</Td>
                  <Td>
                    <Badge tone={creatorAccountStatusTone[creator.status]} icon>
                      {creatorAccountStatusLabel[creator.status]}
                    </Badge>
                  </Td>
                  <Td>
                    <DetailDrawer
                      label={sudahDiperiksa ? "Lihat" : "Periksa"}
                      icon={
                        <IconShieldCheck className="h-4 w-4" strokeWidth={2} />
                      }
                      title={creator.name}
                      subtitle={`${creator.creatorProfile?.city ?? "—"} · Bergabung ${formatDate(creator.createdAt)} · Trust ${creator.creatorProfile?.trustScore ?? "—"}`}
                    >
                      <div>
                        <p className="mb-2 text-sm font-semibold">
                          Akun terhubung
                        </p>
                        {creator.socialAccounts.length === 0 ? (
                          <p className="rounded-xl bg-surface-muted px-3 py-2 text-sm text-muted">
                            Belum ada akun media sosial ditautkan.
                          </p>
                        ) : (
                          <ul className="space-y-2">
                            {creator.socialAccounts.map((akun) => (
                              <li
                                key={akun.id}
                                className="flex items-center justify-between gap-3 rounded-xl border border-line px-3 py-2"
                              >
                                <div className="min-w-0">
                                  <p className="text-sm font-medium">
                                    {platformLabel[akun.platform]} @
                                    {akun.handle}
                                  </p>
                                  <p className="tabular text-xs text-muted">
                                    {formatCompact(akun.followerCount)} follower
                                    ·{" "}
                                    {akun.verifiedAt
                                      ? "token cocok"
                                      : "belum dicek"}
                                  </p>
                                </div>
                                <a
                                  href={akun.profileUrl}
                                  target="_blank"
                                  rel="noreferrer"
                                  title="Buka profil"
                                  className="shrink-0 text-brand-600 transition-colors hover:text-brand-700"
                                >
                                  <IconExternal
                                    className="h-4 w-4"
                                    strokeWidth={2}
                                  />
                                </a>
                              </li>
                            ))}
                          </ul>
                        )}
                      </div>

                      <dl className="space-y-3 text-sm">
                        <div>
                          <dt className="text-xs font-medium text-muted">
                            Riwayat
                          </dt>
                          <dd className="mt-0.5">
                            {creator._count.participations} campaign ·{" "}
                            {creator._count.submissions} submission
                          </dd>
                        </div>
                        <div>
                          <dt className="text-xs font-medium text-muted">
                            Rekening
                          </dt>
                          <dd className="tabular mt-0.5">
                            {creator.creatorProfile?.bankName
                              ? `${creator.creatorProfile.bankName} ${creator.creatorProfile.bankAccountNumber ?? ""} a.n. ${creator.creatorProfile.bankAccountName ?? "—"}`
                              : "Belum diisi"}
                          </dd>
                        </div>
                        <div>
                          <dt className="text-xs font-medium text-muted">
                            Kontak
                          </dt>
                          <dd className="mt-0.5">
                            {creator.email}
                            {creator.phone ? ` · ${creator.phone}` : ""}
                          </dd>
                        </div>
                      </dl>

                      <div className="border-t border-line pt-4">
                        <DecisionForm
                          action={reviewCreatorAction}
                          hiddenField="creatorId"
                          hiddenValue={creator.id}
                          approveLabel="Aktif"
                          rejectLabel="Non-aktif"
                          noteLabel="Alasan non-aktif"
                          noteHint="Wajib diisi, dikirim ke creator dan tercatat di audit trail."
                          requireNoteOnApprove
                        />
                      </div>
                    </DetailDrawer>
                  </Td>
                </tr>
              );
            })
          )}
        </tbody>

        {/* Isi Tabel — Mobile (Baris dengan Grid 2 Kolom Sepanjang Tabel) */}
        <tbody className="md:hidden">
          {creators.length === 0 ? (
            <TableEmptyRow
              colSpan={1}
              title="Tidak ada creator pada penyaringan ini"
              description="Ubah kata kunci atau pilih status lain."
            />
          ) : (
            creators.map((creator, index) => {
              const totalFollower = creator.socialAccounts.reduce(
                (sum, akun) => sum + akun.followerCount,
                0,
              );
              const sudahDiperiksa =
                creator.status === "VERIFIED" || creator.status === "REJECTED";

              return (
                <tr key={`m-${creator.id}`} className="border-b border-line last:border-0">
                  <td className="block w-full p-4">
                    {/* Header item */}
                    <div className="flex items-center justify-between gap-2 pb-2.5 border-b border-line">
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="tabular text-xs font-semibold text-muted shrink-0">
                          #{rowNumber(index, page, pageSize)}
                        </span>
                        <h3 className="font-semibold text-sm truncate text-foreground">
                          {creator.name}
                        </h3>
                      </div>
                      <Badge tone={creatorAccountStatusTone[creator.status]} icon>
                        {creatorAccountStatusLabel[creator.status]}
                      </Badge>
                    </div>

                    {/* Grid data 2 kolom */}
                    <div className="grid grid-cols-2 gap-3 py-3 text-xs border-b border-line">
                      <div>
                        <span className="text-[11px] font-medium text-muted uppercase tracking-wider block">
                          Kota
                        </span>
                        <span className="font-medium text-foreground mt-0.5 block">
                          {creator.creatorProfile?.city ?? "—"}
                        </span>
                      </div>
                      <div>
                        <span className="text-[11px] font-medium text-muted uppercase tracking-wider block">
                          Trust Score
                        </span>
                        <span className="font-medium text-foreground mt-0.5 block">
                          {creator.creatorProfile?.trustScore !== null && creator.creatorProfile?.trustScore !== undefined
                            ? `${creator.creatorProfile.trustScore} / 100`
                            : "—"}
                        </span>
                      </div>
                      <div>
                        <span className="text-[11px] font-medium text-muted uppercase tracking-wider block">
                          Akun Sosial & Follower
                        </span>
                        <p className="font-medium text-foreground mt-0.5 truncate">
                          {creator.socialAccounts.length === 0
                            ? "—"
                            : creator.socialAccounts
                                .map((a) => `${platformLabel[a.platform]}: @${a.handle}`)
                                .join(" · ")}
                        </p>
                        <p className="tabular text-muted mt-0.5">
                          {formatCompact(totalFollower)} Follower
                        </p>
                      </div>
                      <div>
                        <span className="text-[11px] font-medium text-muted uppercase tracking-wider block">
                          Campaign
                        </span>
                        <span className="font-medium text-foreground mt-0.5 block">
                          {creator._count.participations} Diikuti
                        </span>
                      </div>
                    </div>

                    {/* Footer baris: Didaftarkan & Aksi */}
                    <div className="flex items-center justify-between pt-2.5">
                      <div className="text-xs text-muted">
                        <span className="text-[11px] block">Didaftarkan:</span>
                        <span className="font-medium text-foreground">{formatDate(creator.createdAt)}</span>
                      </div>
                      <div>
                        <DetailDrawer
                          label={sudahDiperiksa ? "Lihat" : "Periksa"}
                          icon={<IconShieldCheck className="h-3.5 w-3.5" strokeWidth={2} />}
                          title={creator.name}
                          subtitle={`${creator.creatorProfile?.city ?? "—"} · Trust ${creator.creatorProfile?.trustScore ?? "—"}`}
                        >
                          <div>
                            <p className="mb-2 text-sm font-semibold">Akun terhubung</p>
                            {creator.socialAccounts.length === 0 ? (
                              <p className="rounded-xl bg-surface-muted px-3 py-2 text-sm text-muted">
                                Belum ada akun media sosial ditautkan.
                              </p>
                            ) : (
                              <ul className="space-y-2">
                                {creator.socialAccounts.map((akun) => (
                                  <li
                                    key={akun.id}
                                    className="flex items-center justify-between gap-3 rounded-xl border border-line px-3 py-2"
                                  >
                                    <div className="min-w-0">
                                      <p className="text-sm font-medium">
                                        {platformLabel[akun.platform]} @{akun.handle}
                                      </p>
                                      <p className="tabular text-xs text-muted">
                                        {formatCompact(akun.followerCount)} follower ·{" "}
                                        {akun.verifiedAt ? "token cocok" : "belum dicek"}
                                      </p>
                                    </div>
                                    <a
                                      href={akun.profileUrl}
                                      target="_blank"
                                      rel="noreferrer"
                                      className="shrink-0 text-brand-600 hover:text-brand-700"
                                    >
                                      <IconExternal className="h-4 w-4" strokeWidth={2} />
                                    </a>
                                  </li>
                                ))}
                              </ul>
                            )}
                          </div>
                          <dl className="space-y-3 text-sm">
                            <div>
                              <dt className="text-xs font-medium text-muted">Riwayat</dt>
                              <dd className="mt-0.5">
                                {creator._count.participations} campaign · {creator._count.submissions} submission
                              </dd>
                            </div>
                            <div>
                              <dt className="text-xs font-medium text-muted">Rekening</dt>
                              <dd className="tabular mt-0.5">
                                {creator.creatorProfile?.bankName
                                  ? `${creator.creatorProfile.bankName} ${creator.creatorProfile.bankAccountNumber ?? ""} a.n. ${creator.creatorProfile.bankAccountName ?? "—"}`
                                  : "Belum diisi"}
                              </dd>
                            </div>
                            <div>
                              <dt className="text-xs font-medium text-muted">Kontak</dt>
                              <dd className="mt-0.5">
                                {creator.email}
                                {creator.phone ? ` · ${creator.phone}` : ""}
                              </dd>
                            </div>
                          </dl>
                          <div className="border-t border-line pt-4">
                            <DecisionForm
                              action={reviewCreatorAction}
                              hiddenField="creatorId"
                              hiddenValue={creator.id}
                              approveLabel="Aktif"
                              rejectLabel="Non-aktif"
                              noteLabel="Alasan non-aktif"
                              noteHint="Wajib diisi, dikirim ke creator dan tercatat di audit trail."
                              requireNoteOnApprove
                            />
                          </div>
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
