"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/lib/db";
import { requireRole } from "@/lib/auth";
import {
  validateViewUpdateThrottle,
  MAX_VIEW_UPDATES_PER_MINUTE,
} from "@/domain/views";
import { checkRateLimit } from "@/lib/rate-limit";
import { fetchVideoMetrics } from "@/lib/video-metrics";
import { runCampaignLifecycleSync } from "@/domain/lifecycle";
import { broadcastNewCampaignToNearbyCreators } from "@/domain/notification";
import { formatIDR } from "@/lib/format";

export type ActionState = { error?: string; success?: string };

async function logAction(
  actorId: string,
  action: string,
  entity: string,
  entityId: string,
  metadata?: Record<string, string | number | boolean | null>,
) {
  await db.auditLog.create({
    data: { actorId, action, entity, entityId, metadata: metadata ?? undefined },
  });
}

// ---------------------------------------------------------------- vendor

export async function reviewVendorAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const admin = await requireRole("ADMIN");
  const vendorId = String(formData.get("vendorId") ?? "");
  const decision = String(formData.get("decision") ?? "");
  const note = String(formData.get("note") ?? "").trim();

  if (decision === "reject" && note.length < 10) {
    return { error: "Alasan penolakan wajib diisi minimal 10 karakter." };
  }

  const vendor = await db.user.findUnique({
    where: { id: vendorId },
    include: { vendorProfile: true },
  });
  if (!vendor?.vendorProfile) return { error: "Vendor tidak ditemukan." };

  const approved = decision === "approve";

  try {
    await db.$transaction([
      db.user.update({
        where: { id: vendorId },
        data: { status: approved ? "VERIFIED" : "REJECTED" },
      }),
      db.vendorProfile.update({
        where: { userId: vendorId },
        data: approved
          ? {
              verifiedAt: new Date(),
              verifiedById: admin.id,
              verificationNote: note || null,
              rejectionReason: null,
            }
          : { rejectionReason: note, verifiedAt: null },
      }),
      db.notification.create({
        data: {
          userId: vendorId,
          type: approved ? "VENDOR_VERIFIED" : "GENERAL",
          title: approved ? "Bisnis terverifikasi" : "Verifikasi ditolak",
          body: approved
            ? "Kamu sudah bisa membuat campaign."
            : `Verifikasi ditolak: ${note}`,
          link: "/vendor",
        },
      }),
    ]);

    await logAction(admin.id, approved ? "vendor.verify" : "vendor.reject", "VendorProfile", vendorId, { catatan: note || null });
  } catch (err) {
    console.error("[reviewVendorAction Error]", err);
    return { error: "Terjadi kesalahan sistem saat memproses peninjauan vendor." };
  }

  revalidatePath("/admin/vendors");
  return { success: approved ? "Vendor diverifikasi." : "Vendor ditolak." };
}

// ---------------------------------------------------------------- creator

export async function reviewCreatorAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const admin = await requireRole("ADMIN");
  const creatorId = String(formData.get("creatorId") ?? "");
  const decision = String(formData.get("decision") ?? "");
  const note = String(formData.get("note") ?? "").trim();

  if (decision === "reject" && note.length < 10) {
    return { error: "Alasan non-aktif wajib diisi minimal 10 karakter." };
  }

  const creator = await db.user.findUnique({
    where: { id: creatorId },
    include: { creatorProfile: true },
  });
  if (!creator?.creatorProfile) return { error: "Creator tidak ditemukan." };

  // "decision" cuma dua nilai (approve/reject) karena skema statusnya belum
  // punya nilai khusus non-aktif — REJECTED dipakai ganda untuk menolak
  // pengajuan awal maupun menonaktifkan akun yang sudah pernah aktif.
  const aktif = decision === "approve";

  try {
    await db.$transaction([
      db.user.update({
        where: { id: creatorId },
        data: { status: aktif ? "VERIFIED" : "REJECTED" },
      }),
      db.notification.create({
        data: {
          userId: creatorId,
          type: "GENERAL",
          title: aktif ? "Akun diaktifkan" : "Akun dinonaktifkan",
          body: aktif
            ? "Akunmu aktif. Kamu sudah bisa klaim campaign."
            : `Akunmu dinonaktifkan: ${note}`,
          link: "/creator",
        },
      }),
    ]);

    await logAction(admin.id, aktif ? "creator.activate" : "creator.deactivate", "CreatorProfile", creatorId, { catatan: note || null });
  } catch (err) {
    console.error("[reviewCreatorAction Error]", err);
    return { error: "Terjadi kesalahan sistem saat memproses peninjauan creator." };
  }

  revalidatePath("/admin/creators");
  return { success: aktif ? "Creator diaktifkan." : "Creator dinonaktifkan." };
}

