-- مسار سمّاه متعلم لنفسه من الدورات.
--
-- لماذا: كل ما يُعرض على المتعلم صمّمناه نحن — مئة دورة وعشرون مسارا وستة عشر
-- قالبا. أما التركيبة التي يبنيها هو فهي الدليل الوحيد على طلب حقيقي، وكانت
-- تُفقد بإغلاق التبويب. ما يتكرر منها يستحق مراجعة أكاديمية ليصير مسارا معتمدا.
--
-- بلا حقول شخصية: name اسم المسار لا اسم صاحبه، وuserId اختياري تماما — الضيف
-- يحفظ مساره كما يحفظه المسجَّل. جدول جديد: لا يمسّ بيانات قائمة ولا يحتاج توقفا.
CREATE TABLE "LearnerPathDraft" (
    "id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "courseIds" TEXT[],
    "status" TEXT NOT NULL DEFAULT 'pending_review',
    "source" TEXT NOT NULL DEFAULT 'course_path_builder',
    "userId" UUID,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LearnerPathDraft_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "LearnerPathDraft_status_createdAt_idx" ON "LearnerPathDraft"("status", "createdAt");

ALTER TABLE "LearnerPathDraft" ADD CONSTRAINT "LearnerPathDraft_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
