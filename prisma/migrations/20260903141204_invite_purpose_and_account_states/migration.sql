-- الغرضُ يحدّد عمرَ الرمز: استعادةُ كلمةٍ ساعةً واحدة، ودعوةُ موظّفٍ سبعةَ أيّام.
-- (كانت الدعوةُ تستعمل رمزَ الاستعادة نفسَه، فتنتهي قبل أن يفتح المدعوُّ بريدَه.)
ALTER TABLE "PasswordResetToken" ADD COLUMN "purpose" TEXT NOT NULL DEFAULT 'reset';

-- يُقرأ عليه: «هل لهذا الحساب دعوةٌ سارية؟» في كلّ صفٍّ من قائمة المستخدمين
CREATE INDEX "PasswordResetToken_userId_purpose_usedAt_idx" ON "PasswordResetToken"("userId", "purpose", "usedAt");
