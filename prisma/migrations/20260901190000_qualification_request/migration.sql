-- طلبُ التأهيل يحمل شعبتَه — فالموافقة تؤهّل وتُسند معا.
--
-- كان التأهيل والإسناد فعلين منفصلين في شاشتين: يُؤهَّل المدرّب من «عمليات
-- المدربين»، ثمّ يُسنَد من «عمليات الشعبة». فمن أراد مدرّبا لشعبةٍ بعينها
-- مشى ثلاث خطوات في مكانين، وأوّلُها لا يعرف شيئا عن آخرها.
--
-- والطلبُ الآن يُقدَّم من الشعبة، فيحمل معه أثرَها: يوافق المديرُ الأكاديميّ
-- مرّةً واحدة، فيُضاف التأهيلُ ويقع الإسناد في الفعل نفسِه.

ALTER TABLE "TrainerCourseQualification"
  ADD COLUMN "requestedCohortId" UUID,
  ADD COLUMN "requestedBy"       UUID,
  ADD COLUMN "requestedAt"       TIMESTAMP(3),
  ADD COLUMN "decidedAt"         TIMESTAMP(3);

CREATE INDEX "TrainerCourseQualification_status_idx"
  ON "TrainerCourseQualification"("status");
