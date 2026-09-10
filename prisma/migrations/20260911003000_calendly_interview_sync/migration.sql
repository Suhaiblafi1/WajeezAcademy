-- Calendly هو مصدرُ الحقيقة لمقابلات المدرّبين التي يحجزها المتقدّم.
-- رابطُ المدعوّ ثابتٌ بين الإعادات، وبه تُعرَف رسالةُ الإلغاء.
ALTER TABLE "TrainerInterview"
  ADD COLUMN "provider" TEXT NOT NULL DEFAULT 'manual',
  ADD COLUMN "externalId" TEXT,
  ADD COLUMN "canceledAt" TIMESTAMP(3);

CREATE UNIQUE INDEX "TrainerInterview_externalId_key" ON "TrainerInterview"("externalId");
