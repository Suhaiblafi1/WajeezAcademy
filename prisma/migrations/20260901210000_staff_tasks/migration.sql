-- مهمّةٌ يُكلَّف بها موظّف.
--
-- قرارُ صاحب المنصّة: «يحقّ للسوبر إعطاء مهام للمستخدمين وإرسال إشعارات
-- لهم». ولم يكن في القاعدة نموذجُ «مهمّة» إطلاقا — إلّا `AdvisorTask`، وهي
-- مربوطةٌ بحالة عميلٍ بعينها (`caseId` إلزاميّ) فلا تصلح لتكليفٍ عامّ.
--
-- والمهمّةُ تُشعِر مكلَّفها دائما: تكليفٌ لا يعلم به صاحبُه ليس تكليفا.

CREATE TABLE "StaffTask" (
  "id"         UUID         NOT NULL DEFAULT gen_random_uuid(),
  "title"      TEXT         NOT NULL,
  "bodyAr"     TEXT,
  "assigneeId" UUID         NOT NULL,
  "assignedBy" UUID         NOT NULL,
  "dueAt"      TIMESTAMP(3),
  "priority"   TEXT         NOT NULL DEFAULT 'normal',
  "status"     TEXT         NOT NULL DEFAULT 'open',
  "doneAt"     TIMESTAMP(3),
  "doneNoteAr" TEXT,
  "createdAt"  TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"  TIMESTAMP(3) NOT NULL,
  CONSTRAINT "StaffTask_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "StaffTask_assigneeId_status_idx" ON "StaffTask"("assigneeId", "status");
CREATE INDEX "StaffTask_assignedBy_status_idx" ON "StaffTask"("assignedBy", "status");

ALTER TABLE "StaffTask"
  ADD CONSTRAINT "StaffTask_assigneeId_fkey"
  FOREIGN KEY ("assigneeId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
