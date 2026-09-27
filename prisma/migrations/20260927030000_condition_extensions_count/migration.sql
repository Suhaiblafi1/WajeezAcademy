-- التمديدُ مرّتان لا مرّة — قرارُ صاحب المنصّة (٢٧ سبتمبر ٢٠٢٦)
--
-- «ويحقّ له طلبُ تمديدٍ ليومين مرّتين، أي النتيجةُ ٩ أيّامٍ لو مدّد»:
-- خمسةٌ من التوقيع + يومان + يومان.
--
-- وكان `conditionExtendedAt` وحدَه يحرس المرّةَ الواحدة: وجودُه يعني «مُدّد»
-- ولا يقول كم مرّة. فيُزاد عدّادٌ، ويبقى التاريخُ آخرَ تمديدٍ مُنح.

ALTER TABLE "TrainerContract" ADD COLUMN "conditionExtensionsUsed" INTEGER NOT NULL DEFAULT 0;

-- ومن مُدّد له قبل اليومَ مُدّد مرّةً واحدة — فله مرّةٌ ثانيةٌ بعدُ.
UPDATE "TrainerContract"
   SET "conditionExtensionsUsed" = 1
 WHERE "conditionExtendedAt" IS NOT NULL;
