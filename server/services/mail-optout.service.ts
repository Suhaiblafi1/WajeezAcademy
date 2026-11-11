/* ═══ إلغاءُ الاشتراك في رسائل التسويق (١١ نوفمبر ٢٠٢٦) ═══

   قرارُ صاحب المنصّة: «أضف رابط إلغاء الاشتراك للبريد».

   · **ما يُلغى رسائلُ التسويق وحدَها** (`MARKETING_PURPOSES`): تذكيرُ المنحة، و«مددنا منحتك»، ورسائلُ الإدارة لمن عبّأ
     النموذج. ورسائلُ الحساب والدورات والدفع وكودُ المنحة الذي طلبه تصله كما هي — لا يُحرم من كلمة سرّه أو إيصاله
     لأنّه لا يريد إعلانا.
   · **والرابطُ موقَّعٌ ببريده** (`unsubscribeToken`): لا يُلغي أحدٌ اشتراكَ غيره بأن يكتب بريدَه في رابط. والتوقيعُ من
     سرّ المنصّة المشتقّ (`derivedSecret`)، فلا جدولَ رموزٍ ولا انتهاء.
   · **وفي الرسالة رابطان لشيءٍ واحد**: سطرٌ في تذييلها يفتح صفحةً بزرٍّ (`/unsubscribe`) — فلا يُلغيه فاحصُ روابطَ يفتح
     كلَّ رابطٍ في البريد — ورأسُ `List-Unsubscribe` بنقرةٍ واحدة (RFC 8058) يظهر زرُّه في Gmail وغيره، وتطلبه Gmail
     وYahoo ممّن يرسل كثيرا.
   · **والإلغاءُ بالبريد بحروفٍ صغيرة لا بالحساب**: أكثرُ من يصله بريدُ المنحة لا حسابَ له. ومرّةً تكفي: الثانيةُ لا تغيّر شيئا.

   والحارس: `server/tests/notifications/mail-optout.test.ts`. */

import { createHmac, timingSafeEqual } from 'node:crypto'
import type { Prisma, PrismaClient } from '@prisma/client'
import { derivedSecret } from './storage.service'
import { publicSiteUrl } from './site-url'

type Db = PrismaClient | Prisma.TransactionClient

/** رسائلُ التسويق — ما يحمل رابطَ الإلغاء، وما لا يُرسَل لمن ألغى */
export const MARKETING_PURPOSES = ['grant.reminder', 'grant.extended', 'grant.message'] as const
export type MarketingPurpose = (typeof MARKETING_PURPOSES)[number]

export const UNSUBSCRIBE_PAGE = '/unsubscribe'
export const UNSUBSCRIBE_ONE_CLICK = '/api/public/unsubscribe/one-click'

const norm = (email: string) => email.trim().toLowerCase()
const sign = (email: string) => createHmac('sha256', derivedSecret('mail-unsubscribe')).update(email).digest('base64url').slice(0, 22)

/** رمزُ الرابط: البريدُ وتوقيعُه — لا يُصنع لبريدٍ آخر بلا سرّ المنصّة */
export function unsubscribeToken(email: string): string {
  const e = norm(email)
  return `${Buffer.from(e, 'utf8').toString('base64url')}.${sign(e)}`
}

/** البريدُ من رمزه إن صحّ توقيعُه — وإلّا لا شيء */
export function emailFromToken(token: string | null | undefined): string | null {
  if (!token || token.length > 600) return null
  const [payload, sig] = token.split('.')
  if (!payload || !sig) return null
  let email: string
  try { email = Buffer.from(payload, 'base64url').toString('utf8') } catch { return null }
  if (!email.includes('@') || email !== norm(email)) return null
  const want = Buffer.from(sign(email))
  const got = Buffer.from(sig)
  return want.length === got.length && timingSafeEqual(want, got) ? email : null
}

/** رابطا الإلغاء لبريد: الصفحةُ لتذييل الرسالة، والنقرةُ الواحدةُ لرأسها */
export function unsubscribeLinks(email: string): { page: string; oneClick: string } {
  const t = encodeURIComponent(unsubscribeToken(email))
  const site = publicSiteUrl()
  return { page: `${site}${UNSUBSCRIBE_PAGE}?t=${t}`, oneClick: `${site}${UNSUBSCRIBE_ONE_CLICK}?t=${t}` }
}

/** من ألغى من هذه العناوين — يُقرأ مرّةً للدفعة كلِّها */
export async function optedOut(db: Db, emails: readonly string[]): Promise<Set<string>> {
  const list = [...new Set(emails.map(norm).filter(Boolean))]
  if (list.length === 0) return new Set()
  const rows = await db.mailOptOut.findMany({ where: { email: { in: list } }, select: { email: true } })
  return new Set(rows.map((r) => r.email))
}

/** يُلغي اشتراكَ صاحب الرمز — ومرّةً تكفي. ويقول بريدَه مخفيّا أو أنّ الرمز لا يصحّ */
export async function optOut(db: Db, token: string | null | undefined, purpose?: string | null): Promise<{ ok: boolean; email?: string }> {
  const email = emailFromToken(token)
  if (!email) return { ok: false }
  const p = purpose && (MARKETING_PURPOSES as readonly string[]).includes(purpose) ? purpose : null
  await db.mailOptOut.upsert({ where: { email }, create: { email, purpose: p }, update: {} })
  return { ok: true, email: maskEmail(email) }
}

/** «j•••@gmail.com» — تقول الصفحةُ أيُّ بريدٍ أُلغي بلا أن تكشفه لمن رأى الرابط */
function maskEmail(email: string): string {
  const [name, domain] = email.split('@')
  return domain ? `${name.slice(0, 1)}•••@${domain}` : '•••'
}
