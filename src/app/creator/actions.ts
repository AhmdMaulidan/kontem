"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/lib/db";
import { requireRole } from "@/lib/auth";
import { verifyContentOwnership } from "@/domain/social-url";
import { isWithinCooldown, VIEW_SYNC_COOLDOWN_MS } from "@/domain/views";
import { fetchVideoMetrics } from "@/lib/video-metrics";
import { COUNTABLE_STATUSES } from "@/domain/campaign";
import { calculateCreatorEarning, calculateWithdrawalFee } from "@/domain/withdrawal";
import { formatIDR } from "@/lib/format";

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
        const admins = await tx.user.findMany({
          where: { role: "ADMIN" },
          select: { id: true },
        });
        if (admins.length > 0) {
          await tx.notification.createMany({
            data: admins.map((adm) => ({
              userId: adm.id,
              type: "GENERAL",
              title: "Nomor rekening sama dipakai dua akun creator",
              body: `Kreator "${user.name}" mendaftarkan nomor rekening yang sama dengan kreator "${duplicate.user.name}".`,
              link: "/admin/creators",
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

const withdrawalSchema = z.object({
  submissionId: z.string().min(1),
});

/**
 * Ajukan penarikan dini untuk satu video, sebelum campaign settle.
 *
 * First-come-first-served: sisa budget pool dihitung ulang di dalam transaksi
 * serializable supaya dua creator yang mengajukan bersamaan saat pool tinggal
 * cukup untuk satu tidak sama-sama lolos (pola yang sama dengan guardrail
 * kuota slot yang dulu dipakai di submitContentAction).
 */
export async function requestWithdrawalAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const user = await requireRole("CREATOR");
  const parsed = withdrawalSchema.safeParse(Object.fromEntries(formData.entries()));
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  const submission = await db.submission.findUnique({
    where: { id: parsed.data.submissionId },
    include: { campaign: true, withdrawal: true },
  });

  if (!submission || submission.creatorId !== user.id) {
    return { error: "Submission tidak ditemukan." };
  }
  if (!COUNTABLE_STATUSES.includes(submission.status)) {
    return { error: "Video ini belum disetujui, penghasilannya belum bisa ditarik." };
  }
  if (submission.campaign.status !== "ACTIVE") {
    return { error: "Campaign ini sudah tidak aktif." };
  }
  if (submission.withdrawal) {
    return { error: "Video ini sudah pernah diajukan penarikannya." };
  }

  const creatorProfile = await db.creatorProfile.findUnique({
    where: { userId: user.id },
  });
  if (
    !creatorProfile?.bankName ||
    !creatorProfile.bankAccountNumber ||
    !creatorProfile.bankAccountName
  ) {
    return {
      error: "Lengkapi rekening bank di halaman Penghasilan sebelum menarik dana.",
    };
  }

  const campaign = submission.campaign;
  const earning = calculateCreatorEarning(submission.lastViews, campaign);

  if (
    typeof campaign.minWithdrawalAmount === "number" &&
    earning.grossAmount < campaign.minWithdrawalAmount
  ) {
    return {
      error: `Penghasilan video ini belum mencapai minimum penarikan (${formatIDR(campaign.minWithdrawalAmount)}).`,
    };
  }
  if (earning.grossAmount <= 0) {
    return { error: "Belum ada penghasilan yang bisa ditarik dari video ini." };
  }

  const fee = calculateWithdrawalFee(earning.grossAmount);

  try {
    await db.$transaction(
      async (tx) => {
        // Reservasi FCFS: penarikan yang masih menunggu approval pun ikut
        // dihitung sebagai "sudah dipakai" — supaya sisa pool tidak jebol
        // kalau ada beberapa request menunggu bersamaan.
        const sudahDitarik = await tx.withdrawal.aggregate({
          where: {
            campaignId: campaign.id,
            status: { in: ["PENDING_ADMIN_APPROVAL", "APPROVED", "PAID"] },
          },
          _sum: { grossAmount: true },
        });
        const sisaPool = campaign.budgetPool - (sudahDitarik._sum.grossAmount ?? 0);
        if (earning.grossAmount > sisaPool) {
          throw new Error(
            "Sisa budget pool campaign ini tidak cukup untuk menarik sebesar itu.",
          );
        }

        await tx.withdrawal.create({
          data: {
            creatorId: user.id,
            campaignId: campaign.id,
            submissionId: submission.id,
            viewsCounted: earning.viewsCounted,
            grossAmount: earning.grossAmount,
            feeAmount: fee.feeAmount,
            netAmount: fee.netAmount,
            bankName: creatorProfile.bankName,
            bankAccountNumber: creatorProfile.bankAccountNumber,
            bankAccountName: creatorProfile.bankAccountName,
          },
        });

        const admins = await tx.user.findMany({
          where: { role: "ADMIN" },
          select: { id: true },
        });
        if (admins.length > 0) {
          await tx.notification.createMany({
            data: admins.map((admin) => ({
              userId: admin.id,
              type: "GENERAL",
              title: "Permintaan penarikan dana baru",
              body: `${user.name} mengajukan penarikan ${formatIDR(fee.netAmount)} dari campaign "${campaign.title}".`,
              link: "/admin/submissions?tab=penarikan",
            })),
          });
        }

        await tx.auditLog.create({
          data: {
            actorId: user.id,
            action: "withdrawal.request",
            entity: "Submission",
            entityId: submission.id,
            metadata: { grossAmount: earning.grossAmount, netAmount: fee.netAmount },
          },
        });
      },
      { isolationLevel: "Serializable" },
    );
  } catch (err) {
    console.error("[requestWithdrawalAction Error]", err);
    return {
      error:
        err instanceof Error
          ? err.message
          : "Terjadi kesalahan sistem saat mengajukan penarikan.",
    };
  }

  revalidatePath("/creator/earnings");
  revalidatePath("/admin/submissions");
  return {
    success: "Penarikan diajukan. Menunggu approval admin sebelum dana ditransfer.",
  };
}

/**
 * Segarkan jumlah views dari submission oleh kreator pemilik konten.
 * Dilengkapi proteksi jeda waktu 5 menit (throttling) dan penarikan metrik otomatis.
 */
export async function refreshCreatorSubmissionViewsAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const user = await requireRole("CREATOR");
  const submissionId = String(formData.get("submissionId") ?? "");
  if (!submissionId) return { error: "ID submission tidak valid." };

  const submission = await db.submission.findUnique({
    where: { id: submissionId },
    include: {
      creator: {
        include: { socialAccounts: true },
      },
    },
  });

  if (!submission || submission.creatorId !== user.id) {
    return { error: "Submission tidak ditemukan." };
  }

  // 1. Throttling jeda 5 menit
  if (isWithinCooldown(submission.lastSyncedAt)) {
    const elapsedMs = Date.now() - new Date(submission.lastSyncedAt!).getTime();
    const remainingSeconds = Math.ceil((VIEW_SYNC_COOLDOWN_MS - elapsedMs) / 1000);
    const remainingMinutes = Math.ceil(remainingSeconds / 60);
    return {
      error: `Views baru saja diperbarui. Mohon tunggu jeda 5 menit (sisa ~${remainingMinutes} menit) sebelum menyegarkan kembali.`,
    };
  }

  // 2. Fetch metrik dari platform
  let metrics;
  try {
    metrics = await fetchVideoMetrics(submission.platform, submission.contentUrl);
  } catch (err) {
    return {
      error: `Gagal memperbarui views otomatis: ${err instanceof Error ? err.message : "Kesalahan jaringan"}`,
    };
  }

  // 3. Simpan perubahan secara atomik
  await db.$transaction(async (tx) => {
    await tx.submission.update({
      where: { id: submissionId },
      data: {
        lastViews: metrics.views,
        lastLikes: metrics.likes,
        lastComments: metrics.comments,
        lastSyncedAt: new Date(),
      },
    });

    await tx.viewSnapshot.create({
      data: {
        submissionId,
        views: metrics.views,
        likes: metrics.likes,
        comments: metrics.comments,
        source: "API",
      },
    });

    await tx.auditLog.create({
      data: {
        actorId: user.id,
        action: "submission.views.sync_creator",
        entity: "Submission",
        entityId: submissionId,
        metadata: {
          dari: submission.lastViews,
          ke: metrics.views,
          platform: submission.platform,
        },
      },
    });
  });

  revalidatePath("/creator/submissions");
  revalidatePath("/creator/earnings");
  return {
    success: `Views berhasil diperbarui: ${metrics.views.toLocaleString("id-ID")} views.`,
  };
}

/**
 * Hapus submission dan reset partisipasi agar kreator dapat mengirim ulang
 * konten baru jika terdapat kesalahan atau submission ditolak.
 */
export async function deleteSubmissionAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const user = await requireRole("CREATOR");
  const submissionId = String(formData.get("submissionId") ?? "");
  if (!submissionId) return { error: "ID submission tidak valid." };

  const submission = await db.submission.findUnique({
    where: { id: submissionId },
    include: {
      campaign: true,
      withdrawal: true,
      payout: true,
    },
  });

  if (!submission || submission.creatorId !== user.id) {
    return { error: "Submission tidak ditemukan." };
  }

  if (submission.payout) {
    return {
      error: "Submission tidak dapat dihapus karena sudah memiliki data pembayaran (payout).",
    };
  }

  if (submission.withdrawal && submission.withdrawal.status !== "REJECTED") {
    return {
      error:
        "Submission tidak dapat dihapus karena memiliki pengajuan penarikan dana aktif atau sudah dicairkan.",
    };
  }

  if (submission.campaign.status === "SETTLED") {
    return {
      error: "Submission tidak dapat dihapus karena campaign sudah diselesaikan (settled).",
    };
  }

  try {
    await db.$transaction(async (tx) => {
      // Hapus submission
      await tx.submission.delete({
        where: { id: submissionId },
      });

      // Reset / hapus partisipasi sehingga slot partisipasi terbuka kembali
      // dan kreator bisa mengirim ulang konten baru jika campaign masih aktif
      await tx.campaignParticipation.delete({
        where: { id: submission.participationId },
      });

      await tx.auditLog.create({
        data: {
          actorId: user.id,
          action: "submission.delete",
          entity: "Submission",
          entityId: submissionId,
          metadata: {
            campaignId: submission.campaignId,
            contentUrl: submission.contentUrl,
            platform: submission.platform,
            lastViews: submission.lastViews,
            status: submission.status,
          },
        },
      });
    });
  } catch (err) {
    console.error("[deleteSubmissionAction Error]", err);
    return {
      error:
        err instanceof Error
          ? err.message
          : "Terjadi kesalahan sistem saat menghapus submission.",
    };
  }

  revalidatePath("/creator/submissions");
  revalidatePath(`/creator/campaigns/${submission.campaignId}`);
  revalidatePath("/creator/campaigns");
  revalidatePath(`/vendor/campaigns/${submission.campaignId}`);
  revalidatePath("/admin/submissions");
  return {
    success: "Submission berhasil dihapus. Kamu dapat mengirim ulang konten untuk campaign ini.",
  };
}

