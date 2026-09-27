-- ثلاثةُ أعمدةِ حالةٍ تدخل قيدَ CHECK — مولَّدٌ من `scripts/status-checks.ts`
--
-- كانت تحمل قوائمَ قيمٍ موثَّقةً في تعليقها **ولا يراها المولِّد**: مُفسِّرُه
-- كان يشترط التعليقَ على سطر الحقل نفسِه، وقوائمُ Prisma تُكتب على أسطرٍ
-- تاليةٍ حين تطول. فصار يقرأ التوالي (٢٧ سبتمبر ٢٠٢٦)، ونُقلت قائمةُ
-- `TrainerApplication.status` إلى جانب حقلها بعد أن كانت أسفلَ حقلٍ آخر.
--
-- وأوسعُها `TrainerApplication.status`: أربعَ عشرةَ قيمةً، وعليه يقوم طابورُ
-- المدرّبين كلُّه. وقد حُذفت منه ثلاثُ حالاتٍ في ٢٦ سبتمبر بلا قيدٍ يمنع
-- عودتَها من القاعدة.
--
-- ═══ ولمَ `NOT VALID` ═══
--
-- `ADD CONSTRAINT` يفحص الصفوفَ القائمةَ كلَّها، فيسقط الترحيلُ على الإنتاج
-- إن حمل صفٌّ واحدٌ قيمةً خارجَ القائمة — ولا سبيلَ إلى عدّ الإنتاج من هنا.
--
-- و`NOT VALID` يُنفِذ ما وُضع القيدُ له: **كلُّ كتابةٍ جديدةٍ تُفحَص وتُردّ
-- إن خالفت**. والذي يؤجَّل فحصُ ما مضى وحدَه. فالخطأُ المطبعيُّ الذي كُتب
-- هذا الحرسُ لأجله ممنوعٌ من اليوم.
--
-- ═══ وكيف يُرفَع التأجيل ═══
--
-- يُعَدُّ ما في الإنتاج:
--   SELECT status, count(*) FROM "TrainerApplication"      GROUP BY 1 ORDER BY 2 DESC;
--   SELECT status, count(*) FROM "TrainerChangeRequest"    GROUP BY 1 ORDER BY 2 DESC;
--   SELECT status, count(*) FROM "AssignmentSubmission"    GROUP BY 1 ORDER BY 2 DESC;
--
-- فإن خلت من قيمةٍ غريبةٍ صُدِّق القيدُ بترحيلٍ تالٍ:
--   ALTER TABLE "TrainerApplication"   VALIDATE CONSTRAINT "TrainerApplication_status_allowed";
--   ALTER TABLE "TrainerChangeRequest" VALIDATE CONSTRAINT "TrainerChangeRequest_status_allowed";
--   ALTER TABLE "AssignmentSubmission" VALIDATE CONSTRAINT "AssignmentSubmission_status_allowed";
--
-- وإن وُجدت غريبةٌ فقرارُها لإنسان: تُضاف إلى التعليق إن كانت مشروعةً،
-- أو تُنقل صفوفُها ثمّ يُصدَّق القيد.

ALTER TABLE "TrainerApplication" DROP CONSTRAINT IF EXISTS "TrainerApplication_status_allowed";
ALTER TABLE "TrainerApplication" ADD CONSTRAINT "TrainerApplication_status_allowed" CHECK ("status" IN ('draft', 'submitted', 'under_review', 'information_requested', 'interview_scheduled', 'academic_review', 'conditionally_approved', 'contract_pending', 'onboarding', 'active', 'waitlisted', 'rejected', 'withdrawn', 'suspended')) NOT VALID;
ALTER TABLE "TrainerChangeRequest" DROP CONSTRAINT IF EXISTS "TrainerChangeRequest_status_allowed";
ALTER TABLE "TrainerChangeRequest" ADD CONSTRAINT "TrainerChangeRequest_status_allowed" CHECK ("status" IN ('draft', 'submitted', 'under_review', 'changes_requested', 'approved_for_cohort', 'approved_for_catalog', 'rejected', 'withdrawn', 'published', 'superseded')) NOT VALID;
ALTER TABLE "AssignmentSubmission" DROP CONSTRAINT IF EXISTS "AssignmentSubmission_status_allowed";
ALTER TABLE "AssignmentSubmission" ADD CONSTRAINT "AssignmentSubmission_status_allowed" CHECK ("status" IN ('submitted', 'under_review', 'resubmit_requested', 'accepted', 'rejected')) NOT VALID;
