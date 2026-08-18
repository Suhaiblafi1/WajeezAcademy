-- AlterTable
ALTER TABLE "PathwayVersion" ALTER COLUMN "weeklyHours" SET DATA TYPE TEXT;

-- AlterTable
ALTER TABLE "Question" ADD COLUMN     "moduleId" TEXT,
ADD COLUMN     "moduleName" TEXT,
ADD COLUMN     "optionsKey" TEXT,
ADD COLUMN     "personaScope" JSONB NOT NULL DEFAULT '[]',
ADD COLUMN     "requiredLevel" TEXT NOT NULL DEFAULT 'core',
ADD COLUMN     "sensitivityLevel" TEXT NOT NULL DEFAULT 'low',
ADD COLUMN     "weight" DOUBLE PRECISION NOT NULL DEFAULT 1;
