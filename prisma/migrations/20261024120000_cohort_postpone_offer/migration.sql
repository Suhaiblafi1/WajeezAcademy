-- اقتراحُ تأجيل الشعبة إلى الشهر التالي — نقترحه نحن، ويقبله المدرّبُ أو تتوقّف (٢٤ أكتوبر ٢٠٢٦).
--
-- قرارُ صاحب المنصّة لشعب نوفمبر: «اقترح تأجيلا لها وأرسلها للمدرّب مع إعلامه بأنّه سيتمّ توقيفُ الشعبة
-- تلقائيّا». والعلّةُ في `src/application/trainer/postpone-offer.ts`.

CREATE TABLE "CohortPostponeOffer" (
    "id" UUID NOT NULL,
    "cohortId" UUID NOT NULL,
    "proposedBy" UUID NOT NULL,
    "shiftDays" INTEGER NOT NULL,
    "fromFirstAt" TIMESTAMP(3) NOT NULL,
    "toFirstAt" TIMESTAMP(3) NOT NULL,
    "reasonAr" TEXT NOT NULL,
    "deadlineAt" TIMESTAMP(3) NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "decidedBy" UUID,
    "decidedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CohortPostponeOffer_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "CohortPostponeOffer_status_deadlineAt_idx" ON "CohortPostponeOffer"("status", "deadlineAt");
CREATE INDEX "CohortPostponeOffer_cohortId_createdAt_idx" ON "CohortPostponeOffer"("cohortId", "createdAt");

ALTER TABLE "CohortPostponeOffer" ADD CONSTRAINT "CohortPostponeOffer_cohortId_fkey" FOREIGN KEY ("cohortId") REFERENCES "Cohort"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- والحالةُ مقيَّدةٌ بتعليقها في المخطّط (`scripts/status-checks.ts`)
ALTER TABLE "CohortPostponeOffer" ADD CONSTRAINT "CohortPostponeOffer_status_allowed" CHECK ("status" IN ('pending', 'accepted', 'declined', 'expired', 'withdrawn'));
