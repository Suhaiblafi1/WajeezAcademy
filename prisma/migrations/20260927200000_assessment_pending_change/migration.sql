-- مهامُّ بعد الاعتماد تنتظر قرارَ الإدارة (المرحلة ٣ج-٣)
ALTER TABLE "CohortAssessment" ADD COLUMN "pendingChange" JSONB;
ALTER TABLE "CohortAssessment" ADD COLUMN "reviewerNote" TEXT;
