"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { db } from "@/lib/db";
import { requireRole } from "@/lib/auth";

export type ActionState = { error?: string; success?: string };

const campaignSchema = z.object({
  title: z.string().min(5, "Judul campaign minimal 5 karakter.").max(120, "Judul campaign maksimal 120 karakter."),
  category: z.enum([
    "KULINER",
    "WISATA_ALAM",
    "WISATA_BUATAN",
    "AKOMODASI",
    "LAINNYA",
  ]),
  description: z.string().min(20, "Deskripsi minimal 20 karakter.").max(2000, "Deskripsi maksimal 2.000 karakter."),
  briefAngle: z.string().min(20, "Angle wajib minimal 20 karakter.").max(1000, "Angle wajib maksimal 1.000 karakter."),
  briefMustShow: z.string().min(3, "Isi minimal satu hal yang wajib ditampilkan."),
  briefProhibited: z.string().optional(),
  minDurationSec: z.coerce.number().int().min(5, "Durasi minimal 5 detik.").max(600, "Durasi maksimal 600 detik."),
  platforms: z.string().min(1, "Pilih minimal satu platform."),
  budgetPool: z.coerce
    .number()
    .int("Budget pool harus berupa bilangan bulat.")
    .min(100_000, "Pool minimal Rp 100.000.")
    .max(2_000_000_000, "Pool maksimal Rp 2.000.000.000 (2 Miliar)."),
  cpmRate: z.coerce
    .number()
    .int("CPM rate harus berupa bilangan bulat.")
    .min(1_000, "CPM minimal Rp 1.000.")
    .max(10_000_000, "CPM rate maksimal Rp 10.000.000."),
  maxViewsPerCreator: z.coerce
    .number()
    .int("Batas views harus berupa bilangan bulat.")
    .min(1000, "Batas views minimal 1.000.")
    .max(100_000_000, "Batas views maksimal 100.000.000.")
    .optional(),
  startDate: z.string().min(1, "Tanggal mulai wajib diisi."),
  endDate: z.string().min(1, "Tanggal selesai wajib diisi."),
});

/** Pisah textarea multi-baris jadi array, buang baris kosong. */
function toList(value: string | undefined) {
  return (value ?? "")
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);
}

const MAX_IMAGE_BYTES = 3 * 1024 * 1024; // 3 MB
const ALLOWED_IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp"];

/**
 * Simpan file gambar campaign sebagai data URI langsung di kolom `imageUrl`.
 * Project ini belum punya infrastruktur object storage (S3/blob), jadi
 * gambarnya disimpan inline di database — konsisten dengan pendekatan
 * "versi demo" yang sudah dipakai di bagian lain (escrow manual, dst).
 */
async function readImageAsDataUrl(
  file: File | null,
): Promise<{ dataUrl?: string; error?: string }> {
  if (!file || file.size === 0) return {};

  if (!ALLOWED_IMAGE_TYPES.includes(file.type)) {
    return { error: "Format gambar harus JPG, PNG, atau WEBP." };
  }
  if (file.size > MAX_IMAGE_BYTES) {
    return { error: "Ukuran gambar maksimal 3 MB." };
  }

  const buffer = Buffer.from(await file.arrayBuffer());
  return { dataUrl: `data:${file.type};base64,${buffer.toString("base64")}` };
}

