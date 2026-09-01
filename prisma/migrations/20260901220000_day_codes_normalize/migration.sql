-- أيّامُ الشعب: توحيدُ التمثيل على الرموز.
--
-- كان نموذجا الإنشاء والتحرير يقبلان الأيّامَ نصّا حرّا ويقترحان «الأحد،
-- الثلاثاء»، فاستقرّ في القاعدة تمثيلان ليومٍ واحد: `sun` من البذرة، و«الأحد»
-- ممّا كُتب باليد. والعارضُ (`dayLabelAr`) يُرجع ما لا يعرفه كما هو، فبدا
-- الأمرُ سليما على الشاشة بينما لا يجمع اليومَ فرزٌ ولا مقارنة.
--
-- والهمزةُ تُوحَّد قبل المطابقة (أ إ آ ← ا)، وما لا يُعرف يبقى كما هو
-- بحروفٍ صغيرة — لا يُحذف: صفٌّ ناقصٌ أسوأ من صفٍّ غريب.
WITH exploded AS (
  SELECT c.id,
         CASE translate(btrim(d), 'أإآ', 'ااا')
           WHEN 'الاحد'    THEN 'sun'
           WHEN 'الاثنين'  THEN 'mon'
           WHEN 'الثلاثاء' THEN 'tue'
           WHEN 'الاربعاء' THEN 'wed'
           WHEN 'الخميس'   THEN 'thu'
           WHEN 'الجمعة'   THEN 'fri'
           WHEN 'السبت'    THEN 'sat'
           ELSE lower(btrim(d))
         END AS code
  FROM "Cohort" c, unnest(c."daysOfWeek") AS d
),
mapped AS (
  SELECT id,
         array_agg(code ORDER BY array_position(ARRAY['sun','mon','tue','wed','thu','fri','sat']::text[], code)) AS codes
  FROM (SELECT DISTINCT id, code FROM exploded) u
  GROUP BY id
)
UPDATE "Cohort" c
SET "daysOfWeek" = m.codes
FROM mapped m
WHERE c.id = m.id AND c."daysOfWeek" IS DISTINCT FROM m.codes;
