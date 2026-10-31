/* من عبّأ نموذج المنحة ولم يشترِ — قائمةٌ بالأسماء، ومستشارٌ يتّصل خلال ساعتين (٢٠ و٢٢ أكتوبر ٢٠٢٦).

   ═══ القرار ═══

   سأل صاحبُ المنصّة: «من قام بالتعبئة أين يذهب، وكيف أعرف ماذا فعلوا؟ … ومن لم يقم بالشراء فقط قام
   بالتعبئة سنتواصل معه مرّةً أخرى عن طريق واتساب … أو من المستشار». وخُيّر بين قائمةٍ يتابع منها
   فريقُه، ومستشارٍ يُسند تلقائيّا، والاثنين — فاختار **الاثنين معا**.

   ═══ ما يقع ═══

   ١) **قائمةٌ بكلّ من عبّأ النموذج** (`registrants`) — اسمُه ورقمُه وبريدُه ومجالُه وقناتُه ودفعتُه،
      وما فعل: اشترى، أو ينتظر الدفع، أو لم يشترِ بعد؛ ومستشارُه إن كانت له حالة.
   ٢) **و«اشترى»** = كودُه دُفع به طلبٌ (ولو اشترى به من أهداه إليه)، أو بريدُه بريدُ حسابٍ دفع شيئا.
   ٣) **ومن لم يشترِ بعد ساعةٍ تُفتح له حالةٌ عند مستشار، وفيها مكالمةٌ موعدُها ساعتان بعد النموذج**
      (`openFollowups`، كلَّ ربع ساعةٍ في العامل). كانت بعد يومين، ثمّ اختار صاحبُ المنصّة (٢٢ أكتوبر ٢٠٢٦)
      «مكالمةَ مستشارٍ خلال ساعتين» — والموعدُ في ساعات العمل بتوقيت عمّان (`grantCallDueAt`)، ويُذكَّر به
      المستشارُ قبله بربع ساعة كأيّ متابعة (`remindDue`).
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

   ═══ و«منحة مؤثرين وجيز» مثلُها (٢٦ أكتوبر ٢٠٢٦) ═══

   قرارُ صاحب المنصّة: «أضف المتابعةَ ورسائلَ التذكير لمنحة المؤثّرين». فالحالةُ عند المستشار تُفتح لمن عبّأ أيَّ
   النموذجين ولم يشترِ، ويُقال فيها من أيّ منحةٍ جاء وبكود أيّ مؤثّر. والتذكيرُ لكلّ حملةٍ بنهايتها هي (`sendGrantReminders`
   بمعرّفها)، وبريدُه يعيد صاحبَه إلى صفحة منحته: `/grant` للأولى، ورابطُ مؤثّره للثانية. والقائمةُ بالأسماء
   (`grantRegistrants`) للحملتين معا (٢٧ أكتوبر ٢٠٢٦): كانت للأولى وحدَها، فرابطُ ملفّه (`/g/<كوده>`) في رسالة «راسل
   مستشارك» من صفحة المؤثّر كان يفتح قائمةً ليس هو فيها. وكلُّ صفٍّ يقول من أيّ منحةٍ جاء وبكود أيّ مؤثّر.

   والحارس: `server/tests/commerce/grant-followup.test.ts` و`influencer-grant.test.ts`. */

import type { PrismaClient } from '@prisma/client'
import { recordAudit } from './audit'
import { AdvisorService } from './advisor.service'
import { liveChannels } from './notification.service'
import { enqueueMail } from './outbox.service'
import { renderMail } from './mail-template'
import { publicSiteUrl } from './site-url'
import { INFLUENCER_GRANT_SLUG, MEMBER_GRANT_SLUG, type GrantSlug } from '../../src/application/commerce/grant'
import { influencerLink } from '../../src/application/commerce/influencer'
import { grantCallDueAt, grantDaysLeftAr, leadProfileAr } from '../../src/application/commerce/grant-landing'
import { fmtDateLong } from '../../src/application/text/format-ar'
import { zonedDay } from '../../src/application/trainer/cohort-period'

/** بعد كم ساعةٍ من النموذج تُفتح حالةُ من لم يشترِ — ساعةٌ يشتري فيها وحدَه، ثمّ مكالمةٌ في الساعة الثانية */
export const GRANT_FOLLOWUP_HOURS = 1
/** أقصى ما يُفتح في دورةٍ واحدة — فلا تُغرق دفعةٌ كبيرةٌ المستشارين في ساعة */
const FOLLOWUP_BATCH = 200

