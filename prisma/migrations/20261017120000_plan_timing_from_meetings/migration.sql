-- ═══ خططُ المدرّبين التي في أيديهم تأخذ مواعيدَ محاورها من لقاءاتها (١٧ أكتوبر ٢٠٢٦) ═══
--
-- قرارُ صاحب المنصّة: «خذ التوقيتَ من اللقاءات» — فلا تُكتب لكلّ محورٍ «يبدأ / وينتهي»؛
-- يُشتقّان من لقاءاته (`planSlots` في `src/application/trainer/axis-timeline.ts`).
--
-- · **ما يُمسّ:** خطّةُ مدرّبٍ في يده — مسوّدةٌ أو مردودةٌ إليه — تُعلَّم `timing: meetings`
--   وتسقط منها مواعيدُها المكتوبة.
-- · **وما لا يُمسّ:** المرسَلةُ والمعتمَدةُ والمنشورةُ والسابقة — «ما اعتُمد يبقى على مواعيده
--   حتّى يُعدَّل»؛ وخططُ الإدارة (`baseline`) وغيرُ خطط المدرّبين.
--
-- ويحرسه `server/tests/trainer/plan-timing-migration.test.ts`، ويقرأ جملَه من هنا.

UPDATE "CohortDeliveryPlan"
SET "content" = ("content" - 'slots') || '{"timing": "meetings"}'::jsonb
WHERE "status" IN ('draft', 'changes_requested')
  AND "trainerId" IS NOT NULL
  AND jsonb_typeof("content") = 'object'
  AND "content"->>'kind' = 'trainer';
