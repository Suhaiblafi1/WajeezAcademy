-- ترتيبُ مهارات الدورة كما في المصدر — والأولى شارتُها. يملؤه `catalog:import` في النشر التالي.
-- AlterTable
ALTER TABLE "CourseSkillLink" ADD COLUMN     "sequence" INTEGER NOT NULL DEFAULT 0;
