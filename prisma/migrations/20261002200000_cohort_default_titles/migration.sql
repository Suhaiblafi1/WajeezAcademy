-- ═══ أسماءُ الشعب المسوّدة: «اسمُ الدورة — شعبة N» (٢ أكتوبر ٢٠٢٦) ═══
--
-- قرارُ صاحب المنصّة: الشعبُ تُسمّى باسم دورتها ورقمِها فيها، لا «الدفعة
-- الأولى» ولا «الشعبة الأولى» بلا دورة. والجديدةُ تُسمّى كذلك من الشيفرة
-- (`src/application/learning/cohort-title.ts`)، وهذا لما قام قبلها.
--
-- · **المسوّداتُ وحدَها، وبلا متعلّمين ولا طلباتِ تسجيل** — فلا يتغيّر اسمٌ
--   رآه متعلّمٌ أو كُتب في فاتورةٍ أو شهادة. وما فُتح أو بدأ أو انتهى يبقى.
-- · والرقمُ موضعُ الشعبة بين شعب دورتها كلِّها بترتيب إنشائها — فيوافق ما
--   تحسبه الشيفرةُ للتالية (عددُ الشعب + ١)، ولا يأخذ رقمٌ مكانَ آخر.
-- · واسمُ الدورة من نسختها الجارية، والأرقامُ هنديّة (١، ٢) — بـ`replace` رقما
--   رقما لا بـ`translate`: هذه تعمل حرفا بحرفٍ على ترميز القاعدة، فإن لم يكن
--   UTF8 قطّعت الحرفَ العربيَّ بايتاتٍ فاسدة (رُئي في قاعدة الاختبار).

UPDATE "Cohort" AS c
SET "title" = v."titleAr" || ' — شعبة ' || replace(replace(replace(replace(replace(replace(replace(replace(replace(replace(o.n::text, '0', '٠'), '1', '١'), '2', '٢'), '3', '٣'), '4', '٤'), '5', '٥'), '6', '٦'), '7', '٧'), '8', '٨'), '9', '٩')
FROM (
  SELECT "id", "courseId", row_number() OVER (PARTITION BY "courseId" ORDER BY "createdAt", "id") AS n
  FROM "Cohort"
) AS o,
"Course" AS k,
"CourseVersion" AS v
WHERE o."id" = c."id"
  AND k."id" = c."courseId"
  AND v."courseId" = k."id" AND v."version" = k."currentVersion"
  AND c."status" = 'draft'
  AND NOT EXISTS (SELECT 1 FROM "Enrollment" e WHERE e."cohortId" = c."id")
  AND NOT EXISTS (SELECT 1 FROM "EnrollmentRequest" r WHERE r."cohortId" = c."id");
