-- اقتراحُ دورةٍ يصير سجلّا له حياةٌ بعد الطلب (ح-٢ · ح-٤)
--
-- ═══ ولمَ نقضتُ حكمي قبل يومٍ واحد ═══
--
-- في ترحيل `teachableProposals` (١٣ سبتمبر) كتبتُ: «لا حياةَ له خارج طلبه
-- ولا يُستعلَم عنه وحدَه. وجدولٌ له مفاتيحُ وفهارسُ وترحيلٌ لا يشتري شيئا
-- اليوم». وكان ذلك صحيحا يومَه: الاقتراحُ يُقرأ مرّةً مع الطلب ويُنسى.
--
-- وبندان يُلغيان علّتَه:
--   · **ح-٢** يمنحه حياةً بعد الطلب — يفتح المدرّبُ بوّابتَه بعد شهورٍ
--     فيعدّل اقتراحَه ويضيف ويحذف. فلم يعد محبوسا في طلبه.
--   · **ح-٤** يستعلم عنه وحدَه — طابورُ تصنيفٍ عبرَ المدرّبين كلِّهم:
--     «أرِني ما لم يُصنَّف بعد». وعمودُ JSON لا يُستعلَم عنه هكذا إلّا بمسح
--     كلِّ طلبٍ في القاعدة وتصفيةٍ في الذاكرة.
--   · ولكلِّ اقتراحٍ بعدها **قرارٌ ومُقرِّرٌ ووقت** — وهذا سجلٌّ لا حقل.
--
-- فالعلّةُ انقلبت لا الرأي. ولو بقي الأمرُ على ح-١ (الإدخالُ وحدَه) لبقي
-- العمودُ هو الصواب.
--
-- ═══ والعمودُ القديم لا يُمسّ ═══
--
-- `TrainerApplication.teachableProposals` يبقى كما هو: لا يُفرَّغ ولا
-- يُحذف. هو سجلُّ ما قدّمه المتقدّمُ يومَ تقدّم، وقد قرأه من اعتمده. وهذا
-- الجدولُ يُبذَر منه ثمّ يحيا وحدَه — فمن عدّل اقتراحَه اليومَ لم يُعِد
-- كتابةَ ما قرأه المعتمِدُ أمس.

CREATE TABLE "TrainerCourseProposal" (
  "id"             UUID         NOT NULL DEFAULT gen_random_uuid(),
  "profileId"      UUID         NOT NULL,
  "titleAr"        TEXT         NOT NULL,
  "audienceAr"     TEXT,
  "status"         TEXT         NOT NULL DEFAULT 'draft',
  "courseId"       TEXT,
  "decidedBy"      UUID,
  "decidedAt"      TIMESTAMP(3),
  "decisionNoteAr" TEXT,
  "createdAt"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"      TIMESTAMP(3) NOT NULL,
  CONSTRAINT "TrainerCourseProposal_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "TrainerCourseProposal_status_createdAt_idx" ON "TrainerCourseProposal"("status", "createdAt");
CREATE INDEX "TrainerCourseProposal_profileId_status_idx" ON "TrainerCourseProposal"("profileId", "status");

ALTER TABLE "TrainerCourseProposal" ADD CONSTRAINT "TrainerCourseProposal_profileId_fkey"
  FOREIGN KEY ("profileId") REFERENCES "TrainerProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "TrainerCourseProposal" ADD CONSTRAINT "TrainerCourseProposal_courseId_fkey"
  FOREIGN KEY ("courseId") REFERENCES "Course"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- ═══ بذرةٌ لمن سبق الجدولَ ═══
--
-- من اعتُمد قبل اليوم وله اقتراحاتٌ في طلبه: تُنقَل نسخةٌ منها إلى الجدول
-- حتّى يجدها في بوّابته. وبحالة `submitted` لا `draft`: هي مقدَّمةٌ فعلا
-- منذ يوم طلبه، وليست مسوّدةً عنده.
--
-- وشرطُ `titleAr` غيرِ الفارغ يقي من صفٍّ بلا عنوان: الحقلُ في النموذج
-- إلزاميّ، لكنّ طلبا قديما قد يحمل صفًّا نصفَ مكتوب.
INSERT INTO "TrainerCourseProposal" ("profileId", "titleAr", "audienceAr", "status", "createdAt", "updatedAt")
SELECT p."id",
       btrim(x."titleAr"),
       NULLIF(btrim(COALESCE(x."audienceAr", '')), ''),
       'submitted',
       a."createdAt",
       CURRENT_TIMESTAMP
FROM "TrainerProfile" p
JOIN "TrainerApplication" a ON a."id" = p."applicationId"
CROSS JOIN LATERAL jsonb_to_recordset(a."teachableProposals") AS x("titleAr" TEXT, "audienceAr" TEXT)
WHERE a."teachableProposals" IS NOT NULL
  AND jsonb_typeof(a."teachableProposals") = 'array'
  AND btrim(COALESCE(x."titleAr", '')) <> '';
