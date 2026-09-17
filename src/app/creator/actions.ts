"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/lib/db";
import { requireRole } from "@/lib/auth";
import { verifyContentOwnership } from "@/domain/social-url";

export type ActionState = { error?: string; success?: string };

const submitSchema = z.object({
  campaignId: z.string().min(1),
  contentUrl: z.string().url("Link konten tidak valid."),
  platform: z.enum(["TIKTOK", "INSTAGRAM", "YOUTUBE"]),
  caption: z.string().optional(),
});

/**
 * Kirim konten langsung untuk sebuah campaign. Tidak ada lagi tahap klaim
 * slot maupun verifikasi kunjungan terpisah — participation dan submission
 * dibuat sekaligus begitu creator submit link konten. Tidak ada batas kuota
 * jumlah creator per campaign.
 */
export async function submitContentAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const user = await requireRole("CREATOR");
  const parsed = submitSchema.safeParse(Object.fromEntries(formData.entries()));
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  const { campaignId, contentUrl, platform, caption } = parsed.data;

  const campaign = await db.campaign.findUnique({ where: { id: campaignId } });
  if (!campaign) return { error: "Campaign tidak ditemukan." };
  if (campaign.status !== "ACTIVE") {
    return { error: "Campaign ini sedang tidak menerima peserta." };
  }
  if (new Date() > campaign.endDate) {
    return { error: "Periode campaign sudah berakhir." };
  }
  if (!campaign.allowedPlatforms.includes(platform)) {
    return { error: "Platform ini tidak diizinkan di campaign tersebut." };
  }

  const sudahIkut = await db.campaignParticipation.findUnique({
    where: { campaignId_creatorId: { campaignId, creatorId: user.id } },
  });
  if (sudahIkut) return { error: "Kamu sudah pernah mengirim konten untuk campaign ini." };

  // Guardrail akun tertaut: kreator wajib memiliki akun media sosial terdaftar untuk platform ini
  const socialAccount = await db.socialAccount.findFirst({
    where: { userId: user.id, platform },
  });

  if (!socialAccount) {
    const platformLabelName =
      platform === "TIKTOK"
        ? "TikTok"
        : platform === "INSTAGRAM"
          ? "Instagram"
          : "YouTube";
    return {
      error: `Kamu belum menautkan akun ${platformLabelName} di profilmu. Tautkan akun ${platformLabelName} terlebih dahulu sebelum mengirim konten.`,
    };
  }

  // Guardrail anti-hijack: pastikan handle dari URL video cocok dengan akun terdaftar kreator
  const ownership = verifyContentOwnership({
    url: contentUrl,
    platform,
    registeredHandle: socialAccount.handle,
  });

  if (!ownership.isValid) {
    return { error: ownership.error || "Kepemilikan akun konten tidak valid." };
  }

  // Link yang sama tidak boleh dipakai ulang di campaign lain.
  const duplikat = await db.submission.findFirst({ where: { contentUrl } });
  if (duplikat) {
    return { error: "Link konten ini sudah pernah dikirim." };
  }

  try {
    await db.$transaction(async (tx) => {
      const participation = await tx.campaignParticipation.create({
        data: { campaignId, creatorId: user.id, status: "SUBMITTED" },
      });

      await tx.submission.create({
        data: {
          campaignId,
          creatorId: user.id,
          participationId: participation.id,
          contentUrl,
          platform,
          caption: caption || null,
        },
      });

      await tx.notification.create({
        data: {
          userId: campaign.vendorId,
          type: "GENERAL",
          title: "Submission baru masuk",
          body: `${user.name} mengirim konten untuk "${campaign.title}".`,
          link: `/vendor/campaigns/${campaignId}`,
        },
      });
    });
  } catch (err) {
    console.error("[submitContentAction Error]", err);
    return {
      error:
        err instanceof Error
          ? err.message
          : "Terjadi kesalahan sistem saat mengirim konten.",
    };
  }

  revalidatePath("/creator/submissions");
  revalidatePath(`/creator/campaigns/${campaignId}`);
  return { success: "Konten terkirim, menunggu review admin." };
}

