-- نافذةُ الجدولة تتبع مدّةَ المراجعة لحظةَ حفظها (٢١ أكتوبر ٢٠٢٦).
--
-- كانت نافذةُ شعبةٍ اعتُمدت لها خطّةٌ تبقى نافذةَ ما اعتُمد حتّى تُعتمَد المراجعة، فرُدّ
-- لقاءٌ في مدّةٍ عدّلتها المدرّبةُ وحفظتها: «الموعد خارج مدّة الشعبة». وصارت تتبع ما حُفظ
-- (`savePlan` في `server/services/cohort-plan.service.ts`، والعلّةُ هناك). وما حُفظ قبل
-- هذا لا يُحفظ ثانيةً حتّى يُعدَّل شيء — فتُكتب نافذتُه هنا من آخر خطّةٍ لمدرّبها
-- لم تُعتمَد بعد، بحدود `periodBounds`: منتصفُ ليل يوم البدء بعمّان، وآخرُ لحظةٍ في يوم
-- الانتهاء بعمّان، مخزونةً بغرينتش.

UPDATE "Cohort" c
SET
  "scheduleWindowStart" = (((p.content->>'startsOn')::date)::timestamp AT TIME ZONE 'Asia/Amman') AT TIME ZONE 'UTC',
  "scheduleWindowEnd" = (((((p.content->>'endsOn')::date + 1))::timestamp AT TIME ZONE 'Asia/Amman') AT TIME ZONE 'UTC') - INTERVAL '1 millisecond'
FROM (
  SELECT DISTINCT ON ("cohortId") "cohortId", "content", "status"
  FROM "CohortDeliveryPlan"
  WHERE "trainerId" IS NOT NULL
  ORDER BY "cohortId", "createdAt" DESC
) p
WHERE p."cohortId" = c."id"
  AND p."status" IN ('draft', 'submitted', 'changes_requested')
  AND c."status" NOT IN ('completed', 'cancelled')
  AND (p.content->>'startsOn') ~ '^\d{4}-\d{2}-\d{2}$'
  AND (p.content->>'endsOn') ~ '^\d{4}-\d{2}-\d{2}$'
  AND (p.content->>'endsOn') >= (p.content->>'startsOn');
