-- ═══ حصّةُ الشريك من الإيراد — ولوحتُه وما صُرف له (١٦ نوفمبر ٢٠٢٦) ═══
--
-- قرارُ صاحب المنصّة: تتقاسم الجامعةُ الشريكةُ مع وجيز ما يدفعه المستفيدُ من رابطها — «% of what the student paid»،
-- ٥٠٪ افتراضا تُعدَّل لكلّ شريك، قبل أجور المدرّبين — ولها لوحةٌ تُدقَّق فيها من سجّل ومن دفع وكم لها. وخصمُ الشريك
-- الجديد ٥٠٪ (`PARTNER_DEFAULTS`). والشركاءُ القائمون بلا حصّةٍ حتى يكتبها المدير: لا يُحسب لأحدٍ مالٌ لم يُتّفق عليه.

ALTER TABLE "GrantCampaign" ADD COLUMN "partnerSharePercent" INTEGER;
ALTER TABLE "GrantCampaign" ADD COLUMN "partnerUserId" UUID;
CREATE UNIQUE INDEX "GrantCampaign_partnerUserId_key" ON "GrantCampaign"("partnerUserId");
ALTER TABLE "GrantCampaign" ADD CONSTRAINT "GrantCampaign_partnerUserId_fkey" FOREIGN KEY ("partnerUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "GrantCode" ADD COLUMN "partnerSharePercent" INTEGER;

CREATE TABLE "PartnerPayout" (
    "id" UUID NOT NULL,
    "campaignId" UUID NOT NULL,
    "amount" DECIMAL(10,2) NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'USD',
    "noteAr" TEXT,
    "paidAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "recordedBy" UUID,
    CONSTRAINT "PartnerPayout_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "PartnerPayout_campaignId_paidAt_idx" ON "PartnerPayout"("campaignId", "paidAt");
ALTER TABLE "PartnerPayout" ADD CONSTRAINT "PartnerPayout_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "GrantCampaign"("id") ON DELETE CASCADE ON UPDATE CASCADE;
