-- متابعةُ المؤجَّل إلى الفصول القادمة حين يحلّ موعدُه (٦ أكتوبر ٢٠٢٦).
--
-- اختار صاحبُ المنصّة من أربعة بدائل أن يقع الأمران معا حين يحلّ الموعد: يُذكَّر
-- الفريق، ويُسأل المتقدّمُ بالبريد «أما زلتَ مهتمّا؟» بخيارين يُجاب عنهما بنقرة.
--
-- ① متى سُئل — فلا يُسأل مرّتين: `deferredInterestAskedAt`.
-- ② وهاشُ رمزِ رابطِ جوابه — لا الرمزُ نفسُه: `deferredInterestTokenHash`.
-- ③ وفهرسٌ على الموعد: وظيفةُ العامل تسأل عمّن حلّ موعدُه كلَّ ساعة.

ALTER TABLE "TrainerApplication" ADD COLUMN IF NOT EXISTS "deferredInterestAskedAt" TIMESTAMP(3);
ALTER TABLE "TrainerApplication" ADD COLUMN IF NOT EXISTS "deferredInterestTokenHash" TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS "TrainerApplication_deferredInterestTokenHash_key" ON "TrainerApplication"("deferredInterestTokenHash");
CREATE INDEX IF NOT EXISTS "TrainerApplication_deferredFollowUpAt_idx" ON "TrainerApplication"("deferredFollowUpAt");
