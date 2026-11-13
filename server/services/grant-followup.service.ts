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
      · **مرّةً لكلّ مرحلةٍ من كلّ نهاية**: أثرُ التذكير (`coupon.grant_reminder`) يُكتب مع البريد في معاملةٍ واحدة،
        وفيه النهايةُ التي ذُكِّر لها، وبه يُعرف من ذُكِّر — فلا يُطرق عنوانٌ مرّتين ولو دارت الوظيفةُ كلَّ ساعة،
        وإن مُدّت المنحةُ فلنهايتها الجديدة تذكيراها (`remindedFor`، ١٣ نوفمبر ٢٠٢٦).
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

   والحارس: `server/tests/commerce/grant-followup.test.ts` و`influencer-grant.test.ts` و`grant-reminder-deadline.test.ts`. */

import type { PrismaClient } from '@prisma/client'
import { recordAudit } from './audit'
import { AdvisorService } from './advisor.service'
import { liveChannels } from './notification.service'
import { enqueueMail } from './outbox.service'
import { renderMail, type MailBlock } from './mail-template'
import { publicSiteUrl } from './site-url'
import { GrantCoursesService } from './grant-courses.service'
import { GrantService } from './grant.service'
import { GRANT_CAMPAIGNS, GRANT_CONTINUE_AR, GRANT_SLUGS, INFLUENCER_GRANT_SLUG, MEMBER_GRANT_SLUG, OPEN_GRANT_SLUG, grantCoursesAr, grantLeftLineAr, grantPagePath, type GrantSlug } from '../../src/application/commerce/grant'
import { influencerLink } from '../../src/application/commerce/influencer'
import { optedOut, unsubscribeLinks } from './mail-optout.service'
import {
  GRANT_PICKS_CTA_AR, GRANT_PICKS_INTRO_AR, GRANT_VALUE_AR, grantCallDueAt, grantDaysLeftAr, grantPicksLink, grantPicksPreheaderAr,
  grantShortTitleAr, leadProfileAr,
} from '../../src/application/commerce/grant-landing'
import { grantPrice } from '../../src/application/commerce/grant'
import { fmtDateLong, fmtMoney } from '../../src/application/text/format-ar'
import { zonedDay } from '../../src/application/trainer/cohort-period'

/** بعد كم ساعةٍ من النموذج تُفتح حالةُ من لم يشترِ — ساعةٌ يشتري فيها وحدَه، ثمّ مكالمةٌ في الساعة الثانية */
export const GRANT_FOLLOWUP_HOURS = 1
/** أقصى ما يُفتح في دورةٍ واحدة — فلا تُغرق دفعةٌ كبيرةٌ المستشارين في ساعة */
const FOLLOWUP_BATCH = 200

export const BOUGHT = ['paid', 'partially_refunded']
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

/** ما دُفع بالكود: عددُ طلباته المدفوعة ومبلغُها بالدولار، بقرشين */
function paidByCode(orders: { status: string; total: unknown }[]): { orders: number; revenue: number } {
  const paid = orders.filter((o) => BOUGHT.includes(o.status))
  return { orders: paid.length, revenue: Math.round(paid.reduce((s, o) => s + Number(o.total), 0) * 100) / 100 }
}

export async function grantRegistrants(prisma: PrismaClient) {
  const leads = await prisma.lead.findMany({
    where: { campaign: { in: [...GRANT_SLUGS] }, erasedAt: null },
    orderBy: { createdAt: 'desc' },
    select: {
      id: true, fullName: true, phone: true, email: true, workField: true, careerLevel: true, interests: true,
      channel: true, wave: true, createdAt: true, grantPicks: true, campaign: true, influencer: { select: { code: true } },
      firstTouch: true, pageTouch: true, pageOpenedAt: true,
      grantCode: { select: { coupon: { select: { code: true, active: true, orders: { select: { status: true, total: true } } } } } },
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
      /* وما دُفع بكوده وكم طلبا — ولو اشترى به من أهداه إليه: يُنسب لقناة صاحب الكود (كما كانت «نتائج الحملة») */
      ...paidByCode(orders),
    }
  })
}

