/* من عبّأ نموذج المنحة ولم يشترِ (٢٠ أكتوبر ٢٠٢٦) — والعلّةُ في رأس `grant-followup.service.ts`.

   ① **القائمةُ تقول ما فعل كلٌّ** — اشترى (بكوده ولو اشترى به غيرُه، أو ببريده بلا كود)، أو ينتظر الدفع، أو
      لم يشترِ بعد؛ ومستشارُه إن كانت له حالة.
   ② **ومن لم يشترِ بعد ساعةٍ تُفتح له حالةٌ عند مستشار، وفيها مكالمةٌ هاتفيّةٌ مجدولةٌ** — موعدُها ساعتان بعد النموذج
      في ساعات العمل (`grantCallDueAt`)؛ مرّةً واحدة، وتُسند، ويُكتب أثرُها.
   ③ **ولا تُفتح** لمن لم يمضِ عليه يومان، ولا لمن اشترى، ولا لمن ينتظر طلبُه الدفع، ولا لمن له حالةٌ قبلُ.
   ④ **والعاملُ يفتحها.**
   ⑤ **وتذكيرٌ قبل انتهاء المنحة** — بريدٌ قبل ثلاثة أيّامٍ وفي آخر يوم، التاسعةَ صباحا بتوقيت عمّان، مرّةً لكلّ
      مرحلة، والأحدثُ وحدَها لمن فاتته الأولى؛ ولا يصل من اشترى ولا من ينتظر طلبُه الدفع ولا من أخذ كودَه للتوّ،
      ولا يُكتب شيءٌ وقناةُ البريد مفصولة. */

import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import type { PrismaClient } from '@prisma/client'
import { setupTestDb, testPrisma } from '../helpers/db'
import { makeAdvisor } from '../helpers/advisor'
import { AuthService } from '../../services/auth.service'
import { CommerceService } from '../../services/commerce.service'
import { GrantService } from '../../services/grant.service'
import { GrantLandingService } from '../../services/grant-landing.service'
import { GRANT_CLOSE_FIX, GRANT_COURSES_FIX, GRANT_FOLLOWUP_HOURS, applyGrantCloseFix, applyGrantCoursesFix, grantRegistrants, openGrantFollowups, sendGrantReminders } from '../../services/grant-followup.service'
import { zonedDay } from '../../../src/application/trainer/cohort-period'
import { grantCallDueAt } from '../../../src/application/commerce/grant-landing'
import { INFLUENCER_GRANT_SLUG } from '../../../src/application/commerce/grant'
import { runJob } from '../../worker/jobs'
import { approvedTrainerPlan } from '../helpers/approved-trainer'

let prisma: PrismaClient
let auth: AuthService
let commerce: CommerceService
let landing: GrantLandingService
let ownerId = ''
let pool: string[] = []
let seq = 0
const STAMP = Date.now()
const HOUR = 3_600_000

const nextCourse = () => {
  const id = pool.shift()
  if (!id) throw new Error('نفدت الدوراتُ المنشورة')
  return id
}
async function cohort() {
  return prisma.cohort.create({
    data: {
      plans: { create: await approvedTrainerPlan(prisma) }, courseId: nextCourse(), title: `شعبة المتابعة ${++seq}`,
      status: 'open', registrationOpen: true, financialReady: true, price: 150, currency: 'USD', capacity: 20,
      startsAt: new Date(Date.now() + 30 * 24 * HOUR),
    },
  })
}
/** عضوٌ عبّأ النموذج قبل `hoursAgo` ساعة */
async function member(hoursAgo = GRANT_FOLLOWUP_HOURS + 1) {
  seq += 1
  const email = `fu-${seq}-${STAMP}@test.local`
  const out = await landing.apply({ fullName: `عضو ${seq}`, phone: `0792${String(600000 + seq)}`, email, workField: 'الهندسة' })
  await prisma.lead.update({ where: { id: out.ref }, data: { createdAt: new Date(Date.now() - hoursAgo * HOUR) } })
  return { ref: out.ref, code: out.grant!.code!, email }
}
const learner = async (email = `fu-buyer-${++seq}-${STAMP}@test.local`) => (await auth.register(email, 'Buyer#12345', `مشتر ${seq}`)).userId
const casesOf = (leadId: string) => prisma.advisorCase.findMany({ where: { leadId }, include: { assignments: true } })

