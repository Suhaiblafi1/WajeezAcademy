-- فحوصُ المهارة في المجالات تشارك جدولَ اختبار المستوى (٨ أكتوبر ٢٠٢٦).
--
-- قرارُ صاحب المنصّة: «فحوصُ مهارةٍ قصيرة» في أربعة مجالات (تحليلُ البيانات · التسويق ·
-- الأمنُ السيبرانيّ · الذكاءُ الاصطناعيّ)، اختياريّةٌ من صفحة النتيجة كاختبار الإنجليزيّة،
-- و«تُفتح فورا وتُراجَع بعدُ». فالجدولُ نفسُه بعمود موضوعٍ، والقاعدةُ نفسُها في التصحيح.
--
-- · `subject`: والموجودُ كلُّه إنجليزيّة، فالافتراضُ يصدق على ما مضى.
-- · `stemEn`/`passageEn` ← `stem`/`passage`: نصُّ الفحوص عربيّ، فلا يبقى في الاسم لغة.
--   وإعادةُ تسميةٍ لا حذفٌ وإضافة — فلا يضيع ما عدّله مراجعُ الإنجليزيّة.
-- · قيدُ المستوى يتّسع لسلّم المجال، مولَّدا من تعليق العمود بـ`scripts/status-checks.ts`.

ALTER TABLE "PlacementQuestion" RENAME COLUMN "stemEn" TO "stem";
ALTER TABLE "PlacementQuestion" RENAME COLUMN "passageEn" TO "passage";
ALTER TABLE "PlacementQuestion" ADD COLUMN "subject" TEXT NOT NULL DEFAULT 'english';

DROP INDEX "PlacementQuestion_status_level_idx";
CREATE INDEX "PlacementQuestion_subject_status_level_idx" ON "PlacementQuestion"("subject", "status", "level");

ALTER TABLE "PlacementQuestion" DROP CONSTRAINT IF EXISTS "PlacementQuestion_level_allowed";
ALTER TABLE "PlacementQuestion" ADD CONSTRAINT "PlacementQuestion_level_allowed" CHECK ("level" IN ('a1', 'a2', 'b1', 'b2', 'c1', 'basics', 'independent', 'lead'));
