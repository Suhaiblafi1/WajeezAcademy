-- ═══ تذكيرُ من حجز ولم يدفع (٢١ نوفمبر ٢٠٢٦) ═══
--
-- قرارُ صاحب المنصّة: «if they haven't paid, remind them next day as reminder, after three days last chance».
-- فوقتا الرسالتين على الحجز نفسِه — تُرسل كلٌّ مرّة — وآخرُ إخفاقٍ يُقرأ في اللوحة الخاصّة.

ALTER TABLE "PrivateRegistration" ADD COLUMN "remindedAt" TIMESTAMP(3);
ALTER TABLE "PrivateRegistration" ADD COLUMN "lastChanceAt" TIMESTAMP(3);
ALTER TABLE "PrivateRegistration" ADD COLUMN "reminderError" TEXT;
