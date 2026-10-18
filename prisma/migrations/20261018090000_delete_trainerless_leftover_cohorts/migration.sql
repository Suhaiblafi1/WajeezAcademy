-- ═══ الشعبُ المتروكةُ بلا مدرّبٍ ولا متعلّم تُحذف (١٨ أكتوبر ٢٠٢٦) ═══
--
-- سأل صاحبُ المنصّة: «هل الدورات المفتوحه هي لمدربين ولفصل الشتاء؟ ام هناك دورات بلا مدرب ويجب
-- حذفها؟». والمفتوحةُ كلُّها بمدرّبٍ اعتُمدت خطّتُه (#508). وما بقي بلا مدرّبٍ شعبٌ فتحها
-- `openAllCohorts` لكلّ دورة (تقاعد في #508)، وأعادها #527 مسوّداتٍ مخفيّة. فاختار: «Delete
-- permanently» — تُحذف بما يتبعها، ولا يُمسّ ما فيه أثرٌ لمتعلّم.
--
-- · **ما يُحذف:** شعبةٌ أُنشئت قبل تقاعد الزرّ (١٢ أكتوبر ٢٠٢٦، 08:00 UTC)، غيرُ منتهية، ولا أثرَ فيها
--   لمتعلّمٍ (تسجيلٌ أو طلبُ تسجيلٍ بأيّ حال) ولا لمدرّب (مسنَدٌ، أو خطّةٌ باسمه بأيّ حال، أو تكليفٌ،
--   أو عرضُ تدريس، أو طلبُ تغيير، أو رابطُ إحالة، أو قاعدةُ أجر). ويذهب معها ما يتبعها بقيده:
--   جلساتُها وخطّتُها الأساسيّةُ ومهامُّها وموادُّها.
-- · **وما لا يُمسّ:** المنتهية، وما أُنشئ بعد التقاعد (مسوّدةٌ قد تكون الإدارةُ تعدّها الآن)، وكلُّ ما
--   فيه أثرٌ لمتعلّمٍ أو مدرّب.
-- · **ولا يُسقطه قيد:** ما يمنع حذفَ شعبةٍ (طلبُ تسجيل، وشهادةٌ عبر تسجيل) مستثنى قبله، وما يُفرَغ
--   عند حذفها (تكليفٌ، وعرضٌ، وطلبُ تغيير) مستثنى كذلك — فلا يُمسّ صفٌّ لغيرها.
--
-- ويحرسه `server/tests/learning/delete-trainerless-cohorts-migration.test.ts`، ويقرأ جملَه من هنا.

DELETE FROM "Cohort" c
WHERE c."status" <> 'completed'
  AND c."createdAt" < TIMESTAMP '2026-10-12 08:00:00'
  AND NOT EXISTS (SELECT 1 FROM "Enrollment" e WHERE e."cohortId" = c."id")
  AND NOT EXISTS (SELECT 1 FROM "EnrollmentRequest" r WHERE r."cohortId" = c."id")
  AND NOT EXISTS (SELECT 1 FROM "CohortTrainer" t WHERE t."cohortId" = c."id")
  AND NOT EXISTS (SELECT 1 FROM "CohortDeliveryPlan" p WHERE p."cohortId" = c."id" AND p."trainerId" IS NOT NULL)
  AND NOT EXISTS (SELECT 1 FROM "TrainerCourseAssignment" a WHERE a."cohortId" = c."id")
  AND NOT EXISTS (SELECT 1 FROM "TrainerAssignmentOffer" o WHERE o."cohortId" = c."id")
  AND NOT EXISTS (SELECT 1 FROM "TrainerChangeRequest" q WHERE q."cohortId" = c."id")
  AND NOT EXISTS (SELECT 1 FROM "TrainerReferralLink" l WHERE l."cohortId" = c."id")
  AND NOT EXISTS (SELECT 1 FROM "TrainerCompensationRule" k WHERE k."cohortId" = c."id");
