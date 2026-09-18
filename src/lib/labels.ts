import {
  BusinessCategory,
  CampaignStatus,
  DisputeStatus,
  FraudFlagType,
  ParticipationStatus,
  PayoutStatus,
  Role,
  SocialPlatform,
  SubmissionStatus,
  VerificationStatus,
  WithdrawalStatus,
} from "@/generated/prisma/enums";

export const roleLabel: Record<Role, string> = {
  CREATOR: "Creator",
  VENDOR: "Vendor",
  ADMIN: "Admin",
};

export const categoryLabel: Record<BusinessCategory, string> = {
  KULINER: "Kuliner",
  WISATA_ALAM: "Wisata Alam",
  WISATA_BUATAN: "Wisata Buatan",
  AKOMODASI: "Akomodasi",
  LAINNYA: "Lainnya",
};

export const campaignStatusLabel: Record<CampaignStatus, string> = {
  DRAFT: "Draft",
  PENDING_REVIEW: "Menunggu Approval",
  REJECTED: "Ditolak Admin",
  ACTIVE: "Berjalan",
  ENDED: "Periode Selesai",
  SETTLING: "Proses Payout",
  SETTLED: "Selesai",
  CANCELLED: "Dibatalkan",
};

export const submissionStatusLabel: Record<SubmissionStatus, string> = {
  PENDING_REVIEW: "Menunggu Review",
  APPROVED: "Disetujui",
  REJECTED: "Ditolak",
  APPEALED: "Banding",
  ADMIN_APPROVED: "Disetujui Admin",
  ADMIN_REJECTED: "Ditolak Final",
};

export const participationStatusLabel: Record<ParticipationStatus, string> = {
  SUBMITTED: "Konten Dikirim",
  COMPLETED: "Selesai",
  CANCELLED: "Dibatalkan",
};

export const payoutStatusLabel: Record<PayoutStatus, string> = {
  PENDING: "Menunggu Pencairan",
  PROCESSING: "Diproses",
  PAID: "Cair",
  HELD: "Ditahan",
  CANCELLED: "Dibatalkan",
};

export const withdrawalStatusLabel: Record<WithdrawalStatus, string> = {
  PENDING_ADMIN_APPROVAL: "Menunggu Approval Admin",
  APPROVED: "Disetujui, Menunggu Transfer",
  REJECTED: "Ditolak",
  PAID: "Cair",
};

export const verificationStatusLabel: Record<VerificationStatus, string> = {
  UNVERIFIED: "Belum Verifikasi",
  PENDING: "Menunggu Verifikasi",
  VERIFIED: "Terverifikasi",
  REJECTED: "Ditolak",
};

// Creator dilihat lewat kacamata aktif/non-aktif, bukan lulus/ditolak seperti
// vendor — akun yang sama bisa dinonaktifkan lagi kapan pun setelah pernah
// aktif, jadi "Ditolak" (kesan keputusan sekali jalan) tidak cocok di sini.
// Nilai enum-nya tetap dipakai bersama VerificationStatus supaya tidak perlu
// migrasi skema baru.
export const creatorAccountStatusLabel: Record<VerificationStatus, string> = {
  UNVERIFIED: "Belum dicek",
  PENDING: "Menunggu verifikasi",
  VERIFIED: "Aktif",
  REJECTED: "Non-aktif",
};

export const disputeStatusLabel: Record<DisputeStatus, string> = {
  OPEN: "Terbuka",
  UNDER_REVIEW: "Sedang Ditinjau",
  RESOLVED_UPHELD: "Penolakan Dikuatkan",
  RESOLVED_OVERTURNED: "Dimenangkan Creator",
  WITHDRAWN: "Dicabut",
};

export const platformLabel: Record<SocialPlatform, string> = {
  TIKTOK: "TikTok",
  INSTAGRAM: "Instagram",
  YOUTUBE: "YouTube",
};

export const fraudFlagLabel: Record<FraudFlagType, string> = {
  REUSED_CONTENT: "Konten Daur Ulang",
  INFLATED_VIEWS: "Views Tidak Wajar",
  DUPLICATE_ACCOUNT: "Akun Ganda",
  OFF_BRIEF: "Tidak Sesuai Brief",
  FAKE_VISIT: "Kunjungan Palsu",
  OTHER: "Lainnya",
};

/**
 * Warna badge per status, dipakai komponen <Badge> dan <Callout>.
 * Mengikuti matriks status pada design.md bagian 6.3.
 */
export type BadgeTone =
  | "neutral"
  | "info" // indigo — sedang ditinjau
  | "success" // emerald — beres / dana terkunci
  | "warning" // amber — menunggu tindakan
  | "danger" // rose — ditolak / sengketa
  | "sky" // sky — kehadiran terkonfirmasi
  | "teal" // teal — dana sudah cair
  | "accent"; // marigold — komplimen & sorotan

export const campaignStatusTone: Record<CampaignStatus, BadgeTone> = {
  DRAFT: "neutral",
  PENDING_REVIEW: "warning",
  REJECTED: "danger",
  ACTIVE: "success",
  ENDED: "sky",
  SETTLING: "info",
  SETTLED: "teal",
  CANCELLED: "danger",
};

export const submissionStatusTone: Record<SubmissionStatus, BadgeTone> = {
  PENDING_REVIEW: "info",
  APPROVED: "success",
  REJECTED: "danger",
  APPEALED: "danger",
  ADMIN_APPROVED: "success",
  ADMIN_REJECTED: "danger",
};

export const participationStatusTone: Record<ParticipationStatus, BadgeTone> = {
  SUBMITTED: "info",
  COMPLETED: "success",
  CANCELLED: "neutral",
};

export const payoutStatusTone: Record<PayoutStatus, BadgeTone> = {
  PENDING: "warning",
  PROCESSING: "info",
  PAID: "teal",
  HELD: "danger",
  CANCELLED: "neutral",
};

export const withdrawalStatusTone: Record<WithdrawalStatus, BadgeTone> = {
  PENDING_ADMIN_APPROVAL: "warning",
  APPROVED: "info",
  REJECTED: "danger",
  PAID: "teal",
};

/** Warna per kategori usaha, dipakai badge di kartu campaign. */
export const categoryTone: Record<BusinessCategory, BadgeTone> = {
  KULINER: "accent",
  WISATA_ALAM: "success",
  WISATA_BUATAN: "sky",
  AKOMODASI: "info",
  LAINNYA: "neutral",
};

export const verificationStatusTone: Record<VerificationStatus, BadgeTone> = {
  UNVERIFIED: "neutral",
  PENDING: "warning",
  VERIFIED: "success",
  REJECTED: "danger",
};

export const creatorAccountStatusTone: Record<VerificationStatus, BadgeTone> = {
  UNVERIFIED: "neutral",
  PENDING: "warning",
  VERIFIED: "success",
  REJECTED: "danger",
};