beforeAll(async () => {
  await setupTestDb()
  prisma = await testPrisma()
  auth = new AuthService(prisma)
  commerce = new CommerceService(prisma)
  landing = new GrantLandingService(prisma)
  ownerId = (await auth.register(`fu-owner-${STAMP}@test.local`, 'Owner#12345', 'صاحب المنصة')).userId
  const adv = (await auth.register(`fu-adv-${STAMP}@test.local`, 'Advisor#12345', 'مستشار المتابعة')).userId
  await makeAdvisor(prisma, auth, adv)
  pool = (await prisma.course.findMany({ where: { status: 'published' }, select: { id: true }, orderBy: { id: 'asc' } })).map((c) => c.id)
  await new GrantService(prisma).update({ active: true, percentOff: 60, maxCodes: null, maxCourses: 4, closesAt: null }, ownerId)
}, 240_000)

describe('① القائمة تقول ما فعل كل واحد', () => {
  it('⚠️ اشترى بكوده ولو اشترى به غيره، أو ببريده بلا كود — أو ينتظر الدفع، أو لم يشتر', async () => {
    const gifted = await member()
    const friend = await learner()
    const o = await commerce.checkout(friend, [(await cohort()).id], gifted.code)
    await commerce.payOrder(o.orderId, friend, `fu-${o.orderId}`)

    const byEmail = await member()
    const self = await learner(byEmail.email)
    const o2 = await commerce.checkout(self, [(await cohort()).id])
    await commerce.payOrder(o2.orderId, self, `fu-${o2.orderId}`)

    const pending = await member()
    await commerce.checkout(await learner(), [(await cohort()).id], pending.code)

    const idle = await member()
    await landing.askAdvisor(idle.ref)

    const list = await grantRegistrants(prisma)
    const of = (ref: string) => list.find((r) => r.id === ref)!
    expect(of(gifted.ref).state, 'لم يحسب شراء صديقه بكوده').toBe('bought')
    expect(of(byEmail.ref).state, 'لم يحسب شراءه ببريده').toBe('bought')
    expect(of(pending.ref).state).toBe('pending')
    expect(of(idle.ref).state).toBe('none')
    expect(of(idle.ref).advisor, 'لم يقل مستشاره').toBeTruthy()
    expect(of(gifted.ref).code).toBe(gifted.code)
  })

  /* رابطُ ملفّه (`/g/<كوده>`) في رسالة «راسل مستشارك» من صفحة المؤثّر يفتح هذه القائمة — فكان يفتحها وليس هو فيها */
  it('⚠️ ومن «منحة مؤثرين وجيز» فيها أيضا — بكود مؤثّره، ومن «منحة وجيز» بلا مؤثّر', async () => {
    const inf = await prisma.influencer.create({ data: { nameAr: 'مؤثر القائمة', code: `FU${String(STAMP).slice(-8)}` } })
    const viaInf = await prisma.lead.create({
      data: { fullName: 'متابع المؤثر', email: `fu-inf-${STAMP}@test.local`, source: 'campaign', campaign: INFLUENCER_GRANT_SLUG, influencerId: inf.id },
    })
    const plain = await member()
    const list = await grantRegistrants(prisma)
    const row = list.find((r) => r.id === viaInf.id)
    expect(row, 'لم يظهر من جاء من منحة المؤثرين').toBeTruthy()
    expect(row!.influencer).toBe(true)
    expect(row!.influencerCode).toBe(inf.code)
    expect(list.find((r) => r.id === plain.ref)!.influencer).toBe(false)
  })
})

