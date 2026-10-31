/* من عبّأ نموذج المنحة — ملفُّ كلِّ واحدٍ وما يُفعل به (٣١ أكتوبر ٢٠٢٦).

   طلبُ صاحب المنصّة: «أريد تفاصيلَ أكثر عن كلّ شخص مثل وقت فتح الرابط والمصدر … وأن أستطيع أن أنزّل الملفّ Excel،
   وأريد أن أعلم ما يصلهم من إيميلات، سواءٌ تذكيرٌ أو غيرُه، ومواعيدَها … وخيارَ حذف أيِّ طالبٍ لا أريده، وخيارَ إرسال
   إيميلٍ للجميع بنصٍّ أكتبه أنا أو إيميلٍ لكلّ شخصٍ مثل الواتساب».

   ═══ ما يقع ═══

   ١) **القائمةُ** (`registrantsFull`) — صفُّ `grantRegistrants` ومعه: مصدرُه مسمّى (`registrantSource`)، ومتى فتح صفحةَ
      المنحة، و**كلُّ بريدٍ كُتب لعنوانه** بموضوعه وغرضه وحاله ومتى خرج — من طابور البريد نفسِه لا من سجلٍّ موازٍ، فما
      وصله من غير المنحة يُرى أيضا. و**ما هو آتٍ**: تذكيرا ما قبل انتهاء المنحة بموعدَيهما لمن سيصله (من له كودٌ وبريدٌ ولم
      يشترِ ولم يُذكَّر بالمرحلة)، ومكالمةُ مستشاره إن كانت مجدولة.
   ٢) **Excel** (`registrantsXlsx`) — ورقةٌ بالأشخاص، وورقةٌ بكلّ رسالة، وورقةٌ بالإحصاءات. بالقائمة نفسِها لا بنسخةٍ عنها.
   ٣) **الحذف** (`eraseRegistrant`) — كمحو الستّة أشهر (`guest-erasure.service.ts`): يُمحى الاسمُ والرقمُ والبريدُ وزيارتاه،
      وتُغلق حالاتُه ويُمحى نصُّها، فيخرج من القائمة ولا يصله تذكيرٌ ولا مكالمة. ويبقى عددُه في نتائج الحملة. و**كودُه
      بخيارٍ** — قاعدةُ «لا إجبار على فعل»: يُبطَل فلا يُشترى به، أو يبقى يعمل لمن أُهدي إليه. وكودٌ اشتُري به لا يُبطَل.
      وحسابُه إن كان له حسابٌ لا يُمسّ: له بابُه.
   ٤) **رسالةٌ يكتبها صاحبُ المنصّة** (`messageRegistrants`) — لمن يختارهم: الكلّ، أو من في التصفية، أو واحدٌ من صفّه.
      بقالب الأكاديمية، وتحيّتُه باسم كلٍّ، وتُكتب في الطابور دفعةً واحدةً بمرجعٍ واحد (`batchId`) وأثرٍ يسمّي من أرسل.
      ومن لا بريدَ له يُعدّ ولا يُكتب له.

   والحارس: `server/tests/commerce/grant-registrants.test.ts`. */

import { randomUUID } from 'node:crypto'
import { Prisma, type PrismaClient } from '@prisma/client'
import ExcelJS from 'exceljs'
import { recordAudit } from './audit'
import { AuthError } from './auth.service'
import { enqueueMail } from './outbox.service'
import { renderMail } from './mail-template'
import { liveChannels } from './notification.service'
import { eraseLeadCases, ERASED_NAME_AR } from './guest-erasure.service'
import { BOUGHT, GRANT_REMINDERS, grantRegistrants } from './grant-followup.service'
import { cleanTouch, storedSource, type FirstTouch } from '../../src/application/marketing/signup-source'
import { INFLUENCER_GRANT_SLUG, MEMBER_GRANT_SLUG } from '../../src/application/commerce/grant'
import {
  GRANT_MESSAGE_MAX_TO, MAIL_STATE_AR, SOURCE_GROUP_AR, conversionAr, mailPurposeAr, messageParagraphs, registrantSource, registrantStats,
  type MailState, type RegistrantSource, type Upcoming,
} from '../../src/application/commerce/grant-registrants'
import { zonedClock, zonedDay } from '../../src/application/trainer/cohort-period'

