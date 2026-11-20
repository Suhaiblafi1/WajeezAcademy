-- ═══ احجز أوّلا وادفع بعد — ومن أين جاء (٢٠ نوفمبر ٢٠٢٦) ═══
--
-- قرارُ صاحب المنصّة: يسجّل الزائرُ اسمَه ورقمَه وشعبتَه فيُحجَز مقعدُه، ثمّ يحوّل ويرفع صورةَ الحوالة — الآنَ أو
-- لاحقا من رابطٍ باسمه. فصورةُ الحوالة تصير اختياريّةً عند التسجيل، ولكلّ تسجيلٍ رابطُ دفعٍ ثابت.
-- ومصدرُه (`?src=` و`utm_*` أو الموقعُ الذي أحاله) يُحفظ معه ليُعرف أيُّ منشورٍ يبيع.

ALTER TABLE "PrivateRegistration" ALTER COLUMN "proofKey" DROP NOT NULL;
ALTER TABLE "PrivateRegistration" ALTER COLUMN "proofName" DROP NOT NULL;
ALTER TABLE "PrivateRegistration" ALTER COLUMN "proofMime" DROP NOT NULL;
ALTER TABLE "PrivateRegistration" ALTER COLUMN "proofSize" DROP NOT NULL;
ALTER TABLE "PrivateRegistration" ADD COLUMN "proofUploadedAt" TIMESTAMP(3);
ALTER TABLE "PrivateRegistration" ADD COLUMN "payToken" TEXT;
ALTER TABLE "PrivateRegistration" ADD COLUMN "source" TEXT;

-- ما سُجّل قبلها رفع حوالتَه مع تسجيله، ولكلٍّ رابطُ دفعٍ يُولَّد الآن
UPDATE "PrivateRegistration" SET "proofUploadedAt" = "createdAt" WHERE "proofKey" IS NOT NULL;
UPDATE "PrivateRegistration" SET "payToken" = replace(gen_random_uuid()::text, '-', '') WHERE "payToken" IS NULL;

ALTER TABLE "PrivateRegistration" ALTER COLUMN "payToken" SET NOT NULL;
CREATE UNIQUE INDEX "PrivateRegistration_payToken_key" ON "PrivateRegistration"("payToken");
