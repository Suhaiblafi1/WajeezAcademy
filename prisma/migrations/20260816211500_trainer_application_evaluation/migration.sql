-- AlterTable
ALTER TABLE "TrainerApplication" ADD COLUMN     "accreditationDetails" TEXT,
ADD COLUMN     "hasAccreditation" BOOLEAN,
ADD COLUMN     "instagramUrl" TEXT,
ADD COLUMN     "targetAudiences" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN     "targetCountries" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN     "youtubeUrl" TEXT;

