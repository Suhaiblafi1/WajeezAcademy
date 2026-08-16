-- حقول تحقق البريد لطلبات المدربين — أعمدة nullable آمنة
ALTER TABLE "TrainerApplication"
  ADD COLUMN "emailVerifyTokenHash" TEXT,
  ADD COLUMN "emailVerifyExpiresAt" TIMESTAMP(3);

CREATE UNIQUE INDEX "TrainerApplication_emailVerifyTokenHash_key" ON "TrainerApplication"("emailVerifyTokenHash");
