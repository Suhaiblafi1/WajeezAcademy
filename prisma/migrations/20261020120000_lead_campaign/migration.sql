-- AlterTable
ALTER TABLE "Lead" ADD COLUMN     "campaign" TEXT,
ADD COLUMN     "channel" TEXT,
ADD COLUMN     "wave" TEXT,
ADD COLUMN     "workField" TEXT;

-- CreateIndex
CREATE INDEX "Lead_campaign_createdAt_idx" ON "Lead"("campaign", "createdAt");

