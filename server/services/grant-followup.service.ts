/* من عبّأ نموذج المنحة ولم يشترِ — قائمةٌ بالأسماء، ومستشارٌ بعد يومين (٢٠ أكتوبر ٢٠٢٦).

   ═══ القرار ═══

   سأل صاحبُ المنصّة: «من قام بالتعبئة أين يذهب، وكيف أعرف ماذا فعلوا؟ … ومن لم يقم بالشراء فقط قام
   بالتعبئة سنتواصل معه مرّةً أخرى عن طريق واتساب … أو من المستشار». وخُيّر بين قائمةٍ يتابع منها
   فريقُه، ومستشارٍ يُسند تلقائيّا، والاثنين — فاختار **الاثنين معا**.

   ═══ ما يقع ═══

   ١) **قائمةٌ بكلّ من عبّأ النموذج** (`registrants`) — اسمُه ورقمُه وبريدُه ومجالُه وقناتُه ودفعتُه،
      وما فعل: اشترى، أو ينتظر الدفع، أو لم يشترِ بعد؛ ومستشارُه إن كانت له حالة.
   ٢) **و«اشترى»** = كودُه دُفع به طلبٌ (ولو اشترى به من أهداه إليه)، أو بريدُه بريدُ حسابٍ دفع شيئا.
   ٣) **ومن لم يشترِ بعد يومين تُفتح له حالةٌ عند مستشار** (`openFollowups`، كلَّ ساعةٍ في العامل) —
      مرّةً واحدةً لكلّ عميل: من كانت له حالةٌ قبلُ (طلب مستشارا بنفسه) لا تُفتح له ثانية. ومن ينتظر
      طلبُه الدفعَ لا يُتابَع وهو في منتصف الدفع؛ فإن هُجر طلبُه لحقته الدورةُ التالية.
   ٤) **وتذكيرٌ قبل انتهاء المنحة** (٢١ أكتوبر ٢٠٢٦) — من أفكار «الاستحواذ على العميل» التي اختارها صاحبُ
      المنصّة: بريدٌ لمن أخذ كودا ولم يشترِ، **قبل ثلاثة أيّام** و**في آخر يوم**، التاسعةَ صباحا بتوقيت عمّان
      لا في منتصف الليل حين ينقلب اليوم (`sendGrantReminders`، كلَّ ساعةٍ في العامل).
      · **مرّةً لكلّ مرحلة**: أثرُ التذكير (`coupon.grant_reminder`) يُكتب مع البريد في معاملةٍ واحدة، وبه
        يُعرف من ذُكِّر — فلا يُطرق عنوانٌ مرّتين ولو دارت الوظيفةُ كلَّ ساعة.
      · **والمرحلةُ الأحدثُ وحدَها**: إن توقّف العاملُ حتّى آخر يوم لم يصل تذكيرُ الأيّام الثلاثة متأخّرا ثمّ
        الأخيرُ معه — يصل الأخيرُ وحدَه، وعنوانُه من الأيّام الباقية حقّا (`grantDaysLeftAr`).
      · **ولا يُذكَّر** من اشترى، ولا من ينتظر طلبُه الدفعَ وهو في منتصفه (فإن هُجر طلبُه لحقه تذكيرُ المرحلة
        التالية)، ولا من عبّأ النموذجَ بعد بدء المرحلة — أخذ كودَه للتوّ.
      · **والقناةُ قبل الناس**: إن لم يُوصَل البريدُ لا يُكتب أثرٌ ولا يُصفّ بريد — وإلّا وصل «آخرُ يوم»
        بعد انتهاء المنحة حين تُوصَل القناة.

   والحارس: `server/tests/commerce/grant-followup.test.ts`. */

import type { PrismaClient } from '@prisma/client'
import { recordAudit } from './audit'
import { AdvisorService } from './advisor.service'
import { liveChannels } from './notification.service'
import { enqueueMail } from './outbox.service'
import { publicSiteUrl } from './site-url'
import { MEMBER_GRANT_SLUG } from '../../src/application/commerce/grant'
import { grantDaysLeftAr, leadProfileAr } from '../../src/application/commerce/grant-landing'
import { fmtDateLong } from '../../src/application/text/format-ar'
import { zonedDay } from '../../src/application/trainer/cohort-period'

