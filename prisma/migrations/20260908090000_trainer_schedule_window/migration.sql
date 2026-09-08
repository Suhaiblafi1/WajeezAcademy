-- نافذةُ جدولةِ المدرّب: حدودُ الإدارة، والقرارُ داخلها للمدرّب.
--
-- ثلاثةُ حقولٍ تُقرأ معا: مدًى يبدأ ومدًى ينتهي وسقفٌ لعدد اللقاءات.
-- وكلُّها NULL ابتداءً — أي أنّ الشعبَ القائمةَ تبقى على ما كانت عليه
-- (الإدارةُ وحدَها تجدول) حتّى يفتح إداريٌّ النافذةَ لشعبةٍ بعينها.
ALTER TABLE "Cohort" ADD COLUMN "scheduleWindowStart" TIMESTAMP(3);
ALTER TABLE "Cohort" ADD COLUMN "scheduleWindowEnd" TIMESTAMP(3);
ALTER TABLE "Cohort" ADD COLUMN "maxSessions" INTEGER;
