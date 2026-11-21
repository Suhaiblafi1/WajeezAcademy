-- ═══ الدفعُ بالبطاقة لمن هو خارج الأردن (٢١ نوفمبر ٢٠٢٦) ═══
--
-- قرارُ صاحب المنصّة (اقتراحُ «٢»): CliQ لا يعمل إلّا داخل الأردن، والصفحةُ تخاطب الخليج. فرابطُ دفعٍ بالبطاقة من مزوّده
-- يضبطه في لوحته، ويختار الحاجزُ طريقتَه حين يرفع الإيصال.

ALTER TABLE "PrivateCourse" ADD COLUMN "cardUrl" TEXT;
ALTER TABLE "PrivateRegistration" ADD COLUMN "payMethod" TEXT;

-- ما رُفع قبلها حوالةُ CliQ — لم يكن غيرُها
UPDATE "PrivateRegistration" SET "payMethod" = 'cliq' WHERE "proofKey" IS NOT NULL;
