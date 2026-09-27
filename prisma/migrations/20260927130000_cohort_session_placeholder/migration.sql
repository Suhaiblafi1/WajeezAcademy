-- الموعدُ المبدئيُّ يُسمّى باسمه: ما ولّدته الإدارةُ للشعبة قبل مدرّبها
--
-- قرارُ صاحب المنصّة (٢٧ سبتمبر ٢٠٢٦): «اللقاءات.. امنحه أن يضيفها بنفسه لا
-- ينقلها، لأنّ ما هو موجودٌ مثالٌ فقط». والعلّةُ كاملةً في تعليق الحقل في
-- المخطّط (`CohortSession.placeholder`).

ALTER TABLE "CohortSession" ADD COLUMN "placeholder" BOOLEAN NOT NULL DEFAULT false;

-- ── وما القائمُ منها اليوم؟ ──
--
-- لا يُستنتَج من العنوان («الجلسة ٣»): الاسمُ يُعدَّل، والنمطُ يصدق على ما
-- كتبه إنسانٌ بيده. بل من أربعة شروطٍ تُقرأ من القاعدة معا:
--
-- ① جدولته الإدارةُ لا المدرّب: معتمَدٌ بلا معتمِد (`approvedBy IS NULL`).
--    فما جدوله المدرّبُ يُولد `pending` ولا يُعتمَد إلّا بيدٍ تُكتب في
--    `approvedBy` — ومثلُه المبدئيُّ الذي نقله مدرّبُه: نقلُه أسقطه إلى
--    الانتظار ثمّ اعتُمد بيد، فصار لقاءَه هو ولا يُمَسّ.
-- ② لم ينعقد: لا حضورَ مسجَّلا، ولا اجتماعَ بدأ. ما انعقد واقعةٌ لا مثال.
-- ③ وشعبتُه لم تُعتمَد لها خطّةُ مدرّبٍ قطّ: من اعتُمدت خطّتُه اعتُمد معها
--    جدولُه كما هو — فما فيه من مواعيد الإدارة صار جدولَه، والعدُّ الذي
--    اشترطته الخطّةُ («لقاءٌ لكلّ محور») عدَّها.
-- ④ وشعبتُه لم تنتهِ ولم تُلغَ.
UPDATE "CohortSession" s
SET "placeholder" = true
WHERE s."approvalState" = 'approved'
  AND s."approvedBy" IS NULL
  AND NOT EXISTS (SELECT 1 FROM "Attendance" a WHERE a."sessionId" = s."id")
  AND NOT EXISTS (
    SELECT 1 FROM "ZoomMeeting" z WHERE z."sessionId" = s."id" AND z."actualStartAt" IS NOT NULL
  )
  AND NOT EXISTS (
    SELECT 1 FROM "CohortDeliveryPlan" p
    WHERE p."cohortId" = s."cohortId"
      AND p."trainerId" IS NOT NULL
      AND p."status" IN ('approved', 'published', 'superseded')
  )
  AND EXISTS (
    SELECT 1 FROM "Cohort" c
    WHERE c."id" = s."cohortId" AND c."status" NOT IN ('completed', 'cancelled')
  );
