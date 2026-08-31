-- الدورة بلا شعبة في خطّة المتعلّم: يُبقيها ويُعلَم حين تُفتح، أو يُبقيها صامتة.
-- الافتراض «نعم أعلِمني» لأنّ من أبقاها في خطّته يريدها.
ALTER TABLE "LearnerPlanItem" ADD COLUMN "notifyOnCohort" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "LearnerPlanItem" ADD COLUMN "notifiedAt" TIMESTAMP(3);