describe('② و③ من لم يشتر بعد ساعة — حالة عند مستشار ومكالمة مجدولة، مرة واحدة', () => {
  it('⚠️ تفتح وتسند ويكتب أثرها — ولا تفتح للجديد ولا للمشتري ولا لمن ينتظر الدفع ولا لمن له حالة', async () => {
    /* بالساعات نفسِها لا بالثابت — فعودتُه إلى يومين تسقط هنا */
    const late = await member(2)
    const fresh = await member(0.5)
    const bought = await member()
    const buyer = await learner()
    const o = await commerce.checkout(buyer, [(await cohort()).id], bought.code)
    await commerce.payOrder(o.orderId, buyer, `fu-${o.orderId}`)
    const paying = await member()
    await commerce.checkout(await learner(), [(await cohort()).id], paying.code)
    const asked = await member()
    await landing.askAdvisor(asked.ref)
    /* واشترى ببريده بلا كود */
    const direct = await member()
    const me = await learner(direct.email)
    const o3 = await commerce.checkout(me, [(await cohort()).id])
    await commerce.payOrder(o3.orderId, me, `fu-${o3.orderId}`)

    const NOW = new Date()
    await openGrantFollowups(prisma, NOW)
    const cases = await casesOf(late.ref)
    expect(cases, 'لم تفتح حالة لمن لم يشتر بعد ساعة').toHaveLength(1)
    expect(cases[0].nextAction).toContain('اتصل به — عبأ نموذج المنحة')
    /* والمكالمةُ متابعةٌ هاتفيّةٌ موعدُها ساعتان بعد النموذج في ساعات العمل — وبها يُذكَّر المستشار قبلها */
    const lead = await prisma.lead.findUniqueOrThrow({ where: { id: late.ref }, select: { createdAt: true } })
    const call = await prisma.followUp.findMany({ where: { caseId: cases[0].id } })
    expect(call, 'لا مكالمة مجدولة').toHaveLength(1)
    expect(call[0].channel).toBe('phone')
    expect(call[0].scheduledAt.getTime()).toBe(grantCallDueAt(lead.createdAt, NOW).getTime())
    expect(cases[0].nextFollowUpAt?.getTime()).toBe(call[0].scheduledAt.getTime())
    expect(cases[0].nextAction, 'لم يقرأ المستشار مجاله').toContain('مجاله: الهندسة')
    expect(cases[0].assignments.some((x) => x.unassignedAt === null), 'لم تسند').toBe(true)
    expect(await prisma.auditEvent.count({ where: { action: 'advisor.case.grant_followup', entityId: cases[0].id } })).toBe(1)
    expect(await casesOf(fresh.ref), 'فتحت قبل ساعة').toHaveLength(0)
    expect(await casesOf(bought.ref), 'فتحت لمن اشترى').toHaveLength(0)
    expect(await casesOf(direct.ref), 'فتحت لمن اشترى ببريده بلا كود').toHaveLength(0)
    expect(await casesOf(paying.ref), 'فتحت لمن ينتظر طلبه الدفع').toHaveLength(0)
    expect(await casesOf(asked.ref), 'فتحت ثانية لمن طلب مستشارا').toHaveLength(1)

    await openGrantFollowups(prisma)
    expect(await casesOf(late.ref), 'فتحت مرتين').toHaveLength(1)
  })
})

describe('④ والعامل يفتحها', () => {
  it('⚠️ وظيفة grant_followup', async () => {
    const late = await member()
    await runJob(prisma, 'grant_followup')
    expect(await casesOf(late.ref)).toHaveLength(1)
  })
})

