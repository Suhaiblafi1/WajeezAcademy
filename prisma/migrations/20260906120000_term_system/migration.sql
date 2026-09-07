-- ═══════════ نظامُ الفصول الدراسيّة (البند ٤٦ · ٤٧) ═══════════
--
-- الفصلُ كيانٌ مستقلٌّ لا حقلٌ على الشعبة، لسببٍ حاسم: قائمةُ «المدرّبون
-- المتاحون لهذا الفصل» يجب أن توجد **قبل أن توجد الشعب**. وحقلٌ على الشعبة
-- لا يمكن الربطُ به حين لا شعبةَ بعد.
--
-- ولا تُفقد بيانات: مواسمُ المدرّبين المخزَّنةُ في `TrainerApplication.availability`
-- (JSON) تُنقل إلى الجدول الجديد في هذا الترحيل نفسِه.

CREATE TABLE "Term" (
    "id" UUID NOT NULL,
    "year" INTEGER NOT NULL,
    "season" TEXT NOT NULL,
    "titleAr" TEXT NOT NULL,
    "startsOn" DATE NOT NULL,
    "endsOn" DATE NOT NULL,
    "registrationOpensAt" TIMESTAMP(3),
    "registrationClosesAt" TIMESTAMP(3),
    "status" TEXT NOT NULL DEFAULT 'planned',
    "calendarPublishedAt" TIMESTAMP(3),
    "openedAt" TIMESTAMP(3),
    "openedBy" UUID,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Term_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "Term_year_season_key" ON "Term"("year", "season");
CREATE INDEX "Term_status_startsOn_idx" ON "Term"("status", "startsOn");

CREATE TABLE "TrainerTermAvailability" (
    "profileId" UUID NOT NULL,
    "termId" UUID NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'declared',
    "maxCohorts" INTEGER,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TrainerTermAvailability_pkey" PRIMARY KEY ("profileId", "termId")
);

CREATE INDEX "TrainerTermAvailability_termId_status_idx" ON "TrainerTermAvailability"("termId", "status");

ALTER TABLE "TrainerTermAvailability" ADD CONSTRAINT "TrainerTermAvailability_profileId_fkey"
  FOREIGN KEY ("profileId") REFERENCES "TrainerProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "TrainerTermAvailability" ADD CONSTRAINT "TrainerTermAvailability_termId_fkey"
  FOREIGN KEY ("termId") REFERENCES "Term"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- الشعبةُ تعرف فصلَها — قابلٌ للإفراغ عمدا: المسوّداتُ تُنشأ قبل أن يُقرَّر
-- فصلُها، وشعبُ ما قبل هذا النظام لا فصلَ لها ولا يُلفَّق لها واحد.
ALTER TABLE "Cohort" ADD COLUMN "termId" UUID;
ALTER TABLE "Cohort" ADD COLUMN "plannedMonth" INTEGER;
ALTER TABLE "Cohort" ADD COLUMN "scheduleLockedAt" TIMESTAMP(3);
ALTER TABLE "Cohort" ADD CONSTRAINT "Cohort_termId_fkey"
  FOREIGN KEY ("termId") REFERENCES "Term"("id") ON DELETE SET NULL ON UPDATE CASCADE;
CREATE INDEX "Cohort_termId_plannedMonth_idx" ON "Cohort"("termId", "plannedMonth");

-- ═══ البند ٤٧: مجالُ الدورة يصير بيانا لا اشتقاقا في المتصفّح ═══
--
-- التصنيفُ كاملٌ ١٠٠٪ (٨١ من ٨١) لكنّه يُشتقّ من نصّ المعرِّف في الواجهة
-- وحدَها؛ والخادمُ لا يحسبه أبدا. فمخطِّطُ الفصل لا يستطيع أن يسأل «أهاتان
-- في مجالٍ واحد؟». والعمودُ يُملأ هنا من العائلة نفسِها — المصدرُ واحد.
ALTER TABLE "Course" ADD COLUMN "domainAr" TEXT;
ALTER TABLE "Course" ADD COLUMN "collisionGroup" TEXT;
CREATE INDEX "Course_domainAr_idx" ON "Course"("domainAr");

UPDATE "Course" SET "domainAr" = CASE split_part("id", '-', 2)
  WHEN 'AI'   THEN 'الذكاء الاصطناعي'
  WHEN 'DAT'  THEN 'تحليل البيانات'
  WHEN 'AUT'  THEN 'الأتمتة والربط'
  WHEN 'CYB'  THEN 'الأمن السيبراني'
  WHEN 'PRD'  THEN 'إدارة المنتج'
  WHEN 'PM'   THEN 'إدارة المشاريع'
  WHEN 'MGR'  THEN 'الإدارة وقيادة الفرق'
  WHEN 'OPS'  THEN 'العمليات والجودة'
  WHEN 'SCM'  THEN 'سلاسل الإمداد'
  WHEN 'HR'   THEN 'الموارد البشرية'
  WHEN 'FINM' THEN 'المالية والمحاسبة'
  WHEN 'MKT'  THEN 'التسويق'
  WHEN 'SAL'  THEN 'المبيعات'
  WHEN 'SVC'  THEN 'خدمة العملاء'
  WHEN 'BIZ'  THEN 'ريادة الأعمال'
  WHEN 'NEG'  THEN 'التفاوض'
  WHEN 'COMX' THEN 'التواصل والعرض'
  WHEN 'LND'  THEN 'التدريب والتصميم التعليمي'
  WHEN 'CAR'  THEN 'المسار المهني'
  WHEN 'JOB'  THEN 'البحث عن عمل'
  ELSE 'أخرى'
END;

-- ═══ نقلُ مواسم المدرّبين من JSON إلى صفوف ═══
--
-- الفصولُ تُنشأ للسنة الجارية والتالية (ثمانية صفوف) فيوجد ما يُربط به.
-- والحدودُ من `TRAINING_SEASONS` نفسِها: الشتاءُ نوفمبر–يناير فيمتدّ عبر
-- رأس السنة، ولذلك نهايتُه في السنة التالية.
INSERT INTO "Term" ("id", "year", "season", "titleAr", "startsOn", "endsOn", "status", "createdAt", "updatedAt")
SELECT
  gen_random_uuid(),
  y.year,
  s.season,
  s.label || ' ' || y.year::text,
  make_date(y.year, s.start_month, 1),
  (make_date(CASE WHEN s.end_month < s.start_month THEN y.year + 1 ELSE y.year END, s.end_month, 1)
    + INTERVAL '1 month - 1 day')::date,
  'planned',
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
FROM (VALUES
  (EXTRACT(YEAR FROM CURRENT_DATE)::int),
  (EXTRACT(YEAR FROM CURRENT_DATE)::int + 1)
) AS y(year)
CROSS JOIN (VALUES
  ('nov_jan', 'موسم الشتاء', 11, 1),
  ('feb_apr', 'موسم الربيع', 2, 4),
  ('may_jul', 'موسم الصيف', 5, 7),
  ('aug_oct', 'موسم الخريف', 8, 10)
) AS s(season, label, start_month, end_month)
ON CONFLICT ("year", "season") DO NOTHING;

-- والمواسمُ المعلَنةُ في الطلبات تصير صفوفا للفصول القادمة من السنة الجارية.
-- `declared` لا `confirmed`: المتقدّمُ أعلن موسمَه، ولم يؤكّد فصلا بعينه بعد.
INSERT INTO "TrainerTermAvailability" ("profileId", "termId", "status", "createdAt", "updatedAt")
SELECT DISTINCT p."id", t."id", 'declared', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
FROM "TrainerProfile" p
JOIN "TrainerApplication" a ON a."id" = p."applicationId"
CROSS JOIN LATERAL jsonb_array_elements_text(
  COALESCE(a."availability"::jsonb -> 'seasons', '[]'::jsonb)
) AS declared(season)
JOIN "Term" t ON t."season" = declared.season
  AND t."year" = EXTRACT(YEAR FROM CURRENT_DATE)::int
ON CONFLICT ("profileId", "termId") DO NOTHING;

-- ═══ قيودُ الحالات — مولَّدةٌ بـ`scripts/status-checks.ts` لا مكتوبةٌ باليد ═══
-- (عُرفُ المستودَع: التعليقُ في المخطَّط هو العقد، والقيدُ يُشتقّ منه)
ALTER TABLE "Term" DROP CONSTRAINT IF EXISTS "Term_status_allowed";
ALTER TABLE "Term" ADD CONSTRAINT "Term_status_allowed" CHECK ("status" IN ('planned', 'open', 'active', 'closed', 'cancelled'));
ALTER TABLE "TrainerTermAvailability" DROP CONSTRAINT IF EXISTS "TrainerTermAvailability_status_allowed";
ALTER TABLE "TrainerTermAvailability" ADD CONSTRAINT "TrainerTermAvailability_status_allowed" CHECK ("status" IN ('declared', 'confirmed', 'declined'));
