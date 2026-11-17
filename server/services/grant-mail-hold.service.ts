/* ═══ إمساكُ بريد الحملات حتى يأمر صاحبُ المنصّة (١٧ نوفمبر ٢٠٢٦) ═══

   قرارُه: «don't let the system send any email until i say we are done with everything .. then i order
   to send!». فكلُّ بريدٍ تبعثه وظيفةُ المنح وحدَها — «مددنا منحتك» و«خصمك صار 80%» وتذكيرا قبل النهاية
   و«بقي على كودك» لكلّ حملةٍ وشريك — يُمسَك في `runGrantReminders` (`server/worker/jobs.ts`)، ولا يُكتب له
   أثرُ «ذُكِّر»، فيخرج كلُّه بمراحله حين يُطلَق.

   والإطلاقُ أمرُه هو: زرٌّ في صفحة المنحة (`commerce.manage`) يكتب أثرا يسمّي من أطلق ومتى. والزرُّ نفسُه
   يُمسك ثانيةً إن أراد. والحالُ آخرُ أثرَي الإمساك والإطلاق بعد `GRANT_MAIL_HOLD_SINCE` — وبلا أثرٍ فهو ممسوك.

   وما لا يُمسَك: بريدٌ طلبه صاحبُه في لحظته — كودُ المنحة لمن عبّأ نموذجها، والإيصال، وتوثيقُ البريد،
   واستعادةُ كلمة السرّ — وما يرسله صاحبُ المنصّة بيده من صفحة المسجّلين. */

import type { PrismaClient } from '@prisma/client'
import { recordAudit } from './audit'

export const GRANT_MAIL_HOLD_SINCE = new Date('2026-11-17T09:00:00.000Z')
export const GRANT_MAIL_HOLD_ACTION = 'coupon.grant_mail_hold'
export const GRANT_MAIL_RELEASE_ACTION = 'coupon.grant_mail_release'
const ENTITY = { entityType: 'grant_mail', entityId: 'campaigns' } as const

export interface GrantMailHold {
  held: boolean
  /** آخرُ إمساكٍ أو إطلاقٍ بيد إنسان — وبلا أثرٍ فهو الإمساكُ الأوّل بقرار ١٧ نوفمبر */
  changedAt: string | null
  changedBy: string | null
}

export async function grantMailHold(prisma: PrismaClient): Promise<GrantMailHold> {
  const last = await prisma.auditEvent.findFirst({
    where: { action: { in: [GRANT_MAIL_HOLD_ACTION, GRANT_MAIL_RELEASE_ACTION] }, createdAt: { gte: GRANT_MAIL_HOLD_SINCE } },
    orderBy: { createdAt: 'desc' },
    select: { action: true, createdAt: true, actorId: true },
  })
  if (!last) return { held: true, changedAt: null, changedBy: null }
  const who = last.actorId
    ? await prisma.user.findUnique({ where: { id: last.actorId }, select: { displayName: true, email: true } })
    : null
  return {
    held: last.action === GRANT_MAIL_HOLD_ACTION,
    changedAt: last.createdAt.toISOString(),
    changedBy: who ? (who.displayName || who.email) : null,
  }
}

export async function grantMailHeld(prisma: PrismaClient): Promise<boolean> {
  return (await grantMailHold(prisma)).held
}

/** يُطلق البريدَ أو يُمسكه — ولا يكتب أثرا إن كان على ما طُلب */
export async function setGrantMailHold(prisma: PrismaClient, held: boolean, actorId: string): Promise<GrantMailHold> {
  const now = await grantMailHold(prisma)
  if (now.held === held) return now
  await recordAudit(prisma, {
    actorId, action: held ? GRANT_MAIL_HOLD_ACTION : GRANT_MAIL_RELEASE_ACTION, ...ENTITY,
    meta: { held },
  })
  return grantMailHold(prisma)
}
