import type { DisputeStatus, Role } from "@/generated/prisma/enums";

export interface DisputeParticipationParams {
  userRole: Role;
  userId: string;
  disputeCreatorId: string;
  disputeVendorId: string;
}

export interface DisputeMessageValidationParams {
  status: DisputeStatus;
  body: string;
}

export interface DisputeRecipientsParams {
  senderId: string;
  creatorId: string;
  vendorId: string;
  adminUserIds?: string[];
}

/**
 * Memeriksa apakah user berhak melihat dan berpartisipasi dalam sengketa.
 * Diizinkan jika:
 * 1. User adalah ADMIN (selaku penengah/mediator)
 * 2. User adalah Kreator pemilik submission sengketa
 * 3. User adalah Vendor pemilik campaign sengketa
 */
export function canUserParticipateInDispute(
  params: DisputeParticipationParams,
): boolean {
  if (params.userRole === "ADMIN") {
    return true;
  }
  if (params.userRole === "CREATOR" && params.userId === params.disputeCreatorId) {
    return true;
  }
  if (params.userRole === "VENDOR" && params.userId === params.disputeVendorId) {
    return true;
  }
  return false;
}

/**
 * Memvalidasi apakah pesan sengketa boleh dikirim berdasarkan status sengketa dan isi pesan.
 */
export function validateDisputeMessage(
  params: DisputeMessageValidationParams,
): { isValid: boolean; error?: string } {
  if (params.status !== "OPEN") {
    return {
      isValid: false,
      error: "Sengketa ini sudah diputus/selesai dan tidak menerima pesan baru.",
    };
  }

  const trimmed = params.body.trim();
  if (trimmed.length < 3) {
    return {
      isValid: false,
      error: "Pesan sengketa terlalu singkat (minimal 3 karakter).",
    };
  }

  if (trimmed.length > 1000) {
    return {
      isValid: false,
      error: "Pesan sengketa terlalu panjang (maksimal 1.000 karakter).",
    };
  }

  return { isValid: true };
}

/**
 * Menentukan daftar userId yang berhak menerima notifikasi saat pesan baru dikirim.
 * Mengabaikan si pengirim pesan (senderId) agar tidak menotifikasi diri sendiri.
 */
export function determineDisputeRecipients(
  params: DisputeRecipientsParams,
): string[] {
  const recipients = new Set<string>();

  // Masukkan Kreator jika bukan pengirim
  if (params.creatorId && params.creatorId !== params.senderId) {
    recipients.add(params.creatorId);
  }

  // Masukkan Vendor jika bukan pengirim
  if (params.vendorId && params.vendorId !== params.senderId) {
    recipients.add(params.vendorId);
  }

  // Masukkan Admin jika tersedia dan bukan pengirim
  if (params.adminUserIds) {
    for (const adminId of params.adminUserIds) {
      if (adminId && adminId !== params.senderId) {
        recipients.add(adminId);
      }
    }
  }

  return Array.from(recipients);
}
