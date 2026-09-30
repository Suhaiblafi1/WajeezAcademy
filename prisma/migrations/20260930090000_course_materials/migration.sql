-- موادُّ الدورة في طور العرض المشروط: يكتبها المدرّبُ في «مؤهّلاتي» (٣٠ سبتمبر ٢٠٢٦)
ALTER TABLE "TrainerCourseQualification" ADD COLUMN "materials" JSONB;
ALTER TABLE "TrainerCourseQualification" ADD COLUMN "materialsAt" TIMESTAMP(3);
