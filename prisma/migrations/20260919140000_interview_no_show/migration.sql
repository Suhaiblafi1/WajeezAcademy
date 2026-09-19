-- الغيابُ نتيجةٌ (البند ٥): «لم يحضر» ينضمّ إلى نتائج لقاء التعارف.
-- والتعليقُ عقدٌ (المهمّة ٦٢): القيدُ مولَّدٌ من تعليق العمود في المخطَّط
-- بـ`scripts/status-checks.ts`، لا مكتوبٌ باليد — فمن زاد قيمةً كتبها في
-- التعليق أوّلا ثمّ ولّد الترحيل.
ALTER TABLE "TrainerInterview" DROP CONSTRAINT IF EXISTS "TrainerInterview_outcome_allowed";
ALTER TABLE "TrainerInterview" ADD CONSTRAINT "TrainerInterview_outcome_allowed" CHECK ("outcome" IN ('passed', 'hold', 'failed', 'no_show'));
