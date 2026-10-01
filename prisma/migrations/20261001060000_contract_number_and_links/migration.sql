-- ═══ رقمُ العقد، وسجلُّ روابط التوقيع (١ أكتوبر ٢٠٢٦) ═══
--
-- ① رقمُ العقد `WJ-CT-<سنة>-<خمسة أرقام>` من تسلسلٍ في القاعدة — فلا يأخذ
--    عقدان رقما واحدا ولو رُكّبا في اللحظة نفسِها. والدالّةُ نفسُها تملأ
--    العمودَ إن لم يُمرَّر، ويأخذ منها من يحتاج الرقمَ قبل الإنشاء.
--    والسنةُ بتوقيت عمّان: الإزاحةُ `+03:00` عددٌ لا اسمُ منطقة — فلا تتعلّق
--    الدالّةُ ببيانات المناطق في صورة القاعدة (والأردنُّ على +3 طوالَ العام).
-- ② والعقودُ القائمةُ تُرقَّم بترتيب إنشائها، وسنةُ كلٍّ سنةُ إنشائه.
-- ③ وكلُّ رابطِ توقيعٍ يُصرف بعد اليوم يُحفَظ (بصمتُه) — والحيُّ اليومَ يُحفَظ
--    هنا، فإذا استُبدل بعد اليوم قال القديمُ حالَ عقده.

CREATE SEQUENCE "TrainerContract_number_seq";

CREATE FUNCTION next_trainer_contract_number() RETURNS TEXT LANGUAGE sql VOLATILE AS $$
  SELECT 'WJ-CT-' || to_char(CURRENT_TIMESTAMP AT TIME ZONE INTERVAL '+03:00', 'YYYY') || '-'
      || lpad(s.n::text, greatest(5, length(s.n::text)), '0')
  FROM (SELECT nextval('"TrainerContract_number_seq"') AS n) AS s
$$;

ALTER TABLE "TrainerContract" ADD COLUMN "number" TEXT;

UPDATE "TrainerContract" AS t
SET "number" = 'WJ-CT-' || to_char(o."createdAt" + INTERVAL '3 hours', 'YYYY') || '-'
    || lpad(o.n::text, greatest(5, length(o.n::text)), '0')
FROM (
  SELECT "id", "createdAt", row_number() OVER (ORDER BY "createdAt", "id") AS n
  FROM "TrainerContract"
) AS o
WHERE o."id" = t."id";

SELECT setval('"TrainerContract_number_seq"', (SELECT count(*) FROM "TrainerContract") + 1, false);

ALTER TABLE "TrainerContract" ALTER COLUMN "number" SET DEFAULT next_trainer_contract_number();
ALTER TABLE "TrainerContract" ALTER COLUMN "number" SET NOT NULL;
CREATE UNIQUE INDEX "TrainerContract_number_key" ON "TrainerContract"("number");

CREATE TABLE "TrainerContractLink" (
    "id" UUID NOT NULL,
    "contractId" UUID NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "purpose" TEXT NOT NULL,
    "sentTo" TEXT,
    "expiresAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TrainerContractLink_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "TrainerContractLink_tokenHash_key" ON "TrainerContractLink"("tokenHash");
CREATE INDEX "TrainerContractLink_contractId_createdAt_idx" ON "TrainerContractLink"("contractId", "createdAt");

ALTER TABLE "TrainerContractLink" ADD CONSTRAINT "TrainerContractLink_contractId_fkey" FOREIGN KEY ("contractId") REFERENCES "TrainerContract"("id") ON DELETE CASCADE ON UPDATE CASCADE;

INSERT INTO "TrainerContractLink" ("id", "contractId", "tokenHash", "purpose", "sentTo", "expiresAt", "createdAt")
SELECT gen_random_uuid(), "id", "tokenHash", 'backfill', "signerEmail", "tokenExpiresAt", COALESCE("sentAt", "createdAt")
FROM "TrainerContract"
WHERE "tokenHash" IS NOT NULL;

-- مولَّدٌ من تعليق المخطّط: npx tsx scripts/status-checks.ts
ALTER TABLE "TrainerContractLink" DROP CONSTRAINT IF EXISTS "TrainerContractLink_purpose_allowed";
ALTER TABLE "TrainerContractLink" ADD CONSTRAINT "TrainerContractLink_purpose_allowed" CHECK ("purpose" IN ('sent', 'resend', 'final_reminder', 'link_request', 'amendment_reply', 'backfill'));
