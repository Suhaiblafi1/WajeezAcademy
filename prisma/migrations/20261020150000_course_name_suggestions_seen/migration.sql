-- AlterTable
ALTER TABLE "Course" ADD COLUMN     "nameSuggestionsSeen" TEXT[] DEFAULT ARRAY[]::TEXT[];
