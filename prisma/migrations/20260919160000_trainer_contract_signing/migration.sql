-- المدرّبُ يوقّع عقدَه بنفسه — رابطٌ ودليلُ توقيعٍ ووثائقُ هويّة.
--
-- كان التوقيعُ فعلَ مسؤولٍ يسجّله بالنيابة عن المدرّب، فلا إقرارَ من صاحبه
-- ولا وثيقةَ رآها. وهذه المرحلةُ تفتح له البابَ ليقرأ ويوقّع ويرفع.
--
-- والأعمدةُ كلُّها تقبل الفراغَ فلا تُقفل على صفٍّ سابق. والجدولُ الجديد
-- يُنشأ فارغا.
--
-- والتصميمُ في docs/superpowers/specs/2026-09-19-trainer-contract-design.md

ALTER TABLE "TrainerContract"
  ADD COLUMN "tokenHash"       TEXT,
  ADD COLUMN "tokenExpiresAt"  TIMESTAMP(3),
  ADD COLUMN "firstOpenedAt"   TIMESTAMP(3),
  ADD COLUMN "lastOpenedAt"    TIMESTAMP(3),
  ADD COLUMN "remindedAt"      TIMESTAMP(3),
  ADD COLUMN "signerLegalName" TEXT,
  ADD COLUMN "signerIp"        TEXT,
  ADD COLUMN "signerUserAgent" TEXT,
  ADD COLUMN "consentTextAr"   TEXT,
  ADD COLUMN "signedBodyHash"  TEXT,
  ADD COLUMN "declinedAt"      TIMESTAMP(3),
  ADD COLUMN "declineReasonAr" TEXT;

-- رمزٌ واحدٌ لا يتكرّر — ولا يُخزَّن إلّا هاشُه
CREATE UNIQUE INDEX "TrainerContract_tokenHash_key" ON "TrainerContract"("tokenHash");

-- ═══ وثيقةُ الهويّة تُرفع مع التوقيع، لا مع الطلب ═══
--
-- ومفتاحُ التخزين فريدٌ كما في `TrainerApplicationDocument`: المخزنُ يبحث
-- بالمفتاح عن مالكه (`resolveStorageOwner`)، ومفتاحٌ لمالكَين لا يُحسَم.
CREATE TABLE "TrainerContractDocument" (
    "id"           UUID NOT NULL,
    "contractId"   UUID NOT NULL,
    "kind"         TEXT NOT NULL,
    "storageKey"   TEXT NOT NULL,
    "originalName" TEXT NOT NULL,
    "mime"         TEXT NOT NULL,
    "sizeBytes"    INTEGER NOT NULL,
    "uploadedAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastViewedAt" TIMESTAMP(3),

    CONSTRAINT "TrainerContractDocument_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "TrainerContractDocument_storageKey_key" ON "TrainerContractDocument"("storageKey");
CREATE INDEX "TrainerContractDocument_contractId_idx" ON "TrainerContractDocument"("contractId");

ALTER TABLE "TrainerContractDocument"
  ADD CONSTRAINT "TrainerContractDocument_contractId_fkey"
  FOREIGN KEY ("contractId") REFERENCES "TrainerContract"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- قيودُ الحالات مولَّدةٌ بـ`npx tsx scripts/status-checks.ts` لا مكتوبةٌ باليد
ALTER TABLE "TrainerContract" DROP CONSTRAINT IF EXISTS "TrainerContract_status_allowed";
ALTER TABLE "TrainerContract" ADD CONSTRAINT "TrainerContract_status_allowed" CHECK ("status" IN ('draft', 'sent', 'declined', 'revoked', 'signed', 'expired', 'terminated'));

ALTER TABLE "TrainerContractDocument" DROP CONSTRAINT IF EXISTS "TrainerContractDocument_kind_allowed";
ALTER TABLE "TrainerContractDocument" ADD CONSTRAINT "TrainerContractDocument_kind_allowed" CHECK ("kind" IN ('national_id', 'passport', 'residence_permit', 'teaching_certificate', 'degree', 'experience_letter', 'other'));
