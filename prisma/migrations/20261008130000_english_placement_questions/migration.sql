-- أسئلةُ اختبار تحديد مستوى الإنجليزيّة (٨ أكتوبر ٢٠٢٦).
--
-- قرارُ صاحب المنصّة سؤالا سؤالا: اختبارٌ على المنصّة، ثلاثون سؤالا (قواعد · مفردات ·
-- قراءة)، أكتبه مسوّدةً ويراجعه مدرّبُ الإنجليزيّة في بوّابته خلف صلاحيّةٍ جديدة
-- `placement.review` — ولا يُعرض على متعلّمٍ حتّى يُعتمَد.
--
-- والجدولُ يُملأ بمستورد الكتالوج (`server/catalog/placement-importer.ts`) إنشاءً لا
-- تحديثا: ما عدّله المراجعُ لا يمحوه نشرٌ تالٍ. والقيدان مولَّدان من تعليقَي العمودين
-- بـ`scripts/status-checks.ts` لا مكتوبان باليد.

CREATE TABLE "PlacementQuestion" (
    "id" TEXT NOT NULL,
    "level" TEXT NOT NULL,
    "skill" TEXT NOT NULL,
    "passageEn" TEXT,
    "stemEn" TEXT NOT NULL,
    "options" JSONB NOT NULL,
    "answerIndex" INTEGER NOT NULL,
    "position" INTEGER NOT NULL DEFAULT 0,
    "status" TEXT NOT NULL DEFAULT 'draft',
    "reviewNoteAr" TEXT,
    "reviewedBy" UUID,
    "reviewedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PlacementQuestion_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "PlacementQuestion_status_level_idx" ON "PlacementQuestion"("status", "level");

ALTER TABLE "PlacementQuestion" DROP CONSTRAINT IF EXISTS "PlacementQuestion_level_allowed";
ALTER TABLE "PlacementQuestion" ADD CONSTRAINT "PlacementQuestion_level_allowed" CHECK ("level" IN ('a1', 'a2', 'b1', 'b2', 'c1'));
ALTER TABLE "PlacementQuestion" DROP CONSTRAINT IF EXISTS "PlacementQuestion_status_allowed";
ALTER TABLE "PlacementQuestion" ADD CONSTRAINT "PlacementQuestion_status_allowed" CHECK ("status" IN ('draft', 'approved', 'retired'));
