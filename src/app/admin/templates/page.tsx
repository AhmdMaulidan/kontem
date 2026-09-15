import { requireRole } from "@/lib/auth";
import { db } from "@/lib/db";
import { formatDate } from "@/lib/format";
import {
  Badge,
  Callout,
  DataTable,
  IconArchive,
  IconRestore,
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
import type { BusinessCategory } from "@/generated/prisma/enums";
import { categoryLabel } from "@/lib/labels";
import { toggleBriefTemplateAction } from "../actions";
import { SimpleActionForm } from "../decision-form";
import { TemplateForm } from "./template-form";

const PAGE_SIZE = 10;
const BASE = "/admin/templates";

/**
 * Isi `fields` disimpan sebagai Json supaya struktur brief tiap kategori bisa
 * berbeda. Kolom ringkasan hanya perlu panjang tiap daftar, jadi pembacaannya
 * sengaja bertahan terhadap bentuk yang tak terduga.
 */
function ringkasField(fields: unknown): string {
  if (!fields || typeof fields !== "object") return "—";
  const isi = fields as Record<string, unknown>;
  const hitung = (key: string) =>
    Array.isArray(isi[key]) ? (isi[key] as unknown[]).length : 0;

  const bagian: Array<[number, string]> = [
    [hitung("angles"), "angle"],
    [hitung("mustShow"), "must-show"],
    [hitung("prohibited"), "larangan"],
  ];

  const terisi = bagian.filter(([jumlah]) => jumlah > 0);
  if (terisi.length === 0) return "—";
  return terisi.map(([jumlah, nama]) => `${jumlah} ${nama}`).join(" · ");
}

export default async function AdminTemplatesPage({
  searchParams,
}: {
  searchParams: Promise<{
    q?: string;
    kategori?: string;
    status?: string;
    page?: string;
    ukuran?: string;
  }>;
}) {
  await requireRole("ADMIN");
  const params = await searchParams;
  const page = Math.max(1, Number(params.page) || 1);
  const pageSize = resolvePageSize(params.ukuran, PAGE_SIZE);
  const status = params.status ?? "aktif";

  const where = {
    ...(status === "semua" ? {} : { isActive: status === "aktif" }),
    ...(params.kategori
      ? { category: params.kategori as BusinessCategory }
      : {}),
    ...(params.q
      ? { name: { contains: params.q, mode: "insensitive" as const } }
      : {}),
  };

  const [templates, total, aktif] = await Promise.all([
    db.briefTemplate.findMany({
      where,
      include: { _count: { select: { campaigns: true } } },
      orderBy: [{ category: "asc" }, { name: "asc" }],
      ...paginationArgs(page, pageSize),
    }),
    db.briefTemplate.count({ where }),
    db.briefTemplate.count({ where: { isActive: true } }),
  ]);

  return (
    <div>
      <PageHeader
        title="Template brief per kategori"
        description="Struktur brief berbeda antara kuliner dan wisata. Template yang rapi membuat vendor baru tidak perlu menyusun brief dari nol."
      />

      <div className="mb-6">
        <Callout tone="info" title="Mengarsipkan tidak membatalkan campaign">
          Template yang diarsipkan hanya hilang dari pilihan vendor baru.
          Campaign yang sudah memakainya tetap berjalan dengan brief yang sama.
        </Callout>
      </div>

      <DataTable
        title="Template Brief per Kategori"
        summary={`${aktif} template aktif`}
        action={
          <div className="flex items-center gap-3">
            <PageSizeSelect
              basePath={BASE}
              params={params}
              pageSize={pageSize}
            />
            <TemplateForm />
          </div>
        }
        toolbar={
          <TableToolbar
            basePath={BASE}
            params={params}
            searchPlaceholder="Cari nama template..."
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
                name: "status",
                label: "Status",
                options: [
                  { value: "aktif", label: "Aktif" },
                  { value: "arsip", label: "Arsip" },
                  { value: "semua", label: "Semua status" },
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
        <thead>
          <tr>
            <Th>No</Th>
            <Th>Nama Template</Th>
            <Th>Kategori</Th>
            <Th>Isi Field</Th>
            <Th align="right">Dipakai</Th>
            <Th>Diubah</Th>
            <Th>Status</Th>
            <Th>Aksi</Th>
          </tr>
        </thead>
        <tbody>
          {templates.length === 0 ? (
            <TableEmptyRow
              colSpan={8}
              title="Belum ada template pada penyaringan ini"
              description="Tambah template supaya vendor kategori ini punya titik mulai."
            />
          ) : (
            templates.map((template, index) => (
              <tr key={template.id}>
                <Td className="tabular text-muted">
                  {rowNumber(index, page, pageSize)}
                </Td>
                <Td className="font-medium">{template.name}</Td>
                <Td>{categoryLabel[template.category]}</Td>
                <Td className="text-muted">{ringkasField(template.fields)}</Td>
                <Td align="right">{template._count.campaigns}</Td>
                <Td className="whitespace-nowrap text-muted">
                  {formatDate(template.updatedAt)}
                </Td>
                <Td>
                  <Badge tone={template.isActive ? "success" : "neutral"} icon>
                    {template.isActive ? "Aktif" : "Arsip"}
                  </Badge>
                </Td>
                <Td>
                  <div className="flex items-center gap-3">
                    <SimpleActionForm
                      action={toggleBriefTemplateAction}
                      hiddenField="templateId"
                      hiddenValue={template.id}
                      label={template.isActive ? "Arsipkan" : "Aktifkan"}
                      pendingLabel={
                        template.isActive
                          ? "Mengarsipkan..."
                          : "Mengaktifkan..."
                      }
                      icon={
                        template.isActive ? (
                          <IconArchive className="h-4 w-4" strokeWidth={2} />
                        ) : (
                          <IconRestore className="h-4 w-4" strokeWidth={2} />
                        )
                      }
                    />
                  </div>
                </Td>
              </tr>
            ))
          )}
        </tbody>
      </DataTable>
    </div>
  );
}