export const BOUGHT = ['paid', 'partially_refunded']
/** الحملتان — يُتابَع من عبّأ أيَّهما */
const GRANT_SLUGS: GrantSlug[] = [MEMBER_GRANT_SLUG, INFLUENCER_GRANT_SLUG]
const OPEN_CASE = ['closed', 'enrolled', 'not_interested']

export type RegistrantState = 'bought' | 'pending' | 'none'

/** بريدُ من دفع شيئا من هذه العناوين — يشتري بلا كودٍ أحيانا، أو بكودٍ غير كوده */
export async function paidEmails(prisma: PrismaClient, emails: string[]): Promise<Set<string>> {
  if (emails.length === 0) return new Set()
  const rows = await prisma.order.findMany({
    where: { status: { in: BOUGHT }, user: { email: { in: emails } } },
    select: { user: { select: { email: true } } },
  })
  return new Set(rows.map((r) => r.user.email.toLowerCase()))
}

/** اسمُ كلِّ دورةٍ من آخر نسخةٍ لها — كما في دورات المنحة (`grant-courses.service.ts`) */
export async function courseTitles(prisma: PrismaClient, ids: string[]): Promise<Map<string, string>> {
  if (ids.length === 0) return new Map()
  const rows = await prisma.course.findMany({
    where: { id: { in: ids } },
    select: { id: true, versions: { orderBy: { version: 'desc' }, take: 1, select: { titleAr: true } } },
  })
  return new Map(rows.map((c) => [c.id, c.versions[0]?.titleAr ?? c.id]))
}

export async function grantRegistrants(prisma: PrismaClient) {
  const leads = await prisma.lead.findMany({
    where: { campaign: { in: GRANT_SLUGS }, erasedAt: null },
    orderBy: { createdAt: 'desc' },
    select: {
      id: true, fullName: true, phone: true, email: true, workField: true, careerLevel: true, interests: true,
      channel: true, wave: true, createdAt: true, grantPicks: true, campaign: true, influencer: { select: { code: true } },
      firstTouch: true, pageTouch: true, pageOpenedAt: true,
      grantCode: { select: { coupon: { select: { code: true, active: true, orders: { select: { status: true } } } } } },
      cases: {
        where: { status: { notIn: OPEN_CASE } },
        select: {
          assignments: { where: { unassignedAt: null }, select: { advisor: { select: { displayName: true } } } },
          /* ومكالمتُه القادمة — موعدٌ يُقرأ في ملفّه مع رسائله (`grant-registrants.service.ts`) */
          followUps: { where: { doneAt: null }, orderBy: { scheduledAt: 'asc' }, take: 1, select: { scheduledAt: true, channel: true } },
        },
      },
    },
  })
  const paid = await paidEmails(prisma, leads.map((l) => l.email).filter((e): e is string => !!e))
  /* والدوراتُ التي اختارها بأسمائها اليوم — يُحفظ معرّفُها، فلا يتقادم اسمٌ تغيّر */
  const titles = await courseTitles(prisma, [...new Set(leads.flatMap((l) => l.grantPicks))])
  return leads.map((l) => {
    const orders = l.grantCode?.coupon.orders ?? []
    const state: RegistrantState = orders.some((o) => BOUGHT.includes(o.status)) || (l.email && paid.has(l.email.toLowerCase()))
      ? 'bought'
      : orders.some((o) => o.status === 'pending_payment') ? 'pending' : 'none'
    return {
      id: l.id, fullName: l.fullName, phone: l.phone, email: l.email, workField: l.workField,
      careerLevel: l.careerLevel, interests: l.interests,
      channel: l.channel, wave: l.wave, createdAt: l.createdAt,
      influencer: l.campaign === INFLUENCER_GRANT_SLUG, influencerCode: l.influencer?.code ?? null,
      code: l.grantCode?.coupon.code ?? null, state,
      picks: l.grantPicks.map((id) => titles.get(id) ?? id),
      advisor: l.cases[0] ? (l.cases[0].assignments[0]?.advisor.displayName ?? 'بلا مستشار بعد') : null,
      campaign: l.campaign, codeActive: l.grantCode?.coupon.active ?? null,
      firstTouch: l.firstTouch, pageTouch: l.pageTouch, pageOpenedAt: l.pageOpenedAt,
      nextCall: l.cases[0]?.followUps[0] ?? null,
    }
  })
}

