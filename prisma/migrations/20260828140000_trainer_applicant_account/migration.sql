-- حساب «متقدّم مدرب» — يربط الطلب بصاحبه بدل رمزٍ يُنسخ ويُفقد.
--
-- كان المتقدّم يتابع طلبه برقم مرجعي ورمز مرشح ينسخهما من الشاشة. من فقدهما
-- فقد طلبه، ومن لم تصله رسالة البريد لم يرهما أصلا. والحساب يحفظها عنه.
--
-- ولا يُنشأ حساب متعلم: الدور trainer_applicant وحده، ولا يملك إلا رؤية طلبه.
--
-- العمود اختياري وفريد: الطلبات السابقة بلا حساب تبقى كما هي وتُتابع برمزها،
-- وحسابٌ واحد لكل طلب.
ALTER TABLE "TrainerApplication" ADD COLUMN IF NOT EXISTS "userId" UUID;

CREATE UNIQUE INDEX IF NOT EXISTS "TrainerApplication_userId_key"
  ON "TrainerApplication"("userId");

ALTER TABLE "TrainerApplication"
  ADD CONSTRAINT "TrainerApplication_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
