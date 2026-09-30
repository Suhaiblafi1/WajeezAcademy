-- ═══ إعادةُ C-COMX-107 إلى الكتالوج — بأمر صاحب المنصّة (٣٠ سبتمبر ٢٠٢٦) ═══
--
-- «اعداد المعلمين واولاء الامور لتدريب مهارة الخطابة والالقاء لأبنائهم» — دورةٌ
-- وُلدت في لوحة الإدارة من اقتراح مدرّب، وأطفأها تقليمُ المستورد القديم. وأُصلح
-- المستوردُ، وأعاد الترحيلُ `20260929120000_restore_admin_courses` كلَّ دورةِ
-- لوحةٍ في سجلّ النشر أنّها نُشرت — ولم يكن لهذه فيه سطر، فبقيت خارج الكتالوج،
-- وطريقُها اللوحة: مراجعةٌ فاعتمادٌ فنشر. فقال صاحبُ المنصّة: «restore C-COMX-107
-- now». وأمرُه هو الاعتماد؛ وهذا الترحيلُ يفعل ما يفعله الاعتمادُ ثمّ النشرُ في
-- اللوحة (`promoteEntity` في `catalog-admin.service.ts`) — لهذه الدورة وحدَها،
-- ويجري قبل المستورد ونشرِ اللقطة في النشر، فتدخل الكتالوجَ الحيَّ في النشر نفسِه.
--
-- ── وبحاجزَي النشر نفسِهما ──
--
-- لا تُنشر إلّا ولها وحدةٌ غيرُ مؤرشفةٍ ومهارةٌ مربوطة — شرطا `validateDrafts` في
-- `publishing.service.ts`: دورةٌ بلا وحدات لا تُدرَّس، وبلا مهارات «حيّةٌ في
-- القائمة ميّتةٌ في المحرّك». فإن نقصها أحدُهما لم يُمسّ منها شيء، ومكانُها اللوحة.
--
-- ── وما يخالف فيه اللوحةَ عمدا ──
--
-- النشرُ في اللوحة يرفع وحداتِ الدورة كلَّها إلى المنشور، ومنها المؤرشفة. وهنا لا:
-- الوحدةُ المؤرشفةُ أُرشفت لسبب — المستعملةُ في شعبةٍ لا تُحذف بل تؤرشف — والمستوردُ
-- لم يمسّ الوحداتِ أصلا، كتب حالةَ الدورة وحدَها. فتُنشر المسوّداتُ وحدَها،
-- ويبقى تعديلٌ مسوّدٌ فوق وحدةٍ منشورةٍ مسوّدةً: لم يراجعه أحد.
--
-- والجملُ تُعاد فلا تفسد: الدورةُ المنشورةُ لا تطابقها ثانية — فلا تُنشر مسوّدةُ
-- وحدةٍ جديدةٍ تُكتب فيها بعد اليوم.

-- ① إصداراتُ الوحدات المسوّدة — قبل وحداتها، والشرطُ على الوحدة ما زال مسوّدة
UPDATE "CourseModuleVersion" AS v
SET "status" = 'published'
FROM "CourseModule" AS m
WHERE v."moduleId" = m."id"
  AND m."courseId" = 'C-COMX-107' AND m."status" = 'draft' AND v."status" = 'draft'
  AND EXISTS (SELECT 1 FROM "Course" c WHERE c."id" = 'C-COMX-107' AND c."status" <> 'published')
  AND EXISTS (SELECT 1 FROM "CourseModule" x WHERE x."courseId" = 'C-COMX-107' AND x."status" <> 'archived')
  AND EXISTS (SELECT 1 FROM "CourseSkillLink" l WHERE l."courseId" = 'C-COMX-107');

-- ② الوحداتُ المسوّدة
UPDATE "CourseModule"
SET "status" = 'published'
WHERE "courseId" = 'C-COMX-107' AND "status" = 'draft'
  AND EXISTS (SELECT 1 FROM "Course" c WHERE c."id" = 'C-COMX-107' AND c."status" <> 'published')
  AND EXISTS (SELECT 1 FROM "CourseSkillLink" l WHERE l."courseId" = 'C-COMX-107');

-- ③ إصدارُ الدورة الحاليّ — ما كان الاعتمادُ ثمّ النشرُ يرفعانه
UPDATE "CourseVersion" AS v
SET "status" = 'published'
FROM "Course" AS c
WHERE v."courseId" = c."id" AND v."version" = c."currentVersion"
  AND c."id" = 'C-COMX-107' AND c."status" <> 'published'
  AND v."status" IN ('draft', 'in_review', 'approved')
  AND EXISTS (SELECT 1 FROM "CourseModule" x WHERE x."courseId" = 'C-COMX-107' AND x."status" <> 'archived')
  AND EXISTS (SELECT 1 FROM "CourseSkillLink" l WHERE l."courseId" = 'C-COMX-107');

-- ④ والدورةُ نفسُها — آخرا، فهي شرطُ ما قبلها
UPDATE "Course"
SET "status" = 'published', "updatedAt" = CURRENT_TIMESTAMP
WHERE "id" = 'C-COMX-107' AND "status" <> 'published'
  AND EXISTS (SELECT 1 FROM "CourseModule" x WHERE x."courseId" = 'C-COMX-107' AND x."status" <> 'archived')
  AND EXISTS (SELECT 1 FROM "CourseSkillLink" l WHERE l."courseId" = 'C-COMX-107');
