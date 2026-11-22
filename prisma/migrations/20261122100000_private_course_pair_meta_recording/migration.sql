-- ═══ لزيادة التسجيل: شخصان بسعر، وإبلاغ Meta بالشراء، وتسجيل الدورة (٢١ نوفمبر ٢٠٢٦) ═══
--
-- قرارُ صاحب المنصّة: «نفّذ ٤ و٧ ولكن شخصين يكون السعر ٢٠ لأن السعر الأصلي ١٤ … ونفّذ ٨».

ALTER TABLE "PrivateCourse" ADD COLUMN "recordings" JSONB NOT NULL DEFAULT '{}';

ALTER TABLE "PrivateRegistration" ADD COLUMN "pairId" UUID;
ALTER TABLE "PrivateRegistration" ADD COLUMN "pairRole" TEXT;
ALTER TABLE "PrivateRegistration" ADD COLUMN "metaClick" JSONB;
ALTER TABLE "PrivateRegistration" ADD COLUMN "metaSentAt" TIMESTAMP(3);
ALTER TABLE "PrivateRegistration" ADD COLUMN "metaError" TEXT;
ALTER TABLE "PrivateRegistration" ADD COLUMN "recordingSentAt" TIMESTAMP(3);
ALTER TABLE "PrivateRegistration" ADD COLUMN "recordingUrl" TEXT;

CREATE INDEX "PrivateRegistration_pairId_idx" ON "PrivateRegistration"("pairId");