/** بعد كم ساعةٍ من النموذج يُتابَع من لم يشترِ */
export const GRANT_FOLLOWUP_HOURS = 48
/** أقصى ما يُفتح في دورةٍ واحدة — فلا تُغرق دفعةٌ كبيرةٌ المستشارين في ساعة */
const FOLLOWUP_BATCH = 200

const BOUGHT = ['paid', 'partially_refunded']
const OPEN_CASE = ['closed', 'enrolled', 'not_interested']

export type RegistrantState = 'bought' | 'pending' | 'none'

/** بريدُ من دفع شيئا من هذه العناوين — يشتري بلا كودٍ أحيانا، أو بكودٍ غير كوده */
async function paidEmails(prisma: PrismaClient, emails: string[]): Promise<Set<string>> {
  if (emails.length === 0) return new Set()
  const rows = await prisma.order.findMany({
    where: { status: { in: BOUGHT }, user: { email: { in: emails } } },
    select: { user: { select: { email: true } } },
  })
  return new Set(rows.map((r) => r.user.email.toLowerCase()))
}

export async function grantRegistrants(prisma: PrismaClient) {
  const leads = await prisma.lead.findMany({
    where: { campaign: MEMBER_GRANT_SLUG, erasedAt: null },
    orderBy: { createdAt: 'desc' },
    select: {
      id: true, fullName: true, phone: true, email: true, workField: true, careerLevel: true, interests: true,
      channel: true, wave: true, createdAt: true,
      grantCode: { select: { coupon: { select: { code: true, orders: { select: { status: true } } } } } },
      cases: {
        where: { status: { notIn: OPEN_CASE } },
        select: { assignments: { where: { unassignedAt: null }, select: { advisor: { select: { displayName: true } } } } },
      },
    },
  })
  const paid = await paidEmails(prisma, leads.map((l) => l.email).filter((e): e is string => !!e))
  return leads.map((l) => {
    const orders = l.grantCode?.coupon.orders ?? []
    const state: RegistrantState = orders.some((o) => BOUGHT.includes(o.status)) || (l.email && paid.has(l.email.toLowerCase()))
      ? 'bought'
      : orders.some((o) => o.status === 'pending_payment') ? 'pending' : 'none'
    return {
      id: l.id, fullName: l.fullName, phone: l.phone, email: l.email, workField: l.workField,
      careerLevel: l.careerLevel, interests: l.interests,
      channel: l.channel, wave: l.wave, createdAt: l.createdAt,
      code: l.grantCode?.coupon.code ?? null, state,
      advisor: l.cases[0] ? (l.cases[0].assignments[0]?.advisor.displayName ?? 'بلا مستشار بعد') : null,
    }
  })
}

/** من لم يشترِ بعد يومين — حالةٌ عند مستشار، مرّةً لكلّ عميل */
export async function openGrantFollowups(prisma: PrismaClient, now = new Date()): Promise<{ opened: number }> {
  const cutoff = new Date(now.getTime() - GRANT_FOLLOWUP_HOURS * 3_600_000)
  const leads = await prisma.lead.findMany({
    where: { campaign: MEMBER_GRANT_SLUG, erasedAt: null, createdAt: { lte: cutoff }, cases: { none: {} } },
    orderBy: { createdAt: 'asc' },
    take: FOLLOWUP_BATCH,
    select: {
      id: true, email: true, workField: true, careerLevel: true, interests: true,
      grantCode: { select: { coupon: { select: { orders: { where: { status: { in: [...BOUGHT, 'pending_payment'] } }, select: { id: true } } } } } },
    },
  })
  const paid = await paidEmails(prisma, leads.map((l) => l.email).filter((e): e is string => !!e))
  const advisors = new AdvisorService(prisma)
  let opened = 0
  for (const lead of leads) {
    if ((lead.grantCode?.coupon.orders.length ?? 0) > 0) continue
    if (lead.email && paid.has(lead.email.toLowerCase())) continue
    const kase = await prisma.advisorCase.create({
      data: {
        leadId: lead.id,
        nextAction: ['متابعة — عبأ نموذج المنحة قبل يومين ولم يشتر', leadProfileAr(lead)].filter(Boolean).join(' · '),
      },
    })
    await recordAudit(prisma, {
      action: 'advisor.case.grant_followup', entityType: 'advisor_case', entityId: kase.id,
      meta: { leadId: lead.id, campaign: MEMBER_GRANT_SLUG },
    })
    try { await advisors.autoAssign(kase.id) } catch { /* بلا مستشارٍ متاح: تبقى في «حالات بلا مستشار» */ }
    opened += 1
  }
  return { opened }
}

