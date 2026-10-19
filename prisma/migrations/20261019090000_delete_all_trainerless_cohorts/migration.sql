-- ═══ لا شعبةَ بلا مدرّب — تُحذف كلُّها (١٩ أكتوبر ٢٠٢٦) ═══
--
-- قرارُ صاحب المنصّة: «الدورةُ من المدرّب ثمّ الدورة ثمّ الموادّ ثمّ أفتح. كلُّ شعبةٍ بلا مدرّبٍ تُحذف — لا
-- شعبةَ بلا مدرّب لأنّ المدرّبَ يأتي أوّلا دائما». ثمّ اختار «Delete only»: يُحذف ما قام منها اليوم، ولا تُغلق
-- أبوابُ إنشائها. وكان `20261018090000_delete_trainerless_leftover_cohorts` يحذف ما أُنشئ قبل ١٢ أكتوبر
-- وحدَه — فهذا بلا حدِّ تاريخٍ ولا حالة.
--
-- · **ما يُحذف:** كلُّ شعبةٍ لا مدرّبَ مسنَدَ فيها، أيّا كانت حالُها وتاريخُها، ومعها بقيدها ما يتبعها:
--   جلساتُها وخطّتُها الأساسيّةُ ومهامُّها وموادُّها ورسائلُها وملفّاتُها. والعرضُ الذي رُدّ أو انقضى
--   يبقى صفُّه وتُفرَغ شعبتُه (`SetNull`) — فلن يأتي بمدرّبٍ إليها.
-- · **وما لا يُمسّ:**
--   - ما فيه أثرٌ لمتعلّم: تسجيلٌ بأيّ حال (ومعه ملفُّ الرحيل، فهو لا يقوم إلّا على تسجيل)، أو طلبُ
--     تسجيل — حقُّ إنسانٍ لا يُمحى بترحيل.
--   - ما مدرّبُه في الطريق أو كان فيه: عرضُ تدريسٍ ينتظر جوابَه، أو خطّةٌ باسم مدرّب، أو تكليفٌ، أو طلبُ
--     تغيير، أو طلبُ نقلٍ إلى موسم، أو رابطُ إحالة، أو قاعدةُ أجر.
-- · **ولا يُسقطه قيد:** ما يمنع حذفَ شعبة (طلبُ تسجيل) أو يُفرَغ عنده غيرُ العرض (تكليفٌ وطلبُ تغيير)
--   مستثنى قبله — رُسمت علاقاتُ `Cohort` كلُّها من المخطّط قبل كتابته.
--
-- ويحرسه `server/tests/learning/delete-all-trainerless-cohorts-migration.test.ts`، ويقرأ جملَه من هنا.

DELETE FROM "Cohort" c
WHERE NOT EXISTS (SELECT 1 FROM "CohortTrainer" t WHERE t."cohortId" = c."id")
  AND NOT EXISTS (SELECT 1 FROM "Enrollment" e WHERE e."cohortId" = c."id")
  AND NOT EXISTS (SELECT 1 FROM "EnrollmentRequest" r WHERE r."cohortId" = c."id")
  AND NOT EXISTS (SELECT 1 FROM "CohortMoveRequest" m WHERE m."cohortId" = c."id")
  AND NOT EXISTS (SELECT 1 FROM "TrainerAssignmentOffer" o WHERE o."cohortId" = c."id" AND o."status" = 'offered')
  AND NOT EXISTS (SELECT 1 FROM "CohortDeliveryPlan" p WHERE p."cohortId" = c."id" AND p."trainerId" IS NOT NULL)
  AND NOT EXISTS (SELECT 1 FROM "TrainerCourseAssignment" a WHERE a."cohortId" = c."id")
  AND NOT EXISTS (SELECT 1 FROM "TrainerChangeRequest" q WHERE q."cohortId" = c."id")
  AND NOT EXISTS (SELECT 1 FROM "TrainerReferralLink" l WHERE l."cohortId" = c."id")
  AND NOT EXISTS (SELECT 1 FROM "TrainerCompensationRule" k WHERE k."cohortId" = c."id");
