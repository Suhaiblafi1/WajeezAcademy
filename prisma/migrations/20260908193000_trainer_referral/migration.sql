-- رابطُ دعوةِ المدرّب — قرارُ صاحب المنصّة (٨ سبتمبر ٢٠٢٦).
--
-- لكلّ (شعبة، مدرّب) رمزٌ واحد. ومن سجّل به يُختم تسجيلُه بمصدره ولا يُغيَّر —
-- فهو حجّةُ الأجر. والسعرُ على الطالب واحد؛ ما يتغيّر أجرُ المدرّب عن المقعد
-- (`referralRate`). والرمزُ يُحمل مع الحجز (`EnrollmentRequest`) حتّى التسوية.
CREATE TABLE "TrainerReferralLink" (
  "id" UUID NOT NULL,
  "cohortId" UUID NOT NULL,
  "profileId" UUID NOT NULL,
  "code" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "TrainerReferralLink_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "TrainerReferralLink_code_key" ON "TrainerReferralLink"("code");
CREATE UNIQUE INDEX "TrainerReferralLink_cohortId_profileId_key" ON "TrainerReferralLink"("cohortId", "profileId");
ALTER TABLE "TrainerReferralLink" ADD CONSTRAINT "TrainerReferralLink_cohortId_fkey" FOREIGN KEY ("cohortId") REFERENCES "Cohort"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "TrainerReferralLink" ADD CONSTRAINT "TrainerReferralLink_profileId_fkey" FOREIGN KEY ("profileId") REFERENCES "TrainerProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Enrollment" ADD COLUMN "referralProfileId" UUID;
ALTER TABLE "Enrollment" ADD COLUMN "referralCode" TEXT;
ALTER TABLE "EnrollmentRequest" ADD COLUMN "referralCode" TEXT;
ALTER TABLE "TrainerCompensationRule" ADD COLUMN "referralRate" DECIMAL(10,2);
