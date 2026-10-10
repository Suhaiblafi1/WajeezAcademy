-- كلُّ تعديلٍ مقترحٍ يمرّ بالإدارة قبل المدرّب (١٠ أكتوبر ٢٠٢٦).
--
-- قرارُ صاحب المنصّة: «كلُّ ما يُطلب من المدرّب قبولُه يقبله المديرُ أو المديرُ الأكاديميُّ
-- أو مديرُ المحتوى أوّلا». فيولد المرفوعُ مسوّدةً (`proposed`) لا يراها المدرّب، وتعتمده
-- الإدارةُ بندا بندا (`pending`) أو تحذفه (`dropped`). ومعه من راجعه ومتى.
--
-- وما رُفع قبل هذا القرار ولم يُقرَّر فيه يعود مسوّدةً تُراجَع — لا يصل المدرّبَ تعديلٌ
-- لم تعتمده الإدارة. والقيدُ مولَّدٌ من تعليق العمود بـ`scripts/status-checks.ts`.

ALTER TABLE "PlanEditSuggestion" ADD COLUMN "reviewedBy" UUID;
ALTER TABLE "PlanEditSuggestion" ADD COLUMN "reviewedAt" TIMESTAMP(3);
ALTER TABLE "PlanEditSuggestion" ALTER COLUMN "status" SET DEFAULT 'proposed';

ALTER TABLE "PlanEditSuggestion" DROP CONSTRAINT IF EXISTS "PlanEditSuggestion_status_allowed";
ALTER TABLE "PlanEditSuggestion" ADD CONSTRAINT "PlanEditSuggestion_status_allowed" CHECK ("status" IN ('proposed', 'dropped', 'pending', 'accepted', 'rejected', 'withdrawn', 'lapsed'));

UPDATE "PlanEditSuggestion" SET "status" = 'proposed' WHERE "status" = 'pending';
