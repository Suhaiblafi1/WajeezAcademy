-- AlterTable
ALTER TABLE "TrainerAnnouncement" ADD COLUMN     "byEmail" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "TrainerAnnouncementRecipient" ADD COLUMN     "emailedAt" TIMESTAMP(3);
