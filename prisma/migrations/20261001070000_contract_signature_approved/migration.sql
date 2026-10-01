-- اعتمادُ التوقيع في العرض المشروط — وليس توقيعَنا (١ أكتوبر ٢٠٢٦).
--
-- قرارُ صاحب المنصّة: «لا أريد أن أتعاقد مع أحدٍ قبل أن أعتمد دوراته». فصار
-- «اعتمِدِ التوقيع» في العرض المشروط يطابق الاسمَ ويفتح البوّابة ولا يوقّع عنّا،
-- ويقع توقيعُ الأكاديميّة يومَ تُعتمَد دوراتُه.
--
-- ① `signature_approved`: الحالُ بين «وقّع» و«نافذ» — اعتمدنا توقيعَه ولم نوقّع.
-- ② `signatureApprovedAt` و`signatureApprovedBy` و`signatureApprovalNoteAr`: متى
--    اعتُمد ومن اعتمده وبمَ طابق — وأعمدةُ الخَتم لا تُمَسّ حتّى يقع الخَتم.

ALTER TABLE "TrainerContract" ADD COLUMN "signatureApprovedAt" TIMESTAMP(3);
ALTER TABLE "TrainerContract" ADD COLUMN "signatureApprovedBy" UUID;
ALTER TABLE "TrainerContract" ADD COLUMN "signatureApprovalNoteAr" TEXT;

-- مولَّدٌ من تعليق المخطّط: npx tsx scripts/status-checks.ts — أُضيفت `signature_approved`
ALTER TABLE "TrainerContract" DROP CONSTRAINT IF EXISTS "TrainerContract_status_allowed";
ALTER TABLE "TrainerContract" ADD CONSTRAINT "TrainerContract_status_allowed" CHECK ("status" IN ('draft', 'sent', 'amendment_requested', 'declined', 'revoked', 'signed', 'signature_approved', 'countersigned', 'expired', 'terminated', 'superseded'));
