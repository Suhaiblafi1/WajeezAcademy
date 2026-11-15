-- ═══ دوراتُ كلّ منحةٍ يختارها المدير (١٥ نوفمبر ٢٠٢٦) ═══
--
-- قرارُ صاحب المنصّة: يختار المديرُ دوراتِ كلّ حملة، فلا تُعرض في صفحتها ولا يخصم كودُها إلّا عليها، وما سواها في
-- السلّة بسعره كاملا. والفارغُ تلقائيّ كما كان. ولكلّ مؤثّرٍ بعضُ دورات حملته. والكودُ الذي دُفع به مرّةً يثبت على
-- دوراته يومها. والقاعدةُ كلُّها في `src/application/commerce/grant-scope.ts`.
--
-- إضافيٌّ كلُّه بقيمٍ افتراضيّةٍ تُبقي ما كان كما كان: قائمةٌ فارغة (تلقائيّة)، وكودٌ لم يثبت، وبندٌ داخلَ المنحة.

ALTER TABLE "GrantCampaign" ADD COLUMN "courseIds" TEXT[] DEFAULT ARRAY[]::TEXT[];

ALTER TABLE "Influencer" ADD COLUMN "courseIds" TEXT[] DEFAULT ARRAY[]::TEXT[];

ALTER TABLE "GrantCode" ADD COLUMN "firstPaidAt" TIMESTAMP(3),
ADD COLUMN "allCoursesAtFirstPaid" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN "courseIdsAtFirstPaid" TEXT[] DEFAULT ARRAY[]::TEXT[];

ALTER TABLE "OrderItem" ADD COLUMN "outsideGrant" BOOLEAN NOT NULL DEFAULT false;
