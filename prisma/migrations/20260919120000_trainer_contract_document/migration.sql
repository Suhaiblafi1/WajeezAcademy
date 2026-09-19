-- عقدُ المدرّب يصير وثيقةً: متنٌ مجمَّدٌ وهاشُه، ولقطةُ المال ولقطةُ الدورات.
--
-- كان العقدُ عنوانا وحالةً وتاريخين، و`terms` لا يقرؤه شيء. فالمدرّبُ لم يرَ
-- وثيقةً قطّ، والمسؤولُ يسجّل توقيعَه بالنيابة عنه.
--
-- والأعمدةُ كلُّها إضافيّةٌ تقبل الفراغَ عدا `updatedAt` و`kind` و`revision`
-- و`currency` و`gatesActivation` — ولكلٍّ منها افتراضٌ يملأ الصفوفَ القائمة،
-- فلا يُقفل الترحيلُ على صفٍّ سابق.
--
-- والتصميمُ في docs/superpowers/specs/2026-09-19-trainer-contract-design.md

ALTER TABLE "TrainerContract"
  ADD COLUMN "kind"                     TEXT NOT NULL DEFAULT 'original',
  ADD COLUMN "revision"                 INTEGER NOT NULL DEFAULT 1,
  ADD COLUMN "parentId"                 UUID,
  ADD COLUMN "bodyVersion"              TEXT,
  ADD COLUMN "bodyAr"                   TEXT,
  ADD COLUMN "bodyHash"                 TEXT,
  ADD COLUMN "compensationRuleId"       UUID,
  ADD COLUMN "compensationType"         TEXT,
  ADD COLUMN "compensationRate"         DECIMAL(10,2),
  ADD COLUMN "currency"                 TEXT NOT NULL DEFAULT 'USD',
  ADD COLUMN "compensationMinSeats"     INTEGER,
  ADD COLUMN "compensationReferralRate" DECIMAL(10,2),
  ADD COLUMN "hoursNoteAr"              TEXT,
  ADD COLUMN "rateWaivedReasonAr"       TEXT,
  ADD COLUMN "qualifiedSnapshot"        JSONB,
  ADD COLUMN "requiredDocuments"        JSONB,
  ADD COLUMN "signerEmail"              TEXT,
  ADD COLUMN "gatesActivation"          BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN "revokedAt"                TIMESTAMP(3),
  ADD COLUMN "revokedBy"                UUID,
  ADD COLUMN "revokeReasonAr"           TEXT,
  ADD COLUMN "updatedAt"                TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- سلسلةُ الملاحق: الملحقُ يشير إلى أبيه، ولا يُحذف أبٌ له ذرّيّة.
ALTER TABLE "TrainerContract"
  ADD CONSTRAINT "TrainerContract_parentId_fkey"
  FOREIGN KEY ("parentId") REFERENCES "TrainerContract"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE INDEX "TrainerContract_status_sentAt_idx" ON "TrainerContract"("status", "sentAt");
CREATE INDEX "TrainerContract_parentId_idx" ON "TrainerContract"("parentId");

-- ═══ عقدٌ مفتوحٌ واحدٌ لكلّ مدرّب ═══
--
-- `createContract` القديمةُ تُنشئ الصفَّ ثمّ تنقل الحالة، بلا معاملةٍ ولا قيد.
-- فنقرتان متزامنتان تُنتجان عقدين حالتُهما `sent`، والنقلُ الثاني يسكت لأنّ
-- `transition()` تعود صامتةً حين `from === to`. ثمّ يوقّع المدرّبُ أحدَهما
-- ويبقى الآخرُ قائما يُوقَّع بعده.
--
-- والشرطُ يقتصر على ما له متنٌ مجمَّد (`bodyAr IS NOT NULL`) بقصد: الصفوفُ
-- التي سبقت هذا الترحيل قد يكون منها اثنان لمدرّبٍ واحد، وقيدٌ يشملها يُفشل
-- الترحيلَ على قاعدةٍ حيّةٍ لا يُصلح شيئا. فالقديمُ يبقى كما هو، والجديدُ
-- محروسٌ من يومه.
CREATE UNIQUE INDEX "TrainerContract_one_open_per_profile"
  ON "TrainerContract"("profileId")
  WHERE "status" IN ('draft', 'sent') AND "bodyAr" IS NOT NULL;

-- قيودُ الحالات مولَّدةٌ بـ`npx tsx scripts/status-checks.ts` لا مكتوبةٌ باليد
ALTER TABLE "TrainerContract" DROP CONSTRAINT IF EXISTS "TrainerContract_kind_allowed";
ALTER TABLE "TrainerContract" ADD CONSTRAINT "TrainerContract_kind_allowed" CHECK ("kind" IN ('original', 'annex', 'replacement'));

ALTER TABLE "TrainerContract" DROP CONSTRAINT IF EXISTS "TrainerContract_status_allowed";
ALTER TABLE "TrainerContract" ADD CONSTRAINT "TrainerContract_status_allowed" CHECK ("status" IN ('draft', 'sent', 'revoked', 'signed', 'expired', 'terminated'));
