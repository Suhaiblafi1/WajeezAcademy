-- شعبُ إعدادٍ خلّفها حذفُ مدرّبٍ قبل ٣ أكتوبر ٢٠٢٦ — تُلغى، وتخرج خطّتُها من طابور الاعتماد.
-- المسوّدةُ التي فيها خطّةٌ مرسَلةٌ صاحبُها محذوفٌ أو مفكوكُ الحساب، ولا تسجيلَ فيها
-- ولا طلبَ تسجيل، ولا مدرّبَ آخرَ موصولٌ بحسابٍ يقودها. (`prep-cohort-cleanup.ts`)
UPDATE "Cohort" c
SET "status" = 'cancelled'
WHERE c."status" = 'draft'
  AND EXISTS (
    SELECT 1 FROM "CohortDeliveryPlan" p
    LEFT JOIN "TrainerProfile" tp ON tp."id" = p."trainerId"
    WHERE p."cohortId" = c."id" AND p."status" = 'submitted'
      AND (p."trainerId" IS NULL OR tp."id" IS NULL OR tp."userId" IS NULL)
  )
  AND NOT EXISTS (SELECT 1 FROM "Enrollment" e WHERE e."cohortId" = c."id")
  AND NOT EXISTS (SELECT 1 FROM "EnrollmentRequest" r WHERE r."cohortId" = c."id")
  AND NOT EXISTS (
    SELECT 1 FROM "CohortTrainer" ct JOIN "TrainerProfile" tp2 ON tp2."id" = ct."profileId"
    WHERE ct."cohortId" = c."id" AND tp2."userId" IS NOT NULL
  );
