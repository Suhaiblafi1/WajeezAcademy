-- ما نقترحه نحن على بطاقة المدرّب، ويقبله أو يرفضه (١٩ أكتوبر ٢٠٢٦).
--
-- نوعان بقرار صاحب المنصّة: «لماذا نفتخر به» جديدٌ يعدّله المدرّبُ أو يضيف إليه (وما عدّله
-- يعود إلينا)، ونبذتُه بصياغتنا بطاقةَ «قبل/بعد». والمقبولُ وحدَه يصل الصفحةَ العامّة:
-- `TrainerProfile.pitchLines` و`bioPublic`. والعلّةُ في `server/services/trainer-suggestion.service.ts`.

ALTER TABLE "TrainerProfile" ADD COLUMN "pitchLines" TEXT[] DEFAULT ARRAY[]::TEXT[];

CREATE TABLE "TrainerTextSuggestion" (
    "id" UUID NOT NULL,
    "profileId" UUID NOT NULL,
    "kind" TEXT NOT NULL DEFAULT 'pitch',
    "lines" TEXT[],
    "before" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "editedLines" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "status" TEXT NOT NULL DEFAULT 'pending',
    "noteAr" TEXT,
    "createdBy" UUID NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "decidedAt" TIMESTAMP(3),

    CONSTRAINT "TrainerTextSuggestion_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "TrainerTextSuggestion_profileId_kind_status_idx" ON "TrainerTextSuggestion"("profileId", "kind", "status");

ALTER TABLE "TrainerTextSuggestion" ADD CONSTRAINT "TrainerTextSuggestion_profileId_fkey" FOREIGN KEY ("profileId") REFERENCES "TrainerProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- والحالةُ والنوعُ مقيَّدان بتعليقهما في المخطّط (`scripts/status-checks.ts`)
ALTER TABLE "TrainerTextSuggestion" ADD CONSTRAINT "TrainerTextSuggestion_kind_allowed" CHECK ("kind" IN ('pitch', 'bio'));
ALTER TABLE "TrainerTextSuggestion" ADD CONSTRAINT "TrainerTextSuggestion_status_allowed" CHECK ("status" IN ('pending', 'edited', 'accepted', 'rejected', 'withdrawn'));
