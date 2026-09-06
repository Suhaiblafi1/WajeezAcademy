-- سجلُّ محاولاتِ التسجيل الذاتيّ (سقفُ التسجيل — قرارُ صاحب المنصّة ٤ سبتمبر).
-- سقفان مختلفا الطبيعة على مفتاحِ الشبكة: حجمُ ما أُنشئ فعلا (٤٠/ساعة و١٠٠/يوم)
-- يمنع مصنعَ الحسابات الوهميّة، وعددُ ما ارتدّ بـ«البريد مسجَّل» (١٠/ربع ساعة)
-- يمنع إحصاءَ البريد. ولا يُخزَّن البريدُ المُجرَّب.
CREATE TABLE "RegistrationAttempt" (
    "id" UUID NOT NULL,
    "ip" TEXT,
    "outcome" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RegistrationAttempt_pkey" PRIMARY KEY ("id")
);

-- كِلا السقفَين يعدُّ بمفتاحِ العنوان في نافذةٍ زمنيّة، وهو على مسار كلّ تسجيل.
CREATE INDEX "RegistrationAttempt_ip_createdAt_idx" ON "RegistrationAttempt"("ip", "createdAt");

-- التعليقُ عقدٌ (المهمّة ٦٢): قيمُ العمود مقيَّدةٌ في القاعدة لا في التعليق وحدَه.
ALTER TABLE "RegistrationAttempt" DROP CONSTRAINT IF EXISTS "RegistrationAttempt_outcome_allowed";
ALTER TABLE "RegistrationAttempt" ADD CONSTRAINT "RegistrationAttempt_outcome_allowed" CHECK ("outcome" IN ('created', 'taken'));
