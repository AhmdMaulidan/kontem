"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/lib/db";
import { requireRole } from "@/lib/auth";
import { COUNTABLE_STATUSES } from "@/domain/campaign";
import { calculatePayouts } from "@/domain/payout";
import {
  validateViewUpdateThrottle,
  MAX_VIEW_UPDATES_PER_MINUTE,
  evaluateViewFraud,
} from "@/domain/views";
import { checkRateLimit } from "@/lib/rate-limit";
import { fetchVideoMetrics } from "@/lib/video-metrics";
import { runCampaignLifecycleSync } from "@/domain/lifecycle";
import { verifyAuthorOwnership } from "@/domain/social-url";
import { broadcastNewCampaignToNearbyCreators } from "@/domain/notification";

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
      settleAlertsSent: result.settleAlertsSent,
    });

    revalidatePath("/admin/campaigns");
    revalidatePath("/admin/payouts");
    revalidatePath("/creator");
    revalidatePath("/vendor");

    return {
      success: `Siklus diperiksa: ${result.campaignsEnded} campaign berakhir, ${result.settleAlertsSent} siap settle.`,
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

  // 3. Deteksi anomali views (penurunan, lonjakan spike velocity, keterlibatan ganjil)
  const fraudAssessment = evaluateViewFraud(
    submission.lastViews,
    views,
    submission.lastSyncedAt,
    new Date(),
    likes ?? submission.lastLikes ?? 0,
    comments ?? submission.lastComments ?? 0,
  );

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

      if (fraudAssessment?.hasFraud) {
        await tx.fraudFlag.create({
          data: {
            submissionId,
            flaggedUserId: submission.creatorId,
            reportedById: null, // otomatis oleh sistem
            type: fraudAssessment.type,
            severity: fraudAssessment.severity,
            detail: fraudAssessment.reason,
          },
        });

        if (fraudAssessment.severity >= 2) {
          const admins = await tx.user.findMany({
            where: { role: "ADMIN" },
            select: { id: true },
          });
          if (admins.length > 0) {
            await tx.notification.createMany({
              data: admins.map((adm) => ({
                userId: adm.id,
                type: "GENERAL",
                title: "Peringatan Anomali Views (Fraud)",
                body: `Sistem mendeteksi anomali konten #${submissionId.slice(-6)}: ${fraudAssessment.reason}`,
                link: "/admin/fraud",
              })),
            });
          }
        }
      }
    });

    await logAction(admin.id, "submission.views.update", "Submission", submissionId, {
      dari: submission.lastViews,
      ke: views,
      koreksi: isCorrection ? true : null,
      anomali: fraudAssessment?.hasFraud ? fraudAssessment.reason : null,
    });
  } catch (err) {
    console.error("[updateViewsAction Error]", err);
    return { error: "Terjadi kesalahan sistem saat memperbarui views." };
  }

  revalidatePath("/admin/views");
  revalidatePath("/admin/fraud");
  return {
    success: fraudAssessment?.hasFraud
      ? `Views tersimpan. Sistem menandai anomali (${fraudAssessment.reason}) untuk ditinjau di panel Fraud.`
      : isCorrection
        ? "Koreksi views berhasil disimpan."
        : "Views diperbarui.",
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
    include: {
      creator: {
        include: { socialAccounts: true },
      },
    },
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

  const mencurigakan = metrics.views < submission.lastViews;

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

    if (mencurigakan) {
      await tx.fraudFlag.create({
        data: {
          submissionId,
          flaggedUserId: submission.creatorId,
          type: "INFLATED_VIEWS",
          severity: 2,
          detail: `Views otomatis dari API (${metrics.views}) lebih rendah dari views tercatat sebelumnya (${submission.lastViews}).`,
        },
      });
    }

    // Deteksi ketidakcocokan author video riil dari API dengan akun terdaftar
    const registeredAccount = submission.creator.socialAccounts.find(
      (a) => a.platform === submission.platform,
    );
    if (registeredAccount && metrics.author) {
      const isAuthorMatch = verifyAuthorOwnership({
        author: metrics.author,
        registeredHandle: registeredAccount.handle,
      });
      if (!isAuthorMatch) {
        await tx.fraudFlag.create({
          data: {
            submissionId,
            flaggedUserId: submission.creatorId,
            type: "REUSED_CONTENT",
            severity: 2,
            detail: `Penarikan metrik mendeteksi video diunggah oleh akun @${metrics.author}, berbeda dengan akun ${submission.platform} terdaftar kreator (@${registeredAccount.handle}). Indikasi pengiriman konten orang lain.`,
          },
        });
      }
    }
  });

  await logAction(admin.id, "submission.views.sync_api", "Submission", submissionId, {
    dari: submission.lastViews,
    ke: metrics.views,
    platform: submission.platform,
    source: "HTTP_LIGHTWEIGHT",
  });

  revalidatePath("/admin/views");
  return {
    success: mencurigakan
      ? `Views (${metrics.views.toLocaleString("id-ID")}) ditarik, tetapi ada penurunan angka sehingga otomatis ditandai untuk ditinjau.`
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

/** Duplikat dari `flagSubmissionAction` milik vendor — pelapornya admin sendiri. */
export async function flagSubmissionAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const admin = await requireRole("ADMIN");
  const submissionId = String(formData.get("submissionId") ?? "");
  const type = String(formData.get("type") ?? "OTHER");
  const detail = String(formData.get("detail") ?? "").trim();

  if (detail.length < 10) {
    return { error: "Jelaskan kecurigaanmu minimal 10 karakter." };
  }

  const submission = await db.submission.findUnique({
    where: { id: submissionId },
  });
  if (!submission) return { error: "Submission tidak ditemukan." };

  try {
    await db.fraudFlag.create({
      data: {
        submissionId,
        flaggedUserId: submission.creatorId,
        reportedById: admin.id,
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

    await logAction(admin.id, "flag.create", "Submission", submissionId, {
      jenis: type,
    });
  } catch (err) {
    console.error("[flagSubmissionAction Error]", err);
    return { error: "Terjadi kesalahan sistem saat melaporkan fraud." };
  }

  revalidatePath("/admin/submissions");
  revalidatePath("/admin/fraud");
  return { success: "Laporan dibuat, masuk antrean fraud." };
}

// ---------------------------------------------------------------- dispute

export async function resolveDisputeAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const admin = await requireRole("ADMIN");
  const disputeId = String(formData.get("disputeId") ?? "");
  const decision = String(formData.get("decision") ?? "");
  const resolution = String(formData.get("resolution") ?? "").trim();

  if (resolution.length < 10) {
    return { error: "Tuliskan dasar keputusan minimal 10 karakter." };
  }

  const dispute = await db.dispute.findUnique({
    where: { id: disputeId },
    include: { submission: { include: { campaign: true } } },
  });
  if (!dispute) return { error: "Sengketa tidak ditemukan." };
  if (dispute.status.startsWith("RESOLVED")) {
    return { error: "Sengketa ini sudah diputus." };
  }

  // "overturn" memenangkan creator: submission kembali dihitung untuk payout.
  const overturn = decision === "overturn";

  try {
    await db.$transaction(async (tx) => {
      await tx.dispute.update({
        where: { id: disputeId },
        data: {
          status: overturn ? "RESOLVED_OVERTURNED" : "RESOLVED_UPHELD",
          resolution,
          resolvedById: admin.id,
          resolvedAt: new Date(),
        },
      });
      await tx.disputeMessage.create({
        data: { disputeId, senderId: admin.id, body: resolution },
      });
      await tx.submission.update({
        where: { id: dispute.submissionId },
        data: {
          status: overturn ? "ADMIN_APPROVED" : "ADMIN_REJECTED",
          reviewedById: admin.id,
          reviewedAt: new Date(),
        },
      });
      await tx.campaignParticipation.update({
        where: { id: dispute.submission.participationId },
        data: { status: overturn ? "COMPLETED" : "CANCELLED" },
      });
      // Trust score creator turun kalau bandingnya tidak berdasar.
      await tx.creatorProfile.updateMany({
        where: { userId: dispute.submission.creatorId },
        data: { trustScore: { increment: overturn ? 3 : -5 } },
      });
      await tx.notification.create({
        data: {
          userId: dispute.submission.creatorId,
          type: "DISPUTE_UPDATE",
          title: overturn ? "Banding dimenangkan" : "Banding ditolak",
          body: resolution,
          link: "/creator/submissions",
        },
      });
      await tx.notification.create({
        data: {
          userId: dispute.submission.campaign.vendorId,
          type: "DISPUTE_UPDATE",
          title: "Keputusan sengketa",
          body: overturn
            ? `Admin menyetujui konten yang kamu tolak: ${resolution}`
            : `Penolakanmu dikuatkan: ${resolution}`,
          link: `/vendor/campaigns/${dispute.submission.campaignId}`,
        },
      });
    });

    await logAction(admin.id, overturn ? "dispute.overturn" : "dispute.uphold", "Dispute", disputeId, { dasar: resolution });
  } catch (err) {
    console.error("[resolveDisputeAction Error]", err);
    return { error: "Terjadi kesalahan sistem saat memproses sengketa." };
  }

  revalidatePath("/admin/disputes");
  return {
    success: overturn
      ? "Banding dimenangkan creator, submission kembali dihitung."
      : "Penolakan vendor dikuatkan.",
  };
}

export async function resolveFlagAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const admin = await requireRole("ADMIN");
  const flagId = String(formData.get("flagId") ?? "");
  const decision = String(formData.get("decision") ?? "");
  const note = String(formData.get("note") ?? "").trim();

  const flag = await db.fraudFlag.findUnique({ where: { id: flagId } });
  if (!flag) return { error: "Laporan tidak ditemukan." };

  const confirmed = decision === "confirm";

  try {
    await db.$transaction(async (tx) => {
      await tx.fraudFlag.update({
        where: { id: flagId },
        data: {
          status: confirmed ? "CONFIRMED" : "DISMISSED",
          resolutionNote: note || null,
        },
      });
      if (confirmed && flag.flaggedUserId) {
        await tx.creatorProfile.updateMany({
          where: { userId: flag.flaggedUserId },
          data: { trustScore: { decrement: 15 } },
        });
        // Payout yang belum cair ditahan sampai ada keputusan lanjutan.
        await tx.payout.updateMany({
          where: { creatorId: flag.flaggedUserId, status: "PENDING" },
          data: { status: "HELD", note: "Ditahan karena indikasi kecurangan." },
        });
      }
    });

    await logAction(admin.id, confirmed ? "fraud.confirm" : "fraud.dismiss", "FraudFlag", flagId, { catatan: note || null });
  } catch (err) {
    console.error("[resolveFlagAction Error]", err);
    return { error: "Terjadi kesalahan sistem saat memproses laporan fraud." };
  }

  revalidatePath("/admin/fraud");
  return { success: confirmed ? "Laporan dikonfirmasi." : "Laporan ditutup." };
}

// ---------------------------------------------------------------- payout

/**
 * Tutup campaign dan hitung pembagian pool. Views dikunci ke finalViews supaya
 * angka payout tidak berubah lagi kalau views terus bertambah setelah settle.
 */
export async function settleCampaignAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const admin = await requireRole("ADMIN");
  const campaignId = String(formData.get("campaignId") ?? "");

  const campaign = await db.campaign.findUnique({
    where: { id: campaignId },
    include: {
      submissions: { where: { status: { in: COUNTABLE_STATUSES } } },
      payouts: true,
    },
  });
  if (!campaign) return { error: "Campaign tidak ditemukan." };
  if (campaign.payouts.length > 0) {
    return { error: "Campaign ini sudah pernah disettle." };
  }
  if (!["ACTIVE", "ENDED", "SETTLING"].includes(campaign.status)) {
    return { error: "Status campaign tidak memungkinkan untuk disettle." };
  }

  // Sengketa yang belum diputus harus selesai dulu, kalau tidak angka
  // pembagian bisa berubah setelah dana terlanjur dicairkan.
  const sengketaTerbuka = await db.dispute.count({
    where: {
      submission: { campaignId },
      status: { in: ["OPEN", "UNDER_REVIEW"] },
    },
  });
  if (sengketaTerbuka > 0) {
    return {
      error: `Masih ada ${sengketaTerbuka} sengketa terbuka. Putuskan dulu sebelum settle.`,
    };
  }

  const menungguReview = await db.submission.count({
    where: { campaignId, status: "PENDING_REVIEW" },
  });
  if (menungguReview > 0) {
    return { error: `Masih ada ${menungguReview} submission yang belum direview vendor.` };
  }

  const entries = campaign.submissions.map((submission) => ({
    creatorId: submission.creatorId,
    submissionId: submission.id,
    views: submission.finalViews ?? submission.lastViews,
  }));

  const hasil = calculatePayouts(entries, {
    budgetPool: campaign.budgetPool,
    cpmRate: campaign.cpmRate,
    platformFeeRate: campaign.platformFeeRate,
    maxViewsPerCreator: campaign.maxViewsPerCreator,
  });

  try {
    await db.$transaction(async (tx) => {
      for (const submission of campaign.submissions) {
        await tx.submission.update({
          where: { id: submission.id },
          data: { finalViews: submission.finalViews ?? submission.lastViews },
        });
      }

      for (const line of hasil.lines) {
        await tx.payout.create({
          data: {
            campaignId,
            creatorId: line.creatorId,
            submissionId: line.submissionId,
            viewsCounted: line.viewsCounted,
            totalPoolViews: line.totalPoolViews,
            sharePercent: line.sharePercent,
            grossAmount: line.grossAmount,
            platformFee: line.platformFee,
            netAmount: line.netAmount,
            status: "PENDING",
          },
        });
        await tx.notification.create({
          data: {
            userId: line.creatorId,
            type: "PAYOUT_RELEASED",
            title: "Payout dihitung",
            body: `Campaign "${campaign.title}" selesai. Bagianmu ${line.netAmount.toLocaleString("id-ID")} rupiah, menunggu pencairan.`,
            link: "/creator/earnings",
          },
        });
      }

      await tx.escrowTransaction.create({
        data: {
          campaignId,
          type: "PLATFORM_FEE",
          amount: hasil.totalPlatformFee,
          status: "COMPLETED",
          completedAt: new Date(),
        },
      });

      if (hasil.refundToVendor > 0) {
        await tx.escrowTransaction.create({
          data: {
            campaignId,
            type: "REFUND",
            amount: hasil.refundToVendor,
            status: "PENDING",
            note: "Sisa pool yang tidak terserap.",
          },
        });
      }

      await tx.campaign.update({
        where: { id: campaignId },
        data: { status: "SETTLING", settledAt: new Date() },
      });
    });

    await logAction(admin.id, "campaign.settle", "Campaign", campaignId, {
      totalViews: hasil.totalViews,
      dibagikan: hasil.totalDistributed,
      fee: hasil.totalPlatformFee,
      refund: hasil.refundToVendor,
    });
  } catch (err) {
    console.error("[settleCampaignAction Error]", err);
    return { error: "Terjadi kesalahan sistem saat memproses penyelesaian campaign." };
  }

  revalidatePath("/admin/payouts");
  return {
    success: `Payout dihitung untuk ${hasil.lines.length} creator. Total ${hasil.totalNetToCreators.toLocaleString("id-ID")} rupiah menunggu pencairan.`,
  };
}

