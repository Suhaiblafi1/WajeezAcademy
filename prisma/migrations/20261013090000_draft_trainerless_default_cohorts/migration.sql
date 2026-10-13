-- ═══ الشعبُ الافتراضيّةُ بلا مدرّبٍ ولا متعلّم تعود مسوّدة (١٣ أكتوبر ٢٠٢٦) ═══
--
-- فتح `openAllCohorts` (تقاعد في #508) شعبةً لكلّ دورةٍ بجلساتٍ مبدئيّة ولا مدرّب. ومنذ
-- #508 لا تُعرض ولا تُباع، لكنّ حالتَها بقيت «مفتوحة» — فبقي «ما ينتظرك» يعدّ جلساتِها كلَّ
-- أسبوعٍ «بلا مدرّبٍ وبلا رابط»، ولا متعلّمَ سيفتحها. وقرارُ صاحب المنصّة: تعود مسوّدة،
-- ولا تُفتح إلّا بمدرّبٍ اعتُمدت خطّتُه، من بطاقتها كأيّ شعبة.
--
-- · **ما يُمسّ:** مفتوحةٌ أو ممتلئةٌ أو جارية، ولا صلةَ لها بمدرّبٍ ولا بمتعلّمٍ أصلا.
-- · **وما لا يُمسّ:** ما فيه أيُّ أثرٍ لمتعلّم (تسجيلٌ أو طلبُ تسجيلٍ بأيّ حال) أو لمدرّب
--   (مسنَدٌ، أو خطّةٌ باسمه بأيّ حال، أو تكليفٌ، أو عرضُ تدريس) — فذاك طريقُه قرارُ إنسان.
-- · ولا يُمحى شيء: الجلساتُ والخطّةُ والسعرُ باقية، والتغييرُ الحالةُ وعلمُ التسجيل وحدَهما.
--
-- ويحرسه `server/tests/learning/draft-trainerless-cohorts-migration.test.ts`، ويقرأ جملَه من هنا.

UPDATE "Cohort" c
SET "status" = 'draft', "registrationOpen" = false
WHERE c."status" IN ('open', 'full', 'active')
  AND NOT EXISTS (SELECT 1 FROM "Enrollment" e WHERE e."cohortId" = c."id")
  AND NOT EXISTS (SELECT 1 FROM "EnrollmentRequest" r WHERE r."cohortId" = c."id")
  AND NOT EXISTS (SELECT 1 FROM "CohortTrainer" t WHERE t."cohortId" = c."id")
  AND NOT EXISTS (SELECT 1 FROM "CohortDeliveryPlan" p WHERE p."cohortId" = c."id" AND p."trainerId" IS NOT NULL)
  AND NOT EXISTS (SELECT 1 FROM "TrainerCourseAssignment" a WHERE a."cohortId" = c."id")
  AND NOT EXISTS (SELECT 1 FROM "TrainerAssignmentOffer" o WHERE o."cohortId" = c."id");