export async function createCampaignAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const user = await requireRole("VENDOR");

  if (user.status !== "VERIFIED") {
    return {
      error:
        "Akun vendor kamu belum diverifikasi admin, jadi campaign belum bisa dibuat.",
    };
  }

  const raw = Object.fromEntries(formData.entries());
  const platforms = formData.getAll("platforms").join(",");
  const parsed = campaignSchema.safeParse({ ...raw, platforms });
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  const data = parsed.data;
  const startDate = new Date(data.startDate);
  const endDate = new Date(data.endDate);

  if (endDate <= startDate) {
    return { error: "Tanggal selesai harus setelah tanggal mulai." };
  }

  const mustShow = toList(data.briefMustShow);
  if (mustShow.length === 0) {
    return { error: "Isi minimal satu hal yang wajib ditampilkan." };
  }

  // Validasi: batas views per creator tidak boleh melebihi kapasitas pool.
  if (
    data.maxViewsPerCreator !== undefined &&
    Math.floor((data.maxViewsPerCreator / 1000) * data.cpmRate) > data.budgetPool
  ) {
    return {
      error:
        "Maksimum payout per creator (batas views × CPM) melebihi total budget pool.",
    };
  }

  // Pool harus cukup untuk setidaknya satu creator mencapai 1.000 views,
  // kalau tidak campaign-nya tidak masuk akal secara ekonomi.
  if (data.budgetPool < data.cpmRate) {
    return { error: "Pool budget tidak boleh lebih kecil dari CPM rate." };
  }

  const imageFile = formData.get("imageFile");
  const { dataUrl: imageUrl, error: imageError } = await readImageAsDataUrl(
    imageFile instanceof File ? imageFile : null,
  );
  if (imageError) return { error: imageError };

  let newCampaignId: string;
  try {
    const campaign = await db.campaign.create({
      data: {
        vendorId: user.id,
        title: data.title,
        category: data.category,
        description: data.description,
        imageUrl: imageUrl ?? null,
        briefAngle: data.briefAngle,
        briefMustShow: mustShow,
        briefProhibited: toList(data.briefProhibited),
        minDurationSec: data.minDurationSec,
        allowedPlatforms: data.platforms.split(",") as (
          | "TIKTOK"
          | "INSTAGRAM"
          | "YOUTUBE"
        )[],
        budgetPool: data.budgetPool,
        cpmRate: data.cpmRate,
        maxViewsPerCreator: data.maxViewsPerCreator ?? null,
        startDate,
        endDate,
        // Views masih dilacak seminggu setelah campaign tutup sebelum payout final.
        trackingEndsAt: new Date(endDate.getTime() + 7 * 24 * 60 * 60 * 1000),
        status: "PENDING_REVIEW",
        submittedAt: new Date(),
        // Deposit escrow dicatat menunggu; di versi demo admin yang menandai lunas.
        escrow: {
          create: {
            type: "DEPOSIT",
            amount: data.budgetPool,
            status: "PENDING",
            note: "Menunggu pembayaran deposit budget pool.",
          },
        },
      },
    });

    newCampaignId = campaign.id;

    await db.auditLog.create({
      data: {
        actorId: user.id,
        action: "campaign.submit",
        entity: "Campaign",
        entityId: campaign.id,
      },
    });
  } catch (err) {
    console.error("[createCampaignAction Error]", err);
    return {
      error:
        err instanceof Error
          ? `Gagal membuat campaign: ${err.message}`
          : "Terjadi kesalahan sistem saat membuat campaign.",
    };
  }

  revalidatePath("/vendor");
  redirect(`/vendor/campaigns/${newCampaignId}`);
}
const transferProofSchema = z.object({
  campaignId: z.string().min(1, "Campaign ID wajib diisi."),
  senderBank: z.string().min(2, "Nama bank pengirim wajib diisi (mis. BCA, Mandiri)."),
  senderName: z.string().min(2, "Nama pemilik rekening pengirim wajib diisi."),
  notes: z.string().optional(),
});

/**
 * Konfirmasi manual transfer deposit budget pool oleh vendor.
 * Menyimpan rincian rekening pengirim ke catatan EscrowTransaction dan
 * mengirimkan notifikasi ke seluruh admin untuk pengecekan mutasi bank.
 */