/** Cairkan seluruh payout PENDING milik satu campaign. */
export async function releasePayoutsAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const admin = await requireRole("ADMIN");
  const campaignId = String(formData.get("campaignId") ?? "");

  const payouts = await db.payout.findMany({
    where: { campaignId, status: "PENDING" },
  });
  if (payouts.length === 0) {
    return { error: "Tidak ada payout yang menunggu pencairan." };
  }

  const total = payouts.reduce((sum, p) => sum + p.netAmount, 0);

  try {
    await db.$transaction(async (tx) => {
      await tx.payout.updateMany({
        where: { campaignId, status: "PENDING" },
        data: { status: "PAID", paidAt: new Date() },
      });
      await tx.escrowTransaction.create({
        data: {
          campaignId,
          type: "PAYOUT",
          amount: total,
          status: "COMPLETED",
          reference: `MANUAL-PAYOUT-${Date.now()}`,
          completedAt: new Date(),
        },
      });

      const masihTertahan = await tx.payout.count({
        where: { campaignId, status: { in: ["PENDING", "HELD", "PROCESSING"] } },
      });
      if (masihTertahan === 0) {
        await tx.campaign.update({
          where: { id: campaignId },
          data: { status: "SETTLED" },
        });
      }

      for (const payout of payouts) {
        await tx.notification.create({
          data: {
            userId: payout.creatorId,
            type: "PAYOUT_RELEASED",
            title: "Payout cair",
            body: `${payout.netAmount.toLocaleString("id-ID")} rupiah sudah ditransfer ke rekening terdaftar.`,
            link: "/creator/earnings",
          },
        });
      }
    });

    await logAction(admin.id, "payout.release", "Campaign", campaignId, {
      jumlahCreator: payouts.length,
      total,
    });
  } catch (err) {
    console.error("[releasePayoutsAction Error]", err);
    return { error: "Terjadi kesalahan sistem saat mencairkan payout." };
  }

  revalidatePath("/admin/payouts");
  return { success: `${payouts.length} payout dicairkan, total ${total.toLocaleString("id-ID")} rupiah.` };
}

