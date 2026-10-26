-- مصدرُ التسجيل — من أين جاء المتعلّم حين أنشأ حسابه (٢٦ أكتوبر ٢٠٢٦).
--
-- سأل صاحبُ المنصّة: «كيف أعلم هذا المتعلّم من أين وصل وكيف وصل؟». والعلّةُ في
-- `src/application/marketing/signup-source.ts`. ومن سجّل قبل هذا لا صفَّ له.

CREATE TABLE "SignupSource" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "via" TEXT NOT NULL,
    "utmSource" TEXT,
    "utmMedium" TEXT,
    "utmCampaign" TEXT,
    "utmContent" TEXT,
    "utmTerm" TEXT,
    "channel" TEXT,
    "wave" TEXT,
    "refCode" TEXT,
    "referrerHost" TEXT,
    "landingPath" TEXT,
    "firstSeenAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SignupSource_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "SignupSource_userId_key" ON "SignupSource"("userId");
CREATE INDEX "SignupSource_createdAt_idx" ON "SignupSource"("createdAt");

ALTER TABLE "SignupSource" ADD CONSTRAINT "SignupSource_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
