export interface DuplicateAccountCheckResult {
  isDuplicate: boolean;
  duplicateField?: "bankAccountNumber" | "phone";
  duplicateUserId?: string;
  reason?: string;
}

/**
 * Memeriksa apakah data penting kreator (nomor rekening bank atau nomor telepon)
 * terindikasi duplikat / ganda dengan akun kreator lain di platform (Sybil / Multi-account).
 */
export function evaluateDuplicateCreatorAccount(
  currentUserId: string,
  data: { bankAccountNumber?: string | null; phone?: string | null },
  existingProfiles: Array<{
    userId: string;
    bankAccountNumber?: string | null;
    phone?: string | null;
  }>,
): DuplicateAccountCheckResult {
  const targetBank = data.bankAccountNumber?.trim();
  const targetPhone = data.phone?.trim();

  for (const profile of existingProfiles) {
    if (profile.userId === currentUserId) continue;

    if (targetBank && profile.bankAccountNumber?.trim() === targetBank) {
      return {
        isDuplicate: true,
        duplicateField: "bankAccountNumber",
        duplicateUserId: profile.userId,
        reason: `Nomor rekening ${targetBank} sudah digunakan oleh akun kreator lain (User ID: ${profile.userId}).`,
      };
    }

    if (targetPhone && profile.phone?.trim() === targetPhone) {
      return {
        isDuplicate: true,
        duplicateField: "phone",
        duplicateUserId: profile.userId,
        reason: `Nomor telepon ${targetPhone} sudah terdaftar pada akun kreator lain (User ID: ${profile.userId}).`,
      };
    }
  }

  return { isDuplicate: false };
}
