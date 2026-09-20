-- حسابُ المدرّب البنكيّ — يكتبه بنفسه في بوّابته، ويُخزَّن معمّى.
--
-- إضافيّةٌ كلُّها: جدولٌ جديدٌ وعمودٌ يقبل الفراغَ على `TrainerPayout`.
-- ولا صفَّ قائمٌ يتأثّر، ولا جدولٌ حيٌّ يُقفَل.
--
-- ⚠️ والفهرسُ الجزئيُّ أدناه هو **الضمانُ الوحيد** لأنّ الفعّالَ واحد.
-- وPrisma لا تعرفه (لا تعبّر عن `WHERE` في `@@unique`)، فـ`prisma migrate
-- dev` تُسقطه صامتةً في أيّ توليدٍ لاحق. ويحرسه
-- `server/tests/trainer/bank-account.test.ts` بقراءة `pg_indexes` فعلا —
-- فمن أسقطه يراه أحمرَ لا بعد شهرٍ في صفَّين فعّالَين لرجلٍ واحد.

CREATE TABLE "TrainerBankAccount" (
    "id"           UUID         NOT NULL,
    "profileId"    UUID         NOT NULL,
    "status"       TEXT         NOT NULL DEFAULT 'active',
    "ibanSealed"   TEXT         NOT NULL,
    "tail4"        TEXT         NOT NULL,
    "countryCode"  VARCHAR(2)   NOT NULL,
    "holderName"   TEXT         NOT NULL,
    "bankNameAr"   TEXT         NOT NULL,
    "branchAr"     TEXT,
    "swiftBic"     TEXT,
    "outcome"      TEXT         NOT NULL DEFAULT 'unverifiable',
    "outcomeScore" INTEGER      NOT NULL DEFAULT 0,
    "setBy"        UUID,
    "createdAt"    TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "supersededAt" TIMESTAMP(3),
    "lastRevealAt" TIMESTAMP(3),

    CONSTRAINT "TrainerBankAccount_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "TrainerBankAccount_profileId_status_idx"
  ON "TrainerBankAccount"("profileId", "status");

-- فعّالٌ واحدٌ لكلّ مدرّب — لا صفّان يتنازعان على أين يذهب المال
CREATE UNIQUE INDEX "TrainerBankAccount_one_active"
  ON "TrainerBankAccount"("profileId") WHERE "status" = 'active';

ALTER TABLE "TrainerBankAccount" ADD CONSTRAINT "TrainerBankAccount_profileId_fkey"
  FOREIGN KEY ("profileId") REFERENCES "TrainerProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- والمستحقُّ يقول إلى أيِّ نسخةِ حسابٍ ذهب
ALTER TABLE "TrainerPayout" ADD COLUMN "bankAccountId" UUID;
ALTER TABLE "TrainerPayout" ADD CONSTRAINT "TrainerPayout_bankAccountId_fkey"
  FOREIGN KEY ("bankAccountId") REFERENCES "TrainerBankAccount"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- قيودُ الحالات مولَّدةٌ بـ`scripts/status-checks.ts` لا مكتوبةٌ باليد
ALTER TABLE "TrainerBankAccount" DROP CONSTRAINT IF EXISTS "TrainerBankAccount_status_allowed";
ALTER TABLE "TrainerBankAccount" ADD CONSTRAINT "TrainerBankAccount_status_allowed" CHECK ("status" IN ('active', 'superseded'));

ALTER TABLE "TrainerBankAccount" DROP CONSTRAINT IF EXISTS "TrainerBankAccount_outcome_allowed";
ALTER TABLE "TrainerBankAccount" ADD CONSTRAINT "TrainerBankAccount_outcome_allowed" CHECK ("outcome" IN ('matches', 'differs', 'unverifiable'));