// ---------------------------------------------------------------- campaign

export async function reviewCampaignAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const admin = await requireRole("ADMIN");
  const campaignId = String(formData.get("campaignId") ?? "");
  const decision = String(formData.get("decision") ?? "");
  const note = String(formData.get("note") ?? "").trim();

  if (decision === "reject" && note.length < 10) {
    return { error: "Alasan penolakan wajib diisi minimal 10 karakter." };
  }

  const campaign = await db.campaign.findUnique({
    where: { id: campaignId },
    include: {
      vendor: { include: { vendorProfile: true } },
      escrow: true,
    },
  });
  if (!campaign) return { error: "Campaign tidak ditemukan." };
  if (campaign.status !== "PENDING_REVIEW") {
    return { error: "Campaign ini sudah diputuskan." };
  }

  const approved = decision === "approve";

  // Campaign hanya boleh live kalau deposit budget pool sudah lunas —
  // ini yang membuat creator aman bekerja lebih dulu.
  if (approved) {
    const deposit = campaign.escrow.find((trx) => trx.type === "DEPOSIT");
    if (!deposit || deposit.status !== "COMPLETED") {
      return {
        error:
          "Deposit budget pool belum lunas. Tandai deposit diterima sebelum menyetujui campaign.",
      };
    }
    if (campaign.vendor.status !== "VERIFIED") {
      return { error: "Vendor belum terverifikasi." };
    }
  }

  try {
    await db.$transaction([
      db.campaign.update({
        where: { id: campaignId },
        data: approved
          ? {
              status: "ACTIVE",
              approvedAt: new Date(),
              approvedById: admin.id,
              rejectionReason: null,
            }
          : { status: "REJECTED", rejectionReason: note },
      }),
      db.notification.create({
        data: {
          userId: campaign.vendorId,
          type: "GENERAL",
          title: approved ? "Campaign disetujui" : "Campaign ditolak",
          body: approved
            ? `"${campaign.title}" sudah live dan terlihat creator.`
            : `"${campaign.title}" ditolak: ${note}`,
          link: `/vendor/campaigns/${campaignId}`,
        },
      }),
    ]);

    let creatorsNotified = 0;
    const vendorCity = campaign.vendor.vendorProfile?.city;
    if (approved && vendorCity) {
      const broadcast = await broadcastNewCampaignToNearbyCreators(db, {
        campaignId: campaign.id,
        campaignTitle: campaign.title,
        businessName: campaign.vendor.vendorProfile?.businessName ?? campaign.vendor.name,
        city: vendorCity,
      });
      creatorsNotified = broadcast.count;
    }

    await logAction(
      admin.id,
      approved ? "campaign.approve" : "campaign.reject",
      "Campaign",
      campaignId,
      {
        catatan: note || null,
        ...(approved ? { kota: vendorCity ?? null, creatorsNotified } : {}),
      },
    );

    revalidatePath("/admin/campaigns");
    return {
      success: approved
        ? `Campaign disetujui dan live.${creatorsNotified > 0 ? ` Notifikasi disiarkan ke ${creatorsNotified} creator di ${vendorCity}.` : ""}`
        : "Campaign ditolak.",
    };
  } catch (err) {
    console.error("[reviewCampaignAction Error]", err);
    return { error: "Terjadi kesalahan sistem saat memproses peninjauan campaign." };
  }
}

