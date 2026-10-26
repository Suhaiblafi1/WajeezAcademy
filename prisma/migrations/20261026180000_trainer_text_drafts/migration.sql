-- مسوّدةُ ما نقترحه على بطاقة المدرّب — تُرفع من الشاشة، لا تُكتب في الشيفرة (٢٦ أكتوبر ٢٠٢٦).
--
-- كانت مسوّداتُ «لماذا نفتخر به» والنبذةِ ثابتةً في `server/services/trainer-suggestion-drafts.ts`، فكلُّ جولةٍ نشرُ
-- شيفرة. فصارت تُرفع ملفّا من «المدربون»، والأحدثُ لكلّ مدرّبٍ ونوعٍ مكانَ ما قبله (`trainer-drafts.service.ts`).

CREATE TABLE "TrainerTextDraft" (
    "id" UUID NOT NULL,
    "profileId" UUID NOT NULL,
    "kind" TEXT NOT NULL,
    "lines" TEXT[],
    "uploadedBy" UUID NOT NULL,
    "uploadedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TrainerTextDraft_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "TrainerTextDraft_profileId_kind_key" ON "TrainerTextDraft"("profileId", "kind");

ALTER TABLE "TrainerTextDraft" ADD CONSTRAINT "TrainerTextDraft_profileId_fkey" FOREIGN KEY ("profileId") REFERENCES "TrainerProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- والنوعُ مقيَّدٌ بتعليقه في المخطّط (`scripts/status-checks.ts`)
ALTER TABLE "TrainerTextDraft" ADD CONSTRAINT "TrainerTextDraft_kind_allowed" CHECK ("kind" IN ('pitch', 'bio'));
