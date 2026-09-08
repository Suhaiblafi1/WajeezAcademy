-- الشعبةُ ملكُ مدرّبها — يجهّزها ويقول «أوافق»، والإدارةُ تعتمد.
--
-- قرارُ صاحب المنصّة (٨ سبتمبر ٢٠٢٦). خطّةُ المدرّب تسكن في CohortDeliveryPlan
-- نفسِه: حالتان جديدتان (submitted · changes_requested) وأربعةُ أعمدةٍ تحمل
-- إرسالَه وتوقيعَه وقرارَ المراجع وسببَه. والتسجيلُ صار يُقبل رابطا لا ملفّا
-- فقط، فأعمدةُ الملفّ تصير اختياريّة.
ALTER TABLE "CohortDeliveryPlan" ADD COLUMN "submittedAt" TIMESTAMP(3);
ALTER TABLE "CohortDeliveryPlan" ADD COLUMN "trainerConfirmedAt" TIMESTAMP(3);
ALTER TABLE "CohortDeliveryPlan" ADD COLUMN "reviewedBy" UUID;
ALTER TABLE "CohortDeliveryPlan" ADD COLUMN "reviewedAt" TIMESTAMP(3);
ALTER TABLE "CohortDeliveryPlan" ADD COLUMN "reviewerNote" TEXT;
ALTER TABLE "CohortDeliveryPlan" DROP CONSTRAINT IF EXISTS "CohortDeliveryPlan_status_allowed";
ALTER TABLE "CohortDeliveryPlan" ADD CONSTRAINT "CohortDeliveryPlan_status_allowed" CHECK ("status" IN ('draft', 'submitted', 'changes_requested', 'approved', 'published', 'superseded'));
ALTER TABLE "Recording" ALTER COLUMN "storageKey" DROP NOT NULL;
ALTER TABLE "Recording" ALTER COLUMN "mime" DROP NOT NULL;
ALTER TABLE "Recording" ALTER COLUMN "sizeBytes" DROP NOT NULL;
ALTER TABLE "Recording" ADD COLUMN "externalUrl" TEXT;
