-- ملفٌّ يخصّ شعبةً — متنُ محورٍ (ع-٢) أو مصدرٌ في الخطّة (د-٣)

CREATE TABLE "CohortFile" (
    "id" UUID NOT NULL,
    "cohortId" UUID NOT NULL,
    "purpose" TEXT NOT NULL,
    "refId" TEXT NOT NULL,
    "storageKey" TEXT NOT NULL,
    "originalName" TEXT NOT NULL,
    "mime" TEXT NOT NULL,
    "sizeBytes" INTEGER,
    "uploadedBy" UUID,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CohortFile_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "CohortFile_storageKey_key" ON "CohortFile"("storageKey");
CREATE INDEX "CohortFile_cohortId_purpose_refId_idx" ON "CohortFile"("cohortId", "purpose", "refId");

ALTER TABLE "CohortFile" ADD CONSTRAINT "CohortFile_cohortId_fkey"
    FOREIGN KEY ("cohortId") REFERENCES "Cohort"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- قيدُ الغرض مولَّدٌ لا مكتوبٌ بيده:  npx tsx scripts/status-checks.ts
ALTER TABLE "CohortFile" DROP CONSTRAINT IF EXISTS "CohortFile_purpose_allowed";
ALTER TABLE "CohortFile" ADD CONSTRAINT "CohortFile_purpose_allowed" CHECK ("purpose" IN ('module_body', 'plan_resource'));
