-- خطّة المتعلّم (التوصية ١): القصد يُخزَّن، والحالة تُشتقّ عند القراءة.
CREATE TABLE IF NOT EXISTS "LearnerPlan" (
  "id"            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "userId"        UUID NOT NULL,
  "nameAr"        TEXT NOT NULL,
  "composed"      BOOLEAN NOT NULL DEFAULT false,
  "hostPathwayId" TEXT,
  "giftCourseId"  TEXT,
  "status"        TEXT NOT NULL DEFAULT 'active',
  "createdAt"     TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"     TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "LearnerPlan_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE INDEX IF NOT EXISTS "LearnerPlan_userId_status_idx" ON "LearnerPlan"("userId", "status");

CREATE TABLE IF NOT EXISTS "LearnerPlanItem" (
  "id"       UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "planId"   UUID NOT NULL,
  "courseId" TEXT NOT NULL,
  "sequence" INTEGER NOT NULL,
  CONSTRAINT "LearnerPlanItem_planId_fkey" FOREIGN KEY ("planId") REFERENCES "LearnerPlan"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE UNIQUE INDEX IF NOT EXISTS "LearnerPlanItem_planId_courseId_key" ON "LearnerPlanItem"("planId", "courseId");
CREATE INDEX IF NOT EXISTS "LearnerPlanItem_planId_sequence_idx" ON "LearnerPlanItem"("planId", "sequence");
