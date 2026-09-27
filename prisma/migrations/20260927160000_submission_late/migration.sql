-- «المتأخّرُ يُقبل ويُعلَّم» (٢٧ سبتمبر ٢٠٢٦) — علامةُ التأخّر تُكتب لحظةَ التسليم.
--
-- والعلّةُ كاملةً في تعليق الحقل في المخطّط (`AssignmentSubmission.late`).
-- وما سُلّم قبل العمود لا يُلفَّق له تأخّر: لم يُقل لصاحبه يومَها إنّ له آخرا.

ALTER TABLE "AssignmentSubmission" ADD COLUMN "late" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "AssessmentAttempt" ADD COLUMN "late" BOOLEAN NOT NULL DEFAULT false;
