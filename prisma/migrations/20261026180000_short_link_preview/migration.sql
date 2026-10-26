-- معاينةُ روابط «شارك دوراتك» — صورةُ المدرّب المصمَّمة حين يُلصق رابطُه (٢٦ أكتوبر ٢٠٢٦).
--
-- قرارُ صاحب المنصّة: «أضف معاينة، نعم». والعلّةُ في `server/services/link-preview.ts`.

ALTER TABLE "ShortLink" ADD COLUMN "previewImage" BYTEA;
ALTER TABLE "ShortLink" ADD COLUMN "previewTitle" TEXT;
ALTER TABLE "ShortLink" ADD COLUMN "previewText" TEXT;
ALTER TABLE "ShortLink" ADD COLUMN "previewSig" TEXT;
ALTER TABLE "ShortLink" ADD COLUMN "previewAt" TIMESTAMP(3);
