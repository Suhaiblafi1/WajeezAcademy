-- CreateTable
CREATE TABLE "AdvisorApplication" (
    "id" UUID NOT NULL,
    "reference" TEXT NOT NULL,
    "fullName" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "phoneCountryCode" TEXT,
    "phone" TEXT NOT NULL,
    "country" TEXT,
    "employment" TEXT NOT NULL,
    "experienceYears" TEXT NOT NULL,
    "experienceAr" TEXT NOT NULL,
    "hoursPerWeek" TEXT NOT NULL,
    "audiences" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "accounts" JSONB NOT NULL DEFAULT '[]',
    "communities" JSONB NOT NULL DEFAULT '[]',
    "reachTotal" INTEGER NOT NULL DEFAULT 0,
    "promotedBefore" BOOLEAN NOT NULL DEFAULT false,
    "promotedAr" TEXT,
    "motivationAr" TEXT NOT NULL,
    "termsAcceptedAt" TIMESTAMP(3) NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'submitted',
    "decidedBy" UUID,
    "decidedAt" TIMESTAMP(3),
    "commissionPct" DECIMAL(5,2),
    "decisionNoteAr" TEXT,
    "userId" UUID,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AdvisorApplication_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "AdvisorApplication_reference_key" ON "AdvisorApplication"("reference");

-- CreateIndex
CREATE INDEX "AdvisorApplication_status_createdAt_idx" ON "AdvisorApplication"("status", "createdAt");

-- CreateIndex
CREATE INDEX "AdvisorApplication_email_idx" ON "AdvisorApplication"("email");


-- والحالةُ مقيَّدةٌ بتعليقها في المخطّط (`scripts/status-checks.ts`)
ALTER TABLE "AdvisorApplication" ADD CONSTRAINT "AdvisorApplication_status_allowed" CHECK ("status" IN ('submitted', 'approved', 'rejected'));
