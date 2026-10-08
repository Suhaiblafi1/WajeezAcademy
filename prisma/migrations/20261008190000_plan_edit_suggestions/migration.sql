-- تعديلاتٌ تقترحها الإدارةُ على خطّة المدرّب — يقبل كلًّا أو يرفضه (٨ أكتوبر ٢٠٢٦).
--
-- قرارُ صاحب المنصّة: «التعديلُ معقّدٌ وقد يطول على المدرّب… ألا تكون التعديلاتُ منّا
-- مباشرةً على المنصّة وهو يوافق أو يرفض لكلّ تعديل؟». واختار: نكتبها نحن ويختار هو.
-- جدولٌ جديدٌ لا يمسّ صفًّا قائما. والقيدان مولَّدان من تعليقَي العمودين
-- بـ`scripts/status-checks.ts` لا مكتوبان باليد.

-- CreateTable
CREATE TABLE "PlanEditSuggestion" (
    "id" UUID NOT NULL,
    "cohortId" UUID NOT NULL,
    "planId" UUID NOT NULL,
    "batchId" UUID NOT NULL,
    "seq" INTEGER NOT NULL,
    "kind" TEXT NOT NULL,
    "step" TEXT NOT NULL,
    "required" BOOLEAN NOT NULL DEFAULT false,
    "reasonAr" TEXT NOT NULL,
    "edit" JSONB NOT NULL,
    "before" JSONB,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "decidedAt" TIMESTAMP(3),
    "decidedBy" UUID,
    "noteAr" TEXT,
    "createdBy" UUID NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PlanEditSuggestion_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "PlanEditSuggestion_cohortId_status_idx" ON "PlanEditSuggestion"("cohortId", "status");

-- CreateIndex
CREATE INDEX "PlanEditSuggestion_planId_idx" ON "PlanEditSuggestion"("planId");

-- AddForeignKey
ALTER TABLE "PlanEditSuggestion" ADD CONSTRAINT "PlanEditSuggestion_cohortId_fkey" FOREIGN KEY ("cohortId") REFERENCES "Cohort"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Status checks
ALTER TABLE "PlanEditSuggestion" DROP CONSTRAINT IF EXISTS "PlanEditSuggestion_kind_allowed";
ALTER TABLE "PlanEditSuggestion" ADD CONSTRAINT "PlanEditSuggestion_kind_allowed" CHECK ("kind" IN ('module', 'plan', 'resource_add', 'resource_change', 'resource_remove', 'task_add', 'task_change', 'session_move', 'session_remove'));
ALTER TABLE "PlanEditSuggestion" DROP CONSTRAINT IF EXISTS "PlanEditSuggestion_status_allowed";
ALTER TABLE "PlanEditSuggestion" ADD CONSTRAINT "PlanEditSuggestion_status_allowed" CHECK ("status" IN ('pending', 'accepted', 'rejected', 'withdrawn', 'lapsed'));
