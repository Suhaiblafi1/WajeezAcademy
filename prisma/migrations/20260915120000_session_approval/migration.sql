-- اللقاءُ المباشر: نبذةٌ وملفٌّ واعتمادُ إدارة (١٥ سبتمبر ٢٠٢٦).
--
-- قرارُ صاحب المنصّة: يجدول المدرّبُ اللقاءَ بساعتَي بدئه ونهايته ونبذةٍ
-- عنه وملفٍّ اختياريّ، ثمّ **توافق الإدارة**، فيُنشَر في منصّة الطلبة
-- ويصلهم بريدٌ به وللإدارة.
--
-- و`approvalState` افتراضُه `approved` لا `pending`، وهو الموضعُ الوحيدُ
-- الذي يقرّر مصيرَ ما في القاعدة الآن: الصفوفُ القائمةُ لقاءاتٌ معلَنةٌ
-- يحضرها الناسُ فعلا — ولو وُلدت `pending` لسُحبت من تقاويمهم في لحظةِ
-- ترحيلٍ واحدة، ولانتظرت طابورا لم يطلبه أحد. والترحيلُ لا يحجب.

ALTER TABLE "CohortSession"
  ADD COLUMN "noteAr" TEXT,
  ADD COLUMN "attachmentKey" TEXT,
  ADD COLUMN "attachmentName" TEXT,
  ADD COLUMN "attachmentMime" TEXT,
  ADD COLUMN "approvalState" TEXT NOT NULL DEFAULT 'approved',
  ADD COLUMN "approvedAt" TIMESTAMP(3),
  ADD COLUMN "approvedBy" UUID,
  ADD COLUMN "reviewNote" TEXT,
  ADD COLUMN "wantsMeeting" BOOLEAN NOT NULL DEFAULT true;

-- طابورُ الإدارة يقرأ المنتظِرَ وحدَه — لا يمسح الجدولَ كلَّه
CREATE INDEX "CohortSession_approvalState_startsAt_idx"
  ON "CohortSession" ("approvalState", "startsAt");
