-- ملفُّ المستشار: إعادةُ ترحيلٍ سقط في دمج.
--
-- أُنشئ الجدولُ في `20260901230000_advisor_profile`، وأسقط الدمجُ `964e6bd`
-- ملفَّ الترحيل وأبقى النموذجَ في المخطَّط والخدمةَ التي تقرؤه. فصار الخادمُ
-- ينادي جدولا لا وجودَ له: كلُّ نداءٍ على «المستشارون والعمولة» و«عمولتي»
-- يُردّ بـ«The table `public.AdvisorProfile` does not exist».
--
-- ولا يظهر في أيّ اختبار — لأنّ اختبارات الخادم ليست في CI أصلا.
--
-- والإنشاءُ مشروطٌ (`IF NOT EXISTS`) لأنّ القواعدَ التي طبّقت الترحيلَ
-- الأوّلَ قبل ضياعه فيها الجدولُ سلفا.
CREATE TABLE IF NOT EXISTS "AdvisorProfile" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "commissionPct" DECIMAL(5,2) NOT NULL DEFAULT 0,
    "notesAr" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "AdvisorProfile_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "AdvisorProfile_userId_key" ON "AdvisorProfile"("userId");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'AdvisorProfile_userId_fkey'
  ) THEN
    ALTER TABLE "AdvisorProfile" ADD CONSTRAINT "AdvisorProfile_userId_fkey"
      FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;