/** من لم يشترِ بعد ساعة — حالةٌ عند مستشار ومكالمةٌ مجدولة، مرّةً لكلّ عميل */
export async function openGrantFollowups(prisma: PrismaClient, now = new Date()): Promise<{ opened: number }> {
  const cutoff = new Date(now.getTime() - GRANT_FOLLOWUP_HOURS * 3_600_000)
  const advisors = new AdvisorService(prisma)
  let opened = 0
  /* ═══ ويُقرأ ما بعد من اشترى — لا أقدمُ مئتين وحدَهم (١٣ نوفمبر ٢٠٢٦) ═══
     من اشترى يُتخطّى ولا تُفتح له حالة، فيبقى في أوّل الطابور أبدا. وكانت الدورةُ تقرأ أقدمَ مئتين وحدَهم: فإذا اشترى
     مئتان من الأوائل امتلأت بهم كلُّ دورة، ولم يُتّصل بعدهم بأحد. فالقراءةُ صفحةً بعد صفحةٍ حتّى تُفتح مئتا حالةٍ أو
     ينتهي الطابور. قرارُ صاحب المنصّة: «Look past buyers». والحارس: `server/tests/commerce/grant-followup-buyers.test.ts` */
  const page = (after: string | null) => prisma.lead.findMany({
    where: { campaign: { in: [...GRANT_SLUGS] }, erasedAt: null, createdAt: { lte: cutoff }, cases: { none: {} } },
    orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
    take: FOLLOWUP_BATCH,
    ...(after ? { cursor: { id: after }, skip: 1 } : {}),
    select: {
      id: true, email: true, workField: true, careerLevel: true, interests: true, createdAt: true, campaign: true,
      grantPicks: true, influencer: { select: { code: true } },
      grantCode: { select: { coupon: { select: { orders: { where: { status: { in: [...BOUGHT, 'pending_payment'] } }, select: { id: true } } } } } },
    },
  })
  let cursor: string | null = null
  for (;;) {
    const leads = await page(cursor)
    if (leads.length === 0) break
    cursor = leads[leads.length - 1].id
    const paid = await paidEmails(prisma, leads.map((l) => l.email).filter((e): e is string => !!e))
    /* وما اختاره من دوراتٍ يقرؤه المستشارُ في حالته قبل أن يتّصل */
    const titles = await courseTitles(prisma, [...new Set(leads.flatMap((l) => l.grantPicks))])
    for (const lead of leads) {
      if (opened >= FOLLOWUP_BATCH) break
      if ((lead.grantCode?.coupon.orders.length ?? 0) > 0) continue
      if (lead.email && paid.has(lead.email.toLowerCase())) continue
      const callAt = grantCallDueAt(lead.createdAt, now)
      const kase = await prisma.advisorCase.create({
        data: {
          leadId: lead.id,
          nextAction: [
            lead.campaign === INFLUENCER_GRANT_SLUG
              ? `اتصل به — عبأ نموذج منحة المؤثرين${lead.influencer ? ` بكود ${lead.influencer.code}` : ''} ولم يشتر بعد`
              : lead.campaign === OPEN_GRANT_SLUG
                ? 'اتصل به — عبأ نموذج منحة وجيز العامة ولم يشتر بعد'
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
    if (opened >= FOLLOWUP_BATCH || leads.length < FOLLOWUP_BATCH) break
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

/* ═══ و«ذُكِّر قبلُ» لهذه النهاية لا لأيّ نهاية (١٣ نوفمبر ٢٠٢٦) ═══

   كان الأثرُ يُعرف بمرحلته وحدَها ('3d' أو '1d'). فلمّا مُدّت المنحةُ (١ نوفمبر ٢٠٢٦ إلى ١٢ نوفمبر) تُخطّي في تذكيرَي
   النهاية الجديدة كلُّ من وصله تذكيرا القديمة — وإن لم يُفقد شيءٌ يومَها، فكلُّ تمديدٍ بعده يعيده. فالأثرُ يحمل الآن
   النهايةَ التي ذُكِّر لها (`meta.closesAt`)، ولكلّ نهايةٍ تذكيراها مرّةً مرّة.

   **والأثرُ القديمُ بلا نهاية** يُحسب للنهاية التي كُتب في نافذة مرحلتها وحدَها: من ٦٣ ساعةً (أو ١٥) قبلها إلى لحظتها.
   فالتذكيرُ لا يُكتب إلّا في نافذة نهايته (`sendGrantReminders`)، ووقتُ الأثر يدلّ على النهاية التي كانت سارية — بلا
   تاريخِ نهاياتٍ يُستعاد. فأثرُ ٣٠ أكتوبر لا يمنع تذكيرَ ١٢ نوفمبر، وأثرُ ١٠ نوفمبر يمنع تكرارَه. ولم يُختر «يطابق كلَّ
   نهاية» (السلوكُ القديم: يعيد العلّةَ نفسَها) ولا «لا يطابق شيئا» (يكرّر بريدَ النهاية السارية لمن وصله).
   وإن قصُر تمديدٌ عن طول النافذة فوقع أثرٌ قديمٌ في نافذتي النهايتين حُسب للجديدة — وصله تذكيرٌ قبل ساعات، فلا يُطرق ثانية. */
export function remindedFor(
  row: { meta: unknown; createdAt: Date }, stage: string, closesAt: Date,
  /* نافذةُ المرحلة — من `GRANT_REMINDERS`، أو تُمرَّر لمرحلةٍ ليست فيه (`left` في `sendGrantLeftReminders`) */
  windowMs: number | undefined = GRANT_REMINDERS.find((r) => r.stage === stage)?.beforeMs,
): boolean {
  const meta = (row.meta ?? {}) as { stage?: unknown; closesAt?: unknown }
  if (meta.stage !== stage) return false
  if (typeof meta.closesAt === 'string') return meta.closesAt === closesAt.toISOString()
  if (windowMs === undefined) return false
  const at = row.createdAt.getTime()
  return at >= closesAt.getTime() - windowMs && at < closesAt.getTime()
}

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

  const reminded = (await prisma.auditEvent.findMany({
    where: { action: 'coupon.grant_reminder', entityType: 'lead', meta: { path: ['stage'], equals: due.stage } },
    select: { entityId: true, meta: true, createdAt: true },
  })).filter((r) => remindedFor(r, due.stage, closesAt))
  const leads = await prisma.lead.findMany({
    where: {
      campaign: slug, erasedAt: null, email: { not: null },
      createdAt: { lt: new Date(closesAt.getTime() - due.beforeMs) },
      grantCode: { campaignId: campaign.id },
      id: { notIn: reminded.map((r) => r.entityId) },
    },
    orderBy: { createdAt: 'asc' },
    select: {
      id: true, fullName: true, email: true, grantPicks: true,
      influencer: { select: { code: true } },
      grantCode: { select: { coupon: { select: {
        code: true, percentOff: true,
        orders: { where: { status: { in: [...BOUGHT, 'pending_payment'] } }, select: { id: true } },
      } } } },
    },
  })
  const paid = await paidEmails(prisma, leads.map((l) => l.email).filter((e): e is string => !!e))
  /* ومن ألغى اشتراكَه في رسائل التسويق لا يُذكَّر (١١ نوفمبر ٢٠٢٦، `mail-optout.service.ts`) */
  const off = await optedOut(prisma, leads.map((l) => l.email).filter((e): e is string => !!e))

  /* ودوراتُ المنحة اليوم بسعرها — فما اختاره يُسمّى بما يُشترى منه الآن، وما أُغلقت شعبتُه لا يُذكر */
  const pool = new Map((await new GrantCoursesService(prisma).openCourses(now)).courses.map((c) => [c.courseId, c]))
  const lastDay = new Date(closesAt.getTime() - 1)
  const days = Math.round((Date.parse(zonedDay(lastDay)) - Date.parse(zonedDay(now))) / DAY) + 1
  const subject = grantDaysLeftAr(days)
  let sent = 0
  for (const lead of leads) {
    const coupon = lead.grantCode?.coupon
    if (!coupon || !lead.email || coupon.orders.length > 0 || paid.has(lead.email.toLowerCase()) || off.has(lead.email.toLowerCase())) continue
    const pct = coupon.percentOff ?? campaign.percentOff
    const base = lead.influencer ? influencerLink(publicSiteUrl(), lead.influencer.code) : `${publicSiteUrl()}${grantPagePath(slug)}`
    const lastDayRow = days <= 1 ? [] : [{ label: 'آخر يوم', value: fmtDateLong(lastDay) }]
    /* ما اختاره هو ممّا يُشترى اليوم — بسعر كلٍّ بعد منحته، ومجموعِها وقيمةِ منحته، وزرٍّ يعيده إلى اختياره (٣١ أكتوبر ٢٠٢٦) */
    const mine = lead.grantPicks.map((id) => pool.get(id)).filter((c): c is NonNullable<typeof c> => !!c)
    const listTotal = mine.reduce((sum, c) => sum + c.price, 0)
    const payTotal = grantPrice(listTotal, pct)
    const blocks: MailBlock[] = mine.length > 0
      ? [
          { kind: 'p', text: GRANT_PICKS_INTRO_AR },
          { kind: 'list', numbered: true, items: mine.map((c) => `${grantShortTitleAr(c.courseTitleAr)}: ${fmtMoney(grantPrice(c.price, pct))} بدل ${fmtMoney(c.price)}`) },
          { kind: 'facts', rows: [
            { label: 'تدفع', value: `${fmtMoney(payTotal)} بدل ${fmtMoney(listTotal)}` },
            { label: GRANT_VALUE_AR, value: fmtMoney(listTotal - payTotal) },
            { label: 'كود منحتك', value: coupon.code },
            ...lastDayRow,
          ] },
          { kind: 'cta', label: GRANT_PICKS_CTA_AR, href: grantPicksLink(base, mine.map((c) => c.courseId)) },
          { kind: 'note', text: 'وإن لم تحتجها، يمكنك أن تهدي الكود لغيرك.' },
        ]
      : [
          { kind: 'p', text: `منحتك تصل إلى ${pct}% من سعر دورات مباشرة على Zoom مع مدربين معتمدين.` },
          { kind: 'facts', rows: [
            { label: 'كود منحتك', value: coupon.code },
            /* وفي آخر يومٍ لا يُكرَّر: عنوانُه «اليوم آخر يوم لمنحتك» */
            ...lastDayRow,
          ] },
          /* ومن جاء بكود مؤثّرٍ يعود إلى صفحة منحته هي — برابط مؤثّره */
          { kind: 'cta', label: 'اختر دوراتك', href: base },
          { kind: 'note', text: 'وإن لم تحتجها، يمكنك أن تهدي الكود لغيرك.' },
        ]
    await prisma.$transaction(async (tx) => {
      await recordAudit(tx, {
        action: 'coupon.grant_reminder', entityType: 'lead', entityId: lead.id,
        meta: { stage: due.stage, campaign: slug, picks: mine.length, closesAt: closesAt.toISOString() },
      })
      /* بقالب الأكاديمية لا نصّا خاما — قرارُ صاحب المنصّة (٢٧ أكتوبر ٢٠٢٦): «رسالةُ البريد يجب أن تكون احترافيّة» */
      await enqueueMail(tx, {
        to: lead.email!, purpose: 'grant.reminder', subject, unsubscribeUrl: unsubscribeLinks(lead.email!).oneClick,
        ...renderMail({
          unsubscribeUrl: unsubscribeLinks(lead.email!).page,
          greetingName: lead.fullName,
          /* المنحةُ بنسبتها لا بما يبقى — قرارُ صاحب المنصّة (٢٥ أكتوبر ٢٠٢٦)، كسطر الصفحة الأولى. ومن اختار: ما اختاره وقيمتُه */
          preheader: mine.length > 0
            ? grantPicksPreheaderAr(mine.length, fmtMoney(listTotal - payTotal))
            : `منحتك تصل إلى ${pct}% من سعر دورات مباشرة على Zoom.`,
          heading: subject,
          blocks,
        }),
      })
    })
    sent += 1
  }
  return { sent, stage: due.stage, mailOff: false }
}

/* ═══ وتذكيرُ من اشترى ببعض كوده قبل النهاية (١٣ نوفمبر ٢٠٢٦) ═══

   قال صاحبُ المنصّة: «أرى الناس تستصعب شراء أربع دورات» — فدورةٌ واحدةٌ أوّلا، والكودُ يبقى لباقي المسار حتى آخر يوم
   (`coursesLeft`). وتذكيرُ ما قبل النهاية (`sendGrantReminders`) لمن لم يشترِ وحدَه، فمن اشترى دورةً وبقي على كوده ثلاثٌ
   لم يكن يُذكَّر أنّها تنتهي. فهنا تذكيرٌ واحدٌ له، في موعد تذكير «قبل ثلاثة أيام» (`GRANT_REMINDERS[0]`):
   · لمن اشترى بكوده شيئا دُفع (`BOUGHT`) وبقي عليه شيء — والعدُّ عدُّ الدفع نفسِه، فلا يُقال رقمٌ يردّه الشراء.
   · مرّةً لكلّ عميلٍ لكلّ نهاية (`coupon.grant_reminder` بمرحلة `left` ونهايتِه، `remindedFor`) — فإن مُدّت المنحةُ ذُكِّر
     بنهايتها الجديدة كتذكيرَي من لم يشترِ (١٣ نوفمبر ٢٠٢٦، #935). ولا يصل من ألغى رسائلَ التسويق، ولا يُكتب شيءٌ والبريدُ مفصول.
   · والزرُّ إلى «الدورات»: كودُه يُطبَّق وحده عند الشراء من حسابه (`learnerGrant`)، فلا يُعاد إلى نموذج المنحة. */
export const GRANT_LEFT_STAGE = 'left'

export async function sendGrantLeftReminders(
  prisma: PrismaClient, now = new Date(), slug: GrantSlug = MEMBER_GRANT_SLUG,
): Promise<{ sent: number; mailOff: boolean }> {
  const campaign = await prisma.grantCampaign.findUnique({
    where: { slug }, select: { id: true, active: true, closesAt: true, percentOff: true, maxCourses: true },
  })
  const closesAt = campaign?.closesAt
  if (!campaign?.active || !closesAt || closesAt <= now) return { sent: 0, mailOff: false }
  if (now.getTime() < closesAt.getTime() - GRANT_REMINDERS[0].beforeMs) return { sent: 0, mailOff: false }

  const told = (await prisma.auditEvent.findMany({
    where: { action: 'coupon.grant_reminder', entityType: 'lead', meta: { path: ['stage'], equals: GRANT_LEFT_STAGE } },
    select: { entityId: true, meta: true, createdAt: true },
  })).filter((r) => remindedFor(r, GRANT_LEFT_STAGE, closesAt, GRANT_REMINDERS[0].beforeMs))
  const leads = await prisma.lead.findMany({
    where: {
      campaign: slug, erasedAt: null, email: { not: null },
      grantCode: { campaignId: campaign.id, coupon: { orders: { some: { status: { in: [...BOUGHT] } } } } },
      id: { notIn: told.map((r) => r.entityId) },
    },
    orderBy: { createdAt: 'asc' },
    select: {
      id: true, fullName: true, email: true,
      grantCode: { select: { coupon: { select: { id: true, code: true, percentOff: true, usedCount: true, maxUses: true } } } },
    },
  })
  if (leads.length === 0) return { sent: 0, mailOff: false }
  if (!(await liveChannels(prisma)).includes('email')) return { sent: 0, mailOff: true }
  const off = await optedOut(prisma, leads.map((l) => l.email).filter((e): e is string => !!e))

  const grants = new GrantService(prisma)
  const lastDay = new Date(closesAt.getTime() - 1)
  let sent = 0
  for (const lead of leads) {
    const coupon = lead.grantCode?.coupon
    if (!coupon || !lead.email || off.has(lead.email.toLowerCase())) continue
    const left = await grants.coursesLeft({ ...coupon, grantCode: { campaign: { id: campaign.id, active: campaign.active, closesAt, maxCourses: campaign.maxCourses } } })
    if (left <= 0) continue
    const pct = coupon.percentOff ?? campaign.percentOff
    const subject = `بقي لك ${grantCoursesAr(left)} على كود منحتك`
    const blocks: MailBlock[] = [
      { kind: 'p', text: grantLeftLineAr(left, pct, closesAt) },
      { kind: 'p', text: 'أكمل مسارك بدورة تالية قبل آخر يوم. كودك يطبق وحده عند الشراء من حسابك.' },
      { kind: 'facts', rows: [
        { label: 'كود منحتك', value: coupon.code },
        { label: 'آخر يوم', value: fmtDateLong(lastDay) },
      ] },
      { kind: 'cta', label: GRANT_CONTINUE_AR, href: `${publicSiteUrl()}/courses` },
    ]
    await prisma.$transaction(async (tx) => {
      await recordAudit(tx, {
        action: 'coupon.grant_reminder', entityType: 'lead', entityId: lead.id,
        meta: { stage: GRANT_LEFT_STAGE, campaign: slug, left, closesAt: closesAt.toISOString() },
      })
      await enqueueMail(tx, {
        to: lead.email!, purpose: 'grant.reminder', subject, unsubscribeUrl: unsubscribeLinks(lead.email!).oneClick,
        ...renderMail({
          unsubscribeUrl: unsubscribeLinks(lead.email!).page,
          greetingName: lead.fullName,
          preheader: grantLeftLineAr(left, pct, closesAt),
          heading: subject,
          blocks,
        }),
      })
    })
    sent += 1
  }
  return { sent, mailOff: false }
}

/* ═══ آخرُ يومٍ للمنحة ٣٠ أكتوبر — بقرار صاحب المنصّة (٢٤ أكتوبر ٢٠٢٦) ═══

   قال: «لا تنسَ: مدّةُ الانتهاء تكون ٣٠ أكتوبر لاستغلال المنحة». وكانت نهايتُها المحفوظةُ أوّلَ ١ نوفمبر بتوقيت عمّان
   (آخرُ يومٍ ٣١ أكتوبر)، فتصير أوّلَ ٣١ أكتوبر — كما تحفظها شاشتُها (`grantClosesAt`). وتذكيرا ما قبل الانتهاء يتبعانها.

   ولا يقع إلّا مرّة: يُشترط أن تكون النهايةُ ما زالت التي قبل القرار. فإن غيّرها أحدٌ من شاشتها بعدُ لم تُمسّ. */
export const GRANT_CLOSE_FIX = { from: '2026-10-31T21:00:00.000Z', to: '2026-10-30T21:00:00.000Z' } as const

const GRANT_CLOSE_FIX_REASON = 'قرار صاحب المنصة (24 أكتوبر 2026): آخر يوم للمنحة 30 أكتوبر'

/* ═══ ومرّةً واحدةً حقّا — بأثرها لا بقيمتها (٣١ أكتوبر ٢٠٢٦) ═══

   كان شرطُ «مرّة» أن تكون القيمةُ ما زالت التي قبل القرار. والعاملُ يدور كلَّ ساعة، فمن أعاد القيمةَ نفسَها من
   شاشتها بعدُ — مدّ المنحةَ إلى ٣١ أكتوبر، أو جعل حدَّها ٥ بقراره (٢٨ أكتوبر) — أُعيدت خلال ساعةٍ وكُتب الأثرُ
   باسم قراره القديم. فالشرطُ الآن أثرُ التصحيح نفسِه: وقع مرّةً فلا يقع بعدها، وما يكتبه صاحبُ المنصّة يبقى. */
async function fixedBefore(prisma: PrismaClient, campaignId: string, reason: string): Promise<boolean> {
  return (await prisma.auditEvent.count({
    where: { action: 'coupon.grant_settings', entityType: 'grant_campaign', entityId: campaignId, actorId: null, reason },
  })) > 0
}

export async function applyGrantCloseFix(prisma: PrismaClient, fix: { from: string; to: string } = GRANT_CLOSE_FIX): Promise<boolean> {
  const c = await prisma.grantCampaign.findUnique({ where: { slug: MEMBER_GRANT_SLUG }, select: { id: true, closesAt: true } })
  if (!c?.closesAt || c.closesAt.toISOString() !== fix.from) return false
  if (await fixedBefore(prisma, c.id, GRANT_CLOSE_FIX_REASON)) return false
  await prisma.$transaction(async (tx) => {
    await tx.grantCampaign.update({ where: { id: c.id }, data: { closesAt: new Date(fix.to) } })
    await recordAudit(tx, {
      actorId: null, action: 'coupon.grant_settings', entityType: 'grant_campaign', entityId: c.id,
      before: { closesAt: fix.from }, after: { closesAt: fix.to },
      reason: GRANT_CLOSE_FIX_REASON,
    })
  })
  return true
}

/* ═══ وتُمدَّد إلى ١٢ نوفمبر — بقرار صاحب المنصّة (١ نوفمبر ٢٠٢٦) ═══

   قال: «مدّد المنحة إلى 12 نوفمبر»، ثمّ «مددها أيضا إلى 12 نوفمبر» لـ«منحة مؤثرين وجيز». فآخرُ يومٍ للحملتين ١٢ نوفمبر،
   والنهايةُ أوّلَ ١٣ نوفمبر بتوقيت عمّان (`grantClosesAt`).
   وتمديدٌ لا تقصير: لا يقع إلّا والنهايةُ قبلها — فإن مدّها أحدٌ من شاشتها أبعدَ لم تُمسّ، ولا نهايةَ لها لا تُمسّ.
   ومرّةً واحدةً بأثره (`fixedBefore`): فإن غيّرها صاحبُ المنصّة من شاشتها بعدُ بقي ما كتب. */
export const GRANT_EXTEND_FIX = { to: '2026-11-12T21:00:00.000Z' } as const
const GRANT_EXTEND_FIX_REASON = 'قرار صاحب المنصة (1 نوفمبر 2026): تمديد المنحة إلى 12 نوفمبر'

export async function applyGrantExtendFix(
  prisma: PrismaClient, slug: GrantSlug = MEMBER_GRANT_SLUG, fix: { to: string } = GRANT_EXTEND_FIX,
): Promise<boolean> {
  const c = await prisma.grantCampaign.findUnique({ where: { slug }, select: { id: true, closesAt: true } })
  const to = new Date(fix.to)
  if (!c?.closesAt || c.closesAt >= to) return false
  if (await fixedBefore(prisma, c.id, GRANT_EXTEND_FIX_REASON)) return false
  const from = c.closesAt.toISOString()
  await prisma.$transaction(async (tx) => {
    await tx.grantCampaign.update({ where: { id: c.id }, data: { closesAt: to } })
    await recordAudit(tx, {
      actorId: null, action: 'coupon.grant_settings', entityType: 'grant_campaign', entityId: c.id,
      before: { closesAt: from }, after: { closesAt: fix.to },
      reason: GRANT_EXTEND_FIX_REASON,
    })
  })
  return true
}

/* ═══ وتُشغَّل «منحة وجيز العامة» حتى ٣٠ نوفمبر — بقرار صاحب المنصّة (١ نوفمبر ٢٠٢٦) ═══

   قال: «شغّل المنحة العامة وحدّد آخر يومٍ لها»، وخُيّر بين ١٢ و٣٠ نوفمبر و١٥ ديسمبر وبلا نهاية فاختار **٣٠ نوفمبر**.
   فتُشغَّل ونهايتُها أوّلَ ١ ديسمبر بتوقيت عمّان (`grantClosesAt('2026-11-30')`)، ونسبتُها وعددُها وحدُّ دوراتها كما بدأت.
   · **والصفُّ يُنشأ إن لم يكن** — بإعداداته الافتراضيّة كما ينشئه `GrantService.campaign`.
   · **ولا تُشغَّل إلّا موقوفة**: من شغّلها من شاشتها قبلُ بنهايةٍ يختارها لم تُمسّ.
   · **ولا بعد نهايتها**: ما فات يومُه لا يُفتح.
   · **ومرّةً واحدةً بأثره** (`fixedBefore`): فإن أوقفها صاحبُ المنصّة من شاشتها بعدُ بقيت موقوفة. */
export const OPEN_GRANT_LAUNCH = { closesAt: '2026-11-30T21:00:00.000Z' } as const
const OPEN_GRANT_LAUNCH_REASON = 'قرار صاحب المنصة (1 نوفمبر 2026): تشغيل منحة وجيز العامة حتى 30 نوفمبر'

export async function applyOpenGrantLaunch(
  prisma: PrismaClient, now = new Date(), launch: { closesAt: string } = OPEN_GRANT_LAUNCH,
): Promise<boolean> {
  const closesAt = new Date(launch.closesAt)
  if (closesAt <= now) return false
  const { nameAr, defaults } = GRANT_CAMPAIGNS[OPEN_GRANT_SLUG]
  const c = await prisma.grantCampaign.upsert({
    where: { slug: OPEN_GRANT_SLUG },
    create: { slug: OPEN_GRANT_SLUG, nameAr, ...defaults, active: false },
    update: {},
    select: { id: true, active: true, closesAt: true },
  })
  if (c.active) return false
  if (await fixedBefore(prisma, c.id, OPEN_GRANT_LAUNCH_REASON)) return false
  await prisma.$transaction(async (tx) => {
    await tx.grantCampaign.update({ where: { id: c.id }, data: { active: true, closesAt } })
    await recordAudit(tx, {
      actorId: null, action: 'coupon.grant_settings', entityType: 'grant_campaign', entityId: c.id,
      before: { active: false, closesAt: c.closesAt?.toISOString() ?? null }, after: { active: true, closesAt: launch.closesAt },
      reason: OPEN_GRANT_LAUNCH_REASON,
    })
  })
  return true
}

/* ═══ وبريدُ «مددنا منحتك» لمن لم يشترِ — بقرار صاحب المنصّة (١ نوفمبر ٢٠٢٦) ═══

   قال: «ارسل للي ما اشتروا ايميل ان المنحة تمددت». فمن أخذ كودَه قبل التمديد ولم يشترِ ولا ينتظر طلبُه الدفع
   يصله بريدٌ واحدٌ بآخر يومٍ الجديد وكودِه، وزرٌّ يعيده إلى ما اختاره أو إلى صفحة منحته.
   · **مرّةً لكلّ عميل**: أثرُه (`coupon.grant_reminder` بمرحلة `extended`) يُكتب مع البريد في معاملةٍ واحدة.
   · **لمن سبق التمديدَ وحدَه**: من عبّأ بعده أخذ كودَه وآخرُ يومٍ أمامه، فلا يُقال له «مددنا».
   · **ولا يقع إلّا والتمديدُ وقع** لهذه الحملة (أثرُه) وهي مفتوحة. والقناةُ مفصولةً لا بريدَ ولا أثر، فيصل حين توصل. */
export const GRANT_EXTENDED_STAGE = 'extended'
export const grantExtendedSubjectAr = (lastDay: string) => `مددنا منحتك حتى ${lastDay}`
/** ما ينتظره في وجيز — نصُّ صاحب المنصّة (١ نوفمبر ٢٠٢٦) كما كتبه، بلا حركاتٍ (قاعدةُ نصوص الشاشات) */
export const GRANT_EXTENDED_PERKS_AR = [
  'تطبيق عملي ومشروع تخرج يراجعه مدربك',
  'مدربون معتمدون في لقاءات مباشرة على Zoom لا دروس مسجلة',
  'شهادة اجتياز ورسالة توصية لمشرفك في العمل أو الدراسة',
  'تشخيص مهاري لتحليل احتياجك المهني من المهارات مجاني.',
  'اختبار اكتشف ميولك في ٣ دقائق مع «المرآة»، مجانا',
  'افحص مستواك في المهارة التي تريدها، من الأساسي إلى المتقدم، في ٣ دقائق مجانا.',
  'اعرف مستواك في الإنجليزية (قواعد ومفردات وقراءة) في ٢٠ دقيقة أو أقل، مجانا.',
  'متابعة إنجازك بمستشار مهني خاص لضمان التقدم والاستفادة.',
] as const

export async function sendGrantExtendedNotice(
  prisma: PrismaClient, now = new Date(), slug: GrantSlug = MEMBER_GRANT_SLUG,
): Promise<{ sent: number; mailOff: boolean }> {
  const campaign = await prisma.grantCampaign.findUnique({
    where: { slug }, select: { id: true, active: true, closesAt: true, percentOff: true },
  })
  const closesAt = campaign?.closesAt
  if (!campaign?.active || !closesAt || closesAt <= now) return { sent: 0, mailOff: false }
  const extended = await prisma.auditEvent.findFirst({
    where: { action: 'coupon.grant_settings', entityType: 'grant_campaign', entityId: campaign.id, actorId: null, reason: GRANT_EXTEND_FIX_REASON },
    select: { createdAt: true },
  })
  if (!extended) return { sent: 0, mailOff: false }

  const told = await prisma.auditEvent.findMany({
    where: { action: 'coupon.grant_reminder', entityType: 'lead', meta: { path: ['stage'], equals: GRANT_EXTENDED_STAGE } },
    select: { entityId: true },
  })
  const leads = await prisma.lead.findMany({
    where: {
      campaign: slug, erasedAt: null, email: { not: null },
      createdAt: { lt: extended.createdAt },
      grantCode: { campaignId: campaign.id },
      id: { notIn: told.map((r) => r.entityId) },
    },
    orderBy: { createdAt: 'asc' },
    select: {
      id: true, fullName: true, email: true, grantPicks: true,
      influencer: { select: { code: true } },
      grantCode: { select: { coupon: { select: {
        code: true, percentOff: true,
        orders: { where: { status: { in: [...BOUGHT, 'pending_payment'] } }, select: { id: true } },
      } } } },
    },
  })
  if (leads.length === 0) return { sent: 0, mailOff: false }
  if (!(await liveChannels(prisma)).includes('email')) return { sent: 0, mailOff: true }
  const paid = await paidEmails(prisma, leads.map((l) => l.email).filter((e): e is string => !!e))
  const off = await optedOut(prisma, leads.map((l) => l.email).filter((e): e is string => !!e))

  const pool = new Map((await new GrantCoursesService(prisma).openCourses(now)).courses.map((c) => [c.courseId, c]))
  const lastDay = fmtDateLong(new Date(closesAt.getTime() - 1))
  const subject = grantExtendedSubjectAr(lastDay)
  let sent = 0
  for (const lead of leads) {
    const coupon = lead.grantCode?.coupon
    if (!coupon || !lead.email || coupon.orders.length > 0 || paid.has(lead.email.toLowerCase()) || off.has(lead.email.toLowerCase())) continue
    const pct = coupon.percentOff ?? campaign.percentOff
    const base = lead.influencer ? influencerLink(publicSiteUrl(), lead.influencer.code) : `${publicSiteUrl()}/grant`
    const mine = lead.grantPicks.map((id) => pool.get(id)).filter((c): c is NonNullable<typeof c> => !!c)
    const blocks: MailBlock[] = [
      { kind: 'p', text: `منحتك ما زالت قائمة، وتصل إلى ${pct}% من سعر الدورات.` },
      { kind: 'p', text: 'ما ينتظرك في وجيز:' },
      { kind: 'list', items: [...GRANT_EXTENDED_PERKS_AR] },
      { kind: 'facts', rows: [
        { label: 'كود منحتك', value: coupon.code },
        { label: 'آخر يوم', value: lastDay },
      ] },
      mine.length > 0
        ? { kind: 'cta', label: GRANT_PICKS_CTA_AR, href: grantPicksLink(base, mine.map((c) => c.courseId)) }
        : { kind: 'cta', label: 'اختر دوراتك', href: base },
      { kind: 'note', text: 'وإن لم تحتجها، يمكنك أن تهدي الكود لغيرك.' },
    ]
    await prisma.$transaction(async (tx) => {
      await recordAudit(tx, {
        action: 'coupon.grant_reminder', entityType: 'lead', entityId: lead.id,
        meta: { stage: GRANT_EXTENDED_STAGE, campaign: slug, picks: mine.length },
      })
      await enqueueMail(tx, {
        to: lead.email!, purpose: 'grant.extended', subject, unsubscribeUrl: unsubscribeLinks(lead.email!).oneClick,
        ...renderMail({
          unsubscribeUrl: unsubscribeLinks(lead.email!).page,
          greetingName: lead.fullName,
          preheader: `كودك يعمل حتى ${lastDay}.`,
          heading: subject,
          blocks,
        }),
      })
    })
    sent += 1
  }
  return { sent, mailOff: false }
}

/* ═══ والمنحةُ تغطّي ٤ دوراتٍ بحدٍّ أقصى — بقرار صاحب المنصّة (٢٤ أكتوبر ٢٠٢٦) ═══

   قال: «ضعها له وكأنّك تقول اختر ٤ دوراتٍ بحدٍّ أقصى، لكي يشعر أنّ المنحةَ عظيمة»، واختار تغييرَ الحدّ من ٥ إلى ٤ لا
   القولَ وحدَه — فلا تقول الصفحةُ ٤ وتقبل ٥. والحدُّ نفسُه يُفحص عند الدفع (`maxCourses` في `grant.service.ts`).
   ولا يقع إلّا مرّة: يُشترط أن يكون الحدُّ ما زال ٥. فإن غيّره أحدٌ من شاشته بعدُ لم يُمسّ. */
export const GRANT_COURSES_FIX = { from: 5, to: 4 } as const
const GRANT_COURSES_FIX_REASON = 'قرار صاحب المنصة (24 أكتوبر 2026): المنحة تغطي 4 دورات بحد أقصى'

export async function applyGrantCoursesFix(prisma: PrismaClient, fix: { from: number; to: number } = GRANT_COURSES_FIX): Promise<boolean> {
  const c = await prisma.grantCampaign.findUnique({ where: { slug: MEMBER_GRANT_SLUG }, select: { id: true, maxCourses: true } })
  if (!c || c.maxCourses !== fix.from) return false
  if (await fixedBefore(prisma, c.id, GRANT_COURSES_FIX_REASON)) return false
  await prisma.$transaction(async (tx) => {
    await tx.grantCampaign.update({ where: { id: c.id }, data: { maxCourses: fix.to } })
    await recordAudit(tx, {
      actorId: null, action: 'coupon.grant_settings', entityType: 'grant_campaign', entityId: c.id,
      before: { maxCourses: fix.from }, after: { maxCourses: fix.to },
      reason: GRANT_COURSES_FIX_REASON,
    })
  })
  return true
}