/** ما يُكتب مكانَ نصّ حالاته حين يحذفه مدير */
export const REMOVED_TEXT_AR = 'حذفه مدير من قائمة المنحة'

const STAGE_AR: Record<string, string> = { '3d': 'تذكير: بقيت ثلاثة أيام', '1d': 'تذكير: اليوم آخر يوم' }

export interface RegistrantMail {
  id: string
  subject: string
  purpose: string | null
  purposeAr: string
  status: MailState
  createdAt: Date
  sentAt: Date | null
}

const asTouch = (v: Prisma.JsonValue | null): FirstTouch | null => cleanTouch(v)

export async function registrantsFull(prisma: PrismaClient, now = new Date()) {
  const base = await grantRegistrants(prisma)
  const emails = [...new Set(base.map((r) => r.email?.toLowerCase()).filter((e): e is string => !!e))]

  const [mails, accounts, campaigns, reminded, mailOn] = await Promise.all([
    emails.length === 0 ? [] : prisma.outboxMail.findMany({
      where: { to: { in: emails } },
      orderBy: { createdAt: 'asc' },
      select: { id: true, to: true, subject: true, purpose: true, status: true, createdAt: true, sentAt: true },
    }),
    /* ومن عبّأ قبل تتبّع زيارته وله حسابٌ حُفظ مصدرُه — يُسمّى مصدرُه بحسابه */
    emails.length === 0 ? [] : prisma.user.findMany({
      where: { email: { in: emails } }, select: { email: true, signupSource: true },
    }),
    prisma.grantCampaign.findMany({
      where: { slug: { in: [MEMBER_GRANT_SLUG, INFLUENCER_GRANT_SLUG] } }, select: { slug: true, active: true, closesAt: true },
    }),
    prisma.auditEvent.findMany({
      where: { action: 'coupon.grant_reminder', entityType: 'lead', entityId: { in: base.map((r) => r.id) } },
      select: { entityId: true, meta: true },
    }),
    liveChannels(prisma).then((c) => c.includes('email')),
  ])

  const byTo = new Map<string, RegistrantMail[]>()
  for (const m of mails) {
    const list = byTo.get(m.to.toLowerCase()) ?? []
    list.push({
      id: m.id, subject: m.subject, purpose: m.purpose, purposeAr: mailPurposeAr(m.purpose),
      status: (['queued', 'sent', 'failed'].includes(m.status) ? m.status : 'queued') as MailState, createdAt: m.createdAt, sentAt: m.sentAt,
    })
    byTo.set(m.to.toLowerCase(), list)
  }
  const account = new Map(accounts.map((a) => [a.email.toLowerCase(), a.signupSource]))
  const stagesSent = new Map<string, Set<string>>()
  for (const a of reminded) {
    const stage = (a.meta as { stage?: string } | null)?.stage
    if (!stage) continue
    const s = stagesSent.get(a.entityId) ?? new Set<string>()
    s.add(stage)
    stagesSent.set(a.entityId, s)
  }
  const campaign = new Map(campaigns.map((c) => [c.slug, c]))

  /* ورابطُ المدرّب يُسمّى بصاحبه — نداءٌ واحدٌ للقائمة كلّها، كقائمة المستخدمين */
  const touches = base.map((r) => {
    const own = asTouch(r.firstTouch)
    const acc = r.email ? account.get(r.email.toLowerCase()) : null
    return { page: asTouch(r.pageTouch), first: own ?? (acc ? cleanTouch(storedSource(acc)) : null) }
  })
  const refCodes = [...new Set(touches.flatMap((t) => [t.page?.refCode, t.first?.refCode]).filter((c): c is string => !!c))]
  const refLinks = refCodes.length === 0 ? [] : await prisma.trainerReferralLink.findMany({
    where: { code: { in: refCodes } },
    select: { code: true, profile: { select: { application: { select: { fullName: true } }, user: { select: { displayName: true } } } } },
  })
  const refName = new Map(refLinks.map((l) => [l.code, l.profile.application.fullName || l.profile.user?.displayName || null]))

  const rows = base.map((r, n) => {
    const t = touches[n]
    const source: RegistrantSource = registrantSource({
      influencer: r.influencer, influencerCode: r.influencerCode, channel: r.channel, wave: r.wave,
      pageTouch: t.page, firstTouch: t.first, trainerName: (c) => refName.get(c) ?? null,
    })
    const upcoming: Upcoming[] = []
    const c = r.campaign ? campaign.get(r.campaign) : undefined
    if (c?.active && c.closesAt && r.code && r.email && r.state !== 'bought') {
      for (const s of GRANT_REMINDERS) {
        const due = new Date(c.closesAt.getTime() - s.beforeMs)
        if (due > now && !stagesSent.get(r.id)?.has(s.stage)) upcoming.push({ kind: 'reminder', at: due.toISOString(), labelAr: STAGE_AR[s.stage] ?? 'تذكير' })
      }
    }
    if (r.nextCall) {
      upcoming.push({
        kind: 'call', at: r.nextCall.scheduledAt.toISOString(),
        labelAr: `${r.nextCall.channel === 'phone' ? 'مكالمة' : 'متابعة'} المستشار${r.advisor ? ` ${r.advisor}` : ''}`,
      })
    }
    upcoming.sort((a, b) => a.at.localeCompare(b.at))
    return {
      id: r.id, fullName: r.fullName, phone: r.phone, email: r.email, workField: r.workField, careerLevel: r.careerLevel,
      interests: r.interests, channel: r.channel, wave: r.wave, createdAt: r.createdAt, code: r.code, codeActive: r.codeActive,
      state: r.state, advisor: r.advisor, picks: r.picks, influencer: r.influencer, influencerCode: r.influencerCode,
      pageOpenedAt: r.pageOpenedAt ?? (t.page?.at ? new Date(t.page.at) : null),
      firstSeenAt: t.first?.at ? new Date(t.first.at) : null,
      landingPath: t.page?.landingPath ?? t.first?.landingPath ?? null,
      source,
      mails: r.email ? byTo.get(r.email.toLowerCase()) ?? [] : [],
      upcoming,
    }
  })
  return { mailOn, rows }
}

