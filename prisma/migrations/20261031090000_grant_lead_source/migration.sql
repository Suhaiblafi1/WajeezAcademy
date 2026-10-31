-- AlterTable
ALTER TABLE "Lead" ADD COLUMN     "firstTouch" JSONB,
ADD COLUMN     "pageTouch" JSONB,
ADD COLUMN     "pageOpenedAt" TIMESTAMP(3);

-- CreateIndex
CREATE INDEX "OutboxMail_to_idx" ON "OutboxMail"("to");
