-- محورا اللقاء — «ولكلّ لقاءٍ محورٌ أو محوران» (٢٧ سبتمبر ٢٠٢٦)
--
-- والعلّةُ كاملةً في تعليق الحقل في المخطّط (`CohortSession.moduleIds`).

ALTER TABLE "CohortSession" ADD COLUMN "moduleIds" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];

-- ما رُبط قبل العمود بمحورٍ واحدٍ يُحمل كما هو — ولا يُلفَّق محورٌ لما لم يُربط.
UPDATE "CohortSession"
SET "moduleIds" = ARRAY["moduleId"]
WHERE "moduleId" IS NOT NULL AND "moduleId" <> '';
