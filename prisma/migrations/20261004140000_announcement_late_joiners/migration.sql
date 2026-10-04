-- ومن يصير مدرّبا بعد إرسال الإعلان (٤ أكتوبر ٢٠٢٦).
--
-- قال صاحبُ المنصّة: «اعرضه لمن ينضمّ بعدُ أيضا». فيختار المرسِلُ آخرَ يومٍ يُكتب فيه من
-- صار مدرّبا بعد الإرسال — حين يفتح بوّابتَه — أو يتركه فارغا فيصل من كانوا مدرّبين يومَ
-- أُرسل وحدَهم.

-- AlterTable
ALTER TABLE "TrainerAnnouncement" ADD COLUMN "lateJoinersUntil" TIMESTAMP(3);

-- وما أُرسل قبل هذا الترحيل — إن أُرسل — فقولُه فيه هو نفسُه: يصل من ينضمّ حتّى آخر
-- نوفمبر بعمّان (الحدُّ المقترحُ لنصّ موعد البدء، `LATE_JOINERS_DRAFT_UNTIL`).
UPDATE "TrainerAnnouncement" SET "lateJoinersUntil" = '2026-11-30 20:59:59.999' WHERE "lateJoinersUntil" IS NULL;
