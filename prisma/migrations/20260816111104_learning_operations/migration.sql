-- AlterTable
ALTER TABLE "Cohort" ADD COLUMN     "capacity" INTEGER,
ADD COLUMN     "currency" TEXT NOT NULL DEFAULT 'JOD',
ADD COLUMN     "daysOfWeek" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN     "deliveryMode" TEXT NOT NULL DEFAULT 'remote',
ADD COLUMN     "financialReady" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "language" TEXT NOT NULL DEFAULT 'العربية',
ADD COLUMN     "price" DECIMAL(10,2),
ADD COLUMN     "registrationOpen" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "startTime" TEXT,
ADD COLUMN     "timezone" TEXT;

-- CreateTable
CREATE TABLE "CohortTrainer" (
    "id" UUID NOT NULL,
    "cohortId" UUID NOT NULL,
    "profileId" UUID NOT NULL,
    "role" TEXT NOT NULL DEFAULT 'lead',
    "assignedBy" UUID,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CohortTrainer_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CohortSession" (
    "id" UUID NOT NULL,
    "cohortId" UUID NOT NULL,
    "moduleId" TEXT,
    "title" TEXT NOT NULL,
    "startsAt" TIMESTAMP(3) NOT NULL,
    "endsAt" TIMESTAMP(3),
    "timezone" TEXT,
    "status" TEXT NOT NULL DEFAULT 'scheduled',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CohortSession_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ZoomMeeting" (
    "id" UUID NOT NULL,
    "sessionId" UUID NOT NULL,
    "provider" TEXT NOT NULL DEFAULT 'manual',
    "joinUrl" TEXT NOT NULL,
    "meetingId" TEXT,
    "passcodeEnc" TEXT,
    "learnerUrl" TEXT,
    "hostProfileId" UUID,
    "createdBy" UUID,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ZoomMeeting_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LearningMaterial" (
    "id" UUID NOT NULL,
    "cohortId" UUID NOT NULL,
    "moduleId" TEXT,
    "title" TEXT NOT NULL,
    "kind" TEXT NOT NULL DEFAULT 'file',
    "storageKey" TEXT,
    "externalUrl" TEXT,
    "status" TEXT NOT NULL DEFAULT 'active',
    "createdBy" UUID,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LearningMaterial_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Recording" (
    "id" UUID NOT NULL,
    "sessionId" UUID NOT NULL,
    "moduleId" TEXT,
    "title" TEXT NOT NULL,
    "storageKey" TEXT NOT NULL,
    "mime" TEXT NOT NULL,
    "sizeBytes" INTEGER NOT NULL,
    "durationSec" INTEGER,
    "status" TEXT NOT NULL DEFAULT 'active',
    "createdBy" UUID,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Recording_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Enrollment" (
    "id" UUID NOT NULL,
    "cohortId" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'enrolled',
    "enrolledBy" UUID,
    "overrideCapacity" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Enrollment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Attendance" (
    "id" UUID NOT NULL,
    "sessionId" UUID NOT NULL,
    "enrollmentId" UUID NOT NULL,
    "status" TEXT NOT NULL,
    "markedBy" UUID,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Attendance_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CohortAssessment" (
    "id" UUID NOT NULL,
    "cohortId" UUID NOT NULL,
    "moduleId" TEXT,
    "title" TEXT NOT NULL,
    "type" TEXT NOT NULL DEFAULT 'assignment',
    "maxScore" INTEGER NOT NULL DEFAULT 100,
    "passScore" INTEGER,
    "dueAt" TIMESTAMP(3),
    "rubricId" UUID,
    "status" TEXT NOT NULL DEFAULT 'published',
    "createdBy" UUID,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CohortAssessment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AssessmentItem" (
    "id" UUID NOT NULL,
    "assessmentId" UUID NOT NULL,
    "sequence" INTEGER NOT NULL,
    "prompt" TEXT NOT NULL,
    "kind" TEXT NOT NULL DEFAULT 'text',
    "maxScore" INTEGER NOT NULL DEFAULT 10,

    CONSTRAINT "AssessmentItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AssessmentAttempt" (
    "id" UUID NOT NULL,
    "assessmentId" UUID NOT NULL,
    "enrollmentId" UUID NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'submitted',
    "submittedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "gradedAt" TIMESTAMP(3),

    CONSTRAINT "AssessmentAttempt_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AssessmentResponse" (
    "id" UUID NOT NULL,
    "attemptId" UUID NOT NULL,
    "itemId" UUID NOT NULL,
    "answer" JSONB,
    "storageKey" TEXT,

    CONSTRAINT "AssessmentResponse_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GradingRubric" (
    "id" UUID NOT NULL,
    "title" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'active',
    "createdBy" UUID,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "GradingRubric_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RubricCriterion" (
    "id" UUID NOT NULL,
    "rubricId" UUID NOT NULL,
    "sequence" INTEGER NOT NULL,
    "title" TEXT NOT NULL,
    "maxScore" INTEGER NOT NULL DEFAULT 10,

    CONSTRAINT "RubricCriterion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AssignmentSubmission" (
    "id" UUID NOT NULL,
    "assessmentId" UUID NOT NULL,
    "enrollmentId" UUID NOT NULL,
    "storageKey" TEXT,
    "textAnswer" TEXT,
    "status" TEXT NOT NULL DEFAULT 'submitted',
    "reviewNote" TEXT,
    "submittedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "reviewedAt" TIMESTAMP(3),
    "reviewedBy" UUID,

    CONSTRAINT "AssignmentSubmission_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Grade" (
    "id" UUID NOT NULL,
    "submissionId" UUID,
    "attemptId" UUID,
    "score" DECIMAL(6,2) NOT NULL,
    "maxScore" DECIMAL(6,2) NOT NULL,
    "rubricScores" JSONB,
    "gradedBy" UUID NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Grade_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TrainerFeedback" (
    "id" UUID NOT NULL,
    "submissionId" UUID NOT NULL,
    "authorId" UUID NOT NULL,
    "body" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TrainerFeedback_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GradeHistory" (
    "id" UUID NOT NULL,
    "gradeId" UUID NOT NULL,
    "oldScore" DECIMAL(6,2),
    "newScore" DECIMAL(6,2) NOT NULL,
    "reason" TEXT NOT NULL,
    "changedBy" UUID NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "GradeHistory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CourseProgress" (
    "id" UUID NOT NULL,
    "enrollmentId" UUID NOT NULL,
    "percent" INTEGER NOT NULL DEFAULT 0,
    "evidence" JSONB NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CourseProgress_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ModuleProgress" (
    "id" UUID NOT NULL,
    "enrollmentId" UUID NOT NULL,
    "moduleId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'not_started',
    "evidence" JSONB,
    "completedAt" TIMESTAMP(3),

    CONSTRAINT "ModuleProgress_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CompletionRule" (
    "id" UUID NOT NULL,
    "courseId" TEXT NOT NULL,
    "cohortId" UUID,
    "type" TEXT NOT NULL,
    "threshold" INTEGER NOT NULL DEFAULT 1,
    "required" BOOLEAN NOT NULL DEFAULT true,
    "createdBy" UUID,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CompletionRule_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Certificate" (
    "id" UUID NOT NULL,
    "number" TEXT NOT NULL,
    "enrollmentId" UUID NOT NULL,
    "learnerName" TEXT NOT NULL,
    "courseId" TEXT NOT NULL,
    "courseVersion" INTEGER NOT NULL,
    "issuedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "issuedBy" UUID,
    "status" TEXT NOT NULL DEFAULT 'active',

    CONSTRAINT "Certificate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CertificateVerification" (
    "id" UUID NOT NULL,
    "certificateId" UUID NOT NULL,
    "ip" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CertificateVerification_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CertificateRevocation" (
    "id" UUID NOT NULL,
    "certificateId" UUID NOT NULL,
    "reason" TEXT NOT NULL,
    "revokedBy" UUID NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CertificateRevocation_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "CohortTrainer_cohortId_profileId_key" ON "CohortTrainer"("cohortId", "profileId");

-- CreateIndex
CREATE INDEX "CohortSession_cohortId_startsAt_idx" ON "CohortSession"("cohortId", "startsAt");

-- CreateIndex
CREATE UNIQUE INDEX "ZoomMeeting_sessionId_key" ON "ZoomMeeting"("sessionId");

-- CreateIndex
CREATE UNIQUE INDEX "LearningMaterial_storageKey_key" ON "LearningMaterial"("storageKey");

-- CreateIndex
CREATE INDEX "LearningMaterial_cohortId_status_idx" ON "LearningMaterial"("cohortId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "Recording_storageKey_key" ON "Recording"("storageKey");

-- CreateIndex
CREATE INDEX "Recording_sessionId_idx" ON "Recording"("sessionId");

-- CreateIndex
CREATE INDEX "Enrollment_userId_status_idx" ON "Enrollment"("userId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "Enrollment_cohortId_userId_key" ON "Enrollment"("cohortId", "userId");

-- CreateIndex
CREATE UNIQUE INDEX "Attendance_sessionId_enrollmentId_key" ON "Attendance"("sessionId", "enrollmentId");

-- CreateIndex
CREATE INDEX "CohortAssessment_cohortId_status_idx" ON "CohortAssessment"("cohortId", "status");

-- CreateIndex
CREATE INDEX "AssessmentItem_assessmentId_idx" ON "AssessmentItem"("assessmentId");

-- CreateIndex
CREATE INDEX "AssessmentAttempt_enrollmentId_idx" ON "AssessmentAttempt"("enrollmentId");

-- CreateIndex
CREATE INDEX "AssessmentResponse_attemptId_idx" ON "AssessmentResponse"("attemptId");

-- CreateIndex
CREATE INDEX "RubricCriterion_rubricId_idx" ON "RubricCriterion"("rubricId");

-- CreateIndex
CREATE INDEX "AssignmentSubmission_enrollmentId_status_idx" ON "AssignmentSubmission"("enrollmentId", "status");

-- CreateIndex
CREATE INDEX "TrainerFeedback_submissionId_idx" ON "TrainerFeedback"("submissionId");

-- CreateIndex
CREATE INDEX "GradeHistory_gradeId_idx" ON "GradeHistory"("gradeId");

-- CreateIndex
CREATE UNIQUE INDEX "CourseProgress_enrollmentId_key" ON "CourseProgress"("enrollmentId");

-- CreateIndex
CREATE UNIQUE INDEX "ModuleProgress_enrollmentId_moduleId_key" ON "ModuleProgress"("enrollmentId", "moduleId");

-- CreateIndex
CREATE INDEX "CompletionRule_courseId_idx" ON "CompletionRule"("courseId");

-- CreateIndex
CREATE UNIQUE INDEX "Certificate_number_key" ON "Certificate"("number");

-- CreateIndex
CREATE INDEX "Certificate_enrollmentId_idx" ON "Certificate"("enrollmentId");

-- CreateIndex
CREATE INDEX "CertificateVerification_certificateId_idx" ON "CertificateVerification"("certificateId");

-- CreateIndex
CREATE UNIQUE INDEX "CertificateRevocation_certificateId_key" ON "CertificateRevocation"("certificateId");

-- AddForeignKey
ALTER TABLE "CohortTrainer" ADD CONSTRAINT "CohortTrainer_cohortId_fkey" FOREIGN KEY ("cohortId") REFERENCES "Cohort"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CohortTrainer" ADD CONSTRAINT "CohortTrainer_profileId_fkey" FOREIGN KEY ("profileId") REFERENCES "TrainerProfile"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CohortSession" ADD CONSTRAINT "CohortSession_cohortId_fkey" FOREIGN KEY ("cohortId") REFERENCES "Cohort"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ZoomMeeting" ADD CONSTRAINT "ZoomMeeting_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "CohortSession"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LearningMaterial" ADD CONSTRAINT "LearningMaterial_cohortId_fkey" FOREIGN KEY ("cohortId") REFERENCES "Cohort"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Recording" ADD CONSTRAINT "Recording_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "CohortSession"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Enrollment" ADD CONSTRAINT "Enrollment_cohortId_fkey" FOREIGN KEY ("cohortId") REFERENCES "Cohort"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Attendance" ADD CONSTRAINT "Attendance_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "CohortSession"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Attendance" ADD CONSTRAINT "Attendance_enrollmentId_fkey" FOREIGN KEY ("enrollmentId") REFERENCES "Enrollment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CohortAssessment" ADD CONSTRAINT "CohortAssessment_cohortId_fkey" FOREIGN KEY ("cohortId") REFERENCES "Cohort"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CohortAssessment" ADD CONSTRAINT "CohortAssessment_rubricId_fkey" FOREIGN KEY ("rubricId") REFERENCES "GradingRubric"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AssessmentItem" ADD CONSTRAINT "AssessmentItem_assessmentId_fkey" FOREIGN KEY ("assessmentId") REFERENCES "CohortAssessment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AssessmentAttempt" ADD CONSTRAINT "AssessmentAttempt_assessmentId_fkey" FOREIGN KEY ("assessmentId") REFERENCES "CohortAssessment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AssessmentAttempt" ADD CONSTRAINT "AssessmentAttempt_enrollmentId_fkey" FOREIGN KEY ("enrollmentId") REFERENCES "Enrollment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AssessmentResponse" ADD CONSTRAINT "AssessmentResponse_attemptId_fkey" FOREIGN KEY ("attemptId") REFERENCES "AssessmentAttempt"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AssessmentResponse" ADD CONSTRAINT "AssessmentResponse_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "AssessmentItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RubricCriterion" ADD CONSTRAINT "RubricCriterion_rubricId_fkey" FOREIGN KEY ("rubricId") REFERENCES "GradingRubric"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AssignmentSubmission" ADD CONSTRAINT "AssignmentSubmission_assessmentId_fkey" FOREIGN KEY ("assessmentId") REFERENCES "CohortAssessment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AssignmentSubmission" ADD CONSTRAINT "AssignmentSubmission_enrollmentId_fkey" FOREIGN KEY ("enrollmentId") REFERENCES "Enrollment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Grade" ADD CONSTRAINT "Grade_submissionId_fkey" FOREIGN KEY ("submissionId") REFERENCES "AssignmentSubmission"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Grade" ADD CONSTRAINT "Grade_attemptId_fkey" FOREIGN KEY ("attemptId") REFERENCES "AssessmentAttempt"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TrainerFeedback" ADD CONSTRAINT "TrainerFeedback_submissionId_fkey" FOREIGN KEY ("submissionId") REFERENCES "AssignmentSubmission"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GradeHistory" ADD CONSTRAINT "GradeHistory_gradeId_fkey" FOREIGN KEY ("gradeId") REFERENCES "Grade"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CourseProgress" ADD CONSTRAINT "CourseProgress_enrollmentId_fkey" FOREIGN KEY ("enrollmentId") REFERENCES "Enrollment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ModuleProgress" ADD CONSTRAINT "ModuleProgress_enrollmentId_fkey" FOREIGN KEY ("enrollmentId") REFERENCES "Enrollment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CompletionRule" ADD CONSTRAINT "CompletionRule_cohortId_fkey" FOREIGN KEY ("cohortId") REFERENCES "Cohort"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Certificate" ADD CONSTRAINT "Certificate_enrollmentId_fkey" FOREIGN KEY ("enrollmentId") REFERENCES "Enrollment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CertificateVerification" ADD CONSTRAINT "CertificateVerification_certificateId_fkey" FOREIGN KEY ("certificateId") REFERENCES "Certificate"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CertificateRevocation" ADD CONSTRAINT "CertificateRevocation_certificateId_fkey" FOREIGN KEY ("certificateId") REFERENCES "Certificate"("id") ON DELETE CASCADE ON UPDATE CASCADE;
