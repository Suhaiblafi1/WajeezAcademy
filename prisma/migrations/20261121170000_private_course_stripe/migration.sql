-- ═══ تأكيدُ الدفع بالبطاقة تلقائيّا من Stripe (٢١ نوفمبر ٢٠٢٦) ═══
--
-- قرارُ صاحب المنصّة: «نعم اربط Stripe ليتأكّد تلقائيّا». فما أخبر به Stripe يُكتب على الحجز، والجلسةُ فريدةٌ
-- كي لا يؤكّد الخبرُ المعادُ مرّتين.

ALTER TABLE "PrivateRegistration" ADD COLUMN "cardPaidAt" TIMESTAMP(3);
ALTER TABLE "PrivateRegistration" ADD COLUMN "stripeSessionId" TEXT;
ALTER TABLE "PrivateRegistration" ADD COLUMN "stripePaymentId" TEXT;
ALTER TABLE "PrivateRegistration" ADD COLUMN "cardAmount" INTEGER;
ALTER TABLE "PrivateRegistration" ADD COLUMN "cardCurrency" TEXT;

CREATE UNIQUE INDEX "PrivateRegistration_stripeSessionId_key" ON "PrivateRegistration"("stripeSessionId");
