/* هديّةُ رابط المسار — أتُضاف إلى هذه السلّة بصفر؟ (٨ نوفمبر ٢٠٢٦)

   الشكلُ والقرارُ في `src/application/commerce/private-path.ts` («دورةٌ هديّة في رابط المسار»). وهنا الحكمُ وحدَه، من
   الخادم لا من المتصفّح: المتصفّحُ يرسل رمزَ الرابط الموقَّع (`bl`)، ومنه يُقرأ المسارُ نفسُه وهديّتُه — فلا يستطيع أحدٌ أن
   يكتب «هديّة» لدورةٍ لم يُهدِها مولّدُ الرابط.

   وتُضاف الهديّةُ بأربعة شروطٍ معا:
   ① **في السلّة شعبةٌ من دورة الهديّة** — أيُّ شعبةٍ منها: للمتعلّم أن يختار غيرَ التي اختارها المولّد إن تعارضت.
   ② **وفيها من الدورات المدفوعة ما يبلغ شرطَها** (`minCourses`) — وإلّا يُقال كم ينقصه.
   ③ **والمشتري صاحبُ المسار** (`learnerKey`): حسابُه نفسُه، أو حسابٌ ببريد نموذجه إن لم يكن للنموذج حساب. ومعاينةُ الزائر
      بلا حسابٍ تُعرض على أنّه هو، والدفعُ يفحص.
   ④ **ولم يأخذها من قبل**: لا بندَ بصفرٍ في طلبٍ له قائمٍ من شعب دورتها. فالرمزُ يبقى في المتصفّح سبعةَ أيّام (`buy-link-token`)
      ولا تُعطى الهديّةُ مرّتين.

   وما لم يُضِف هديّةً لا يغيّر شيئا: بلا رمزٍ أو بلا هديّةٍ في الرابط يُسعَّر كلُّ شيءٍ كما كان. */

import type { PrismaClient } from '@prisma/client'
import { verifyBuyLinkToken } from './buy-link.service'
import { PRIVATE_PATH_PURPOSE, giftMissingAr, type PrivatePathPayload } from '../../src/application/commerce/private-path'

export interface GiftDecision {
  courseId: string
  /** أفي السلّة شعبةٌ من دورتها */
  inCart: boolean
  /** تُضاف بصفر */
  applies: boolean
  /** كم دورةً مدفوعةً تنقص الشرط — صفرٌ إن بلغه */
  missing: number
  minCourses: number
  /** لماذا لا تُضاف — يُقال للمشتري */
  reasonAr: string | null
}

const NOT_YOURS_AR = 'الدورة الهدية لصاحب هذا المسار وحده'
const TAKEN_AR = 'أخذت هذه الدورة الهدية من قبل'

/** هديّةُ المسار الذي وُلّد به هذا الرمز — أو `null` */
export async function giftOfToken(prisma: PrismaClient, token: unknown): Promise<{ gift: NonNullable<PrivatePathPayload['gift']>; learnerKey: string } | null> {
  const v = verifyBuyLinkToken(token)
  if (!v) return null
  const row = await prisma.shortLink.findFirst({
    where: { purpose: PRIVATE_PATH_PURPOSE, revokedAt: null, payload: { path: ['linkId'], equals: v.linkId } },
    select: { payload: true },
  })
  const p = row?.payload as unknown as PrivatePathPayload | null
  if (!p?.gift) return null
  return { gift: p.gift, learnerKey: p.learnerKey }
}

/** أهذا المشتري صاحبُ المسار؟ */
async function isPathOwner(prisma: PrismaClient, userId: string, learnerKey: string): Promise<boolean> {
  const [kind, id] = learnerKey.split(':')
  if (kind === 'user') return id === userId
  if (kind !== 'lead' || !id) return false
  const lead = await prisma.lead.findUnique({ where: { id }, select: { userId: true, email: true } })
  if (!lead) return false
  if (lead.userId) return lead.userId === userId
  if (!lead.email) return false
  const user = await prisma.user.findUnique({ where: { id: userId }, select: { email: true } })
  return !!user?.email && user.email.trim().toLowerCase() === lead.email.trim().toLowerCase()
}

/** أخذها من قبل: بندٌ بصفرٍ من شعب دورتها في طلبٍ له لم يُلغَ */
async function alreadyGifted(prisma: PrismaClient, userId: string, courseId: string): Promise<boolean> {
  const cohorts = await prisma.cohort.findMany({ where: { courseId }, select: { id: true } })
  if (cohorts.length === 0) return false
  const n = await prisma.orderItem.count({
    where: {
      kind: 'cohort', refId: { in: cohorts.map((c) => c.id) }, unitPrice: 0,
      order: { userId, status: { not: 'cancelled' } },
    },
  })
  return n > 0
}

/** حكمُ الهديّة على سلّة — أو `null` حين لا هديّةَ في رابطها */
export async function giftForCart(
  prisma: PrismaClient,
  userId: string | null,
  token: unknown,
  cart: readonly { courseId: string }[],
): Promise<GiftDecision | null> {
  const found = await giftOfToken(prisma, token)
  if (!found) return null
  const { gift, learnerKey } = found
  const inCart = cart.some((l) => l.courseId === gift.courseId)
  const paid = new Set(cart.filter((l) => l.courseId !== gift.courseId).map((l) => l.courseId)).size
  const missing = Math.max(0, gift.minCourses - paid)
  const base = { courseId: gift.courseId, inCart, missing, minCourses: gift.minCourses }
  if (missing > 0) return { ...base, applies: false, reasonAr: giftMissingAr(missing) }
  if (userId) {
    if (!(await isPathOwner(prisma, userId, learnerKey))) return { ...base, applies: false, reasonAr: NOT_YOURS_AR }
    if (await alreadyGifted(prisma, userId, gift.courseId)) return { ...base, applies: false, reasonAr: TAKEN_AR }
  }
  return { ...base, applies: inCart, reasonAr: null }
}