const HOUR = 3_600_000
const DAY = 24 * HOUR

/** قبل كم من نهاية المنحة يُذكَّر من لم يشترِ. والنهايةُ تُحفظ أوّلَ اليوم الذي بعد آخر يوم (`grantClosesAt`)،
    فـ٦٣ ساعةً قبلها التاسعةُ صباحا قبل آخر يومٍ بيومين، و١٥ ساعةً التاسعةُ صباحَ آخر يوم */
export const GRANT_REMINDERS = [
  { stage: '3d', beforeMs: 63 * HOUR },
  { stage: '1d', beforeMs: 15 * HOUR },
] as const

/** تذكيرُ من أخذ كودا ولم يشترِ قبل انتهاء المنحة — المرحلةُ الحالّةُ الأحدثُ، مرّةً لكلّ عميل */
export async function sendGrantReminders(prisma: PrismaClient, now = new Date()): Promise<{ sent: number; stage: string | null; mailOff: boolean }> {
  const campaign = await prisma.grantCampaign.findUnique({
    where: { slug: MEMBER_GRANT_SLUG }, select: { id: true, active: true, closesAt: true, percentOff: true },
  })
  const closesAt = campaign?.closesAt
  if (!campaign?.active || !closesAt || closesAt <= now) return { sent: 0, stage: null, mailOff: false }
  const due = GRANT_REMINDERS.filter((r) => now.getTime() >= closesAt.getTime() - r.beforeMs).at(-1)
  if (!due) return { sent: 0, stage: null, mailOff: false }
  if (!(await liveChannels(prisma)).includes('email')) return { sent: 0, stage: due.stage, mailOff: true }

  const reminded = await prisma.auditEvent.findMany({
    where: { action: 'coupon.grant_reminder', entityType: 'lead', meta: { path: ['stage'], equals: due.stage } },
    select: { entityId: true },
  })
  const leads = await prisma.lead.findMany({
    where: {
      campaign: MEMBER_GRANT_SLUG, erasedAt: null, email: { not: null },
      createdAt: { lt: new Date(closesAt.getTime() - due.beforeMs) },
      grantCode: { campaignId: campaign.id },
      id: { notIn: reminded.map((r) => r.entityId) },
    },
    orderBy: { createdAt: 'asc' },
    select: {
      id: true, fullName: true, email: true,
      grantCode: { select: { coupon: { select: {
        code: true, percentOff: true,
        orders: { where: { status: { in: [...BOUGHT, 'pending_payment'] } }, select: { id: true } },
      } } } },
    },
  })
  const paid = await paidEmails(prisma, leads.map((l) => l.email).filter((e): e is string => !!e))

  const lastDay = new Date(closesAt.getTime() - 1)
  const days = Math.round((Date.parse(zonedDay(lastDay)) - Date.parse(zonedDay(now))) / DAY) + 1
  const subject = grantDaysLeftAr(days)
  let sent = 0
  for (const lead of leads) {
    const coupon = lead.grantCode?.coupon
    if (!coupon || !lead.email || coupon.orders.length > 0 || paid.has(lead.email.toLowerCase())) continue
    const pct = coupon.percentOff ?? campaign.percentOff
    await prisma.$transaction(async (tx) => {
      await recordAudit(tx, {
        action: 'coupon.grant_reminder', entityType: 'lead', entityId: lead.id,
        meta: { stage: due.stage, campaign: MEMBER_GRANT_SLUG },
      })
      await enqueueMail(tx, {
        to: lead.email!, purpose: 'grant.reminder', subject,
        text: [
          `مرحبا ${lead.fullName}،`, '',
          days <= 1 ? `${subject}.` : `${subject}. آخر يوم: ${fmtDateLong(lastDay)}.`,
          `كود منحتك: ${coupon.code}`,
          `تدفع ${100 - pct}% فقط من سعر دورات مباشرة على Zoom.`,
          '', `اختر دوراتك: ${publicSiteUrl()}/grant`, '',
          'وإن لم تحتجه فيمكنك أن تهديه لغيرك.',
        ].join('\n'),
      })
    })
    sent += 1
  }
  return { sent, stage: due.stage, mailOff: false }
}