describe('⑤ تذكير قبل انتهاء المنحة', () => {
  /* نهايةُ المنحة أوّلَ يومٍ بتوقيت عمّان كما تحفظها شاشتُها — بعد عشرة أيّام */
  const T = new Date(`${zonedDay(new Date(Date.now() + 10 * 24 * HOUR))}T00:00:00+03:00`)
  const at = (hoursBefore: number) => new Date(T.getTime() - hoursBefore * HOUR)
  const mails = (to: string) => prisma.outboxMail.findMany({ where: { to, purpose: 'grant.reminder' }, orderBy: { createdAt: 'asc' } })
  const mailChannel = (enabled: boolean) => prisma.integrationSetting.upsert({
    where: { provider: 'email' },
    update: { enabled, config: { apiKey: 'test-key', fromEmail: 'no-reply@test.local' } },
    create: { provider: 'email', enabled, config: { apiKey: 'test-key', fromEmail: 'no-reply@test.local' } },
  })
  let had: { enabled: boolean; config: unknown } | null = null

  beforeAll(async () => {
    had = await prisma.integrationSetting.findUnique({ where: { provider: 'email' }, select: { enabled: true, config: true } })
    await new GrantService(prisma).update({ closesAt: T }, ownerId)
  })
  afterAll(async () => {
    if (had) await prisma.integrationSetting.update({ where: { provider: 'email' }, data: { enabled: had.enabled, config: had.config as never } })
    else await prisma.integrationSetting.delete({ where: { provider: 'email' } })
    await new GrantService(prisma).update({ closesAt: null }, ownerId)
  })

  it('⚠️ قبل ثلاثة أيام ثم في آخر يوم، مرة لكل مرحلة — ولا يصل من اشترى أو ينتظر الدفع أو أخذ كوده للتو', async () => {
    const idle = await member()
    const bought = await member()
    const buyer = await learner()
    const o = await commerce.checkout(buyer, [(await cohort()).id], bought.code)
    await commerce.payOrder(o.orderId, buyer, `fu-${o.orderId}`)
    const paying = await member()
    await commerce.checkout(await learner(), [(await cohort()).id], paying.code)
    const direct = await member()
    const me = await learner(direct.email)
    const o3 = await commerce.checkout(me, [(await cohort()).id])
    await commerce.payOrder(o3.orderId, me, `fu-${o3.orderId}`)
    /* عبّأ النموذجَ بعد بدء المرحلة الأولى — أخذ كودَه للتوّ */
    const late = await member()
    await prisma.lead.update({ where: { id: late.ref }, data: { createdAt: at(62) } })
    /* والقناةُ بعد الشراء: موصولةً يُطلب توثيقُ البريد قبل الدفع */
    await mailChannel(true)

    expect((await sendGrantReminders(prisma, at(64))).stage, 'ذكر قبل موعده').toBeNull()
    expect(await mails(idle.email)).toHaveLength(0)

    const first = await sendGrantReminders(prisma, at(62.9))
    expect(first.stage).toBe('3d')
    const m1 = await mails(idle.email)
    expect(m1, 'لم يذكر من لم يشتر').toHaveLength(1)
    expect(m1[0].subject).toBe('بقي 3 أيام على منحتك')
    expect(m1[0].text).toContain(idle.code)
    expect(m1[0].text).toContain('/grant')
    expect(await prisma.auditEvent.count({ where: { action: 'coupon.grant_reminder', entityId: idle.ref } })).toBe(1)
    expect(await mails(bought.email), 'ذكر من اشترى بكوده').toHaveLength(0)
    expect(await mails(direct.email), 'ذكر من اشترى ببريده').toHaveLength(0)
    expect(await mails(paying.email), 'ذكر من ينتظر طلبه الدفع').toHaveLength(0)
    expect(await mails(late.email), 'ذكر من أخذ كوده للتو').toHaveLength(0)

    await sendGrantReminders(prisma, at(40))
    expect(await mails(idle.email), 'ذكر مرتين في مرحلة').toHaveLength(1)

    await sendGrantReminders(prisma, at(14.9))
    const m2 = await mails(idle.email)
    expect(m2, 'لم يذكر في آخر يوم').toHaveLength(2)
    expect(m2[1].subject).toBe('اليوم آخر يوم لمنحتك')
    expect(m2[1].text, 'كرر آخر يوم في يومه').not.toContain('آخر يوم:')
    expect(m1[0].text, 'لم يقل آخر يوم').toContain('آخر يوم:')
    const lateMails = await mails(late.email)
    expect(lateMails, 'من فاتته الأولى يصله الأخير وحده').toHaveLength(1)
    expect(lateMails[0].subject).toBe('اليوم آخر يوم لمنحتك')
  })

  it('⚠️ وقناة البريد مفصولة — لا بريد ولا أثر، فيذكر حين توصل لا بعد انتهاء المنحة', async () => {
    const idle = await member()
    await mailChannel(false)
    const out = await sendGrantReminders(prisma, at(14.9))
    expect(out.mailOff).toBe(true)
    expect(await mails(idle.email)).toHaveLength(0)
    expect(await prisma.auditEvent.count({ where: { action: 'coupon.grant_reminder', entityId: idle.ref } })).toBe(0)
    await mailChannel(true)
    expect((await sendGrantReminders(prisma, new Date(T.getTime() + HOUR))).stage, 'ذكر بعد انتهاء المنحة').toBeNull()
    expect(await mails(idle.email)).toHaveLength(0)
  })

  it('⚠️ وظيفة grant_reminders', async () => {
    await mailChannel(true)
    const idle = await member()
    await runJob(prisma, 'grant_reminders', at(14.9))
    expect(await mails(idle.email)).toHaveLength(1)
  })
})

