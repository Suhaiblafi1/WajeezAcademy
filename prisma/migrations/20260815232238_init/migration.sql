-- CreateTable
CREATE TABLE "User" (
    "id" UUID NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "displayName" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'active',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "suspendedAt" TIMESTAMP(3),

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Role" (
    "id" TEXT NOT NULL,
    "nameAr" TEXT NOT NULL,

    CONSTRAINT "Role_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Permission" (
    "key" TEXT NOT NULL,
    "description" TEXT NOT NULL,

    CONSTRAINT "Permission_pkey" PRIMARY KEY ("key")
);

-- CreateTable
CREATE TABLE "RolePermission" (
    "roleId" TEXT NOT NULL,
    "permissionKey" TEXT NOT NULL,

    CONSTRAINT "RolePermission_pkey" PRIMARY KEY ("roleId","permissionKey")
);

-- CreateTable
CREATE TABLE "UserRole" (
    "userId" UUID NOT NULL,
    "roleId" TEXT NOT NULL,

    CONSTRAINT "UserRole_pkey" PRIMARY KEY ("userId","roleId")
);

-- CreateTable
CREATE TABLE "Session" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "userAgent" TEXT,
    "ip" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "revokedAt" TIMESTAMP(3),

    CONSTRAINT "Session_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PasswordResetToken" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "usedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PasswordResetToken_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LoginAttempt" (
    "id" UUID NOT NULL,
    "email" TEXT NOT NULL,
    "ip" TEXT,
    "success" BOOLEAN NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LoginAttempt_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CatalogVersion" (
    "id" UUID NOT NULL,
    "label" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'draft',
    "createdBy" UUID,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "publishedAt" TIMESTAMP(3),
    "publishedBy" UUID,

    CONSTRAINT "CatalogVersion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CatalogSnapshot" (
    "id" UUID NOT NULL,
    "catalogVersionId" UUID NOT NULL,
    "payload" JSONB NOT NULL,
    "payloadHash" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CatalogSnapshot_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CatalogPublishEvent" (
    "id" UUID NOT NULL,
    "catalogVersionId" UUID NOT NULL,
    "actorId" UUID,
    "action" TEXT NOT NULL,
    "details" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CatalogPublishEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Pathway" (
    "id" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'draft',
    "currentVersion" INTEGER NOT NULL DEFAULT 1,
    "createdBy" UUID,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Pathway_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PathwayVersion" (
    "id" UUID NOT NULL,
    "pathwayId" TEXT NOT NULL,
    "version" INTEGER NOT NULL,
    "title" TEXT NOT NULL,
    "shortTitle" TEXT,
    "audience" TEXT,
    "notFor" TEXT,
    "entry" TEXT,
    "beforeText" TEXT,
    "afterText" TEXT,
    "durationWeeks" INTEGER,
    "weeklyHours" INTEGER,
    "level" TEXT,
    "delivery" TEXT,
    "capstone" TEXT,
    "outcomeMetric" TEXT,
    "credentialAr" TEXT,
    "status" TEXT NOT NULL DEFAULT 'draft',
    "createdBy" UUID,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PathwayVersion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CompositeTemplate" (
    "id" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'draft',
    "currentVersion" INTEGER NOT NULL DEFAULT 1,
    "notCountedAsPathway" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CompositeTemplate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CompositeTemplateVersion" (
    "id" UUID NOT NULL,
    "templateId" TEXT NOT NULL,
    "version" INTEGER NOT NULL,
    "nameAr" TEXT NOT NULL,
    "shortNameAr" TEXT,
    "intentAr" TEXT,
    "persona" JSONB,
    "transformation" JSONB,
    "plan" JSONB,
    "diagnostic" JSONB,
    "status" TEXT NOT NULL DEFAULT 'draft',
    "createdBy" UUID,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CompositeTemplateVersion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Course" (
    "id" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'draft',
    "currentVersion" INTEGER NOT NULL DEFAULT 1,
    "recommendableDirectly" BOOLEAN NOT NULL DEFAULT false,
    "priceUsd" INTEGER,
    "availability" TEXT NOT NULL DEFAULT 'available',
    "createdBy" UUID,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Course_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CourseVersion" (
    "id" UUID NOT NULL,
    "courseId" TEXT NOT NULL,
    "version" INTEGER NOT NULL,
    "titleAr" TEXT NOT NULL,
    "legacyTitleAr" TEXT,
    "shortPromiseAr" TEXT,
    "descriptionAr" TEXT,
    "audienceAr" TEXT,
    "prerequisitesAr" TEXT,
    "levelAr" TEXT,
    "totalHours" INTEGER NOT NULL,
    "weeklyHours" INTEGER,
    "deliveryAr" TEXT,
    "languageAr" TEXT DEFAULT 'العربية',
    "trainerRequirements" JSONB,
    "status" TEXT NOT NULL DEFAULT 'draft',
    "createdBy" UUID,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CourseVersion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CourseModule" (
    "id" TEXT NOT NULL,
    "courseId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'published',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CourseModule_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CourseModuleVersion" (
    "id" UUID NOT NULL,
    "moduleId" TEXT NOT NULL,
    "version" INTEGER NOT NULL,
    "sequence" INTEGER NOT NULL,
    "titleAr" TEXT NOT NULL,
    "outcomeAr" TEXT,
    "activityAr" TEXT,
    "artifactAr" TEXT,
    "hours" INTEGER NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'published',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CourseModuleVersion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LearningObjective" (
    "id" UUID NOT NULL,
    "courseVersionId" UUID NOT NULL,
    "sequence" INTEGER NOT NULL,
    "textAr" TEXT NOT NULL,

    CONSTRAINT "LearningObjective_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LearningOutcome" (
    "id" UUID NOT NULL,
    "courseVersionId" UUID NOT NULL,
    "sequence" INTEGER NOT NULL,
    "textAr" TEXT NOT NULL,

    CONSTRAINT "LearningOutcome_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PracticalProject" (
    "id" UUID NOT NULL,
    "courseVersionId" UUID NOT NULL,
    "descriptionAr" TEXT NOT NULL,
    "evidenceRequired" JSONB,

    CONSTRAINT "PracticalProject_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Assessment" (
    "id" UUID NOT NULL,
    "courseVersionId" UUID NOT NULL,
    "kind" TEXT NOT NULL,
    "specAr" TEXT,

    CONSTRAINT "Assessment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Rubric" (
    "id" UUID NOT NULL,
    "assessmentId" UUID,
    "nameAr" TEXT NOT NULL,
    "criteria" JSONB NOT NULL,

    CONSTRAINT "Rubric_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Skill" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "nameAr" TEXT NOT NULL,
    "definitionAr" TEXT,
    "aliases" JSONB,
    "domain" TEXT,
    "source" TEXT,
    "masteryScale" JSONB,
    "evidenceExamples" JSONB,
    "status" TEXT NOT NULL DEFAULT 'published',
    "currentVersion" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Skill_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SkillVersion" (
    "id" UUID NOT NULL,
    "skillId" TEXT NOT NULL,
    "version" INTEGER NOT NULL,
    "nameAr" TEXT NOT NULL,
    "definitionAr" TEXT,
    "status" TEXT NOT NULL DEFAULT 'draft',
    "createdBy" UUID,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SkillVersion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SkillRelation" (
    "skillId" TEXT NOT NULL,
    "relatedSkillId" TEXT NOT NULL,
    "type" TEXT NOT NULL,

    CONSTRAINT "SkillRelation_pkey" PRIMARY KEY ("skillId","relatedSkillId","type")
);

-- CreateTable
CREATE TABLE "CourseSkillLink" (
    "courseId" TEXT NOT NULL,
    "skillId" TEXT NOT NULL,
    "targetLevel" INTEGER NOT NULL DEFAULT 3,
    "weight" DOUBLE PRECISION NOT NULL DEFAULT 1,

    CONSTRAINT "CourseSkillLink_pkey" PRIMARY KEY ("courseId","skillId")
);

-- CreateTable
CREATE TABLE "PathwaySkillRequirement" (
    "pathwayId" TEXT NOT NULL,
    "skillId" TEXT NOT NULL,
    "requiredLevel" INTEGER NOT NULL DEFAULT 3,
    "priority" TEXT NOT NULL DEFAULT 'medium',
    "weight" DOUBLE PRECISION NOT NULL DEFAULT 1,

    CONSTRAINT "PathwaySkillRequirement_pkey" PRIMARY KEY ("pathwayId","skillId")
);

-- CreateTable
CREATE TABLE "PathwayCourse" (
    "pathwayId" TEXT NOT NULL,
    "courseId" TEXT NOT NULL,
    "sequence" INTEGER NOT NULL,
    "kind" TEXT NOT NULL DEFAULT 'required',

    CONSTRAINT "PathwayCourse_pkey" PRIMARY KEY ("pathwayId","courseId")
);

-- CreateTable
CREATE TABLE "TemplateCourse" (
    "templateId" TEXT NOT NULL,
    "courseId" TEXT NOT NULL,
    "listType" TEXT NOT NULL,
    "sequence" INTEGER NOT NULL DEFAULT 1,
    "roleAr" TEXT,
    "reasonAr" TEXT,
    "conditionAr" TEXT,

    CONSTRAINT "TemplateCourse_pkey" PRIMARY KEY ("templateId","courseId","listType")
);

-- CreateTable
CREATE TABLE "Prerequisite" (
    "courseId" TEXT NOT NULL,
    "requiresCourseId" TEXT NOT NULL,

    CONSTRAINT "Prerequisite_pkey" PRIMARY KEY ("courseId","requiresCourseId")
);

-- CreateTable
CREATE TABLE "MethodologyReference" (
    "code" TEXT NOT NULL,
    "titleAr" TEXT NOT NULL,
    "publisherAr" TEXT,
    "url" TEXT,
    "status" TEXT NOT NULL DEFAULT 'implemented',
    "evidenceAr" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MethodologyReference_pkey" PRIMARY KEY ("code")
);

-- CreateTable
CREATE TABLE "Question" (
    "id" TEXT NOT NULL,
    "answerType" TEXT NOT NULL,
    "measures" JSONB NOT NULL,
    "triggerCondition" TEXT NOT NULL DEFAULT 'always',
    "reasonAr" TEXT,
    "differentiates" JSONB,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "status" TEXT NOT NULL DEFAULT 'published',
    "currentVersion" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Question_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "QuestionVersion" (
    "id" UUID NOT NULL,
    "questionId" TEXT NOT NULL,
    "version" INTEGER NOT NULL,
    "textAr" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'draft',
    "createdBy" UUID,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "QuestionVersion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "QuestionOption" (
    "id" UUID NOT NULL,
    "questionId" TEXT NOT NULL,
    "optionId" TEXT NOT NULL,
    "orderIndex" INTEGER NOT NULL,
    "textAr" TEXT NOT NULL,
    "effects" JSONB,

    CONSTRAINT "QuestionOption_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "QuestionSkillLink" (
    "questionId" TEXT NOT NULL,
    "skillId" TEXT NOT NULL,
    "weight" DOUBLE PRECISION NOT NULL DEFAULT 1,

    CONSTRAINT "QuestionSkillLink_pkey" PRIMARY KEY ("questionId","skillId")
);

-- CreateTable
CREATE TABLE "DiagnosticProfile" (
    "id" UUID NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "audience" JSONB,
    "goals" JSONB,
    "requiredSkills" JSONB,
    "interests" JSONB,
    "timeConstraints" JSONB,
    "eligibility" JSONB,
    "exclusion" JSONB,
    "positiveSignals" JSONB,
    "negativeSignals" JSONB,
    "differentiators" JSONB,
    "minCoverage" DOUBLE PRECISION NOT NULL DEFAULT 0.8,
    "rationales" JSONB,
    "readinessStatus" TEXT NOT NULL DEFAULT 'incomplete',
    "version" INTEGER NOT NULL DEFAULT 1,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DiagnosticProfile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ScoringConfigVersion" (
    "id" UUID NOT NULL,
    "version" INTEGER NOT NULL,
    "config" JSONB NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'draft',
    "createdBy" UUID,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "publishedAt" TIMESTAMP(3),

    CONSTRAINT "ScoringConfigVersion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RecommendationVersion" (
    "id" UUID NOT NULL,
    "version" INTEGER NOT NULL,
    "rules" JSONB NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'draft',
    "createdBy" UUID,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "publishedAt" TIMESTAMP(3),

    CONSTRAINT "RecommendationVersion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SlugRedirect" (
    "oldSlug" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SlugRedirect_pkey" PRIMARY KEY ("oldSlug")
);

-- CreateTable
CREATE TABLE "ContentChangeRequest" (
    "id" UUID NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'draft',
    "createdBy" UUID,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "reviewedBy" UUID,
    "reviewedAt" TIMESTAMP(3),

    CONSTRAINT "ContentChangeRequest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ContentReviewComment" (
    "id" UUID NOT NULL,
    "changeRequestId" UUID NOT NULL,
    "authorId" UUID,
    "bodyAr" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ContentReviewComment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ContentApprovalDecision" (
    "id" UUID NOT NULL,
    "changeRequestId" UUID NOT NULL,
    "actorId" UUID,
    "decision" TEXT NOT NULL,
    "noteAr" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ContentApprovalDecision_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ImpactAnalysisRun" (
    "id" UUID NOT NULL,
    "changeRef" TEXT NOT NULL,
    "summary" JSONB NOT NULL,
    "createdBy" UUID,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ImpactAnalysisRun_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DiagnosticRegressionRun" (
    "id" UUID NOT NULL,
    "catalogVersionId" UUID,
    "results" JSONB NOT NULL,
    "passed" BOOLEAN NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DiagnosticRegressionRun_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DiagnosticSession" (
    "id" UUID NOT NULL,
    "userId" UUID,
    "catalogVersionId" UUID,
    "engineVersion" TEXT NOT NULL,
    "questionBankVersion" TEXT,
    "scoringConfigVersion" INTEGER,
    "recommendationVersion" INTEGER,
    "answers" JSONB NOT NULL,
    "decisionTrace" JSONB NOT NULL,
    "candidates" JSONB,
    "exclusionReasons" JSONB,
    "recommendationSnapshot" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DiagnosticSession_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "Session_tokenHash_key" ON "Session"("tokenHash");

-- CreateIndex
CREATE INDEX "Session_userId_idx" ON "Session"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "PasswordResetToken_tokenHash_key" ON "PasswordResetToken"("tokenHash");

-- CreateIndex
CREATE INDEX "LoginAttempt_email_createdAt_idx" ON "LoginAttempt"("email", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "CatalogVersion_label_key" ON "CatalogVersion"("label");

-- CreateIndex
CREATE INDEX "CatalogSnapshot_catalogVersionId_idx" ON "CatalogSnapshot"("catalogVersionId");

-- CreateIndex
CREATE INDEX "PathwayVersion_pathwayId_idx" ON "PathwayVersion"("pathwayId");

-- CreateIndex
CREATE UNIQUE INDEX "PathwayVersion_pathwayId_version_key" ON "PathwayVersion"("pathwayId", "version");

-- CreateIndex
CREATE UNIQUE INDEX "CompositeTemplateVersion_templateId_version_key" ON "CompositeTemplateVersion"("templateId", "version");

-- CreateIndex
CREATE INDEX "CourseVersion_courseId_idx" ON "CourseVersion"("courseId");

-- CreateIndex
CREATE UNIQUE INDEX "CourseVersion_courseId_version_key" ON "CourseVersion"("courseId", "version");

-- CreateIndex
CREATE INDEX "CourseModule_courseId_idx" ON "CourseModule"("courseId");

-- CreateIndex
CREATE UNIQUE INDEX "CourseModuleVersion_moduleId_version_key" ON "CourseModuleVersion"("moduleId", "version");

-- CreateIndex
CREATE INDEX "LearningObjective_courseVersionId_idx" ON "LearningObjective"("courseVersionId");

-- CreateIndex
CREATE INDEX "LearningOutcome_courseVersionId_idx" ON "LearningOutcome"("courseVersionId");

-- CreateIndex
CREATE UNIQUE INDEX "PracticalProject_courseVersionId_key" ON "PracticalProject"("courseVersionId");

-- CreateIndex
CREATE UNIQUE INDEX "Skill_slug_key" ON "Skill"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "SkillVersion_skillId_version_key" ON "SkillVersion"("skillId", "version");

-- CreateIndex
CREATE INDEX "PathwayCourse_courseId_idx" ON "PathwayCourse"("courseId");

-- CreateIndex
CREATE INDEX "TemplateCourse_courseId_idx" ON "TemplateCourse"("courseId");

-- CreateIndex
CREATE UNIQUE INDEX "QuestionVersion_questionId_version_key" ON "QuestionVersion"("questionId", "version");

-- CreateIndex
CREATE UNIQUE INDEX "QuestionOption_questionId_optionId_key" ON "QuestionOption"("questionId", "optionId");

-- CreateIndex
CREATE UNIQUE INDEX "QuestionOption_questionId_orderIndex_key" ON "QuestionOption"("questionId", "orderIndex");

-- CreateIndex
CREATE UNIQUE INDEX "DiagnosticProfile_entityType_entityId_key" ON "DiagnosticProfile"("entityType", "entityId");

-- CreateIndex
CREATE UNIQUE INDEX "ScoringConfigVersion_version_key" ON "ScoringConfigVersion"("version");

-- CreateIndex
CREATE UNIQUE INDEX "RecommendationVersion_version_key" ON "RecommendationVersion"("version");

-- CreateIndex
CREATE INDEX "DiagnosticSession_userId_idx" ON "DiagnosticSession"("userId");

-- CreateIndex
CREATE INDEX "DiagnosticSession_catalogVersionId_idx" ON "DiagnosticSession"("catalogVersionId");

-- AddForeignKey
ALTER TABLE "RolePermission" ADD CONSTRAINT "RolePermission_roleId_fkey" FOREIGN KEY ("roleId") REFERENCES "Role"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RolePermission" ADD CONSTRAINT "RolePermission_permissionKey_fkey" FOREIGN KEY ("permissionKey") REFERENCES "Permission"("key") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserRole" ADD CONSTRAINT "UserRole_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserRole" ADD CONSTRAINT "UserRole_roleId_fkey" FOREIGN KEY ("roleId") REFERENCES "Role"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Session" ADD CONSTRAINT "Session_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PasswordResetToken" ADD CONSTRAINT "PasswordResetToken_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CatalogSnapshot" ADD CONSTRAINT "CatalogSnapshot_catalogVersionId_fkey" FOREIGN KEY ("catalogVersionId") REFERENCES "CatalogVersion"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CatalogPublishEvent" ADD CONSTRAINT "CatalogPublishEvent_catalogVersionId_fkey" FOREIGN KEY ("catalogVersionId") REFERENCES "CatalogVersion"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PathwayVersion" ADD CONSTRAINT "PathwayVersion_pathwayId_fkey" FOREIGN KEY ("pathwayId") REFERENCES "Pathway"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CompositeTemplateVersion" ADD CONSTRAINT "CompositeTemplateVersion_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "CompositeTemplate"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CourseVersion" ADD CONSTRAINT "CourseVersion_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES "Course"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CourseModule" ADD CONSTRAINT "CourseModule_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES "Course"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CourseModuleVersion" ADD CONSTRAINT "CourseModuleVersion_moduleId_fkey" FOREIGN KEY ("moduleId") REFERENCES "CourseModule"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LearningObjective" ADD CONSTRAINT "LearningObjective_courseVersionId_fkey" FOREIGN KEY ("courseVersionId") REFERENCES "CourseVersion"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LearningOutcome" ADD CONSTRAINT "LearningOutcome_courseVersionId_fkey" FOREIGN KEY ("courseVersionId") REFERENCES "CourseVersion"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PracticalProject" ADD CONSTRAINT "PracticalProject_courseVersionId_fkey" FOREIGN KEY ("courseVersionId") REFERENCES "CourseVersion"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Assessment" ADD CONSTRAINT "Assessment_courseVersionId_fkey" FOREIGN KEY ("courseVersionId") REFERENCES "CourseVersion"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Rubric" ADD CONSTRAINT "Rubric_assessmentId_fkey" FOREIGN KEY ("assessmentId") REFERENCES "Assessment"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SkillVersion" ADD CONSTRAINT "SkillVersion_skillId_fkey" FOREIGN KEY ("skillId") REFERENCES "Skill"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SkillRelation" ADD CONSTRAINT "SkillRelation_skillId_fkey" FOREIGN KEY ("skillId") REFERENCES "Skill"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CourseSkillLink" ADD CONSTRAINT "CourseSkillLink_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES "Course"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CourseSkillLink" ADD CONSTRAINT "CourseSkillLink_skillId_fkey" FOREIGN KEY ("skillId") REFERENCES "Skill"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PathwaySkillRequirement" ADD CONSTRAINT "PathwaySkillRequirement_pathwayId_fkey" FOREIGN KEY ("pathwayId") REFERENCES "Pathway"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PathwaySkillRequirement" ADD CONSTRAINT "PathwaySkillRequirement_skillId_fkey" FOREIGN KEY ("skillId") REFERENCES "Skill"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PathwayCourse" ADD CONSTRAINT "PathwayCourse_pathwayId_fkey" FOREIGN KEY ("pathwayId") REFERENCES "Pathway"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PathwayCourse" ADD CONSTRAINT "PathwayCourse_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES "Course"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TemplateCourse" ADD CONSTRAINT "TemplateCourse_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "CompositeTemplate"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TemplateCourse" ADD CONSTRAINT "TemplateCourse_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES "Course"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Prerequisite" ADD CONSTRAINT "Prerequisite_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES "Course"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Prerequisite" ADD CONSTRAINT "Prerequisite_requiresCourseId_fkey" FOREIGN KEY ("requiresCourseId") REFERENCES "Course"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "QuestionVersion" ADD CONSTRAINT "QuestionVersion_questionId_fkey" FOREIGN KEY ("questionId") REFERENCES "Question"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "QuestionOption" ADD CONSTRAINT "QuestionOption_questionId_fkey" FOREIGN KEY ("questionId") REFERENCES "Question"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "QuestionSkillLink" ADD CONSTRAINT "QuestionSkillLink_questionId_fkey" FOREIGN KEY ("questionId") REFERENCES "Question"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "QuestionSkillLink" ADD CONSTRAINT "QuestionSkillLink_skillId_fkey" FOREIGN KEY ("skillId") REFERENCES "Skill"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ContentReviewComment" ADD CONSTRAINT "ContentReviewComment_changeRequestId_fkey" FOREIGN KEY ("changeRequestId") REFERENCES "ContentChangeRequest"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ContentApprovalDecision" ADD CONSTRAINT "ContentApprovalDecision_changeRequestId_fkey" FOREIGN KEY ("changeRequestId") REFERENCES "ContentChangeRequest"("id") ON DELETE CASCADE ON UPDATE CASCADE;
