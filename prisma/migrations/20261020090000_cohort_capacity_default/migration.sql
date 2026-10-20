-- سعةُ الشعبة ٢٠ دائما — قرارُ صاحب المنصّة (٢٠ أكتوبر ٢٠٢٦): «إذا كانت للشعبة سعرٌ فالسعةُ ٢٠، لا داعي أن أكتبها»
ALTER TABLE "Cohort" ALTER COLUMN "capacity" SET DEFAULT 20;
UPDATE "Cohort" SET "capacity" = 20 WHERE "capacity" IS NULL AND "price" IS NOT NULL;