export type FullRegistrant = Awaited<ReturnType<typeof registrantsFull>>['rows'][number]

/* ═══ Excel ═══ */

const STATE_AR: Record<string, string> = { bought: 'اشترى', pending: 'ينتظر الدفع', none: 'لم يشتر بعد' }
const stamp = (d: Date | string | null | undefined) => (d ? `${zonedDay(d)} ${zonedClock(d)}` : '')

export async function registrantsXlsx(prisma: PrismaClient, now = new Date()): Promise<Buffer> {
  const { rows } = await registrantsFull(prisma, now)
  const wb = new ExcelJS.Workbook()
  const head = (ws: ExcelJS.Worksheet) => { ws.getRow(1).font = { bold: true }; ws.views = [{ rightToLeft: true, state: 'frozen', ySplit: 1 }] }

  const people = wb.addWorksheet('من عبأ النموذج')
  people.columns = [
    { header: 'الاسم', key: 'name', width: 26 },
    { header: 'الهاتف', key: 'phone', width: 18 },
    { header: 'البريد', key: 'email', width: 30 },
    { header: 'المنحة', key: 'grant', width: 18 },
    { header: 'المصدر', key: 'source', width: 18 },
    { header: 'تفصيل المصدر', key: 'sourceLabel', width: 30 },
    { header: 'تفاصيل أخرى', key: 'sourceDetail', width: 34 },
    { header: 'فتح صفحة المنحة', key: 'opened', width: 18 },
    { header: 'أول زيارة للموقع', key: 'firstSeen', width: 18 },
    { header: 'عبأ النموذج', key: 'created', width: 18 },
    { header: 'الحالة', key: 'state', width: 14 },
    { header: 'الكود', key: 'code', width: 16 },
    { header: 'المستشار', key: 'advisor', width: 18 },
    { header: 'مجال العمل', key: 'field', width: 20 },
    { header: 'المستوى', key: 'level', width: 16 },
    { header: 'يريد تطوير', key: 'interests', width: 34 },
    { header: 'الدورات التي اختارها', key: 'picks', width: 40 },
    { header: 'الرسائل المرسلة', key: 'mailCount', width: 14 },
    { header: 'آخر رسالة', key: 'lastMail', width: 34 },
    { header: 'الموعد القادم', key: 'next', width: 34 },
  ]
  for (const r of rows) {
    const last = r.mails.at(-1)
    const next = r.upcoming[0]
    people.addRow({
      name: r.fullName, phone: r.phone ?? '', email: r.email ?? '',
      grant: r.influencer ? 'منحة مؤثرين وجيز' : 'منحة وجيز',
      source: SOURCE_GROUP_AR[r.source.group], sourceLabel: r.source.labelAr, sourceDetail: r.source.detailAr ?? '',
      opened: stamp(r.pageOpenedAt), firstSeen: stamp(r.firstSeenAt), created: stamp(r.createdAt),
      state: STATE_AR[r.state], code: r.code ?? '', advisor: r.advisor ?? '',
      field: r.workField ?? '', level: r.careerLevel ?? '', interests: r.interests.join('، '), picks: r.picks.join('، '),
      mailCount: r.mails.length, lastMail: last ? `${last.purposeAr} · ${stamp(last.sentAt ?? last.createdAt)}` : '',
      next: next ? `${next.labelAr} · ${stamp(next.at)}` : '',
    })
  }
  head(people)

  const mails = wb.addWorksheet('الرسائل')
  mails.columns = [
    { header: 'الاسم', key: 'name', width: 26 },
    { header: 'البريد', key: 'email', width: 30 },
    { header: 'الرسالة', key: 'purpose', width: 24 },
    { header: 'الموضوع', key: 'subject', width: 40 },
    { header: 'الحال', key: 'state', width: 14 },
    { header: 'كتبت', key: 'created', width: 18 },
    { header: 'أرسلت', key: 'sent', width: 18 },
  ]
  for (const r of rows) {
    for (const m of r.mails) {
      mails.addRow({
        name: r.fullName, email: r.email ?? '', purpose: m.purposeAr, subject: m.subject,
        state: MAIL_STATE_AR[m.status], created: stamp(m.createdAt), sent: stamp(m.sentAt),
      })
    }
    for (const u of r.upcoming) {
      mails.addRow({ name: r.fullName, email: r.email ?? '', purpose: u.labelAr, subject: '', state: 'مجدولة', created: '', sent: stamp(u.at) })
    }
  }
  head(mails)

  const s = registrantStats(rows.map((r) => ({
    ...r, createdAt: r.createdAt.toISOString(), pageOpenedAt: r.pageOpenedAt?.toISOString() ?? null,
  })))
  const stats = wb.addWorksheet('الإحصاءات')
  stats.columns = [{ header: 'البند', key: 'k', width: 34 }, { header: 'العدد', key: 'n', width: 12 }, { header: 'اشترى', key: 'b', width: 22 }]
  const section = (title: string) => { stats.addRow({}); stats.addRow({ k: title }).font = { bold: true } }
  stats.addRow({ k: 'من عبأ النموذج', n: s.total, b: conversionAr({ n: s.total, bought: s.bought }) })
  stats.addRow({ k: 'أخذ كودا', n: s.withCode })
  stats.addRow({ k: 'ينتظر الدفع', n: s.pending })
  stats.addRow({ k: 'لم يشتر بعد', n: s.none })
  stats.addRow({ k: 'له مستشار', n: s.withAdvisor })
  stats.addRow({ k: 'منحة وجيز', n: s.member })
  stats.addRow({ k: 'منحة مؤثرين وجيز', n: s.influencer })
  if (s.openToFormMedianMin !== null) stats.addRow({ k: 'من فتح الصفحة إلى التعبئة (وسيط بالدقائق)', n: s.openToFormMedianMin })
  const block = (title: string, list: { labelAr: string; n: number; bought: number }[]) => {
    section(title)
    for (const c of list) stats.addRow({ k: c.labelAr, n: c.n, b: conversionAr(c) })
  }
  block('المصدر', s.bySource)
  block('مجال العمل', s.byField)
  block('المستوى', s.byLevel)
  block('يريد تطوير', s.byInterest)
  block('الدورات المختارة', s.byPick)
  section('حسب اليوم')
  for (const d of s.byDay) stats.addRow({ k: d.day, n: d.n })
  section('الرسائل')
  stats.addRow({ k: 'كل الرسائل', n: s.mails.total })
  stats.addRow({ k: 'أرسلت', n: s.mails.sent })
  stats.addRow({ k: 'في الطريق', n: s.mails.queued })
  stats.addRow({ k: 'تعذر إرسالها', n: s.mails.failed })
  for (const c of s.mails.byPurpose) stats.addRow({ k: c.labelAr, n: c.n })
  head(stats)

  return Buffer.from(await wb.xlsx.writeBuffer())
}

