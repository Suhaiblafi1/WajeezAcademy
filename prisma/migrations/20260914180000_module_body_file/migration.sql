-- ملفُّ المحتوى النظريِّ لمحور (ع-٢) — بديلٌ عن كتابته

CREATE TABLE "ModuleBodyFile" (
    "id" UUID NOT NULL,
    "cohortId" UUID NOT NULL,
    "moduleId" TEXT NOT NULL,
    "storageKey" TEXT NOT NULL,
    "originalName" TEXT NOT NULL,
    "mime" TEXT NOT NULL,
    "sizeBytes" INTEGER,
    "uploadedBy" UUID,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ModuleBodyFile_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ModuleBodyFile_storageKey_key" ON "ModuleBodyFile"("storageKey");
CREATE INDEX "ModuleBodyFile_cohortId_moduleId_idx" ON "ModuleBodyFile"("cohortId", "moduleId");

ALTER TABLE "ModuleBodyFile" ADD CONSTRAINT "ModuleBodyFile_cohortId_fkey"
    FOREIGN KEY ("cohortId") REFERENCES "Cohort"("id") ON DELETE CASCADE ON UPDATE CASCADE;
