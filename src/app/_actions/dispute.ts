"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import {
  canUserParticipateInDispute,
  determineDisputeRecipients,
  validateDisputeMessage,
} from "@/domain/dispute";

export type ActionState = { error?: string; success?: string };

/**
 * Mengirim pesan klarifikasi/tanggapan baru di thread sengketa submission.
 * Dapat dipanggil oleh Admin, Kreator pemilik, maupun Vendor pemilik.
 */
export async function sendDisputeMessageAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const user = await requireUser();
  const disputeId = String(formData.get("disputeId") ?? "").trim();
  const message = String(formData.get("message") ?? "").trim();

  if (!disputeId) {
    return { error: "ID sengketa tidak valid." };
  }

  const dispute = await db.dispute.findUnique({
    where: { id: disputeId },
    include: {
      submission: {
        include: {
          campaign: {
            include: { vendor: true },
          },
          creator: true,
        },
      },
    },
  });

  if (!dispute) {
    return { error: "Sengketa tidak ditemukan." };
  }

  // 1. Otorisasi hak akses sengketa
  const isAuthorized = canUserParticipateInDispute({
    userRole: user.role,
    userId: user.id,
    disputeCreatorId: dispute.submission.creatorId,
    disputeVendorId: dispute.submission.campaign.vendorId,
  });

  if (!isAuthorized) {
    return { error: "Kamu tidak memiliki wewenang untuk mengirim pesan di sengketa ini." };
  }

  // 2. Validasi status sengketa dan format pesan
  const validation = validateDisputeMessage({
    status: dispute.status,
    body: message,
  });

  if (!validation.isValid) {
    return { error: validation.error ?? "Pesan sengketa tidak valid." };
  }

  // 3. Ambil daftar admin untuk notifikasi mediasi
  const admins = await db.user.findMany({
    where: { role: "ADMIN", status: "VERIFIED" },
    select: { id: true },
  });
  const adminIds = admins.map((a) => a.id);

  // 4. Tentukan pihak penerima notifikasi (lawan bicara)
  const recipients = determineDisputeRecipients({
    senderId: user.id,
    creatorId: dispute.submission.creatorId,
    vendorId: dispute.submission.campaign.vendorId,
    adminUserIds: adminIds,
  });

  // 5. Simpan pesan & notifikasi dalam transaksi database
  await db.$transaction(async (tx) => {
    await tx.disputeMessage.create({
      data: {
        disputeId,
        senderId: user.id,
        body: message,
      },
    });

    if (recipients.length > 0) {
      const truncated =
        message.length > 70 ? `${message.slice(0, 67)}...` : message;

      await tx.notification.createMany({
        data: recipients.map((recipientId) => ({
          userId: recipientId,
          type: "DISPUTE_UPDATE",
          title: `Pesan sengketa: ${dispute.submission.campaign.title}`,
          body: `${user.name} (${user.role}): "${truncated}"`,
          link:
            recipientId === dispute.submission.creatorId
              ? "/creator/submissions"
              : recipientId === dispute.submission.campaign.vendorId
                ? "/vendor/submissions"
                : `/admin/disputes/${disputeId}`,
        })),
      });
    }

    await tx.auditLog.create({
      data: {
        actorId: user.id,
        action: "dispute.message_sent",
        entity: "Dispute",
        entityId: disputeId,
        metadata: {
          panjangPesan: message.length,
          jumlahPenerima: recipients.length,
        },
      },
    });
  });

  revalidatePath(`/admin/disputes/${disputeId}`);
  revalidatePath("/creator/submissions");
  revalidatePath("/vendor/submissions");

  return { success: "Pesan berhasil dikirim ke riwayat sengketa." };
}
