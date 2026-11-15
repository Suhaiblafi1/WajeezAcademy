-- ═══ منحُ الشركاء — جامعاتٌ وشركاتٌ بمنحةٍ لكلٍّ منها (١٥ نوفمبر ٢٠٢٦) ═══
--
-- قرارُ صاحب المنصّة: منحةٌ لكلّ شريكٍ بصفحتها ونسبتها وحدّ دوراتها، بلا عمولة، وأوّلُها «الجامعة الهاشمية».
-- والشريكُ صفٌّ في `GrantCampaign` بنوع `partner` — فالكودُ وحدُّ الدورات واختيارُ الدورات والتذكيرُ تعمل كما هي.
-- والتحقّقُ ببريد الجامعة وحدَه: رابطٌ يُرسَل إليه ويُستعمل مرّةً (`PartnerEmailLink`). والعلّةُ في
-- `server/services/partner-grant.service.ts`.
--
-- إضافيٌّ كلُّه: الحملاتُ الأربعُ نوعُها `campaign` بالافتراضيّ، وما سوى ذلك فارغ — فلا يتغيّر فيها شيء.

ALTER TABLE "GrantCampaign" ADD COLUMN "kind" TEXT NOT NULL DEFAULT 'campaign';
ALTER TABLE "GrantCampaign" ADD COLUMN "partnerType" TEXT;
ALTER TABLE "GrantCampaign" ADD COLUMN "partnerNameEn" TEXT;
ALTER TABLE "GrantCampaign" ADD COLUMN "emailDomains" TEXT[] DEFAULT ARRAY[]::TEXT[];
ALTER TABLE "GrantCampaign" ADD COLUMN "logoKey" TEXT;
ALTER TABLE "GrantCampaign" ADD COLUMN "logoPendingKey" TEXT;

CREATE UNIQUE INDEX "GrantCampaign_logoKey_key" ON "GrantCampaign"("logoKey");
CREATE UNIQUE INDEX "GrantCampaign_logoPendingKey_key" ON "GrantCampaign"("logoPendingKey");
CREATE INDEX "GrantCampaign_kind_idx" ON "GrantCampaign"("kind");

-- مولَّدٌ من تعليق المخطّط: npx tsx scripts/status-checks.ts
ALTER TABLE "GrantCampaign" DROP CONSTRAINT IF EXISTS "GrantCampaign_kind_allowed";
ALTER TABLE "GrantCampaign" ADD CONSTRAINT "GrantCampaign_kind_allowed" CHECK ("kind" IN ('campaign', 'partner'));

CREATE TABLE "PartnerEmailLink" (
    "id" UUID NOT NULL,
    "campaignId" UUID NOT NULL,
    "email" TEXT NOT NULL,
    "fullName" TEXT NOT NULL,
    "phone" TEXT,
    "channel" TEXT,
    "wave" TEXT,
    "tokenHash" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "usedAt" TIMESTAMP(3),
    "leadId" UUID,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PartnerEmailLink_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "PartnerEmailLink_tokenHash_key" ON "PartnerEmailLink"("tokenHash");
CREATE INDEX "PartnerEmailLink_campaignId_email_createdAt_idx" ON "PartnerEmailLink"("campaignId", "email", "createdAt");

ALTER TABLE "PartnerEmailLink" ADD CONSTRAINT "PartnerEmailLink_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "GrantCampaign"("id") ON DELETE CASCADE ON UPDATE CASCADE;
