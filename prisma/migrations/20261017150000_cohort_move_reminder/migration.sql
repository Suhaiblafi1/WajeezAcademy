-- تذكيرُ مدرّبي الشعبة المنقولة قبل فصلها الجديد بشهر — مرّةً واحدة (١٧ أكتوبر ٢٠٢٦).
-- والعلّةُ في `src/application/trainer/cohort-move.ts`.

ALTER TABLE "CohortMoveRequest" ADD COLUMN "reminderSentAt" TIMESTAMP(3);