/* ═══ الحذف ═══ */

export async function eraseRegistrant(
  prisma: PrismaClient, id: string, opts: { disableCode: boolean }, actorId: string, ip?: string, now = new Date(),
) {
  const lead = await prisma.lead.findFirst({
    where: { id, campaign: { in: [MEMBER_GRANT_SLUG, INFLUENCER_GRANT_SLUG] }, erasedAt: null },
    select: {
      id: true, campaign: true,
      grantCode: { select: { coupon: { select: { id: true, code: true, orders: { where: { status: { in: BOUGHT } }, select: { id: true } } } } } },
    },
  })
  if (!lead) throw new AuthError('not_found', 'لم نجده في القائمة', 404)
  const coupon = lead.grantCode?.coupon
  /* كودٌ اشتُري به لا يُبطَل: الشراءُ تمّ، وإبطالُه لا يردّ شيئا ويقطع ما بقي من استعماله */
  const disable = opts.disableCode && !!coupon && coupon.orders.length === 0
  await prisma.$transaction(async (tx) => {
    await tx.lead.update({
      where: { id },
      data: {
        fullName: ERASED_NAME_AR, email: null, phone: null, erasedAt: now,
        firstTouch: Prisma.DbNull, pageTouch: Prisma.DbNull, pageOpenedAt: null, grantPicks: [],
      },
    })
    await eraseLeadCases(tx, id, REMOVED_TEXT_AR)
    if (disable) await tx.coupon.update({ where: { id: coupon!.id }, data: { active: false } })
    await recordAudit(tx, {
      action: 'coupon.grant_registrant_removed', entityType: 'lead', entityId: id, actorId, ip,
      meta: { campaign: lead.campaign, code: coupon?.code ?? null, codeDisabled: disable },
    })
  })
  return { ok: true as const, codeDisabled: disable }
}

