-- إعادةُ دوراتِ لوحة الإدارة التي أطفأها مستوردُ الكتالوج
--
-- كان تقليمُ المستورد (`server/catalog/importer.ts`) يعامل ملفَّ المستودع بابا
-- وحيدا للدورات، ويطفئ عند كلِّ نشرٍ للموقع ما ليس فيه. ولوحةُ الإدارة بابٌ
-- ثانٍ: دوراتُها تُراجَع وتُعتمَد وتُنشر، ولا تدخل الملفَّ أبدا. فوقع عليها
-- التقليمُ من وجهين:
--   · دورةٌ منشورةٌ ليست في الملفّ ← `archived`، فتخرج من الكتالوج.
--   · ورابطُها بمسارٍ من مسارات الملفّ ← يُحذف، ولو كانت مسوّدةً لم تُنشر.
-- ووقع ذلك لـC-COMX-107، الدورةِ التي صارت إليها فكرةُ مدرّب: الاقتراحُ يقول
-- «صار دورةً في الكتالوج»، والكتالوجُ الحيُّ مئةٌ وسبعَ عشرةَ دورةً كلُّها من
-- الملفّ.
--
-- وأُصلح المستوردُ في الالتزام نفسِه. وهذا يعيد ما أطفأه قبلُ — بالبيّنة وحدَها:
-- لا تُعاد دورةٌ إلّا ولها في السجلّ ما يقول إنّها كانت كذلك.

-- ① الحالة.
--
-- تعود دورةٌ إلى `published` بثلاثة شروطٍ معا:
--   · وُلدت في اللوحة — `createdBy` مكتوب. والمعالجُ يكتبه في كلّ دورة،
--     والمستوردُ لا يكتبه أبدا.
--   · وحالُها اليومَ `archived`. ولا بابَ في اللوحة يؤرشف دورة: الاعتمادُ
--     والنشرُ وحدَهما يرقّيان حالتَها. فمؤرشفةٌ وُلدت في اللوحة لم يؤرشفها
--     إلّا المستورد.
--   · وفي سجلّ النشر أنّها رُقّيت إلى المنشور. كلُّ نشرٍ — من اللوحة أو
--     الآليُّ مع البناء — يكتب ما رقّاه في `details.promoted.courses`، ولا يرقّي
--     إلّا ما اعتمده إنسان.
-- ودورةٌ لم تُنشر قطّ لا تُمسّ: مكانُها المراجعةُ لا هذا الملفّ.
--
-- ولا يُمسّ إصدارُها ولا وحداتُها: التقليمُ كتب حالةَ الدورة وحدَها، فالرجوعُ
-- عنه يكتبها وحدَها.
UPDATE "Course" c
SET "status" = 'published', "updatedAt" = CURRENT_TIMESTAMP
WHERE c."createdBy" IS NOT NULL
  AND c."status" = 'archived'
  AND EXISTS (
    SELECT 1
    FROM "CatalogPublishEvent" e
    CROSS JOIN LATERAL jsonb_array_elements_text(
      CASE WHEN jsonb_typeof(e."details"->'promoted'->'courses') = 'array'
           THEN e."details"->'promoted'->'courses'
           ELSE '[]'::jsonb END
    ) AS promoted(id)
    WHERE e."action" = 'publish' AND promoted.id = c."id"
  );

-- ② ورابطُ المسار — حين حفظته لقطة.
--
-- الرابطُ المحذوفُ لا سجلَّ له إلّا اللقطاتُ المنشورة: كلٌّ منها يحفظ مسارَ كلِّ
-- دورةٍ وترتيبَها يومَ نُشرت (`coreCatalog.courses[].pathway_id` و`sequence`).
-- فيُعاد من آخر لقطةٍ حملت الدورةَ بمسار، بشروط:
--   · دورةُ لوحةٍ منشورةٌ اليوم، ولا رابطَ مسارٍ لها البتّة — فلا يُضاف ثانٍ
--     إلى دورةٍ لها رابط، ولا يُقدَّم ظنٌّ على ما في القاعدة.
--   · والمسارُ ما زال قائما.
-- وما حُذف رابطُه قبل أن تحفظه لقطةٌ — دورةٌ فقدته مسوّدةً ثمّ نُشرت — لا يُعرف
-- مسارُه، فتبقى قائمةً بنفسها، وهو شكلٌ يقبله الكتالوج منذ ٢٠ سبتمبر ٢٠٢٦.
--
-- واللقطةُ ثقيلة (الكتالوجُ كلُّه بمهاراته وأسئلته)، فتُفتح كلُّ لقطةٍ مرّةً
-- واحدةً لا مرّةً لكلّ دورة (`MATERIALIZED`)، ولا تُفتح منها إلّا ما جاء بعد
-- ميلاد أقدم دورةٍ تُطلب — ولا يُفتح شيءٌ حين لا دورةَ تُطلب أصلا.
WITH orphan AS (
  SELECT c."id", c."createdAt"
  FROM "Course" c
  WHERE c."createdBy" IS NOT NULL
    AND c."status" = 'published'
    AND NOT EXISTS (SELECT 1 FROM "PathwayCourse" pc WHERE pc."courseId" = c."id")
),
seen AS MATERIALIZED (
  SELECT entry->>'course_id' AS "courseId", entry->>'pathway_id' AS "pathwayId",
         entry->>'sequence' AS "sequence", s."createdAt"
  FROM "CatalogSnapshot" s
  CROSS JOIN LATERAL jsonb_array_elements(
    CASE WHEN jsonb_typeof(s."payload"->'coreCatalog'->'courses') = 'array'
         THEN s."payload"->'coreCatalog'->'courses'
         ELSE '[]'::jsonb END
  ) AS entry
  WHERE s."createdAt" >= (SELECT MIN(o."createdAt") FROM orphan o)
)
INSERT INTO "PathwayCourse" ("pathwayId", "courseId", "sequence", "kind")
SELECT DISTINCT ON (o."id")
  seen."pathwayId",
  o."id",
  CASE WHEN seen."sequence" ~ '^[0-9]+$' THEN seen."sequence"::int ELSE 1 END,
  'required'
FROM orphan o
JOIN seen ON seen."courseId" = o."id"
WHERE EXISTS (SELECT 1 FROM "Pathway" p WHERE p."id" = seen."pathwayId")
ORDER BY o."id", seen."createdAt" DESC
ON CONFLICT DO NOTHING;