/** Cairkan satu baris payout creator tertentu secara individual. */
export async function releaseSinglePayoutAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const admin = await requireRole("ADMIN");
  const payoutId = String(formData.get("payoutId") ?? "");

  const payout = await db.payout.findUnique({
    where: { id: payoutId },
    include: {
      campaign: true,
      submission: {
        include: {
          fraudFlags: { where: { status: { in: ["OPEN", "REVIEWING"] } } },
        },
      },
      creator: true,
    },
  });

  if (!payout) return { error: "Payout tidak ditemukan." };
  if (payout.status !== "PENDING") return { error: "Status payout bukan PENDING." };
  if ((payout.submission?.fraudFlags.length ?? 0) > 0) {
    return {
      error:
        "Payout ini ditahan karena memiliki flag fraud yang belum diselesaikan.",
    };
  }

  try {
    await db.$transaction(async (tx) => {
      await tx.payout.update({
        where: { id: payout.id },
        data: { status: "PAID", paidAt: new Date() },
      });

      await tx.escrowTransaction.create({
        data: {
          campaignId: payout.campaignId,
          type: "PAYOUT",
          amount: payout.netAmount,
          status: "COMPLETED",
          reference: `MANUAL-PAYOUT-${Date.now()}`,
          completedAt: new Date(),
        },
      });

      const masihTertahan = await tx.payout.count({
        where: {
          campaignId: payout.campaignId,
          status: { in: ["PENDING", "HELD", "PROCESSING"] },
        },
      });
      if (masihTertahan === 0) {
        await tx.campaign.update({
          where: { id: payout.campaignId },
          data: { status: "SETTLED" },
        });
      }

      await tx.notification.create({
        data: {
          userId: payout.creatorId,
          type: "PAYOUT_RELEASED",
          title: "Payout cair",
          body: `${payout.netAmount.toLocaleString("id-ID")} rupiah sudah ditransfer ke rekening terdaftar.`,
          link: "/creator/earnings",
        },
      });
    });

    await logAction(admin.id, "payout.release.single", "Payout", payout.id, {
      creatorId: payout.creatorId,
      jumlah: payout.netAmount,
    });
  } catch (err) {
    console.error("[releaseSinglePayoutAction Error]", err);
    return { error: "Terjadi kesalahan sistem saat mencairkan payout." };
  }

  revalidatePath("/admin/payouts");
  revalidatePath("/admin/payouts/pratinjau");
  return {
    success: `Payout ${payout.creator.name} sebesar ${payout.netAmount.toLocaleString("id-ID")} rupiah dicairkan.`,
  };
}

/** Tahan payout creator yang bersangkutan tanpa langsung menutup flag fraud. */
export async function holdPayoutAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const admin = await requireRole("ADMIN");
  const flagId = String(formData.get("flagId") ?? "");

  const flag = await db.fraudFlag.findUnique({
    where: { id: flagId },
  });

  if (!flag) return { error: "Laporan fraud tidak ditemukan." };
  if (!flag.flaggedUserId) return { error: "User tidak ditemukan pada laporan ini." };

  try {
    const count = await db.payout.updateMany({
      where: { creatorId: flag.flaggedUserId, status: "PENDING" },
      data: {
        status: "HELD",
        note: "Ditahan oleh admin untuk penyelidikan indikasi kecurangan.",
      },
    });

    await logAction(admin.id, "fraud.payout.hold", "FraudFlag", flagId, {
      flaggedUserId: flag.flaggedUserId,
      jumlahTertahan: count.count,
    });

    revalidatePath("/admin/fraud");
    revalidatePath("/admin/payouts");
    return {
      success: `${count.count} payout berhasil ditahan untuk penyelidikan fraud.`,
    };
  } catch (err) {
    console.error("[holdPayoutAction Error]", err);
    return { error: "Terjadi kesalahan sistem saat menahan payout." };
  }
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
