-- إعلانُ الإدارة إلى المدرّبين — نافذةٌ تُقرأ، ويُعلَم من قرأها (٤ أكتوبر ٢٠٢٦).
--
-- قرارُ صاحب المنصّة: «أعطهم النصيحةَ وتأكّد أنّهم قرؤوها — ولا تمنع أحدا».
-- واختار من ثلاثة خيارات: نافذةً فيها «قرأتُه»، وإشعارا في الجرس، وقائمةً بمن قرأ.
-- والمستقبِلون يُكتبون ساعةَ الإرسال، ومعهم متى رأى كلٌّ النافذةَ ومتى أكّد قراءتَها.

-- CreateTable
CREATE TABLE "TrainerAnnouncement" (
    "id" UUID NOT NULL,
    "titleAr" TEXT NOT NULL,
    "bodyAr" TEXT NOT NULL,
    "sentBy" UUID NOT NULL,
    "sentAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TrainerAnnouncement_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TrainerAnnouncementRecipient" (
    "announcementId" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "seenAt" TIMESTAMP(3),
    "readAt" TIMESTAMP(3),

    CONSTRAINT "TrainerAnnouncementRecipient_pkey" PRIMARY KEY ("announcementId","userId")
);

-- CreateIndex
CREATE INDEX "TrainerAnnouncement_sentAt_idx" ON "TrainerAnnouncement"("sentAt");

-- CreateIndex
CREATE INDEX "TrainerAnnouncementRecipient_userId_readAt_idx" ON "TrainerAnnouncementRecipient"("userId", "readAt");

-- AddForeignKey
ALTER TABLE "TrainerAnnouncementRecipient" ADD CONSTRAINT "TrainerAnnouncementRecipient_announcementId_fkey" FOREIGN KEY ("announcementId") REFERENCES "TrainerAnnouncement"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TrainerAnnouncementRecipient" ADD CONSTRAINT "TrainerAnnouncementRecipient_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
