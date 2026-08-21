-- سيناريو القرار المتفرّع (البند ح-٥)
-- إضافي بالكامل: عمود جديد يقبل NULL وجدول جديد — آمن على قاعدة حيّة.
ALTER TABLE "CourseModuleVersion" ADD COLUMN "scenarioAr" TEXT;

CREATE TABLE "ScenarioRun" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "moduleId" TEXT NOT NULL,
    "path" JSONB NOT NULL,
    "reflectionAr" TEXT,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "endedAt" TIMESTAMP(3),
    CONSTRAINT "ScenarioRun_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "ScenarioRun_userId_moduleId_startedAt_idx" ON "ScenarioRun"("userId", "moduleId", "startedAt");

ALTER TABLE "ScenarioRun" ADD CONSTRAINT "ScenarioRun_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
