-- CreateEnum
CREATE TYPE "AnalysisVerdict" AS ENUM ('diterima', 'ditolak', 'perlu_verifikasi');

-- CreateEnum
CREATE TYPE "AnalysisStatus" AS ENUM ('PROCESSING', 'COMPLETED', 'FAILED');

-- AlterTable
ALTER TABLE "Campaign" ADD COLUMN "brief" TEXT NOT NULL DEFAULT '';

-- CreateTable
CREATE TABLE "video_analyses" (
    "id" TEXT NOT NULL,
    "campaignId" TEXT,
    "sourceUrl" TEXT NOT NULL,
    "brief" TEXT NOT NULL,
    "interpretedRules" JSONB NOT NULL,
    "verdict" "AnalysisVerdict",
    "status" "AnalysisStatus" NOT NULL DEFAULT 'PROCESSING',
    "alasan" JSONB NOT NULL,
    "score" DOUBLE PRECISION,
    "transcript" TEXT,
    "durationSec" INTEGER,
    "results" JSONB NOT NULL,
    "humanDecision" "AnalysisVerdict",
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "video_analyses_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "video_analyses_campaignId_idx" ON "video_analyses"("campaignId");

-- AddForeignKey
ALTER TABLE "video_analyses" ADD CONSTRAINT "video_analyses_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "Campaign"("id") ON DELETE SET NULL ON UPDATE CASCADE;