/** Pemicu manual sinkronisasi siklus hidup kampanye oleh admin. */
export async function triggerLifecycleCheckAction(): Promise<ActionState> {
  const admin = await requireRole("ADMIN");

  try {
    const result = await runCampaignLifecycleSync(db);

    await logAction(admin.id, "campaign.lifecycle.sync_manual", "System", "Lifecycle", {
      campaignsEnded: result.campaignsEnded,
      campaignsSettled: result.campaignsSettled,
    });

    revalidatePath("/admin/campaigns");
    revalidatePath("/admin/payouts");
    revalidatePath("/creator");
    revalidatePath("/vendor");

    return {
      success: `Siklus diperiksa: ${result.campaignsEnded} campaign berakhir, ${result.campaignsSettled} otomatis disettle.`,
    };
  } catch (error) {
    return {
      error:
        error instanceof Error
          ? error.message
          : "Gagal menjalankan sinkronisasi siklus hidup kampanye.",
    };
  }
}

/** Tandai deposit escrow vendor sudah diterima (di produksi: webhook payment gateway). */
export async function confirmDepositAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const admin = await requireRole("ADMIN");
  const campaignId = String(formData.get("campaignId") ?? "");

  const deposit = await db.escrowTransaction.findFirst({
    where: { campaignId, type: "DEPOSIT" },
    include: { campaign: true },
  });
  if (!deposit) return { error: "Transaksi deposit tidak ditemukan." };
  if (deposit.status === "COMPLETED") return { error: "Deposit sudah lunas." };

  try {
    await db.$transaction([
      db.escrowTransaction.update({
        where: { id: deposit.id },
        data: {
          status: "COMPLETED",
          completedAt: new Date(),
          reference: deposit.reference || `MANUAL-${Date.now()}`,
          note: deposit.note
            ? `${deposit.note} · Diverifikasi oleh Admin (${admin.name})`
            : `Dikonfirmasi manual oleh admin (${admin.name}) setelah cek mutasi bank.`,
        },
      }),
      db.notification.create({
        data: {
          userId: deposit.campaign.vendorId,
          type: "GENERAL",
          title: "Deposit escrow diterima",
          body: `Deposit budget pool sebesar ${deposit.amount.toLocaleString("id-ID")} rupiah untuk "${deposit.campaign.title}" telah diverifikasi dan dikunci aman di escrow.`,
          link: `/vendor/campaigns/${campaignId}`,
        },
      }),
    ]);

    await logAction(admin.id, "escrow.deposit.confirm", "Campaign", campaignId, {
      jumlah: deposit.amount,
      referensi: deposit.reference || null,
    });
  } catch (err) {
    console.error("[confirmDepositAction Error]", err);
    return { error: "Terjadi kesalahan sistem saat memproses konfirmasi deposit." };
  }

  revalidatePath("/admin/campaigns");
  revalidatePath("/admin/escrow");
  revalidatePath(`/vendor/campaigns/${campaignId}`);
  return { success: "Deposit ditandai lunas dan dana dikunci di escrow." };
}

