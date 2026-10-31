-- طلبُ الانضمام مؤثّرا — من صفحة «انضم كمؤثر» (`influencer-application.service.ts`)

-- CreateTable
CREATE TABLE "InfluencerApplication" (
    "id" UUID NOT NULL,
    "reference" TEXT NOT NULL,
    "fullName" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "phoneCountryCode" TEXT,
    "phone" TEXT NOT NULL,
    "accounts" JSONB NOT NULL DEFAULT '[]',
    "reachTotal" INTEGER NOT NULL DEFAULT 0,
    "pitchAr" TEXT NOT NULL,
    "termsAr" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "termsAcceptedAt" TIMESTAMP(3) NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'submitted',
    "decidedBy" UUID,
    "decidedAt" TIMESTAMP(3),
    "decisionNoteAr" TEXT,
    "influencerId" UUID,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "InfluencerApplication_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "InfluencerApplication_reference_key" ON "InfluencerApplication"("reference");

-- CreateIndex
CREATE INDEX "InfluencerApplication_status_createdAt_idx" ON "InfluencerApplication"("status", "createdAt");

-- CreateIndex
CREATE INDEX "InfluencerApplication_email_idx" ON "InfluencerApplication"("email");

-- والحالةُ مقيَّدةٌ بتعليقها في المخطّط (`scripts/status-checks.ts`)
ALTER TABLE "InfluencerApplication" ADD CONSTRAINT "InfluencerApplication_status_allowed" CHECK ("status" IN ('submitted', 'approved', 'rejected'));
