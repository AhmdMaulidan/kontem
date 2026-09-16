import { NextRequest } from "next/server";
import { getSession } from "@/lib/auth";
import { db } from "@/lib/db";
import { Role } from "@/generated/prisma/enums";
import { errorResponse, ErrorCode } from "@/lib/api-response";

function escapeCSV(val: unknown): string {
  if (val === null || val === undefined) return "";
  const str = String(val).replace(/"/g, '""');
  return `"${str}"`;
}

function toCSV(headers: string[], rows: (string | number | null | undefined)[][]): string {
  const head = headers.map(escapeCSV).join(",");
  const body = rows.map((r) => r.map(escapeCSV).join(",")).join("\n");
  // Prefix UTF-8 BOM so Excel opens indonesian strings cleanly
  return `\uFEFF${head}\n${body}`;
}

export async function GET(req: NextRequest) {
  const session = await getSession();
  if (!session || session.role !== Role.ADMIN) {
    return errorResponse(
      ErrorCode.UNAUTHORIZED,
      "Unauthorized: Akses ditolak. Hanya administrator yang diizinkan.",
      401,
    );
  }

  const { searchParams } = new URL(req.url);
  const type = searchParams.get("type") ?? "payouts";

  if (type === "payouts") {
    const payouts = await db.payout.findMany({
      include: {
        campaign: { select: { title: true } },
        creator: {
          select: {
            name: true,
            email: true,
            creatorProfile: {
              select: {
                bankName: true,
                bankAccountNumber: true,
                bankAccountName: true,
              },
            },
          },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    const headers = [
      "ID Payout",
      "Campaign",
      "Creator",
      "Email",
      "Views",
      "Porsi (%)",
      "Bruto (Rp)",
      "Fee Platform (Rp)",
      "Net Diterima (Rp)",
      "Status",
      "Nama Bank",
      "No Rekening",
      "Atas Nama",
      "Tanggal Dibuat",
      "Tanggal Cair",
    ];

    const rows = payouts.map((p) => [
      p.id,
      p.campaign.title,
      p.creator.name,
      p.creator.email,
      p.viewsCounted,
      p.sharePercent.toFixed(2),
      p.grossAmount,
      p.platformFee,
      p.netAmount,
      p.status,
      p.creator.creatorProfile?.bankName ?? "-",
      p.creator.creatorProfile?.bankAccountNumber ?? "-",
      p.creator.creatorProfile?.bankAccountName ?? "-",
      p.createdAt.toISOString(),
      p.paidAt ? p.paidAt.toISOString() : "-",
    ]);

    const csv = toCSV(headers, rows);
    return new Response(csv, {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="kontem-payouts-${Date.now()}.csv"`,
      },
    });
  }

  if (type === "escrow") {
    const transactions = await db.escrowTransaction.findMany({
      include: {
        campaign: {
          select: {
            title: true,
            vendor: { select: { name: true, email: true } },
          },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    const headers = [
      "ID Transaksi",
      "Campaign",
      "Vendor",
      "Email Vendor",
      "Tipe",
      "Jumlah (Rp)",
      "Status",
      "Referensi",
      "Catatan",
      "Tanggal Dibuat",
      "Tanggal Selesai",
    ];

    const rows = transactions.map((t) => [
      t.id,
      t.campaign.title,
      t.campaign.vendor.name,
      t.campaign.vendor.email,
      t.type,
      t.amount,
      t.status,
      t.reference ?? "-",
      t.note ?? "-",
      t.createdAt.toISOString(),
      t.completedAt ? t.completedAt.toISOString() : "-",
    ]);

    const csv = toCSV(headers, rows);
    return new Response(csv, {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="kontem-escrow-${Date.now()}.csv"`,
      },
    });
  }

  if (type === "analytics") {
    const campaigns = await db.campaign.findMany({
      include: {
        vendor: {
          select: {
            name: true,
            vendorProfile: { select: { businessName: true, city: true } },
          },
        },
        _count: { select: { participations: true, submissions: true } },
        submissions: { select: { lastViews: true, finalViews: true } },
      },
      orderBy: { createdAt: "desc" },
    });

    const headers = [
      "ID Campaign",
      "Judul",
      "Usaha Vendor",
      "Pemilik Vendor",
      "Kota",
      "Kategori",
      "Status",
      "Budget Pool (Rp)",
      "CPM Rate (Rp)",
      "Slot Terisi",
      "Total Submission",
      "Total Views",
      "Tanggal Mulai",
      "Tanggal Selesai",
      "Tanggal Settle",
    ];

    const rows = campaigns.map((c) => {
      const views = c.submissions.reduce(
        (sum, s) => sum + (s.finalViews ?? s.lastViews),
        0,
      );
      return [
        c.id,
        c.title,
        c.vendor.vendorProfile?.businessName ?? "-",
        c.vendor.name,
        c.vendor.vendorProfile?.city ?? "-",
        c.category,
        c.status,
        c.budgetPool,
        c.cpmRate,
        c._count.participations,
        c._count.submissions,
        views,
        c.startDate.toISOString(),
        c.endDate.toISOString(),
        c.settledAt ? c.settledAt.toISOString() : "-",
      ];
    });

    const csv = toCSV(headers, rows);
    return new Response(csv, {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="kontem-campaigns-analytics-${Date.now()}.csv"`,
      },
    });
  }

  return errorResponse(
    ErrorCode.BAD_REQUEST,
    "Tipe ekspor tidak didukung. Pilihan yang valid: payouts, escrow, analytics.",
    400,
  );
}
