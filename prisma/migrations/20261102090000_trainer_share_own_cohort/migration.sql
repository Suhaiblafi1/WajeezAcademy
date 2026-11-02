-- ═══ «شارك دوراتك» تخصّ شعبةَ المدرّب نفسَها (٢ نوفمبر ٢٠٢٦) ═══
--
-- قال صاحبُ المنصّة عن تصاميم أماني الحديد: «عدّلها كما طلبت، وتأكّد أنّ كلَّ التصاميم تخصّ الدوراتِ الخاصّةَ
-- بالمدرّب كشعبة، وليس الدورةَ العليا أو شعبا أخرى لنفس الدورات». فجملتان:
--
-- ① **روابطُ الشعب القصيرةُ تفتح شعبتَها.** كان رابطُ الشعبة `/build/<الدورة>?ref=<رمزه>` فتختار صفحةُ الدورة أقربَ
--   شعبةٍ مفتوحة — وقد تكون لمدرّبٍ آخر. والشيفرةُ تكتبه الآن بشعبته (`cohortLinkUrl` في `referral.service.ts`)،
--   وهذا لما سُكّ قبلها: يتغيّر عنوانُه ويبقى رمزُه، فما نُشر يفتح شعبتَه. والعنوانُ بحروف `cohortLinkUrl` نفسِها،
--   فيجده `shortOf` ولا يسكّ غيرَه. والجملةُ تُعاد فلا تفسد: ما وُجّه لا يطابق `?ref=` في أوّله.
--
-- ② **اسما شعبتَي أماني الحديد كما طلبت** — اسمُ الشعبة لا اسمُ الدورة، فشعبُ المدرّبين الآخرين لا تُمسّ:
--   · «القيادة للمديرين الجديد» ← «القيادة للمديرين الجدد».
--   · «الذكاء الاصطناعي مساعدك الشخصي»: وعدُه «ابحث عن وظيفة، وأدر بريدك، وابن موقعك بنفسك» — وقالت: «أنا ما حأعلّمهم
--     يعملوا موقعهم، الفكرة أكثر عن كيفيّة استخدام أدوات الذكاء الاصطناعي للعمل.. تعلّم كتابة Prompt بذكاء، تطبيقات
--     سهلة للعمل اليومي، والتعامل معه بأخلاقيّات». فصار بصيغة الوعد الأوّل: أفعالٌ ثلاثة.
--   ورقمُ الشعبة في ذيل اسمها يبقى كما هو. وما اسمُه «شعبة ١» أو «الدفعة الأولى» وحدَه يُنشر باسم دورته
--   (`sharedCohortTitleAr`)، فيُكتب له اسمُها مصحَّحا. ولكلّ تغييرٍ أثرٌ `cohort.update` باسمه قبلُ وبعدُ.
--
-- والتعابيرُ بلا أقواس حروفٍ عربيّة (`[٠-٩]`، `[—،]`): القاعدةُ إن لم تكن UTF8 تقرأ القوسَ بايتا بايتا فتقطّع الحرفَ
-- (رُئي في قاعدة الاختبار، وعلّتُه في `20261002200000_cohort_default_titles`). فالبدائلُ تُكتب واحدةً واحدة.

UPDATE "ShortLink" AS s
SET "target" = '/build/' || c."courseId" || '?cohort=' || c."id"::text || '&ref=' || l."code"
FROM "TrainerReferralLink" AS l
JOIN "Cohort" AS c ON c."id" = l."cohortId"
WHERE s."purpose" = 'share-kit'
  AND s."revokedAt" IS NULL
  AND s."target" LIKE '/build/%'
  AND split_part(s."target", '?ref=', 2) = l."code"
  AND NOT EXISTS (
    SELECT 1 FROM "ShortLink" AS t
    WHERE t."target" = '/build/' || c."courseId" || '?cohort=' || c."id"::text || '&ref=' || l."code"
  );

WITH amani AS (
  SELECT p."id"
  FROM "TrainerProfile" AS p
  JOIN "TrainerApplication" AS a ON a."id" = p."applicationId"
  WHERE a."fullName" LIKE '%ماني%الحديد%'
),
theirs AS (
  SELECT ct."cohortId" AS id FROM "CohortTrainer" AS ct WHERE ct."role" = 'lead' AND ct."profileId" IN (SELECT "id" FROM amani)
  UNION
  SELECT ta."cohortId" FROM "TrainerCourseAssignment" AS ta
  WHERE ta."status" = 'active' AND ta."cohortId" IS NOT NULL AND ta."profileId" IN (SELECT "id" FROM amani)
),
parts AS (
  SELECT c."id", c."title" AS before, v."titleAr" AS course,
         btrim(regexp_replace(c."title", '\s*(?:—|–|-|\||:|،)\s*شعبة\s*(?:٠|١|٢|٣|٤|٥|٦|٧|٨|٩|[0-9])+\s*$', '')) AS own,
         coalesce(substring(c."title" from '\s*(?:—|–|-|\||:|،)\s*شعبة\s*(?:٠|١|٢|٣|٤|٥|٦|٧|٨|٩|[0-9])+\s*$'), '') AS tail
  FROM "Cohort" AS c
  JOIN "Course" AS k ON k."id" = c."courseId"
  LEFT JOIN "CourseVersion" AS v ON v."courseId" = k."id" AND v."version" = k."currentVersion"
  WHERE c."id" IN (SELECT id FROM theirs)
),
named AS (
  SELECT "id", before, tail,
         CASE WHEN own = '' OR own ~ '^(ال)?(شعبة|دفعة)(\s|$)' THEN btrim(coalesce(course, own)) ELSE own END AS name
  FROM parts
),
fixed AS (
  SELECT "id", before,
         CASE
           WHEN name LIKE '%مساعدك الشخصي%'
             THEN btrim(split_part(name, ':', 1)) || ': اكتب Prompt بذكاء، واستخدم تطبيقات سهلة في عملك اليومي، وتعامل معه بأخلاقيات' || tail
           ELSE replace(name, 'للمديرين الجديد', 'للمديرين الجدد') || tail
         END AS after
  FROM named
  WHERE name LIKE '%مساعدك الشخصي%' OR name LIKE '%للمديرين الجديد%'
),
renamed AS (
  UPDATE "Cohort" AS c
  SET "title" = f.after
  FROM fixed AS f
  WHERE c."id" = f."id" AND c."title" <> f.after
  RETURNING c."id", f.before, f.after
)
INSERT INTO "AuditEvent" ("id", "actorId", "action", "entityType", "entityId", "reason", "before", "after")
SELECT gen_random_uuid(), NULL, 'cohort.update', 'cohort', r."id"::text,
       'اسم الشعبة كما طلبت مدربتها لتصاميم «شارك دوراتك» — قرار صاحب المنصة ٢ نوفمبر ٢٠٢٦',
       jsonb_build_object('title', r.before), jsonb_build_object('title', r.after)
FROM renamed AS r;