export async function confirmVendorTransferAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const user = await requireRole("VENDOR");
  const raw = Object.fromEntries(formData.entries());
  const parsed = transferProofSchema.safeParse(raw);
  if (!parsed.success) {
    return { error: parsed.error.issues[0].message };
  }

  const { campaignId, senderBank, senderName, notes } = parsed.data;

  const campaign = await db.campaign.findUnique({
    where: { id: campaignId },
    include: {
      escrow: { where: { type: "DEPOSIT" } },
    },
  });

  if (!campaign || campaign.vendorId !== user.id) {
    return { error: "Campaign tidak ditemukan atau bukan milik Anda." };
  }

  const deposit = campaign.escrow[0];
  if (!deposit) {
    return { error: "Catatan transaksi deposit tidak ditemukan." };
  }
  if (deposit.status === "COMPLETED") {
    return { error: "Deposit untuk campaign ini sudah lunas terverifikasi." };
  }

  const noteText = `Transfer via ${senderBank} a.n. ${senderName}${notes ? ` · Catatan: ${notes}` : ""}`;

  try {
    await db.$transaction(async (tx) => {
      await tx.escrowTransaction.update({
        where: { id: deposit.id },
        data: {
          note: noteText,
          reference: `TF-${senderBank.toUpperCase().slice(0, 4)}-${Date.now().toString().slice(-6)}`,
        },
      });

      const admins = await tx.user.findMany({
        where: { role: "ADMIN" },
        select: { id: true },
      });

      if (admins.length > 0) {
        await tx.notification.createMany({
          data: admins.map((adm) => ({
            userId: adm.id,
            type: "GENERAL",
            title: "Konfirmasi transfer vendor",
            body: `Vendor mengonfirmasi transfer deposit untuk campaign "${campaign.title}" (${noteText}). Segera periksa mutasi bank.`,
            link: "/admin/escrow",
          })),
        });
      }

      await tx.auditLog.create({
        data: {
          actorId: user.id,
          action: "escrow.deposit.submit_proof",
          entity: "Campaign",
          entityId: campaignId,
          metadata: { senderBank, senderName, notes: notes || null },
        },
      });
    });
  } catch (err) {
    console.error("[confirmVendorTransferAction Error]", err);
    return { error: "Terjadi kesalahan saat memproses konfirmasi transfer." };
  }

  revalidatePath(`/vendor/campaigns/${campaignId}`);
  revalidatePath("/admin/campaigns");
  revalidatePath("/admin/escrow");

  return {
    success:
      "Konfirmasi transfer berhasil dikirim. Admin akan segera memverifikasi mutasi bank dan mengaktifkan campaign Anda.",
  };
}

const vendorBankSchema = z.object({
  bankName: z.string().min(2, "Nama bank wajib diisi."),
  bankAccountNumber: z.string().min(4, "Nomor rekening wajib diisi minimal 4 digit."),
  bankAccountName: z.string().min(2, "Nama pemilik rekening wajib diisi."),
});

/** Simpan atau perbarui rekening bank vendor untuk pengembalian sisa dana (escrow refund). */
export async function updateVendorBankAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const user = await requireRole("VENDOR");
  const parsed = vendorBankSchema.safeParse({
    bankName: String(formData.get("bankName") ?? "").trim(),
    bankAccountNumber: String(formData.get("bankAccountNumber") ?? "").trim(),
    bankAccountName: String(formData.get("bankAccountName") ?? "").trim(),
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0].message };
  }

  const { bankName, bankAccountNumber, bankAccountName } = parsed.data;

  try {
    await db.vendorProfile.update({
      where: { userId: user.id },
      data: { bankName, bankAccountNumber, bankAccountName },
    });
  } catch (err) {
    console.error("[updateVendorBankAction Error]", err);
    return { error: "Gagal menyimpan informasi rekening bank." };
  }

  const campaignId = formData.get("campaignId");
  if (campaignId && typeof campaignId === "string") {
    revalidatePath(`/vendor/campaigns/${campaignId}`);
  }
  revalidatePath("/vendor");
  revalidatePath("/vendor/campaigns");
  return { success: "Informasi rekening bank refund berhasil disimpan." };
}
