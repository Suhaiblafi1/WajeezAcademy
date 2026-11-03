-- ═══ توثيقُ البريد واحدٌ للإنسان، لا اثنان (٣ نوفمبر ٢٠٢٦) ═══
--
-- سأل صاحبُ المنصّة: «لماذا يستلم المستخدم ايميل توثيق حسابه بالرغم انه موثق فعلا». والعلّة أنّ للمدرّب
-- المتقدّم عَلَمَي توثيقٍ لا يعرف أحدُهما الآخر: `TrainerApplication.emailVerifiedAt` (رابطُ رسالة الطلب) و
-- `User.emailVerifiedAt` (رابطُ «وثّق بريدك»). فمن وثّق من رسالة طلبه بقي حسابُه «غيرَ موثَّق» فطرقه عاملُ
-- التذكير. والشيفرةُ تكتب كلًّا منهما في الآخر الآن (`server/services/email-proof.ts`)، وهذا لما وُثّق قبلها —
-- في الاتّجاهين، وبشرط البريد نفسِه: توثيقُ عنوانٍ لا يوثّق غيرَه. ويُعاد فلا يفسد: لا يمسّ إلّا الفارغ.

UPDATE "User" AS u
SET "emailVerifiedAt" = a."emailVerifiedAt", "emailVerifyTokenHash" = NULL, "emailVerifyExpiresAt" = NULL
FROM "TrainerApplication" AS a
WHERE a."userId" = u."id"
  AND u."emailVerifiedAt" IS NULL
  AND a."emailVerifiedAt" IS NOT NULL
  AND lower(a."email") = lower(u."email");

UPDATE "TrainerApplication" AS a
SET "emailVerifiedAt" = u."emailVerifiedAt", "emailVerifyTokenHash" = NULL, "emailVerifyExpiresAt" = NULL
FROM "User" AS u
WHERE a."userId" = u."id"
  AND a."emailVerifiedAt" IS NULL
  AND u."emailVerifiedAt" IS NOT NULL
  AND lower(a."email") = lower(u."email");