/** Tandai pengembalian sisa dana escrow (refund) ke rekening vendor sudah ditransfer. */
export async function confirmRefundAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const admin = await requireRole("ADMIN");
  const transactionId = String(formData.get("transactionId") ?? "");
  const campaignId = String(formData.get("campaignId") ?? "");

  const refundTrx = await db.escrowTransaction.findFirst({
    where: transactionId
      ? { id: transactionId, type: "REFUND" }
      : { campaignId, type: "REFUND" },
    include: {
      campaign: {
        include: {
          vendor: {
            include: { vendorProfile: true },
          },
        },
      },
    },
  });

  if (!refundTrx) {
    return { error: "Transaksi refund tidak ditemukan." };
  }

  if (refundTrx.status === "COMPLETED") {
    return { error: "Refund ini sudah diselesaikan sebelumnya." };
  }

  const vendorBank = refundTrx.campaign.vendor.vendorProfile;
  const bankInfoText =
    vendorBank?.bankName && vendorBank?.bankAccountNumber
      ? `ke rekening ${vendorBank.bankName} ${vendorBank.bankAccountNumber} a.n. ${vendorBank.bankAccountName ?? "-"}`
      : "ke rekening vendor";

  const refCode = `REFUND-${Date.now().toString().slice(-8)}`;

  try {
    await db.$transaction([
      db.escrowTransaction.update({
        where: { id: refundTrx.id },
        data: {
          status: "COMPLETED",
          completedAt: new Date(),
          reference: refCode,
          note: `Sisa pool dikembalikan ${bankInfoText}. Dikonfirmasi oleh admin (${admin.name}).`,
        },
      }),
      db.notification.create({
        data: {
          userId: refundTrx.campaign.vendorId,
          type: "GENERAL",
          title: "Refund sisa budget dicairkan",
          body: `Sisa budget pool campaign "${refundTrx.campaign.title}" sebesar ${refundTrx.amount.toLocaleString("id-ID")} rupiah telah ditransfer ${bankInfoText} (Ref: ${refCode}).`,
          link: `/vendor/campaigns/${refundTrx.campaignId}`,
        },
      }),
    ]);

    await logAction(admin.id, "escrow.refund.confirm", "EscrowTransaction", refundTrx.id, {
      campaignId: refundTrx.campaignId,
      jumlah: refundTrx.amount,
      referensi: refCode,
    });
  } catch (err) {
    console.error("[confirmRefundAction Error]", err);
    return { error: "Terjadi kesalahan sistem saat memproses konfirmasi refund." };
  }

  revalidatePath("/admin/escrow");
  revalidatePath("/admin/campaigns");
  revalidatePath(`/admin/campaigns/${refundTrx.campaignId}`);
  revalidatePath(`/vendor/campaigns/${refundTrx.campaignId}`);
  revalidatePath("/vendor");

  return {
    success: `Refund sebesar ${refundTrx.amount.toLocaleString("id-ID")} rupiah berhasil dikonfirmasi dan dicatat selesai.`,
  };
}


// ---------------------------------------------------------------- views

const viewsSchema = z.object({
  submissionId: z.string().min(1),
  views: z.coerce
    .number()
    .int()
    .min(0, "Views tidak boleh negatif.")
    .max(1_000_000_000, "Views tidak boleh melebihi 1 miliar."),
  likes: z.coerce.number().int().min(0).max(1_000_000_000).optional(),
  comments: z.coerce.number().int().min(0).max(1_000_000_000).optional(),
  isCorrection: z.coerce.boolean().optional(),
});

/**
 * Pembaruan views manual dengan Rate Limiting dan Throttling:
 * 1. Rate Limiting: Maksimal 20 kali update per menit per admin.
 * 2. Throttling: Jeda minimal 5 menit per konten untuk mencegah spam snapshot dan fluktuasi palsu.
 * 3. Mode Koreksi (isCorrection): Bypass jeda throttling jika admin bermaksud merevisi typo angka.
 */
export async function updateViewsAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const admin = await requireRole("ADMIN");
  const parsed = viewsSchema.safeParse(Object.fromEntries(formData.entries()));
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  const { submissionId, views, likes, comments, isCorrection } = parsed.data;

  // 1. Rate Limiting per Admin (Maks 20 update per menit)
  const rateLimit = checkRateLimit(
    `admin:${admin.id}:views_update`,
    MAX_VIEW_UPDATES_PER_MINUTE,
    60_000,
  );
  if (!rateLimit.allowed) {
    const retrySec = Math.ceil(rateLimit.retryAfterMs / 1000);
    return {
      error: `Batas frekuensi pembaruan tercapai (maksimal ${MAX_VIEW_UPDATES_PER_MINUTE} aksi/menit). Harap tunggu ${retrySec} detik sebelum memperbarui views lagi.`,
    };
  }

  const submission = await db.submission.findUnique({
    where: { id: submissionId },
  });
  if (!submission) return { error: "Submission tidak ditemukan." };

  // 2. Throttling per Submission (Jeda minimal 5 menit)
  const throttle = validateViewUpdateThrottle(
    submission.lastSyncedAt,
    Boolean(isCorrection),
  );
  if (!throttle.allowed) {
    return { error: throttle.message };
  }

  try {
    await db.$transaction(async (tx) => {
      await tx.submission.update({
        where: { id: submissionId },
        data: {
          lastViews: views,
          lastLikes: likes ?? submission.lastLikes,
          lastComments: comments ?? submission.lastComments,
          lastSyncedAt: new Date(),
        },
      });
      await tx.viewSnapshot.create({
        data: {
          submissionId,
          views,
          likes: likes ?? 0,
          comments: comments ?? 0,
          source: "MANUAL",
        },
      });
    });

    await logAction(admin.id, "submission.views.update", "Submission", submissionId, {
      dari: submission.lastViews,
      ke: views,
      koreksi: isCorrection ? true : null,
    });
  } catch (err) {
    console.error("[updateViewsAction Error]", err);
    return { error: "Terjadi kesalahan sistem saat memperbarui views." };
  }

  revalidatePath("/admin/views");
  return {
    success: isCorrection ? "Koreksi views berhasil disimpan." : "Views diperbarui.",
  };
}

