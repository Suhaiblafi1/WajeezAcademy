-- بريدُ زائرٍ لم يُسجَّل بعد — تُرك مقابل كود خصم لا مقابل حساب.
--
-- بديلٌ عن بوّابة التسجيل الكاملة التي حُذفت من صفحتي المسار والتشخيص:
-- الزائر يرى كل شيء بلا حاجز، وهذا الجدول هو الإشارة التسويقية الوحيدة
-- الباقية عمّن تصفّح ولم يشترِ بعد.

CREATE TABLE "MarketingLead" (
  "id"         UUID NOT NULL DEFAULT gen_random_uuid(),
  "email"      TEXT NOT NULL,
  "source"     TEXT NOT NULL,
  "pathwayId"  TEXT,
  "createdAt"  TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "lastSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "MarketingLead_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "MarketingLead_email_key" ON "MarketingLead"("email");
CREATE INDEX "MarketingLead_createdAt_idx" ON "MarketingLead"("createdAt");
