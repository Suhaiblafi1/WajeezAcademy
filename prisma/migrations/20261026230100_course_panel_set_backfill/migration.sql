-- ما ضبطته اللوحة ولم يمحه نشر بعد يعلَّم فيبقى (٢٦ أكتوبر ٢٠٢٦، خطة لوحة الإدارة — المرحلة الثامنة).
-- النشر الذي يحمل هذا الترحيل يستورد الملف بعده مباشرة، فبلا العلامة يمحو ما ضبط منذ النشر السابق.
-- ويعلَّم ما أثره الأخير ما زال قائما في القاعدة وحده: ما رجع إلى الملف قبل اليوم لا يرجَع، فربما عدّله الملف بعده.

-- المهارات: آخر «catalog.course.skills_set» لكل دورة، وما بعده يطابق روابطها الآن مجموعة لا ترتيبا.
WITH latest AS (
  SELECT DISTINCT ON ("entityId") "entityId", "createdAt", "after"
  FROM "AuditEvent"
  WHERE "action" = 'catalog.course.skills_set' AND "entityType" = 'course'
  ORDER BY "entityId", "createdAt" DESC
)
UPDATE "Course" AS c SET "skillsSetAt" = l."createdAt"
FROM latest AS l
WHERE c."id" = l."entityId"
  AND c."skillsSetAt" IS NULL
  AND ARRAY(SELECT k."skillId" FROM "CourseSkillLink" AS k WHERE k."courseId" = c."id" ORDER BY 1)
    = ARRAY(SELECT jsonb_array_elements_text(l."after" -> 'skillIds') ORDER BY 1);

-- وترشيحها وحدها: آخر «catalog.course.standalone_set»، ورمزه ومجالاته وجمهوره كما في القاعدة الآن.
WITH latest AS (
  SELECT DISTINCT ON ("entityId") "entityId", "createdAt", "after"
  FROM "AuditEvent"
  WHERE "action" = 'catalog.course.standalone_set' AND "entityType" = 'course'
  ORDER BY "entityId", "createdAt" DESC
)
UPDATE "Course" AS c SET "standaloneSetAt" = l."createdAt"
FROM latest AS l
WHERE c."id" = l."entityId"
  AND c."standaloneSetAt" IS NULL
  AND c."recommendableDirectly" = (l."after" -> 'recommendable')::boolean
  AND ARRAY(SELECT d FROM unnest(c."diagnosticDomains") AS d ORDER BY 1)
    = ARRAY(SELECT jsonb_array_elements_text(l."after" -> 'domains') ORDER BY 1)
  AND ARRAY(SELECT s FROM unnest(c."diagnosticStages") AS s ORDER BY 1)
    = ARRAY(SELECT jsonb_array_elements_text(l."after" -> 'stages') ORDER BY 1);
