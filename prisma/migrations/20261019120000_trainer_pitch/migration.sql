-- «لماذا نفتخر به» — سطورٌ نكتبها نحن عن المدرّب، ويقبلها أو يرفضها (١٩ أكتوبر ٢٠٢٦).
--
-- قرارُ صاحب المنصّة: «أضف كلماتٍ تشجّع الناس لهذا المدرّب، والمدرّب يوافق أو يرفض التعديل».
-- فالمقبولُ في `TrainerProfile.pitchLines` وحدَه يصل الصفحةَ العامّة، والمقترَحُ بطاقةُ «قبل/بعد»
-- في `TrainerPitchSuggestion`. والعلّةُ في `server/services/trainer-pitch.service.ts`.

ALTER TABLE "TrainerProfile" ADD COLUMN "pitchLines" TEXT[] DEFAULT ARRAY[]::TEXT[];

CREATE TABLE "TrainerPitchSuggestion" (
    "id" UUID NOT NULL,
    "profileId" UUID NOT NULL,
    "lines" TEXT[],
    "before" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "status" TEXT NOT NULL DEFAULT 'pending',
    "noteAr" TEXT,
    "createdBy" UUID NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "decidedAt" TIMESTAMP(3),

    CONSTRAINT "TrainerPitchSuggestion_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "TrainerPitchSuggestion_profileId_status_idx" ON "TrainerPitchSuggestion"("profileId", "status");

ALTER TABLE "TrainerPitchSuggestion" ADD CONSTRAINT "TrainerPitchSuggestion_profileId_fkey" FOREIGN KEY ("profileId") REFERENCES "TrainerProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- والحالةُ مقيَّدةٌ بتعليقها في المخطّط (`scripts/status-checks.ts`)
ALTER TABLE "TrainerPitchSuggestion" ADD CONSTRAINT "TrainerPitchSuggestion_status_allowed" CHECK ("status" IN ('pending', 'accepted', 'rejected', 'withdrawn'));
