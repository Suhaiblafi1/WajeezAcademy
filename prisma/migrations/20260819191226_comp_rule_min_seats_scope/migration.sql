-- AlterTable
ALTER TABLE "LearnerProfile" ALTER COLUMN "updatedAt" DROP DEFAULT;

-- AlterTable
ALTER TABLE "TrainerCompensationRule" ADD COLUMN     "cohortId" UUID,
ADD COLUMN     "courseId" TEXT,
ADD COLUMN     "minSeats" INTEGER NOT NULL DEFAULT 0;
