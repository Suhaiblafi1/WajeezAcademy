-- التأجيلُ إلى الفصول القادمة (٦ أكتوبر ٢٠٢٦) — خيارٌ ثالثٌ بجانب القبول والرفض.
--
-- قرارُ صاحب المنصّة: «يؤجَّل حسابُك إلى الفصول القادمة، لأنّ الفصلَ القادمَ لن
-- يحمل طلبا كافيا على دوراتك، ونتواصل معك بعد شهرين لنرى اهتمامَك» — في قرار
-- الإدارة، وفي تقييم المقابلة نفسِه (خانة المقابلات ورابطِ التقييم).
--
-- ① حالةٌ جديدةٌ للطلب: `deferred`.
-- ② نتيجةٌ جديدةٌ للمقابلة وحكمٌ للقارئ: `deferred`.
-- ③ وموعدُ التواصل الموعود في بريده: `deferredFollowUpAt`.
--
-- والقيدان مولَّدان من تعليق العمودين بـ`scripts/status-checks.ts` لا مكتوبان باليد.
-- وقيدُ الطلب يبقى `NOT VALID` كما كان (والعلّةُ في 20260927040000): ما يُكتب
-- من اليوم يُفحَص، وما مضى يُصدَّق بترحيلٍ يُعدّ الإنتاجَ أوّلا.

ALTER TABLE "TrainerApplication" ADD COLUMN IF NOT EXISTS "deferredFollowUpAt" TIMESTAMP(3);

ALTER TABLE "TrainerApplication" DROP CONSTRAINT IF EXISTS "TrainerApplication_status_allowed";
ALTER TABLE "TrainerApplication" ADD CONSTRAINT "TrainerApplication_status_allowed" CHECK ("status" IN ('draft', 'submitted', 'under_review', 'information_requested', 'interview_scheduled', 'academic_review', 'conditionally_approved', 'contract_pending', 'onboarding', 'active', 'waitlisted', 'deferred', 'rejected', 'withdrawn', 'suspended')) NOT VALID;

ALTER TABLE "TrainerInterview" DROP CONSTRAINT IF EXISTS "TrainerInterview_outcome_allowed";
ALTER TABLE "TrainerInterview" ADD CONSTRAINT "TrainerInterview_outcome_allowed" CHECK ("outcome" IN ('passed', 'hold', 'deferred', 'failed', 'no_show'));
