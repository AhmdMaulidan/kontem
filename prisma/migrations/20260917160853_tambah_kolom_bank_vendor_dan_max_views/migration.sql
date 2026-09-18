-- AlterTable
ALTER TABLE "Campaign" ADD COLUMN     "maxViewsPerCreator" INTEGER;

-- AlterTable
ALTER TABLE "VendorProfile" ADD COLUMN     "bankAccountName" TEXT,
ADD COLUMN     "bankAccountNumber" TEXT,
ADD COLUMN     "bankName" TEXT;
