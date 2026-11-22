-- ═══ البريدُ الجماعيّ: قوائمُ وحملات (٢٢ نوفمبر ٢٠٢٦) ═══
--
-- طلبُ صاحب المنصّة: «i need to send emails to all leads from my website or leads from excel sheet i upload..
-- using resend»، ثمّ «i choose which list and what email to them.. multi campaign same place».
-- فقائمةٌ تُرفع صفوفُها (لا ملفُّها)، وحملةٌ تُكتب ثمّ تُرسل في طابور البريد القائم بمرجع دفعةٍ واحد.
-- ومن مُرسِلٍ على نطاقٍ فرعيّ، وعلى مراحلَ بالأيّام لما كبر (قرارُ صاحب المنصّة في اليوم نفسِه).
-- وقيدُ الحالة مولَّدٌ من تعليقه: npx tsx scripts/status-checks.ts

-- CreateTable
CREATE TABLE "MailList" (
    "id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "fileName" TEXT,
    "totalRows" INTEGER NOT NULL DEFAULT 0,
    "invalidRows" INTEGER NOT NULL DEFAULT 0,
    "duplicateRows" INTEGER NOT NULL DEFAULT 0,
    "createdBy" UUID,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MailList_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MailListEntry" (
    "id" UUID NOT NULL,
    "listId" UUID NOT NULL,
    "email" TEXT NOT NULL,
    "name" TEXT,

    CONSTRAINT "MailListEntry_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MailCampaign" (
    "id" UUID NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'draft',
    "subject" TEXT NOT NULL DEFAULT '',
    "body" TEXT NOT NULL DEFAULT '',
    "buttonLabel" TEXT,
    "buttonUrl" TEXT,
    "audience" TEXT,
    "audienceAr" TEXT,
    "fromName" TEXT,
    "fromEmail" TEXT,
    "stages" JSONB,
    "createdBy" UUID,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "batchId" UUID,
    "sentBy" UUID,
    "sentAt" TIMESTAMP(3),
    "queuedCount" INTEGER NOT NULL DEFAULT 0,
    "skippedOptOut" INTEGER NOT NULL DEFAULT 0,
    "skippedInvalid" INTEGER NOT NULL DEFAULT 0,
    "skippedDuplicate" INTEGER NOT NULL DEFAULT 0,
    "stoppedBy" UUID,
    "stoppedAt" TIMESTAMP(3),
    "cancelledCount" INTEGER NOT NULL DEFAULT 0,
    "sentCount" INTEGER,
    "failedCount" INTEGER,
    "finishedAt" TIMESTAMP(3),

    CONSTRAINT "MailCampaign_pkey" PRIMARY KEY ("id")
);

-- AlterTable: لا يُرسَل قبله — مراحلُ الحملة
ALTER TABLE "OutboxMail" ADD COLUMN "notBefore" TIMESTAMP(3);

-- CreateIndex
CREATE UNIQUE INDEX "MailListEntry_listId_email_key" ON "MailListEntry"("listId", "email");

-- CreateIndex
CREATE UNIQUE INDEX "MailCampaign_batchId_key" ON "MailCampaign"("batchId");

-- CreateIndex
CREATE INDEX "MailCampaign_status_createdAt_idx" ON "MailCampaign"("status", "createdAt");

-- CreateIndex
CREATE INDEX "OutboxMail_purpose_status_createdAt_idx" ON "OutboxMail"("purpose", "status", "createdAt");

-- AddForeignKey
ALTER TABLE "MailListEntry" ADD CONSTRAINT "MailListEntry_listId_fkey" FOREIGN KEY ("listId") REFERENCES "MailList"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- مولَّدٌ من تعليق الحالة (scripts/status-checks.ts)
ALTER TABLE "MailCampaign" DROP CONSTRAINT IF EXISTS "MailCampaign_status_allowed";
ALTER TABLE "MailCampaign" ADD CONSTRAINT "MailCampaign_status_allowed" CHECK ("status" IN ('draft', 'sending', 'sent', 'stopped'));
