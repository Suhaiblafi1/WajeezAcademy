-- ═══ دوراتُ كلّ منحةٍ يختارها المدير لصفحتها (١٥ نوفمبر ٢٠٢٦) ═══
--
-- قرارُ صاحب المنصّة: يختار المديرُ دوراتِ كلّ حملة، فلا تُعرض في صفحتها إلّا هي — والكودُ يخصم على أيّ دورةٍ حتى
-- حدّه كما كان («Discount all courses»). والفارغُ تلقائيّ كما كان. ولكلّ مؤثّرٍ بعضُ دورات حملته لصفحته.
-- والقاعدةُ كلُّها في `src/application/commerce/grant-scope.ts`.
--
-- إضافيٌّ كلُّه بقائمةٍ فارغةٍ تُبقي ما كان كما كان.

ALTER TABLE "GrantCampaign" ADD COLUMN "courseIds" TEXT[] DEFAULT ARRAY[]::TEXT[];

ALTER TABLE "Influencer" ADD COLUMN "courseIds" TEXT[] DEFAULT ARRAY[]::TEXT[];
