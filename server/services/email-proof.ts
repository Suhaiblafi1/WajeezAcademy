/* ═══ توثيقُ البريد واحدٌ للإنسان، لا اثنان (٣ نوفمبر ٢٠٢٦) ═══

   سأل صاحبُ المنصّة: «لماذا يستلم المستخدم ايميل توثيق حسابه بالرغم انه موثق فعلا».

   والعلّة: للمدرّب المتقدّم عَلَما توثيقٍ لا يعرف أحدُهما الآخر —
   `TrainerApplication.emailVerifiedAt` يكتبه رابطُ «وصل طلب انضمامك»، و
   `User.emailVerifiedAt` يكتبه رابطُ «وثّق بريدك». والحسابُ يُنشأ مع الطلب
   ببريده نفسِه. فمن وثّق من رسالة الطلب — وهو الفعلُ الوحيدُ المطلوبُ منه فيها —
   بقي حسابُه «غيرَ موثَّق»، فطرقه عاملُ التذكير بعد يومٍ ثمّ بعد أربعة: «بقي توثيق
   بريدك». والعكسُ مثلُه: متعلّمٌ موثَّقٌ يتقدّم للتدريب فتطلب منه رسالةُ الطلب أن
   يوثّق ما وثّقه.

   والدليلُ واحدٌ في الحالين: رابطٌ لا يصل إلّا ذلك العنوانَ بعينه فُتح. فما أثبته
   أحدُهما يُكتب في الآخر — **بشرط أن يكون البريدُ نفسَه**: الحسابُ قد يُربط بطلبٍ
   ببريدٍ آخر (نقلُ الملكيّة)، وتوثيقُ عنوانٍ لا يوثّق غيرَه. */

import type { Prisma, PrismaClient } from '@prisma/client'

type Db = PrismaClient | Prisma.TransactionClient

const cleared = (at: Date) => ({ emailVerifiedAt: at, emailVerifyTokenHash: null, emailVerifyExpiresAt: null })

/** وثّق الطلبُ بريدَه ← يوثَّق حسابُه المربوطُ به إن كان بالبريد نفسِه. يعيد هل كُتب. */
export async function proveAccountFromApplication(
  db: Db, app: { userId: string | null; email: string }, at = new Date(),
): Promise<boolean> {
  if (!app.userId) return false
  const { count } = await db.user.updateMany({
    where: { id: app.userId, emailVerifiedAt: null, email: { equals: app.email, mode: 'insensitive' } },
    data: cleared(at),
  })
  return count > 0
}

/** وثّق الحسابُ بريدَه ← يوثَّق طلبُ انضمامه المربوطُ به إن كان بالبريد نفسِه. */
export async function proveApplicationFromAccount(db: Db, userId: string, at = new Date()): Promise<void> {
  const user = await db.user.findUnique({ where: { id: userId }, select: { email: true } })
  if (!user) return
  await db.trainerApplication.updateMany({
    where: { userId, emailVerifiedAt: null, email: { equals: user.email, mode: 'insensitive' } },
    data: cleared(at),
  })
}