/** من لم يشترِ بعد ساعة — حالةٌ عند مستشار ومكالمةٌ مجدولة، مرّةً لكلّ عميل */
export async function openGrantFollowups(prisma: PrismaClient, now = new Date()): Promise<{ opened: number }> {
  const cutoff = new Date(now.getTime() - GRANT_FOLLOWUP_HOURS * 3_600_000)
  const leads = await prisma.lead.findMany({
    where: { campaign: { in: GRANT_SLUGS }, erasedAt: null, createdAt: { lte: cutoff }, cases: { none: {} } },
    orderBy: { createdAt: 'asc' },
    take: FOLLOWUP_BATCH,
    select: {
      id: true, email: true, workField: true, careerLevel: true, interests: true, createdAt: true, campaign: true,
      grantPicks: true, influencer: { select: { code: true } },
      grantCode: { select: { coupon: { select: { orders: { where: { status: { in: [...BOUGHT, 'pending_payment'] } }, select: { id: true } } } } } },
    },
  })
  const paid = await paidEmails(prisma, leads.map((l) => l.email).filter((e): e is string => !!e))
  const advisors = new AdvisorService(prisma)
  /* وما اختاره من دوراتٍ يقرؤه المستشارُ في حالته قبل أن يتّصل */
  const titles = await courseTitles(prisma, [...new Set(leads.flatMap((l) => l.grantPicks))])
  let opened = 0
  for (const lead of leads) {
    if ((lead.grantCode?.coupon.orders.length ?? 0) > 0) continue
    if (lead.email && paid.has(lead.email.toLowerCase())) continue
    const callAt = grantCallDueAt(lead.createdAt, now)
    const kase = await prisma.advisorCase.create({
      data: {
        leadId: lead.id,
        nextAction: [
          lead.campaign === INFLUENCER_GRANT_SLUG
            ? `اتصل به — عبأ نموذج منحة المؤثرين${lead.influencer ? ` بكود ${lead.influencer.code}` : ''} ولم يشتر بعد`
            : 'اتصل به — عبأ نموذج المنحة ولم يشتر بعد',
          leadProfileAr({ ...lead, picks: lead.grantPicks.map((id) => titles.get(id) ?? id) }),
        ].filter(Boolean).join(' · '),
        nextFollowUpAt: callAt,
        followUps: { create: { scheduledAt: callAt, channel: 'phone', note: 'مكالمة المنحة — خلال ساعتين من النموذج' } },
      },
    })
    await recordAudit(prisma, {
      action: 'advisor.case.grant_followup', entityType: 'advisor_case', entityId: kase.id,
      meta: { leadId: lead.id, campaign: lead.campaign },
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

/** تذكيرُ من أخذ كودا ولم يشترِ قبل انتهاء المنحة — المرحلةُ الحالّةُ الأحدثُ، مرّةً لكلّ عميل. ولكلّ حملةٍ بنهايتها */
export async function sendGrantReminders(
  prisma: PrismaClient, now = new Date(), slug: GrantSlug = MEMBER_GRANT_SLUG,
): Promise<{ sent: number; stage: string | null; mailOff: boolean }> {
  const campaign = await prisma.grantCampaign.findUnique({
    where: { slug }, select: { id: true, active: true, closesAt: true, percentOff: true },
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
      campaign: slug, erasedAt: null, email: { not: null },
      createdAt: { lt: new Date(closesAt.getTime() - due.beforeMs) },
      grantCode: { campaignId: campaign.id },
      id: { notIn: reminded.map((r) => r.entityId) },
    },
    orderBy: { createdAt: 'asc' },
    select: {
      id: true, fullName: true, email: true,
      influencer: { select: { code: true } },
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
        meta: { stage: due.stage, campaign: slug },
      })
      /* بقالب الأكاديمية لا نصّا خاما — قرارُ صاحب المنصّة (٢٧ أكتوبر ٢٠٢٦): «رسالةُ البريد يجب أن تكون احترافيّة» */
      await enqueueMail(tx, {
        to: lead.email!, purpose: 'grant.reminder', subject,
        ...renderMail({
          greetingName: lead.fullName,
          /* المنحةُ بنسبتها لا بما يبقى — قرارُ صاحب المنصّة (٢٥ أكتوبر ٢٠٢٦)، كسطر الصفحة الأولى */
          preheader: `منحتك تصل إلى ${pct}% من سعر دورات مباشرة على Zoom.`,
          heading: subject,
          blocks: [
            { kind: 'p', text: `منحتك تصل إلى ${pct}% من سعر دورات مباشرة على Zoom مع مدربين معتمدين.` },
            { kind: 'facts', rows: [
              { label: 'كود منحتك', value: coupon.code },
              /* وفي آخر يومٍ لا يُكرَّر: عنوانُه «اليوم آخر يوم لمنحتك» */
              ...(days <= 1 ? [] : [{ label: 'آخر يوم', value: fmtDateLong(lastDay) }]),
            ] },
            /* ومن جاء بكود مؤثّرٍ يعود إلى صفحة منحته هي — برابط مؤثّره */
            { kind: 'cta', label: 'اختر دوراتك', href: lead.influencer ? influencerLink(publicSiteUrl(), lead.influencer.code) : `${publicSiteUrl()}/grant` },
            { kind: 'note', text: 'وإن لم تحتجها، يمكنك أن تهدي الكود لغيرك.' },
          ],
        }),
      })
    })
    sent += 1
  }
  return { sent, stage: due.stage, mailOff: false }
}

/* ═══ آخرُ يومٍ للمنحة ٣٠ أكتوبر — بقرار صاحب المنصّة (٢٤ أكتوبر ٢٠٢٦) ═══

   قال: «لا تنسَ: مدّةُ الانتهاء تكون ٣٠ أكتوبر لاستغلال المنحة». وكانت نهايتُها المحفوظةُ أوّلَ ١ نوفمبر بتوقيت عمّان
   (آخرُ يومٍ ٣١ أكتوبر)، فتصير أوّلَ ٣١ أكتوبر — كما تحفظها شاشتُها (`grantClosesAt`). وتذكيرا ما قبل الانتهاء يتبعانها.

   ولا يقع إلّا مرّة: يُشترط أن تكون النهايةُ ما زالت التي قبل القرار. فإن غيّرها أحدٌ من شاشتها بعدُ لم تُمسّ. */
export const GRANT_CLOSE_FIX = { from: '2026-10-31T21:00:00.000Z', to: '2026-10-30T21:00:00.000Z' } as const

export async function applyGrantCloseFix(prisma: PrismaClient, fix: { from: string; to: string } = GRANT_CLOSE_FIX): Promise<boolean> {
  const c = await prisma.grantCampaign.findUnique({ where: { slug: MEMBER_GRANT_SLUG }, select: { id: true, closesAt: true } })
  if (!c?.closesAt || c.closesAt.toISOString() !== fix.from) return false
  await prisma.$transaction(async (tx) => {
    await tx.grantCampaign.update({ where: { id: c.id }, data: { closesAt: new Date(fix.to) } })
    await recordAudit(tx, {
      actorId: null, action: 'coupon.grant_settings', entityType: 'grant_campaign', entityId: c.id,
      before: { closesAt: fix.from }, after: { closesAt: fix.to },
      reason: 'قرار صاحب المنصة (24 أكتوبر 2026): آخر يوم للمنحة 30 أكتوبر',
    })
  })
  return true
}

/* ═══ والمنحةُ تغطّي ٤ دوراتٍ بحدٍّ أقصى — بقرار صاحب المنصّة (٢٤ أكتوبر ٢٠٢٦) ═══

   قال: «ضعها له وكأنّك تقول اختر ٤ دوراتٍ بحدٍّ أقصى، لكي يشعر أنّ المنحةَ عظيمة»، واختار تغييرَ الحدّ من ٥ إلى ٤ لا
   القولَ وحدَه — فلا تقول الصفحةُ ٤ وتقبل ٥. والحدُّ نفسُه يُفحص عند الدفع (`maxCourses` في `grant.service.ts`).
   ولا يقع إلّا مرّة: يُشترط أن يكون الحدُّ ما زال ٥. فإن غيّره أحدٌ من شاشته بعدُ لم يُمسّ. */
export const GRANT_COURSES_FIX = { from: 5, to: 4 } as const

export async function applyGrantCoursesFix(prisma: PrismaClient, fix: { from: number; to: number } = GRANT_COURSES_FIX): Promise<boolean> {
  const c = await prisma.grantCampaign.findUnique({ where: { slug: MEMBER_GRANT_SLUG }, select: { id: true, maxCourses: true } })
  if (!c || c.maxCourses !== fix.from) return false
  await prisma.$transaction(async (tx) => {
    await tx.grantCampaign.update({ where: { id: c.id }, data: { maxCourses: fix.to } })
    await recordAudit(tx, {
      actorId: null, action: 'coupon.grant_settings', entityType: 'grant_campaign', entityId: c.id,
      before: { maxCourses: fix.from }, after: { maxCourses: fix.to },
      reason: 'قرار صاحب المنصة (24 أكتوبر 2026): المنحة تغطي 4 دورات بحد أقصى',
    })
  })
  return true
}
