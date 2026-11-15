-- ═══ تقييمُ المستشار مرّةً لكلّ متعلّم (١٥ نوفمبر ٢٠٢٦، قرارُ صاحب المنصّة «One per learner») ═══
--
-- كان تقييمُ المستشار يُعلَّق بأحد تسجيلات المتعلّم، والمفتاحُ الفريدُ بالتسجيل — فمن له أكثرُ من تسجيلٍ قيّم المستشارَ
-- أكثرَ من مرّة، وكلُّها تُعدّ في معدّله. فيُبقى لكلّ متعلّمٍ ومستشارٍ أحدثُ تقييمٍ كتبه ويُمحى ما قبله، ثمّ فهرسٌ فريدٌ
-- يمنع الثاني. والخدمةُ تُحدِّث تقييمَه السابقَ بدل أن تكتب جديدا (`RatingService.submit`).

DELETE FROM "Rating" r
USING "Rating" newer
WHERE r."subjectType" = 'advisor'
  AND newer."subjectType" = 'advisor'
  AND newer."raterId" = r."raterId"
  AND newer."subjectId" = r."subjectId"
  AND (newer."createdAt" > r."createdAt" OR (newer."createdAt" = r."createdAt" AND newer."id" > r."id"));

CREATE UNIQUE INDEX IF NOT EXISTS "Rating_advisor_one_per_rater"
  ON "Rating" ("raterId", "subjectId") WHERE "subjectType" = 'advisor';
