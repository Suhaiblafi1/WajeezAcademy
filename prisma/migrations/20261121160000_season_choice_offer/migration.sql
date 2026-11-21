-- ═══ اختيارُ الموسم لشعب الموسم الأوّل — سؤالٌ واحدٌ للمدرّب بثلاثة أجوبة (٢١ نوفمبر ٢٠٢٦) ═══
--
-- قرارُ صاحب المنصّة: كلُّ مدرّبٍ له شعبةٌ لم تبدأ يختار من صفحته: يؤجّلها إلى الربيع (أبريل–مايو ٢٠٢٧)، أو إلى
-- موسمٍ لاحق (يوليو–أغسطس أو أكتوبر–نوفمبر)، أو يلغيها بلا التزام. ومن لم يختر حتّى المهلة تُلغى شعبتُه («b»).
-- فيتّسع جدولُ اقتراح التأجيل لنوعٍ ثانٍ بدل جدولٍ موازٍ. والعلّةُ في `src/application/trainer/season-choice.ts`.

ALTER TABLE "CohortPostponeOffer" ADD COLUMN "kind" TEXT NOT NULL DEFAULT 'next_month';
ALTER TABLE "CohortPostponeOffer" ADD COLUMN "choices" JSONB;
ALTER TABLE "CohortPostponeOffer" ADD COLUMN "chosenYear" INTEGER;
ALTER TABLE "CohortPostponeOffer" ADD COLUMN "chosenSeason" TEXT;

-- وشعبةُ الإعداد بلا موعدٍ بعد تُسأل كغيرها — وموعدُها بعد الحسم لا يُعرف حتّى يختار
ALTER TABLE "CohortPostponeOffer" ALTER COLUMN "fromFirstAt" DROP NOT NULL;
ALTER TABLE "CohortPostponeOffer" ALTER COLUMN "toFirstAt" DROP NOT NULL;

-- والنوعُ مقيَّدٌ بتعليقه في المخطّط (`scripts/status-checks.ts`)
ALTER TABLE "CohortPostponeOffer" DROP CONSTRAINT IF EXISTS "CohortPostponeOffer_kind_allowed";
ALTER TABLE "CohortPostponeOffer" ADD CONSTRAINT "CohortPostponeOffer_kind_allowed" CHECK ("kind" IN ('next_month', 'season_choice'));
