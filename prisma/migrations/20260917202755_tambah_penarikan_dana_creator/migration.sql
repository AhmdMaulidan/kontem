-- CreateEnum
CREATE TYPE "WithdrawalStatus" AS ENUM ('PENDING_ADMIN_APPROVAL', 'APPROVED', 'REJECTED', 'PAID');

-- AlterEnum
ALTER TYPE "EscrowType" ADD VALUE 'WITHDRAWAL_FEE';

-- AlterTable
ALTER TABLE "Campaign" ADD COLUMN     "minWithdrawalAmount" INTEGER;

-- AlterTable
ALTER TABLE "VendorProfile" ALTER COLUMN "latitude" DROP NOT NULL,
ALTER COLUMN "longitude" DROP NOT NULL;

-- CreateTable
CREATE TABLE "Withdrawal" (
    "id" TEXT NOT NULL,
    "creatorId" TEXT NOT NULL,
    "campaignId" TEXT NOT NULL,
    "submissionId" TEXT NOT NULL,
    "viewsCounted" INTEGER NOT NULL,
    "grossAmount" INTEGER NOT NULL,
    "feeAmount" INTEGER NOT NULL,
    "netAmount" INTEGER NOT NULL,
    "status" "WithdrawalStatus" NOT NULL DEFAULT 'PENDING_ADMIN_APPROVAL',
    "requestedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "approvedAt" TIMESTAMP(3),
    "approvedById" TEXT,
    "rejectionReason" TEXT,
    "paidAt" TIMESTAMP(3),
    "bankName" TEXT,
    "bankAccountNumber" TEXT,
    "bankAccountName" TEXT,

    CONSTRAINT "Withdrawal_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Withdrawal_submissionId_key" ON "Withdrawal"("submissionId");

-- CreateIndex
CREATE INDEX "Withdrawal_campaignId_status_idx" ON "Withdrawal"("campaignId", "status");

-- CreateIndex
CREATE INDEX "Withdrawal_creatorId_idx" ON "Withdrawal"("creatorId");

-- AddForeignKey
ALTER TABLE "Withdrawal" ADD CONSTRAINT "Withdrawal_creatorId_fkey" FOREIGN KEY ("creatorId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Withdrawal" ADD CONSTRAINT "Withdrawal_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "Campaign"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Withdrawal" ADD CONSTRAINT "Withdrawal_submissionId_fkey" FOREIGN KEY ("submissionId") REFERENCES "Submission"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Withdrawal" ADD CONSTRAINT "Withdrawal_approvedById_fkey" FOREIGN KEY ("approvedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
