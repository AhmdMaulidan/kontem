-- Migrasi keluar dari model redeem-code kunjungan fisik & klaim slot manual.
-- Participation lama berstatus JOINED/VISITED (menunggu kunjungan) tidak lagi
-- punya arti karena submit sekarang langsung membuat participation ber-status
-- SUBMITTED; baris lama dinormalisasi dulu sebelum enum-nya diciutkan.
UPDATE "CampaignParticipation" SET "status" = 'SUBMITTED' WHERE "status" IN ('JOINED', 'VISITED');

-- AlterEnum
BEGIN;
CREATE TYPE "ParticipationStatus_new" AS ENUM ('SUBMITTED', 'COMPLETED', 'CANCELLED');
ALTER TABLE "public"."CampaignParticipation" ALTER COLUMN "status" DROP DEFAULT;
ALTER TABLE "CampaignParticipation" ALTER COLUMN "status" TYPE "ParticipationStatus_new" USING ("status"::text::"ParticipationStatus_new");
ALTER TYPE "ParticipationStatus" RENAME TO "ParticipationStatus_old";
ALTER TYPE "ParticipationStatus_new" RENAME TO "ParticipationStatus";
DROP TYPE "public"."ParticipationStatus_old";
ALTER TABLE "CampaignParticipation" ALTER COLUMN "status" SET DEFAULT 'SUBMITTED';
COMMIT;

-- DropForeignKey
ALTER TABLE "RedeemCode" DROP CONSTRAINT "RedeemCode_campaignId_fkey";

-- DropForeignKey
ALTER TABLE "RedeemCode" DROP CONSTRAINT "RedeemCode_participationId_fkey";

-- AlterTable
ALTER TABLE "Campaign" ADD COLUMN     "imageUrl" TEXT,
ALTER COLUMN "complimentType" DROP NOT NULL,
ALTER COLUMN "complimentValue" DROP NOT NULL;

-- DropTable
DROP TABLE "RedeemCode";

-- DropEnum
DROP TYPE "RedeemCodeStatus";
