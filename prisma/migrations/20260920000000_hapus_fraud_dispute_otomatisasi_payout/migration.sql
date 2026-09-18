-- Hapus fitur Fraud, Dispute (sengketa), dan sederhanakan PayoutStatus
-- karena settlement sekarang otomatis (lihat domain/lifecycle.ts), bukan
-- lagi lewat aksi manual admin (tahan/rilis payout per kasus fraud/sengketa).

-- 1. Bersihkan data lama yang memakai nilai enum yang akan dihapus
UPDATE "Notification"
SET "type" = 'GENERAL'
WHERE "type"::text = 'DISPUTE_UPDATE';

UPDATE "Submission"
SET "status" = CASE
  WHEN "status"::text = 'ADMIN_APPROVED' THEN 'APPROVED'
  WHEN "status"::text = 'ADMIN_REJECTED' THEN 'REJECTED'
  WHEN "status"::text = 'APPEALED' THEN 'PENDING_REVIEW'
  ELSE "status"::text
END::"SubmissionStatus"
WHERE "status"::text IN ('ADMIN_APPROVED', 'ADMIN_REJECTED', 'APPEALED');

UPDATE "Payout"
SET "status" = 'PENDING'
WHERE "status"::text NOT IN ('PENDING', 'PAID');

-- 2. DropForeignKey + DropTable: DisputeMessage (child) sebelum Dispute (parent)
DROP TABLE IF EXISTS "DisputeMessage" CASCADE;
DROP TABLE IF EXISTS "Dispute" CASCADE;
DROP TABLE IF EXISTS "FraudFlag" CASCADE;

-- 3. DropEnum (sudah tidak dipakai kolom manapun setelah tabel di atas dihapus)
DROP TYPE IF EXISTS "DisputeStatus";
DROP TYPE IF EXISTS "FraudFlagType";
DROP TYPE IF EXISTS "FraudFlagStatus";

-- 4. AlterEnum: NotificationType — hapus DISPUTE_UPDATE
CREATE TYPE "NotificationType_new" AS ENUM ('CAMPAIGN_NEW_NEARBY', 'CAMPAIGN_ENDING_SOON', 'SUBMISSION_APPROVED', 'SUBMISSION_REJECTED', 'PAYOUT_RELEASED', 'VENDOR_VERIFIED', 'GENERAL');
ALTER TABLE "Notification" ALTER COLUMN "type" TYPE "NotificationType_new" USING ("type"::text::"NotificationType_new");
ALTER TYPE "NotificationType" RENAME TO "NotificationType_old";
ALTER TYPE "NotificationType_new" RENAME TO "NotificationType";
DROP TYPE "NotificationType_old";

-- 5. AlterEnum: SubmissionStatus — hapus APPEALED, ADMIN_APPROVED, ADMIN_REJECTED
CREATE TYPE "SubmissionStatus_new" AS ENUM ('PENDING_REVIEW', 'APPROVED', 'REJECTED');
ALTER TABLE "Submission" ALTER COLUMN "status" DROP DEFAULT;
ALTER TABLE "Submission" ALTER COLUMN "status" TYPE "SubmissionStatus_new" USING ("status"::text::"SubmissionStatus_new");
ALTER TYPE "SubmissionStatus" RENAME TO "SubmissionStatus_old";
ALTER TYPE "SubmissionStatus_new" RENAME TO "SubmissionStatus";
DROP TYPE "SubmissionStatus_old";
ALTER TABLE "Submission" ALTER COLUMN "status" SET DEFAULT 'PENDING_REVIEW';

-- 6. AlterEnum: PayoutStatus — sederhanakan jadi PENDING/PAID saja
CREATE TYPE "PayoutStatus_new" AS ENUM ('PENDING', 'PAID');
ALTER TABLE "Payout" ALTER COLUMN "status" DROP DEFAULT;
ALTER TABLE "Payout" ALTER COLUMN "status" TYPE "PayoutStatus_new" USING ("status"::text::"PayoutStatus_new");
ALTER TYPE "PayoutStatus" RENAME TO "PayoutStatus_old";
ALTER TYPE "PayoutStatus_new" RENAME TO "PayoutStatus";
DROP TYPE "PayoutStatus_old";
ALTER TABLE "Payout" ALTER COLUMN "status" SET DEFAULT 'PENDING';