/* ═══ رسالةُ صاحب المنصّة ═══ */

export async function messageRegistrants(
  prisma: PrismaClient,
  input: { ids: string[]; subject: string; body: string },
  actorId: string, ip?: string,
) {
  const ids = [...new Set(input.ids)].slice(0, GRANT_MESSAGE_MAX_TO)
  const subject = input.subject.trim()
  const paragraphs = messageParagraphs(input.body)
  if (!subject) throw new AuthError('bad_subject', 'اكتب عنوان الرسالة', 400)
  if (paragraphs.length === 0) throw new AuthError('bad_body', 'اكتب نص الرسالة', 400)
  const leads = await prisma.lead.findMany({
    where: { id: { in: ids }, campaign: { in: [MEMBER_GRANT_SLUG, INFLUENCER_GRANT_SLUG] }, erasedAt: null },
    select: { id: true, fullName: true, email: true },
  })
  const to = leads.filter((l): l is typeof l & { email: string } => !!l.email)
  const batchId = randomUUID()
  await prisma.$transaction(async (tx) => {
    for (const l of to) {
      await enqueueMail(tx, {
        to: l.email, purpose: 'grant.message', subject, batchId,
        ...renderMail({
          greetingName: l.fullName,
          preheader: paragraphs[0].slice(0, 140),
          heading: subject,
          blocks: paragraphs.map((text) => ({ kind: 'p' as const, text })),
        }),
      })
    }
    await recordAudit(tx, {
      /* لواحدٍ يُقرأ في أثره هو، ولأكثرَ أثرُ الدفعة بمرجعها */
      action: 'coupon.grant_message', ...(to.length === 1 ? { entityType: 'lead', entityId: to[0].id } : { entityType: 'mail_batch', entityId: batchId }), actorId, ip,
      meta: { batchId, subject, sent: to.length, noEmail: leads.length - to.length, asked: ids.length },
    })
  }, { timeout: 120_000 })
  const mailOn = (await liveChannels(prisma)).includes('email')
  return { sent: to.length, noEmail: leads.length - to.length, mailOn, batchId }
}
