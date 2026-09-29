-- «التسويق» في بوّابة المدرّب: فيديوهاتُه وصورُه، وملصقاتٌ تصمّمها الإدارةُ ويوافق عليها (٢٩ سبتمبر ٢٠٢٦)


-- CreateTable
CREATE TABLE "TrainerMarketingVideo" (
    "id" UUID NOT NULL,
    "profileId" UUID NOT NULL,
    "targetKind" TEXT NOT NULL,
    "targetId" TEXT NOT NULL DEFAULT '',
    "url" TEXT NOT NULL,
    "noteAr" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TrainerMarketingVideo_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TrainerMarketingPhoto" (
    "id" UUID NOT NULL,
    "profileId" UUID NOT NULL,
    "storageKey" TEXT,
    "url" TEXT,
    "captionAr" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TrainerMarketingPhoto_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TrainerPoster" (
    "id" UUID NOT NULL,
    "profileId" UUID NOT NULL,
    "targetKind" TEXT NOT NULL,
    "targetId" TEXT NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,
    "storageKey" TEXT,
    "url" TEXT,
    "status" TEXT NOT NULL DEFAULT 'draft',
    "staffNoteAr" TEXT,
    "trainerNoteAr" TEXT,
    "createdBy" UUID,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "submittedAt" TIMESTAMP(3),
    "decidedAt" TIMESTAMP(3),

    CONSTRAINT "TrainerPoster_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "TrainerMarketingVideo_profileId_targetKind_targetId_key" ON "TrainerMarketingVideo"("profileId", "targetKind", "targetId");

-- CreateIndex
CREATE UNIQUE INDEX "TrainerMarketingPhoto_storageKey_key" ON "TrainerMarketingPhoto"("storageKey");

-- CreateIndex
CREATE INDEX "TrainerMarketingPhoto_profileId_idx" ON "TrainerMarketingPhoto"("profileId");

-- CreateIndex
CREATE UNIQUE INDEX "TrainerPoster_storageKey_key" ON "TrainerPoster"("storageKey");

-- CreateIndex
CREATE INDEX "TrainerPoster_profileId_targetKind_targetId_idx" ON "TrainerPoster"("profileId", "targetKind", "targetId");

-- CreateIndex
CREATE INDEX "TrainerPoster_status_idx" ON "TrainerPoster"("status");

-- AddForeignKey
ALTER TABLE "TrainerMarketingVideo" ADD CONSTRAINT "TrainerMarketingVideo_profileId_fkey" FOREIGN KEY ("profileId") REFERENCES "TrainerProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TrainerMarketingPhoto" ADD CONSTRAINT "TrainerMarketingPhoto_profileId_fkey" FOREIGN KEY ("profileId") REFERENCES "TrainerProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TrainerPoster" ADD CONSTRAINT "TrainerPoster_profileId_fkey" FOREIGN KEY ("profileId") REFERENCES "TrainerProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;


-- قيودُ الحالات — مولَّدةٌ بـ`scripts/status-checks.ts` من تعليق المخطّط
ALTER TABLE "TrainerPoster" DROP CONSTRAINT IF EXISTS "TrainerPoster_status_allowed";
ALTER TABLE "TrainerPoster" ADD CONSTRAINT "TrainerPoster_status_allowed" CHECK ("status" IN ('draft', 'pending', 'approved', 'changes_requested', 'superseded'));

-- وما يُقصَد به: مجموعةٌ مغلقةٌ لا يدخلها نوعٌ ثالثٌ بسهو
ALTER TABLE "TrainerMarketingVideo" ADD CONSTRAINT "TrainerMarketingVideo_targetKind_allowed" CHECK ("targetKind" IN ('bio', 'course', 'path'));
ALTER TABLE "TrainerPoster" ADD CONSTRAINT "TrainerPoster_targetKind_allowed" CHECK ("targetKind" IN ('course', 'path'));
-- والصورةُ ملفٌّ أو رابط، والملصقُ كذلك — لا صفٌّ بلا واحدٍ منهما
ALTER TABLE "TrainerMarketingPhoto" ADD CONSTRAINT "TrainerMarketingPhoto_has_source" CHECK ("storageKey" IS NOT NULL OR "url" IS NOT NULL);
