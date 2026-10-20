-- AlterTable
ALTER TABLE "Lead" ADD COLUMN     "careerLevel" TEXT,
ADD COLUMN     "interests" TEXT[] DEFAULT ARRAY[]::TEXT[];
