-- بنودٌ خاصّةٌ بمدرّبٍ بعينه، وإزاحةُ العقد النافذ بأحدثَ منه (١ أكتوبر ٢٠٢٦).
--
-- ① `specialTermsAr`: ما طُبع في البند 21 من متن العقد، محفوظا في الصفّ ليحمله
--    كلُّ مسلكٍ يُعيد تصييرَ المتن (البديلُ والإعادةُ للتوقيع وتحديثُ العروض).
-- ② `supersededAt` و`supersededByContractId`: حين يُعتمَد عقدٌ جديدٌ لمن له عقدٌ
--    نافذ، يُغلَق القديمُ بحالة `superseded` ويُكتب متى ومن أزاحه.

ALTER TABLE "TrainerContract" ADD COLUMN "specialTermsAr" TEXT;
ALTER TABLE "TrainerContract" ADD COLUMN "supersededAt" TIMESTAMP(3);
ALTER TABLE "TrainerContract" ADD COLUMN "supersededByContractId" UUID;

-- مولَّدٌ من تعليق المخطّط: npx tsx scripts/status-checks.ts — أُضيفت `superseded`
ALTER TABLE "TrainerContract" DROP CONSTRAINT IF EXISTS "TrainerContract_status_allowed";
ALTER TABLE "TrainerContract" ADD CONSTRAINT "TrainerContract_status_allowed" CHECK ("status" IN ('draft', 'sent', 'amendment_requested', 'declined', 'revoked', 'signed', 'countersigned', 'expired', 'terminated', 'superseded'));
