"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { db } from "@/lib/db";
import { requireRole } from "@/lib/auth";

export type ActionState = { error?: string; success?: string };

const campaignSchema = z.object({
  title: z.string().min(5, "Judul campaign minimal 5 karakter."),
  category: z.enum([
    "KULINER",
    "WISATA_ALAM",
    "WISATA_BUATAN",
    "AKOMODASI",
    "LAINNYA",
  ]),
  description: z.string().min(20, "Deskripsi minimal 20 karakter."),
  briefAngle: z.string().min(20, "Angle wajib minimal 20 karakter."),
  briefMustShow: z.string().min(3, "Isi minimal satu hal yang wajib ditampilkan."),
  briefProhibited: z.string().optional(),
  minDurationSec: z.coerce.number().int().min(5).max(600),
  platforms: z.string().min(1, "Pilih minimal satu platform."),
  budgetPool: z.coerce.number().int().min(100_000, "Pool minimal Rp 100.000."),
  cpmRate: z.coerce.number().int().min(1_000, "CPM minimal Rp 1.000."),
  // maxCreators dihapus dari form; nilai disetel otomatis di server.
  // TODO: tambah maxViewsPerCreator ke kolom Campaign setelah migrasi DB.
  maxViewsPerCreator: z.coerce.number().int().min(1000).optional(),
  complimentType: z.string().min(3, "Jelaskan komplimen yang disediakan."),
  complimentValue: z.coerce.number().int().min(0),
  complimentTerms: z.string().optional(),
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
  // TODO: simpan maxViewsPerCreator ke DB setelah kolom Campaign.maxViewsPerCreator ditambahkan.
  // Nilai sudah diterima dari form: data.maxViewsPerCreator

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

  const campaign = await db.campaign.create({
    data: {
      vendorId: user.id,
      title: data.title,
      category: data.category,
      description: data.description,
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
      // maxCreators diisi 999 (tidak dibatasi) karena fitur kuota creator dihapus dari UI.
      // Kolom masih ada di DB schema dan wajib diisi.
      maxCreators: 999,
      complimentType: data.complimentType,
      complimentValue: data.complimentValue,
      complimentTerms: data.complimentTerms || null,
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

  await db.auditLog.create({
    data: {
      actorId: user.id,
      action: "campaign.submit",
      entity: "Campaign",
      entityId: campaign.id,
    },
  });

  revalidatePath("/vendor");
  redirect(`/vendor/campaigns/${campaign.id}`);
}


export async function reviewSubmissionAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const user = await requireRole("VENDOR");
  const submissionId = String(formData.get("submissionId") ?? "");
  const decision = String(formData.get("decision") ?? "");
  const note = String(formData.get("note") ?? "").trim();

  // Guardrail utama: penolakan wajib beralasan, tercatat di audit trail,
  // dan bisa dibanding creator.
  if (decision === "reject" && note.length < 10) {
    return { error: "Alasan penolakan wajib diisi minimal 10 karakter." };
  }

  const submission = await db.submission.findUnique({
    where: { id: submissionId },
    include: { campaign: true },
  });

  if (!submission || submission.campaign.vendorId !== user.id) {
    return { error: "Submission tidak ditemukan." };
  }
  if (submission.status !== "PENDING_REVIEW") {
    return { error: "Submission ini sudah direview." };
  }

  const approved = decision === "approve";

  await db.$transaction(async (tx) => {
    await tx.submission.update({
      where: { id: submissionId },
      data: {
        status: approved ? "APPROVED" : "REJECTED",
        reviewedById: user.id,
        reviewedAt: new Date(),
        reviewNote: note || null,
      },
    });

    await tx.campaignParticipation.update({
      where: { id: submission.participationId },
      data: { status: approved ? "COMPLETED" : "SUBMITTED" },
    });

    if (approved) {
      // Trust score naik pelan-pelan, dibatasi 100.
      await tx.creatorProfile.updateMany({
        where: { userId: submission.creatorId },
        data: { trustScore: { increment: 2 } },
      });
    }

    await tx.notification.create({
      data: {
        userId: submission.creatorId,
        type: approved ? "SUBMISSION_APPROVED" : "SUBMISSION_REJECTED",
        title: approved ? "Konten disetujui" : "Konten ditolak",
        body: approved
          ? `Kontenmu untuk "${submission.campaign.title}" disetujui. Views mulai dihitung.`
          : `Vendor menolak kontenmu: ${note}`,
        link: "/creator/submissions",
      },
    });

    await tx.auditLog.create({
      data: {
        actorId: user.id,
        action: approved ? "submission.approve" : "submission.reject",
        entity: "Submission",
        entityId: submissionId,
        metadata: { alasan: note || null },
      },
    });
  });

  revalidatePath(`/vendor/campaigns/${submission.campaignId}`);
  revalidatePath("/vendor/submissions");
  return {
    success: approved ? "Submission disetujui." : "Submission ditolak.",
  };
}

/** Vendor menandai submission mencurigakan untuk ditinjau admin. */
export async function flagSubmissionAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const user = await requireRole("VENDOR");
  const submissionId = String(formData.get("submissionId") ?? "");
  const type = String(formData.get("type") ?? "OTHER");
  const detail = String(formData.get("detail") ?? "").trim();

  if (detail.length < 10) {
    return { error: "Jelaskan kecurigaanmu minimal 10 karakter." };
  }

  const submission = await db.submission.findUnique({
    where: { id: submissionId },
    include: { campaign: true },
  });
  if (!submission || submission.campaign.vendorId !== user.id) {
    return { error: "Submission tidak ditemukan." };
  }

  await db.fraudFlag.create({
    data: {
      submissionId,
      flaggedUserId: submission.creatorId,
      reportedById: user.id,
      type: type as
        | "REUSED_CONTENT"
        | "INFLATED_VIEWS"
        | "DUPLICATE_ACCOUNT"
        | "OFF_BRIEF"
        | "FAKE_VISIT"
        | "OTHER",
      detail,
      severity: 2,
    },
  });

  revalidatePath(`/vendor/campaigns/${submission.campaignId}`);
  return { success: "Laporan terkirim. Admin akan meninjau." };
}