describe('⑥ آخر يوم للمنحة 30 أكتوبر — بقرار صاحب المنصة، مرة واحدة', () => {
  const closesAt = async () => (await prisma.grantCampaign.findUniqueOrThrow({ where: { slug: 'wajeez-members' }, select: { closesAt: true } })).closesAt?.toISOString() ?? null

  it('⚠️ من نهاية 31 أكتوبر إلى 30 — بأثر مكتوب، ولا يمس تاريخا غيره أحد بعده', async () => {
    const g = new GrantService(prisma)
    await g.update({ closesAt: new Date(GRANT_CLOSE_FIX.from) }, ownerId)
    expect(await applyGrantCloseFix(prisma)).toBe(true)
    expect(await closesAt()).toBe(GRANT_CLOSE_FIX.to)
    expect(GRANT_CLOSE_FIX.to, 'أول 31 أكتوبر بتوقيت عمان').toBe('2026-10-30T21:00:00.000Z')
    expect(await prisma.auditEvent.count({ where: { action: 'coupon.grant_settings', actorId: null, reason: { contains: '30 أكتوبر' } } })).toBeGreaterThanOrEqual(1)
    expect(await applyGrantCloseFix(prisma), 'وقع مرتين').toBe(false)

    /* غيّرها صاحبُ المنصّة من شاشتها بعدُ — لا تُمسّ */
    const other = '2026-11-05T21:00:00.000Z'
    await g.update({ closesAt: new Date(other) }, ownerId)
    expect(await applyGrantCloseFix(prisma)).toBe(false)
    expect(await closesAt()).toBe(other)

    /* والعاملُ يطبّقه قبل التذكير */
    await g.update({ closesAt: new Date(GRANT_CLOSE_FIX.from) }, ownerId)
    await runJob(prisma, 'grant_reminders')
    expect(await closesAt()).toBe(GRANT_CLOSE_FIX.to)
    await g.update({ closesAt: null }, ownerId)
  })
})

describe('⑦ والمنحة تغطي 4 دورات بحد أقصى — بقرار صاحب المنصة، مرة واحدة', () => {
  const maxCourses = async () => (await prisma.grantCampaign.findUniqueOrThrow({ where: { slug: 'wajeez-members' }, select: { maxCourses: true } })).maxCourses

  it('⚠️ من 5 إلى 4 — بأثر مكتوب، ولا يمس حدا غيره أحد بعده، والعامل يطبقه', async () => {
    const g = new GrantService(prisma)
    const before = await maxCourses()
    expect(GRANT_COURSES_FIX).toEqual({ from: 5, to: 4 })
    await g.update({ maxCourses: 5 }, ownerId)
    expect(await applyGrantCoursesFix(prisma)).toBe(true)
    expect(await maxCourses()).toBe(4)
    expect(await prisma.auditEvent.count({ where: { action: 'coupon.grant_settings', actorId: null, reason: { contains: '4 دورات' } } })).toBeGreaterThanOrEqual(1)
    expect(await applyGrantCoursesFix(prisma), 'وقع مرتين').toBe(false)

    await g.update({ maxCourses: 6 }, ownerId)
    expect(await applyGrantCoursesFix(prisma), 'مس حدا غيره أحد').toBe(false)
    expect(await maxCourses()).toBe(6)

    await g.update({ maxCourses: 5 }, ownerId)
    await runJob(prisma, 'grant_reminders')
    expect(await maxCourses()).toBe(4)
    await g.update({ maxCourses: before }, ownerId)
  })
})
