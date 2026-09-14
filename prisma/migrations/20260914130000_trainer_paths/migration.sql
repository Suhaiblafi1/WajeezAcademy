-- مسارٌ يبنيه مدرّبٌ من دوراته ويُعرض على الرفّ العامّ (ن-١ … ن-٨)
--
-- ═══ ولمَ جدولٌ مستقلٌّ لا صفٌّ في `Pathway` ═══
--
-- ن-٥ يقطع بأنّه لا يزاحم في التشخيص. و`Pathway` هو ما يقرؤه محرّكُ التوصية
-- عبرَ `PathwaySkillRequirement` و`PathwayDomain` — فلو سكن المسارُ هناك
-- لصار وعدُ «مؤشّر وجيز» معلّقا براية يُطفئها أحدُهم يوما. والفصلُ بالبنية
-- يجعل الوعدَ لا يحتاج حارسا يتذكّره.
--
-- ═══ ولا عمودَ سعر (ن-٦) ═══
--
-- السعرُ حاصلُ ما تكلّفه دوراتُه، وأيُّ خصمٍ قرارُ إدارة. وحقلٌ غيرُ موجودٍ
-- أصدقُ من حقلٍ موجودٍ تحرسه شاشة.
--
-- ═══ والمفتاحُ المركّبُ يفرض ح-٣ (ن-٨) ═══
--
-- `PRIMARY KEY (pathId, courseId)` والنسخُ تتشارك `courseId` — فإصداران من
-- رمزٍ واحدٍ لا يدخلان مسارا واحدا. وهي القاعدةُ نفسُها التي تحكم المسارات
-- المنسَّقة، تلزم ما يبنيه الناسُ كما تلزم ما نكتبه.

CREATE TABLE "TrainerPath" (
  "id"           UUID         NOT NULL DEFAULT gen_random_uuid(),
  "profileId"    UUID         NOT NULL,
  "titleAr"      TEXT         NOT NULL,
  "blurbAr"      TEXT,
  "termId"       UUID,
  "status"       TEXT         NOT NULL DEFAULT 'draft',
  "slug"         TEXT,
  "reviewedBy"   UUID,
  "reviewedAt"   TIMESTAMP(3),
  "reviewNoteAr" TEXT,
  "publishedAt"  TIMESTAMP(3),
  "retiredAt"    TIMESTAMP(3),
  "retiredBy"    UUID,
  "createdAt"    TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"    TIMESTAMP(3) NOT NULL,
  CONSTRAINT "TrainerPath_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "TrainerPath_slug_key" ON "TrainerPath"("slug");
CREATE INDEX "TrainerPath_status_publishedAt_idx" ON "TrainerPath"("status", "publishedAt");
CREATE INDEX "TrainerPath_profileId_status_idx" ON "TrainerPath"("profileId", "status");

ALTER TABLE "TrainerPath" ADD CONSTRAINT "TrainerPath_profileId_fkey"
  FOREIGN KEY ("profileId") REFERENCES "TrainerProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "TrainerPath" ADD CONSTRAINT "TrainerPath_termId_fkey"
  FOREIGN KEY ("termId") REFERENCES "Term"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE TABLE "TrainerPathCourse" (
  "pathId"   UUID    NOT NULL,
  "courseId" TEXT    NOT NULL,
  "sequence" INTEGER NOT NULL DEFAULT 1,
  CONSTRAINT "TrainerPathCourse_pkey" PRIMARY KEY ("pathId", "courseId")
);

CREATE INDEX "TrainerPathCourse_courseId_idx" ON "TrainerPathCourse"("courseId");

ALTER TABLE "TrainerPathCourse" ADD CONSTRAINT "TrainerPathCourse_pathId_fkey"
  FOREIGN KEY ("pathId") REFERENCES "TrainerPath"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "TrainerPathCourse" ADD CONSTRAINT "TrainerPathCourse_courseId_fkey"
  FOREIGN KEY ("courseId") REFERENCES "Course"("id") ON DELETE CASCADE ON UPDATE CASCADE;
