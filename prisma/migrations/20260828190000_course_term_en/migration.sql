-- المصطلح المهنيّ بالإنجليزية على إصدار الدورة — اختياريّ، ويمرّ بحاكمية
-- النسخ والنشر كسائر محتوى الإصدار.
ALTER TABLE "CourseVersion" ADD COLUMN IF NOT EXISTS "termEn" TEXT;
