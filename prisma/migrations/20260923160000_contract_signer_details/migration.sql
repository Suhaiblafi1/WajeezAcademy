-- عنوانُ الموقّع وهاتفُه بخطّه — بياناتُ طرفٍ في عقد، لا منقولةً من نموذج تقديمه.
ALTER TABLE "TrainerContract"
  ADD COLUMN "signerAddressAr" TEXT,
  ADD COLUMN "signerPhone"     TEXT;
