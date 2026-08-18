-- CreateTable
CREATE TABLE "TrainerApplication" (
    "id" UUID NOT NULL,
    "reference" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'email_verification_pending',
    "email" TEXT NOT NULL,
    "emailVerifiedAt" TIMESTAMP(3),
    "accessTokenHash" TEXT,
    "fullName" TEXT NOT NULL,
    "phoneCountryCode" TEXT,
    "phone" TEXT,
    "country" TEXT,
    "timezone" TEXT,
    "jobTitle" TEXT,
    "domainYears" TEXT,
    "trainingYears" TEXT,
    "bio" TEXT,
    "linkedinUrl" TEXT,
    "trainingLanguages" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "deliveryMode" TEXT,
    "motivation" TEXT,
    "privacyConsentAt" TIMESTAMP(3),
    "phase2CompletedAt" TIMESTAMP(3),
    "previousCourses" JSONB,
    "totalLearners" INTEGER,
    "previousOrgs" TEXT,
    "evidenceNotes" TEXT,
    "availability" JSONB,
    "demoConsent" BOOLEAN NOT NULL DEFAULT false,
    "teachableCourseIds" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "withdrawReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TrainerApplication_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TrainerApplicationSpecialty" (
    "applicationId" UUID NOT NULL,
    "specialty" TEXT NOT NULL,

    CONSTRAINT "TrainerApplicationSpecialty_pkey" PRIMARY KEY ("applicationId","specialty")
);

-- CreateTable
CREATE TABLE "TrainerApplicationDocument" (
    "id" UUID NOT NULL,
    "applicationId" UUID NOT NULL,
    "kind" TEXT NOT NULL,
    "storageKey" TEXT NOT NULL,
    "originalName" TEXT NOT NULL,
    "mime" TEXT NOT NULL,
    "sizeBytes" INTEGER NOT NULL,
    "uploadedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TrainerApplicationDocument_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TrainerApplicationReview" (
    "id" UUID NOT NULL,
    "applicationId" UUID NOT NULL,
    "reviewerId" UUID NOT NULL,
    "scores" JSONB NOT NULL,
    "overallNote" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TrainerApplicationReview_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TrainerInterview" (
    "id" UUID NOT NULL,
    "applicationId" UUID NOT NULL,
    "scheduledAt" TIMESTAMP(3) NOT NULL,
    "mode" TEXT NOT NULL DEFAULT 'remote',
    "interviewerId" UUID,
    "outcome" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TrainerInterview_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TrainerDemoEvaluation" (
    "id" UUID NOT NULL,
    "applicationId" UUID NOT NULL,
    "evaluatorId" UUID NOT NULL,
    "scores" JSONB NOT NULL,
    "decision" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TrainerDemoEvaluation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TrainerReference" (
    "id" UUID NOT NULL,
    "applicationId" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "relation" TEXT,
    "contact" TEXT,
    "note" TEXT,
    "verifiedAt" TIMESTAMP(3),
    "verifiedBy" UUID,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TrainerReference_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TrainerStatusHistory" (
    "id" UUID NOT NULL,
    "applicationId" UUID NOT NULL,
    "fromStatus" TEXT,
    "toStatus" TEXT NOT NULL,
    "actorId" UUID,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TrainerStatusHistory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TrainerInvitation" (
    "id" UUID NOT NULL,
    "applicationId" UUID NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "sentTo" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "usedAt" TIMESTAMP(3),
    "createdBy" UUID,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TrainerInvitation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TrainerOnboardingTask" (
    "profileId" UUID NOT NULL,
    "key" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "doneAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TrainerOnboardingTask_pkey" PRIMARY KEY ("profileId","key")
);

-- CreateTable
CREATE TABLE "TrainerProfile" (
    "id" UUID NOT NULL,
    "applicationId" UUID NOT NULL,
    "userId" UUID,
    "headline" TEXT,
    "bioPublic" TEXT,
    "isVerified" BOOLEAN NOT NULL DEFAULT false,
    "publicVisibility" BOOLEAN NOT NULL DEFAULT false,
    "publishApprovedBy" UUID,
    "publishApprovedAt" TIMESTAMP(3),
    "suspendedAt" TIMESTAMP(3),
    "suspendedBy" UUID,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TrainerProfile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TrainerSkill" (
    "profileId" UUID NOT NULL,
    "skillId" TEXT NOT NULL,
    "level" INTEGER NOT NULL DEFAULT 3,

    CONSTRAINT "TrainerSkill_pkey" PRIMARY KEY ("profileId","skillId")
);

-- CreateTable
CREATE TABLE "TrainerCourseQualification" (
    "id" UUID NOT NULL,
    "profileId" UUID NOT NULL,
    "courseId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'qualified',
    "qualifiedBy" UUID,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TrainerCourseQualification_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TrainerCourseAssignment" (
    "id" UUID NOT NULL,
    "profileId" UUID NOT NULL,
    "courseId" TEXT NOT NULL,
    "cohortId" UUID,
    "status" TEXT NOT NULL DEFAULT 'active',
    "assignedBy" UUID,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TrainerCourseAssignment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TrainerChangeRequest" (
    "id" UUID NOT NULL,
    "profileId" UUID NOT NULL,
    "courseId" TEXT NOT NULL,
    "baseCourseVersion" INTEGER NOT NULL,
    "scope" TEXT NOT NULL,
    "cohortId" UUID,
    "status" TEXT NOT NULL DEFAULT 'draft',
    "reason" TEXT NOT NULL,
    "evidence" TEXT,
    "scheduledPublishAt" TIMESTAMP(3),
    "reviewedBy" UUID,
    "reviewedAt" TIMESTAMP(3),
    "reviewerComment" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TrainerChangeRequest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TrainerChangeRequestItem" (
    "id" UUID NOT NULL,
    "requestId" UUID NOT NULL,
    "changeType" TEXT NOT NULL,
    "targetKey" TEXT,
    "beforeValue" JSONB,
    "afterValue" JSONB,
    "note" TEXT,

    CONSTRAINT "TrainerChangeRequestItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TrainerContract" (
    "id" UUID NOT NULL,
    "profileId" UUID NOT NULL,
    "title" TEXT NOT NULL,
    "terms" JSONB,
    "status" TEXT NOT NULL DEFAULT 'draft',
    "sentAt" TIMESTAMP(3),
    "signedAt" TIMESTAMP(3),
    "createdBy" UUID,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TrainerContract_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TrainerCompensationRule" (
    "id" UUID NOT NULL,
    "profileId" UUID NOT NULL,
    "type" TEXT NOT NULL,
    "rate" DECIMAL(10,2) NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'JOD',
    "effectiveFrom" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "effectiveTo" TIMESTAMP(3),
    "createdBy" UUID,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TrainerCompensationRule_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TrainerPayout" (
    "id" UUID NOT NULL,
    "profileId" UUID NOT NULL,
    "period" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "total" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "currency" TEXT NOT NULL DEFAULT 'JOD',
    "approvedBy" UUID,
    "paidAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TrainerPayout_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TrainerPayoutItem" (
    "id" UUID NOT NULL,
    "payoutId" UUID NOT NULL,
    "description" TEXT NOT NULL,
    "amount" DECIMAL(10,2) NOT NULL,
    "sourceRef" TEXT,

    CONSTRAINT "TrainerPayoutItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Cohort" (
    "id" UUID NOT NULL,
    "courseId" TEXT NOT NULL,
    "pathwayId" TEXT,
    "title" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'draft',
    "startsAt" TIMESTAMP(3),
    "endsAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Cohort_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CohortDeliveryPlan" (
    "id" UUID NOT NULL,
    "cohortId" UUID NOT NULL,
    "trainerId" UUID,
    "content" JSONB NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'draft',
    "sourceChangeRequestId" UUID,
    "createdBy" UUID,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CohortDeliveryPlan_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuditEvent" (
    "id" UUID NOT NULL,
    "actorId" UUID,
    "action" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "meta" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuditEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "TrainerApplication_reference_key" ON "TrainerApplication"("reference");

-- CreateIndex
CREATE UNIQUE INDEX "TrainerApplication_accessTokenHash_key" ON "TrainerApplication"("accessTokenHash");

-- CreateIndex
CREATE INDEX "TrainerApplication_status_createdAt_idx" ON "TrainerApplication"("status", "createdAt");

-- CreateIndex
CREATE INDEX "TrainerApplication_email_idx" ON "TrainerApplication"("email");

-- CreateIndex
CREATE UNIQUE INDEX "TrainerApplicationDocument_storageKey_key" ON "TrainerApplicationDocument"("storageKey");

-- CreateIndex
CREATE INDEX "TrainerApplicationDocument_applicationId_idx" ON "TrainerApplicationDocument"("applicationId");

-- CreateIndex
CREATE INDEX "TrainerApplicationReview_applicationId_idx" ON "TrainerApplicationReview"("applicationId");

-- CreateIndex
CREATE INDEX "TrainerInterview_applicationId_idx" ON "TrainerInterview"("applicationId");

-- CreateIndex
CREATE INDEX "TrainerDemoEvaluation_applicationId_idx" ON "TrainerDemoEvaluation"("applicationId");

-- CreateIndex
CREATE INDEX "TrainerReference_applicationId_idx" ON "TrainerReference"("applicationId");

-- CreateIndex
CREATE INDEX "TrainerStatusHistory_applicationId_createdAt_idx" ON "TrainerStatusHistory"("applicationId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "TrainerInvitation_tokenHash_key" ON "TrainerInvitation"("tokenHash");

-- CreateIndex
CREATE INDEX "TrainerInvitation_applicationId_idx" ON "TrainerInvitation"("applicationId");

-- CreateIndex
CREATE UNIQUE INDEX "TrainerProfile_applicationId_key" ON "TrainerProfile"("applicationId");

-- CreateIndex
CREATE UNIQUE INDEX "TrainerProfile_userId_key" ON "TrainerProfile"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "TrainerCourseQualification_profileId_courseId_key" ON "TrainerCourseQualification"("profileId", "courseId");

-- CreateIndex
CREATE INDEX "TrainerCourseAssignment_profileId_status_idx" ON "TrainerCourseAssignment"("profileId", "status");

-- CreateIndex
CREATE INDEX "TrainerChangeRequest_status_createdAt_idx" ON "TrainerChangeRequest"("status", "createdAt");

-- CreateIndex
CREATE INDEX "TrainerChangeRequestItem_requestId_idx" ON "TrainerChangeRequestItem"("requestId");

-- CreateIndex
CREATE INDEX "TrainerContract_profileId_idx" ON "TrainerContract"("profileId");

-- CreateIndex
CREATE INDEX "TrainerCompensationRule_profileId_idx" ON "TrainerCompensationRule"("profileId");

-- CreateIndex
CREATE INDEX "TrainerPayout_profileId_period_idx" ON "TrainerPayout"("profileId", "period");

-- CreateIndex
CREATE INDEX "TrainerPayoutItem_payoutId_idx" ON "TrainerPayoutItem"("payoutId");

-- CreateIndex
CREATE INDEX "Cohort_courseId_status_idx" ON "Cohort"("courseId", "status");

-- CreateIndex
CREATE INDEX "CohortDeliveryPlan_cohortId_status_idx" ON "CohortDeliveryPlan"("cohortId", "status");

-- CreateIndex
CREATE INDEX "AuditEvent_entityType_entityId_createdAt_idx" ON "AuditEvent"("entityType", "entityId", "createdAt");

-- CreateIndex
CREATE INDEX "AuditEvent_actorId_createdAt_idx" ON "AuditEvent"("actorId", "createdAt");

-- AddForeignKey
ALTER TABLE "TrainerApplicationSpecialty" ADD CONSTRAINT "TrainerApplicationSpecialty_applicationId_fkey" FOREIGN KEY ("applicationId") REFERENCES "TrainerApplication"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TrainerApplicationDocument" ADD CONSTRAINT "TrainerApplicationDocument_applicationId_fkey" FOREIGN KEY ("applicationId") REFERENCES "TrainerApplication"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TrainerApplicationReview" ADD CONSTRAINT "TrainerApplicationReview_applicationId_fkey" FOREIGN KEY ("applicationId") REFERENCES "TrainerApplication"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TrainerInterview" ADD CONSTRAINT "TrainerInterview_applicationId_fkey" FOREIGN KEY ("applicationId") REFERENCES "TrainerApplication"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TrainerDemoEvaluation" ADD CONSTRAINT "TrainerDemoEvaluation_applicationId_fkey" FOREIGN KEY ("applicationId") REFERENCES "TrainerApplication"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TrainerReference" ADD CONSTRAINT "TrainerReference_applicationId_fkey" FOREIGN KEY ("applicationId") REFERENCES "TrainerApplication"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TrainerStatusHistory" ADD CONSTRAINT "TrainerStatusHistory_applicationId_fkey" FOREIGN KEY ("applicationId") REFERENCES "TrainerApplication"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TrainerInvitation" ADD CONSTRAINT "TrainerInvitation_applicationId_fkey" FOREIGN KEY ("applicationId") REFERENCES "TrainerApplication"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TrainerOnboardingTask" ADD CONSTRAINT "TrainerOnboardingTask_profileId_fkey" FOREIGN KEY ("profileId") REFERENCES "TrainerProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TrainerProfile" ADD CONSTRAINT "TrainerProfile_applicationId_fkey" FOREIGN KEY ("applicationId") REFERENCES "TrainerApplication"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TrainerProfile" ADD CONSTRAINT "TrainerProfile_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TrainerSkill" ADD CONSTRAINT "TrainerSkill_profileId_fkey" FOREIGN KEY ("profileId") REFERENCES "TrainerProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TrainerCourseQualification" ADD CONSTRAINT "TrainerCourseQualification_profileId_fkey" FOREIGN KEY ("profileId") REFERENCES "TrainerProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TrainerCourseQualification" ADD CONSTRAINT "TrainerCourseQualification_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES "Course"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TrainerCourseAssignment" ADD CONSTRAINT "TrainerCourseAssignment_profileId_fkey" FOREIGN KEY ("profileId") REFERENCES "TrainerProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TrainerCourseAssignment" ADD CONSTRAINT "TrainerCourseAssignment_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES "Course"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TrainerCourseAssignment" ADD CONSTRAINT "TrainerCourseAssignment_cohortId_fkey" FOREIGN KEY ("cohortId") REFERENCES "Cohort"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TrainerChangeRequest" ADD CONSTRAINT "TrainerChangeRequest_profileId_fkey" FOREIGN KEY ("profileId") REFERENCES "TrainerProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TrainerChangeRequest" ADD CONSTRAINT "TrainerChangeRequest_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES "Course"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TrainerChangeRequest" ADD CONSTRAINT "TrainerChangeRequest_cohortId_fkey" FOREIGN KEY ("cohortId") REFERENCES "Cohort"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TrainerChangeRequestItem" ADD CONSTRAINT "TrainerChangeRequestItem_requestId_fkey" FOREIGN KEY ("requestId") REFERENCES "TrainerChangeRequest"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TrainerContract" ADD CONSTRAINT "TrainerContract_profileId_fkey" FOREIGN KEY ("profileId") REFERENCES "TrainerProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TrainerCompensationRule" ADD CONSTRAINT "TrainerCompensationRule_profileId_fkey" FOREIGN KEY ("profileId") REFERENCES "TrainerProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TrainerPayout" ADD CONSTRAINT "TrainerPayout_profileId_fkey" FOREIGN KEY ("profileId") REFERENCES "TrainerProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TrainerPayoutItem" ADD CONSTRAINT "TrainerPayoutItem_payoutId_fkey" FOREIGN KEY ("payoutId") REFERENCES "TrainerPayout"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Cohort" ADD CONSTRAINT "Cohort_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES "Course"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CohortDeliveryPlan" ADD CONSTRAINT "CohortDeliveryPlan_cohortId_fkey" FOREIGN KEY ("cohortId") REFERENCES "Cohort"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CohortDeliveryPlan" ADD CONSTRAINT "CohortDeliveryPlan_trainerId_fkey" FOREIGN KEY ("trainerId") REFERENCES "TrainerProfile"("id") ON DELETE SET NULL ON UPDATE CASCADE;