/**
 * Tarik views otomatis menggunakan extractor ringan HTTP (Opsi 1: Tanpa Chromium/Puppeteer).
 * Mengambil angka views, likes, dan comments riil langsung dari TikTok dan
 * menyimpannya ke database dengan jejak source: "API".
 */
export async function syncSingleSubmissionViewsAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const admin = await requireRole("ADMIN");
  const submissionId = String(formData.get("submissionId") ?? "");
  const isCorrection = formData.get("isCorrection") === "true";

  // 1. Rate Limiting per Admin
  const rateLimit = checkRateLimit(
    `admin:${admin.id}:views_sync_api`,
    MAX_VIEW_UPDATES_PER_MINUTE,
    60_000,
  );
  if (!rateLimit.allowed) {
    const retrySec = Math.ceil(rateLimit.retryAfterMs / 1000);
    return {
      error: `Batas frekuensi sinkronisasi tercapai (maksimal ${MAX_VIEW_UPDATES_PER_MINUTE} aksi/menit). Harap tunggu ${retrySec} detik.`,
    };
  }

  const submission = await db.submission.findUnique({
    where: { id: submissionId },
  });
  if (!submission) return { error: "Submission tidak ditemukan." };

  // 2. Throttling per Submission (jeda minimal 5 menit)
  const throttle = validateViewUpdateThrottle(submission.lastSyncedAt, isCorrection);
  if (!throttle.allowed) {
    return { error: throttle.message };
  }

  // 3. Fetch metrik via HTTP extractor ringan (Opsi 1)
  let metrics;
  try {
    metrics = await fetchVideoMetrics(submission.platform, submission.contentUrl);
  } catch (err) {
    return {
      error: `Gagal menarik metrik otomatis: ${err instanceof Error ? err.message : "Kesalahan jaringan"}`,
    };
  }

  const menurun = metrics.views < submission.lastViews;

  // 4. Update database secara atomik
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
  });

  await logAction(admin.id, "submission.views.sync_api", "Submission", submissionId, {
    dari: submission.lastViews,
    ke: metrics.views,
    platform: submission.platform,
    source: "HTTP_LIGHTWEIGHT",
  });

  revalidatePath("/admin/views");
  return {
    success: menurun
      ? `Views (${metrics.views.toLocaleString("id-ID")}) ditarik, tapi angkanya turun dari sebelumnya — cek manual kalau perlu.`
      : `Views berhasil ditarik otomatis: ${metrics.views.toLocaleString("id-ID")} views, ${metrics.likes.toLocaleString("id-ID")} likes.`,
  };
}

// ---------------------------------------------------------------- submission

/**
 * Duplikat dari `reviewSubmissionAction` milik vendor (lihat
 * `src/app/vendor/actions.ts`), tapi tanpa pengecekan `campaign.vendorId` —
 * admin boleh menengahi submission vendor mana pun, bukan hanya miliknya
 * sendiri. Nama aksi audit tetap `submission.approve`/`submission.reject`
 * supaya jejaknya tercampur rapi dengan keputusan vendor di jejak audit yang
 * sama (lihat peta `auditLabel` di `src/app/admin/page.tsx`).
 */
