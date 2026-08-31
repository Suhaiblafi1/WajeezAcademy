-- مخاطبة المدرب لشعبته — رسالةٌ تُسجَّل لا إشعارٌ عابر
CREATE TABLE "CohortMessage" (
  "id"           UUID NOT NULL DEFAULT gen_random_uuid(),
  "cohortId"     UUID NOT NULL,
  "authorId"     UUID NOT NULL,
  "audience"     TEXT NOT NULL,
  "enrollmentId" UUID,
  "body"         TEXT NOT NULL,
  "recipients"   INTEGER NOT NULL DEFAULT 0,
  "createdAt"    TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "CohortMessage_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "CohortMessage_cohortId_createdAt_idx" ON "CohortMessage"("cohortId", "createdAt");
CREATE INDEX "CohortMessage_enrollmentId_createdAt_idx" ON "CohortMessage"("enrollmentId", "createdAt");
ALTER TABLE "CohortMessage" ADD CONSTRAINT "CohortMessage_cohortId_fkey"
  FOREIGN KEY ("cohortId") REFERENCES "Cohort"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CohortMessage" ADD CONSTRAINT "CohortMessage_authorId_fkey"
  FOREIGN KEY ("authorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "CohortMessage" ADD CONSTRAINT "CohortMessage_enrollmentId_fkey"
  FOREIGN KEY ("enrollmentId") REFERENCES "Enrollment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- اقتراح تأجيل جلسة — المدرب يقترح والإدارة تعتمد
CREATE TABLE "SessionRescheduleRequest" (
  "id"               UUID NOT NULL DEFAULT gen_random_uuid(),
  "sessionId"        UUID NOT NULL,
  "requestedBy"      UUID NOT NULL,
  "currentStartsAt"  TIMESTAMP(3) NOT NULL,
  "proposedStartsAt" TIMESTAMP(3) NOT NULL,
  "reason"           TEXT NOT NULL,
  "status"           TEXT NOT NULL DEFAULT 'pending',
  "reviewedBy"       UUID,
  "reviewedAt"       TIMESTAMP(3),
  "reviewerComment"  TEXT,
  "createdAt"        TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "SessionRescheduleRequest_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "SessionRescheduleRequest_status_createdAt_idx" ON "SessionRescheduleRequest"("status", "createdAt");
CREATE INDEX "SessionRescheduleRequest_sessionId_createdAt_idx" ON "SessionRescheduleRequest"("sessionId", "createdAt");
ALTER TABLE "SessionRescheduleRequest" ADD CONSTRAINT "SessionRescheduleRequest_sessionId_fkey"
  FOREIGN KEY ("sessionId") REFERENCES "CohortSession"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "SessionRescheduleRequest" ADD CONSTRAINT "SessionRescheduleRequest_requestedBy_fkey"
  FOREIGN KEY ("requestedBy") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
