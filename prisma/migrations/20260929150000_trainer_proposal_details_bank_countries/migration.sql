-- أسئلةُ فورم الدورة المقترحة، وحسابٌ بنكيٌّ يصلح لكلّ الدول (٢٩ سبتمبر ٢٠٢٦)
ALTER TABLE "TrainerCourseProposal" ADD COLUMN "details" JSONB;

ALTER TABLE "TrainerBankAccount" ADD COLUMN "accountKind" TEXT NOT NULL DEFAULT 'iban';
ALTER TABLE "TrainerBankAccount" ADD COLUMN "routingCode" TEXT;
ALTER TABLE "TrainerBankAccount" ADD COLUMN "ownNameConfirmedAt" TIMESTAMP(3);
