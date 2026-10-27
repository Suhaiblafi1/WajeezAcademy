-- AlterTable
ALTER TABLE "CohortTrainer" ADD COLUMN     "calendarSentAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "CohortSession" ADD COLUMN     "calendarAnnouncedAt" TIMESTAMP(3),
ADD COLUMN     "calendarWithdrawnAt" TIMESTAMP(3);
