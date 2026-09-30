-- ═══ «التحضير لأول وظيفة» دورتان لا أربع (٣٠ سبتمبر ٢٠٢٦) ═══
--
-- قرارُ صاحب المنصّة: تُدمج C-JOB-103 (ملفّ الأعمال) في C-JOB-101 (الاستهداف
-- والسيرة)، وC-JOB-105 (البحث عن عمل) في C-JOB-104 (المقابلات). والدمجُ نفسُه
-- في `core-catalog.v2.json`: الوحداتُ تنتقل بمعرّفاتها إلى الباقية، والمُدمَجةُ
-- تزول من الملفّ فيؤرشفها المستوردُ ولا يحذفها. وهذا الترحيلُ لما في القاعدة
-- ولا يبلغه الملفّ — ويجري قبل المستورد في النشر، والباقيتان قائمتان.
--
-- ① التأهيلُ ينتقل. وقولُ صاحب المنصّة أنّ الدمجَ لا يمسّ المدرّبين: «if the
--    trainer has two of these courses that would be merged, then in that case,
--    he would have only one». فالمؤهَّلُ لجزءٍ مؤهَّلٌ للمدموجة، وما ينتظر قرارا
--    ينتظره فيها:
--      أ) من له صفٌّ للباقية تُرفع حالتُه إلى أعلى الحالتين (مؤهَّلٌ فوق منتظِر)؛
--      ب) ومن لا صفَّ له للباقية يُنقل صفُّه إليها كما هو، بموادّه وتاريخه؛
--      ج) وما بقي حيّا على المُدمَجة يُتقاعَد (`retired`) ولا يُحذف — فأثرُه باقٍ.
--    والردُّ لا ينتقل: من رُدّ عن جزءٍ لم يُردّ عن الكلّ، فيبقى على دورته
--    المؤرشفة سجلّا. وطلبُ تأهيلٍ من أجل شعبةٍ بعينها (`requestedCohortId`) يبقى
--    على دورة شعبته — فالموافقةُ عليه تُسند إليها.
-- ② واقتراحاتُ المدرّبين المربوطةُ بالمُدمَجة تُربط بالباقية — فالرابطُ يدلّ على
--    دورةٍ حيّةٍ لا مؤرشفة.
--
-- ولا يُمسّ غيرُ ذلك: الشعبُ والتسجيلاتُ والطلباتُ والعروضُ سجلٌّ لما وقع. وقاعدةُ
-- أجرٍ خاصّةٌ بدورةٍ مُدمَجة لا تُنقل إلى دورةٍ أطولَ منها بلا قرار — فيُحسب
-- المدرّبُ في الباقية بقاعدتها أو بقاعدته العامّة. والجملُ تُعاد فلا تفسد:
-- ما نُقل أو تقاعد لا يطابقها ثانية.

-- ① أ) من له صفٌّ للباقية: تُرفع حالتُه إن كانت دون حالة الجزء
WITH pairs(old_id, new_id) AS (VALUES ('C-JOB-103', 'C-JOB-101'), ('C-JOB-105', 'C-JOB-104')),
     rnk(status, r) AS (VALUES ('qualified', 4), ('pending', 3), ('rejected', 2), ('retired', 1))
UPDATE "TrainerCourseQualification" AS keep
SET "status" = part."status",
    "qualifiedBy" = COALESCE(part."qualifiedBy", keep."qualifiedBy"),
    "decidedAt" = COALESCE(part."decidedAt", keep."decidedAt")
FROM "TrainerCourseQualification" AS part, pairs, rnk AS rk, rnk AS rp
WHERE part."courseId" = pairs.old_id AND keep."courseId" = pairs.new_id
  AND keep."profileId" = part."profileId"
  AND part."status" IN ('qualified', 'pending') AND part."requestedCohortId" IS NULL
  AND rk.status = keep."status" AND rp.status = part."status" AND rp.r > rk.r;

-- ① ب) ومن لا صفَّ له للباقية: يُنقل صفُّه إليها كما هو
WITH pairs(old_id, new_id) AS (VALUES ('C-JOB-103', 'C-JOB-101'), ('C-JOB-105', 'C-JOB-104'))
UPDATE "TrainerCourseQualification" AS part
SET "courseId" = pairs.new_id
FROM pairs
WHERE part."courseId" = pairs.old_id
  AND part."status" IN ('qualified', 'pending') AND part."requestedCohortId" IS NULL
  AND NOT EXISTS (
    SELECT 1 FROM "TrainerCourseQualification" AS k
    WHERE k."profileId" = part."profileId" AND k."courseId" = pairs.new_id
  );

-- ① ج) وما بقي حيّا على المُدمَجة يُتقاعَد — بتاريخه وموادّه
UPDATE "TrainerCourseQualification"
SET "status" = 'retired'
WHERE "courseId" IN ('C-JOB-103', 'C-JOB-105')
  AND "status" IN ('qualified', 'pending') AND "requestedCohortId" IS NULL;

-- ② الاقتراحاتُ المربوطةُ بالمُدمَجة تُربط بالباقية
UPDATE "TrainerCourseProposal" SET "courseId" = 'C-JOB-101' WHERE "courseId" = 'C-JOB-103';
UPDATE "TrainerCourseProposal" SET "courseId" = 'C-JOB-104' WHERE "courseId" = 'C-JOB-105';