export async function reviewSubmissionAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const admin = await requireRole("ADMIN");
  const submissionId = String(formData.get("submissionId") ?? "");
  const decision = String(formData.get("decision") ?? "");
  const note = String(formData.get("note") ?? "").trim();

  if (decision === "reject" && note.length < 10) {
    return { error: "Alasan penolakan wajib diisi minimal 10 karakter." };
  }

  const submission = await db.submission.findUnique({
    where: { id: submissionId },
    include: { campaign: true },
  });
  if (!submission) return { error: "Submission tidak ditemukan." };
  if (submission.status !== "PENDING_REVIEW") {
    return { error: "Submission ini sudah direview." };
  }

  const approved = decision === "approve";

  try {
    await db.$transaction(async (tx) => {
      await tx.submission.update({
        where: { id: submissionId },
        data: {
          status: approved ? "APPROVED" : "REJECTED",
          reviewedById: admin.id,
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
            : `Admin menolak kontenmu: ${note}`,
          link: "/creator/submissions",
        },
      });
    });

    await logAction(
      admin.id,
      approved ? "submission.approve" : "submission.reject",
      "Submission",
      submissionId,
      { catatan: note || null },
    );
  } catch (err) {
    console.error("[reviewSubmissionAction Error]", err);
    return { error: "Terjadi kesalahan sistem saat mereview submission." };
  }

  revalidatePath("/admin/submissions");
  return {
    success: approved ? "Submission disetujui." : "Submission ditolak.",
  };
}

// ---------------------------------------------------------------- penarikan dana

/**
 * Keputusan admin atas satu permintaan penarikan dini — dipasangkan ke
 * `<DecisionForm>` yang sama seperti `reviewSubmissionAction`. Approve tidak
 * langsung mencairkan dana; pencairan tetap langkah manual terpisah
 * (`markWithdrawalPaidAction`), konsisten dengan pola deposit/payout lain di
 * halaman ini.
 */
export async function reviewWithdrawalAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const admin = await requireRole("ADMIN");
  const withdrawalId = String(formData.get("withdrawalId") ?? "");
  const decision = String(formData.get("decision") ?? "");
  const note = String(formData.get("note") ?? "").trim();

  if (decision === "reject" && note.length < 10) {
    return { error: "Alasan penolakan wajib diisi minimal 10 karakter." };
  }

  const withdrawal = await db.withdrawal.findUnique({
    where: { id: withdrawalId },
    include: { campaign: true },
  });
  if (!withdrawal) return { error: "Permintaan penarikan tidak ditemukan." };
  if (withdrawal.status !== "PENDING_ADMIN_APPROVAL") {
    return { error: "Permintaan ini sudah diputuskan." };
  }

  const approved = decision === "approve";

  try {
    await db.$transaction(async (tx) => {
      await tx.withdrawal.update({
        where: { id: withdrawalId },
        data: approved
          ? { status: "APPROVED", approvedAt: new Date(), approvedById: admin.id }
          : { status: "REJECTED", rejectionReason: note },
      });

      await tx.notification.create({
        data: {
          userId: withdrawal.creatorId,
          type: "GENERAL",
          title: approved ? "Penarikan disetujui" : "Penarikan ditolak",
          body: approved
            ? `Penarikan ${formatIDR(withdrawal.netAmount)} dari campaign "${withdrawal.campaign.title}" disetujui, menunggu transfer.`
            : `Penarikan dari campaign "${withdrawal.campaign.title}" ditolak: ${note}`,
          link: "/creator/earnings",
        },
      });
    });

    await logAction(
      admin.id,
      approved ? "withdrawal.approve" : "withdrawal.reject",
      "Withdrawal",
      withdrawalId,
      { catatan: note || null },
    );
  } catch (err) {
    console.error("[reviewWithdrawalAction Error]", err);
    return { error: "Terjadi kesalahan sistem saat memproses penarikan." };
  }

  revalidatePath("/admin/submissions");
  return { success: approved ? "Penarikan disetujui." : "Penarikan ditolak." };
}

