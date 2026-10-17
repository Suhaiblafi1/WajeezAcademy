-- طلبُ نقل الشعبة إلى فصلٍ آخر — المدرّبُ يطلب والإدارةُ تعتمد (١٧ أكتوبر ٢٠٢٦).
--
-- قرارُ صاحب المنصّة: زرٌّ في بطاقة كلّ شعبةٍ عند المدرّب يؤجّلها إلى فصلٍ قادم — أو يعيدها
-- إلى أقرب منه في حالاتٍ نادرة — ولا يقع شيءٌ إلّا بموافقة الإدارة. وعند الاعتماد تُنقل
-- الشعبةُ نفسُها. والعلّةُ في `src/application/trainer/cohort-move.ts`.

CREATE TABLE "CohortMoveRequest" (
    "id" UUID NOT NULL,
    "cohortId" UUID NOT NULL,
    "requestedBy" UUID NOT NULL,
    "fromYear" INTEGER,
    "fromSeason" TEXT,
    "fromStartsAt" TIMESTAMP(3),
    "toYear" INTEGER NOT NULL,
    "toSeason" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "reviewedBy" UUID,
    "reviewedAt" TIMESTAMP(3),
    "reviewerComment" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CohortMoveRequest_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "CohortMoveRequest_status_createdAt_idx" ON "CohortMoveRequest"("status", "createdAt");
CREATE INDEX "CohortMoveRequest_cohortId_createdAt_idx" ON "CohortMoveRequest"("cohortId", "createdAt");

ALTER TABLE "CohortMoveRequest" ADD CONSTRAINT "CohortMoveRequest_cohortId_fkey" FOREIGN KEY ("cohortId") REFERENCES "Cohort"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- والحالةُ مقيَّدةٌ بتعليقها في المخطّط (`scripts/status-checks.ts`)
ALTER TABLE "CohortMoveRequest" ADD CONSTRAINT "CohortMoveRequest_status_allowed" CHECK ("status" IN ('pending', 'approved', 'rejected', 'withdrawn'));
