-- «منحة مؤثرين وجيز» — مؤثّرون ينشرون منحةً ثانيةً بكودٍ لكلٍّ منهم، ولهم عمولةٌ من سعر الدورات (٢٦ أكتوبر ٢٠٢٦).
--
-- قرارُ صاحب المنصّة: الأولى «منحة وجيز» بلا كود، والثانية «منحة مؤثرين وجيز» بكود المؤثّر في نموذج التسجيل،
-- وعمولتُه ١٥٪ من سعر الدورات العامّ. والعلّةُ في `server/services/influencer.service.ts`.

CREATE TABLE "Influencer" (
    "id" UUID NOT NULL,
    "nameAr" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "commissionPercent" INTEGER NOT NULL DEFAULT 15,
    "userId" UUID,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdBy" UUID,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Influencer_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "Influencer_code_key" ON "Influencer"("code");
CREATE UNIQUE INDEX "Influencer_userId_key" ON "Influencer"("userId");
ALTER TABLE "Influencer" ADD CONSTRAINT "Influencer_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE TABLE "InfluencerPayout" (
    "id" UUID NOT NULL,
    "influencerId" UUID NOT NULL,
    "amount" DECIMAL(10,2) NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'USD',
    "noteAr" TEXT,
    "recordedBy" UUID,
    "paidAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "InfluencerPayout_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "InfluencerPayout_influencerId_paidAt_idx" ON "InfluencerPayout"("influencerId", "paidAt");
ALTER TABLE "InfluencerPayout" ADD CONSTRAINT "InfluencerPayout_influencerId_fkey" FOREIGN KEY ("influencerId") REFERENCES "Influencer"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- كودُ المنحة يحمل مؤثّرَه وعمولتَه يومَ أُعطي
ALTER TABLE "GrantCode" ADD COLUMN "influencerId" UUID;
ALTER TABLE "GrantCode" ADD COLUMN "commissionPercent" INTEGER;
CREATE INDEX "GrantCode_influencerId_idx" ON "GrantCode"("influencerId");
ALTER TABLE "GrantCode" ADD CONSTRAINT "GrantCode_influencerId_fkey" FOREIGN KEY ("influencerId") REFERENCES "Influencer"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- وصاحبُ النموذج يحمل المؤثّرَ الذي جاء بكوده
ALTER TABLE "Lead" ADD COLUMN "influencerId" UUID;
ALTER TABLE "Lead" ADD CONSTRAINT "Lead_influencerId_fkey" FOREIGN KEY ("influencerId") REFERENCES "Influencer"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- والأولى اسمُها «منحة وجيز» — قرارُ صاحب المنصّة (٢٦ أكتوبر ٢٠٢٦)
UPDATE "GrantCampaign" SET "nameAr" = 'منحة وجيز' WHERE "slug" = 'wajeez-members';