/** Tandai penarikan yang sudah disetujui sebagai selesai ditransfer manual. */
export async function markWithdrawalPaidAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const admin = await requireRole("ADMIN");
  const withdrawalId = String(formData.get("withdrawalId") ?? "");

  const withdrawal = await db.withdrawal.findUnique({ where: { id: withdrawalId } });
  if (!withdrawal) return { error: "Permintaan penarikan tidak ditemukan." };
  if (withdrawal.status !== "APPROVED") {
    return { error: "Penarikan ini belum disetujui atau sudah cair." };
  }

  try {
    await db.$transaction(async (tx) => {
      await tx.withdrawal.update({
        where: { id: withdrawalId },
        data: { status: "PAID", paidAt: new Date() },
      });

      await tx.escrowTransaction.createMany({
        data: [
          {
            campaignId: withdrawal.campaignId,
            type: "PAYOUT",
            amount: withdrawal.netAmount,
            status: "COMPLETED",
            reference: `WITHDRAW-${Date.now()}`,
            completedAt: new Date(),
          },
          {
            campaignId: withdrawal.campaignId,
            type: "WITHDRAWAL_FEE",
            amount: withdrawal.feeAmount,
            status: "COMPLETED",
            completedAt: new Date(),
          },
        ],
      });

      await tx.notification.create({
        data: {
          userId: withdrawal.creatorId,
          type: "PAYOUT_RELEASED",
          title: "Penarikan cair",
          body: `${formatIDR(withdrawal.netAmount)} sudah ditransfer ke rekening terdaftar.`,
          link: "/creator/earnings",
        },
      });
    });

    await logAction(admin.id, "withdrawal.pay", "Withdrawal", withdrawalId, {
      netAmount: withdrawal.netAmount,
      feeAmount: withdrawal.feeAmount,
    });
  } catch (err) {
    console.error("[markWithdrawalPaidAction Error]", err);
    return { error: "Terjadi kesalahan sistem saat mencairkan penarikan." };
  }

  revalidatePath("/admin/submissions");
  return { success: `Penarikan ${formatIDR(withdrawal.netAmount)} dicairkan.` };
}

// ---------------------------------------------------------------- brief template

const briefTemplateSchema = z.object({
  name: z.string().min(3, "Nama template minimal 3 karakter."),
  category: z.enum([
    "KULINER",
    "WISATA_ALAM",
    "WISATA_BUATAN",
    "AKOMODASI",
    "LAINNYA",
  ]),
  angles: z.string().optional(),
  mustShow: z.string().optional(),
  prohibited: z.string().optional(),
  minDurationSec: z.coerce.number().int().min(5).default(30),
  isActive: z.coerce.boolean().default(true),
});

export async function createBriefTemplateAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const admin = await requireRole("ADMIN");
  const raw = Object.fromEntries(formData.entries());
  const parsed = briefTemplateSchema.safeParse({
    ...raw,
    isActive: formData.get("status") !== "arsip",
  });
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  const data = parsed.data;
  const toArr = (val?: string) =>
    (val ?? "")
      .split("\n")
      .map((s) => s.trim())
      .filter(Boolean);

  const template = await db.briefTemplate.create({
    data: {
      category: data.category,
      name: data.name,
      fields: {
        angleSaran: toArr(data.angles),
        wajibTampil: toArr(data.mustShow),
        larangan: toArr(data.prohibited),
        durasiMinimalDetik: data.minDurationSec,
      },
      isActive: data.isActive,
    },
  });

  await logAction(admin.id, "template.create", "BriefTemplate", template.id, {
    nama: template.name,
    kategori: template.category,
  });

  revalidatePath("/admin/templates");
  return { success: `Template "${template.name}" berhasil dibuat.` };
}

export async function toggleBriefTemplateAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const admin = await requireRole("ADMIN");
  const templateId = String(formData.get("templateId") ?? "");

  const template = await db.briefTemplate.findUnique({
    where: { id: templateId },
  });
  if (!template) return { error: "Template tidak ditemukan." };

  const updated = await db.briefTemplate.update({
    where: { id: templateId },
    data: { isActive: !template.isActive },
  });

  await logAction(
    admin.id,
    updated.isActive ? "template.activate" : "template.archive",
    "BriefTemplate",
    templateId,
  );

  revalidatePath("/admin/templates");
  return {
    success: `Template "${template.name}" ${updated.isActive ? "diaktifkan" : "diarsipkan"}.`,
  };
}
