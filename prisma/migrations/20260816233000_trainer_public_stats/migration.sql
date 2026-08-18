-- AlterTable
ALTER TABLE "TrainerProfile" ADD COLUMN     "graduatesCount" INTEGER,
ADD COLUMN     "hoursTaught" INTEGER,
ADD COLUMN     "photoUrl" TEXT,
ADD COLUMN     "ratingAvg" DOUBLE PRECISION,
ADD COLUMN     "ratingCount" INTEGER;
