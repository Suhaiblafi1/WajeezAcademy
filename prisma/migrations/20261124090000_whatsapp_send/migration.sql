-- ═══ الإرسالُ على واتساب: موافقاتٌ وحملاتٌ ورسائل (٢٤ نوفمبر ٢٠٢٦) ═══
--
-- طلبُ صاحب المنصّة: «ابنه لي في الادمن لارسل واتس اب براحتي»، ولكلّ جهات الأكاديميّة («All academy contacts»).
-- عبر WhatsApp Cloud API. والإرسالُ مغلقٌ حتى يُربط الحساب. وقيودُ الحالة مولَّدةٌ: npx tsx scripts/status-checks.ts

-- CreateTable
CREATE TABLE "WhatsAppConsent" (
    "id" UUID NOT NULL,
    "tail" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "name" TEXT,
    "kind" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "textAr" TEXT NOT NULL,
    "createdBy" UUID,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WhatsAppConsent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WhatsAppCampaign" (
    "id" UUID NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'sending',
    "template" TEXT NOT NULL,
    "language" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "params" JSONB NOT NULL DEFAULT '[]',
    "audience" TEXT NOT NULL,
    "audienceAr" TEXT NOT NULL,
    "queuedCount" INTEGER NOT NULL DEFAULT 0,
    "skippedConsent" INTEGER NOT NULL DEFAULT 0,
    "skippedOptOut" INTEGER NOT NULL DEFAULT 0,
    "skippedInvalid" INTEGER NOT NULL DEFAULT 0,
    "skippedDuplicate" INTEGER NOT NULL DEFAULT 0,
    "cancelledCount" INTEGER NOT NULL DEFAULT 0,
    "sentBy" UUID,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "stoppedBy" UUID,
    "finishedAt" TIMESTAMP(3),

    CONSTRAINT "WhatsAppCampaign_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WhatsAppMessage" (
    "id" UUID NOT NULL,
    "direction" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'queued',
    "tail" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "name" TEXT,
    "body" TEXT NOT NULL,
    "campaignId" UUID,
    "template" TEXT,
    "language" TEXT,
    "category" TEXT,
    "params" JSONB,
    "metaId" TEXT,
    "error" TEXT,
    "createdBy" UUID,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "notBefore" TIMESTAMP(3),
    "startedAt" TIMESTAMP(3),
    "readAt" TIMESTAMP(3),

    CONSTRAINT "WhatsAppMessage_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "WhatsAppConsent_tail_kind_key" ON "WhatsAppConsent"("tail", "kind");

-- CreateIndex
CREATE INDEX "WhatsAppCampaign_status_createdAt_idx" ON "WhatsAppCampaign"("status", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "WhatsAppMessage_metaId_key" ON "WhatsAppMessage"("metaId");

-- CreateIndex
CREATE INDEX "WhatsAppMessage_status_createdAt_idx" ON "WhatsAppMessage"("status", "createdAt");

-- CreateIndex
CREATE INDEX "WhatsAppMessage_tail_createdAt_idx" ON "WhatsAppMessage"("tail", "createdAt");

-- CreateIndex
CREATE INDEX "WhatsAppMessage_campaignId_status_idx" ON "WhatsAppMessage"("campaignId", "status");

-- AddForeignKey
ALTER TABLE "WhatsAppMessage" ADD CONSTRAINT "WhatsAppMessage_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "WhatsAppCampaign"("id") ON DELETE CASCADE ON UPDATE CASCADE;


ALTER TABLE "WhatsAppConsent" DROP CONSTRAINT IF EXISTS "WhatsAppConsent_kind_allowed";
ALTER TABLE "WhatsAppConsent" ADD CONSTRAINT "WhatsAppConsent_kind_allowed" CHECK ("kind" IN ('utility', 'marketing'));
ALTER TABLE "WhatsAppCampaign" DROP CONSTRAINT IF EXISTS "WhatsAppCampaign_status_allowed";
ALTER TABLE "WhatsAppCampaign" ADD CONSTRAINT "WhatsAppCampaign_status_allowed" CHECK ("status" IN ('sending', 'sent', 'stopped'));
ALTER TABLE "WhatsAppMessage" DROP CONSTRAINT IF EXISTS "WhatsAppMessage_status_allowed";
ALTER TABLE "WhatsAppMessage" ADD CONSTRAINT "WhatsAppMessage_status_allowed" CHECK ("status" IN ('queued', 'sending', 'sent', 'delivered', 'read', 'failed', 'cancelled', 'received'));
