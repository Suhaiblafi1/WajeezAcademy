-- تذكيرُ المدرّب بنشر شعبته قبل بدئها بأسبوع — مرّةً واحدةً لكلّ شعبة (٢٧ أكتوبر ٢٠٢٦).
--
-- اقترح Claude «تذكيرَ المدرّب بالنشر قبل بدء شعبته»، فقال صاحبُ المنصّة: «كلّهم». والعلّةُ في
-- `server/services/share-reminder.service.ts`.

ALTER TABLE "Cohort" ADD COLUMN "shareReminderAt" TIMESTAMP(3);
