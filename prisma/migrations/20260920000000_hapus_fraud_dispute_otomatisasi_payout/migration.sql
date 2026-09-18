-- Hapus fitur Fraud, Dispute (sengketa), dan sederhanakan PayoutStatus
-- karena settlement sekarang otomatis (lihat domain/lifecycle.ts), bukan
-- lagi lewat aksi manual admin (tahan/rilis payout per kasus fraud/sengketa).

-- DropForeignKey + DropTable: DisputeMessage (child) sebelum Dispute (parent)
DROP TABLE "DisputeMessage" CASCADE;
DROP TABLE "Dispute" CASCADE;
DROP TABLE "FraudFlag" CASCADE;

-- DropEnum (sudah tidak dipakai kolom manapun setelah tabel di atas dihapus)
DROP TYPE "DisputeStatus";
DROP TYPE "FraudFlagType";
DROP TYPE "FraudFlagStatus";

-- AlterEnum: NotificationType — hapus DISPUTE_UPDATE
BEGIN;
CREATE TYPE "NotificationType_new" AS ENUM ('CAMPAIGN_NEW_NEARBY', 'CAMPAIGN_ENDING_SOON', 'SUBMISSION_APPROVED', 'SUBMISSION_REJECTED', 'PAYOUT_RELEASED', 'VENDOR_VERIFIED', 'GENERAL');
ALTER TABLE "Notification" ALTER COLUMN "type" TYPE "NotificationType_new" USING ("type"::text::"NotificationType_new");
ALTER TYPE "NotificationType" RENAME TO "NotificationType_old";
ALTER TYPE "NotificationType_new" RENAME TO "NotificationType";
DROP TYPE "NotificationType_old";
COMMIT;

-- AlterEnum: SubmissionStatus — hapus APPEALED, ADMIN_APPROVED, ADMIN_REJECTED
BEGIN;
CREATE TYPE "SubmissionStatus_new" AS ENUM ('PENDING_REVIEW', 'APPROVED', 'REJECTED');
ALTER TABLE "Submission" ALTER COLUMN "status" DROP DEFAULT;
ALTER TABLE "Submission" ALTER COLUMN "status" TYPE "SubmissionStatus_new" USING ("status"::text::"SubmissionStatus_new");
ALTER TYPE "SubmissionStatus" RENAME TO "SubmissionStatus_old";
ALTER TYPE "SubmissionStatus_new" RENAME TO "SubmissionStatus";
DROP TYPE "SubmissionStatus_old";
ALTER TABLE "Submission" ALTER COLUMN "status" SET DEFAULT 'PENDING_REVIEW';
COMMIT;

-- AlterEnum: PayoutStatus — sederhanakan jadi PENDING/PAID saja (PROCESSING/HELD/CANCELLED
-- hanya berarti dulu saat ada alur tahan-payout manual karena fraud/sengketa)
BEGIN;
CREATE TYPE "PayoutStatus_new" AS ENUM ('PENDING', 'PAID');
ALTER TABLE "Payout" ALTER COLUMN "status" DROP DEFAULT;
ALTER TABLE "Payout" ALTER COLUMN "status" TYPE "PayoutStatus_new" USING ("status"::text::"PayoutStatus_new");
ALTER TYPE "PayoutStatus" RENAME TO "PayoutStatus_old";
ALTER TYPE "PayoutStatus_new" RENAME TO "PayoutStatus";
DROP TYPE "PayoutStatus_old";
ALTER TABLE "Payout" ALTER COLUMN "status" SET DEFAULT 'PENDING';
COMMIT;