export async function appealAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const user = await requireRole("CREATOR");
  const submissionId = String(formData.get("submissionId") ?? "");
  const reason = String(formData.get("reason") ?? "").trim();

  if (reason.length < 20) {
    return { error: "Jelaskan alasan banding minimal 20 karakter." };
  }

  const submission = await db.submission.findUnique({
    where: { id: submissionId },
    include: { campaign: true },
  });

  if (!submission || submission.creatorId !== user.id) {
    return { error: "Submission tidak ditemukan." };
  }
  if (submission.status !== "REJECTED") {
    return { error: "Hanya submission yang ditolak yang bisa dibanding." };
  }

  try {
    await db.$transaction(async (tx) => {
      await tx.submission.update({
        where: { id: submissionId },
        data: { status: "APPEALED" },
      });
      const dispute = await tx.dispute.create({
        data: { submissionId, openedById: user.id, reason, status: "OPEN" },
      });
      await tx.disputeMessage.create({
        data: { disputeId: dispute.id, senderId: user.id, body: reason },
      });
      await tx.auditLog.create({
        data: {
          actorId: user.id,
          action: "submission.appeal",
          entity: "Submission",
          entityId: submissionId,
          metadata: { alasan: reason },
        },
      });
    });
  } catch (err) {
    console.error("[appealAction Error]", err);
    return { error: "Terjadi kesalahan sistem saat mengajukan banding." };
  }

  revalidatePath("/creator/submissions");
  return { success: "Banding diajukan. Admin akan meninjau dalam 2x24 jam." };
}

export async function updateBankAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const user = await requireRole("CREATOR");
  const bankName = String(formData.get("bankName") ?? "").trim();
  const bankAccountNumber = String(formData.get("bankAccountNumber") ?? "").trim();
  const bankAccountName = String(formData.get("bankAccountName") ?? "").trim();

  if (!bankName || !bankAccountNumber || !bankAccountName) {
    return { error: "Semua kolom rekening wajib diisi." };
  }

  const duplicate = await db.creatorProfile.findFirst({
    where: {
      userId: { not: user.id },
      bankAccountNumber,
    },
    include: { user: true },
  });

  try {
    await db.$transaction(async (tx) => {
      await tx.creatorProfile.update({
        where: { userId: user.id },
        data: { bankName, bankAccountNumber, bankAccountName },
      });

      if (duplicate) {
        await tx.fraudFlag.create({
          data: {
            flaggedUserId: user.id,
            reportedById: null, // terdeteksi otomatis oleh sistem
            type: "DUPLICATE_ACCOUNT",
            severity: 3,
            detail: `Nomor rekening ${bankAccountNumber} (${bankName} a.n. ${bankAccountName}) sama persis dengan akun kreator lain "${duplicate.user.name}" (ID: ${duplicate.userId}).`,
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
              title: "Peringatan Akun Ganda (Sybil)",
              body: `Kreator "${user.name}" mendaftarkan nomor rekening yang sama dengan kreator "${duplicate.user.name}". Periksa di panel Fraud.`,
              link: "/admin/fraud",
            })),
          });
        }
      }
    });
  } catch (err) {
    console.error("[updateBankAction Error]", err);
    return { error: "Terjadi kesalahan sistem saat menyimpan rekening bank." };
  }

  revalidatePath("/creator/earnings");
  revalidatePath("/admin/fraud");
  return { success: "Rekening tersimpan." };
}

export async function markNotificationsReadAction() {
  const user = await requireRole("CREATOR");
  await db.notification.updateMany({
    where: { userId: user.id, readAt: null },
    data: { readAt: new Date() },
  });
  revalidatePath("/creator/notifications");
}
