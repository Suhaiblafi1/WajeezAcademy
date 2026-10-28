/* ═══ لقاءٌ تغيّر موعدُه — «كان … وصار …» وسببُه بقلم من طلبه، لكلٍّ بلغته (٢٨ أكتوبر ٢٠٢٦) ═══

   قال صاحبُ المنصّة: «We have changed the session time from X to Y, and we should write the reason. These
   reasons that the student would read must be written by who has asked for the change» — واختار رسالةً واحدةً
   يتحرّك بها الموعدُ نفسُه في التقويم («One email, entry moves»). والنصوصُ في `session-move.ts`، والرسالةُ في
   `calendar/session-invite.ts` (`calendar/session-invite.test.ts`)؛ وهنا على قاعدةٍ حقيقيّة:

   ① المدرّبُ ينقل لقاءه المعتمَد: لا يُنقل بلا سبب، وبه تصل رسالةُ التقويم «كان … وصار …» وسببَه — للمتعلّم
      «نقله مدرّبك، وكتب»، وللمدرّب «نقلته بطلبك» — ولا بريدَ ثانٍ لمن وصلته، والمنتظِرُ في القائمة يبقى له بريدُه.
   ①ب ونقلٌ يعيده إلى انتظار الإدارة: يُرفع من التقاويم بما كتبه المدرّب، ولا بريدَ ثانٍ لصاحب المقعد.
   ② وما لم يُعتمَد لم يره متعلّم — يُنقل بلا سبب.
   ③ وبطاقةُ الإدارة يقبلها المدرّب: يقرأ المتعلّمون سببَها بقلمها، ويُقال للمدرّب «بطلب الإدارة وقبلته».
   ④ وموعدٌ بلا تعارض: سببُه كما وقع — بلا «نقترح»، و«كان موعدها يتعارض» — في الرسالة وفي الجرس.
   ④ب وجدولٌ سقط بعد أن نُقلت لقاءاتُه يعيدها إلى مواعيدها — والمعتمَدُ يعود بلا سبب نقلٍ يُطلب، ويُقال إنّه عاد.
   ⑤ والإدارةُ تنقل الشعبةَ بنفسها: كلُّ لقاءٍ «كان … وصار …» وسببُها، وللمدرّب «نقلته الإدارة».
   ⑥ واقتراحُ التأجيل يقبله المدرّب: سببُ الإدارة يصل المتعلّمين مع مواعيدهم الجديدة.

   ولا شبكةَ: لا اجتماعَ Zoom لهذه اللقاءات، فلا نداءَ يخرج. */

import { beforeAll, describe, expect as vexpect, it, vi } from 'vitest'
import { plainExpect } from '../helpers/plain-expect'
const expect = plainExpect(vexpect)
import type { PrismaClient } from '@prisma/client'
import type { FastifyInstance } from 'fastify'
import { setupTestDb, testPrisma } from '../helpers/db'
import { AuthService } from '../../services/auth.service'
import { buildApp } from '../../http/app'
import { SESSION_COOKIE } from '../../http/auth-plugin'
import { CohortService } from '../../services/cohort.service'
import { PlanEditService } from '../../services/plan-edit.service'
import { CohortMoveService } from '../../services/cohort-move.service'
import { CohortPostponeService } from '../../services/cohort-postpone.service'
import { AssessmentService } from '../../services/assessment.service'
import { SESSION_GUESTS } from '../../services/session-invite.service'
import { whenAr } from '../../../src/application/learning/cohort-gate'
import { CLASH_REASON_PREFIX } from '../../../src/application/terms/schedule-clash'
import { PROPOSAL_TAIL_AR } from '../../../src/application/trainer/schedule-proposal'
import { nextTerm } from '../../../src/application/trainer/cohort-move'
import { termBounds, termOf } from '../../../src/application/terms/season'

let prisma: PrismaClient
let auth: AuthService
let app: FastifyInstance
let cohorts: CohortService
let adminId = ''
const STAMP = Date.now()
const PASS = 'Pass#12345'
const H = 3_600_000
const DAY = 24 * H
const GUESTS = SESSION_GUESTS.map((g) => g.email)

interface Cast {
  cohortId: string
  trainer: { userId: string; email: string; profileId: string; cookie: string }
  /** صاحبُ مقعدٍ قائم — تصله رسالةُ التقويم */
  seated: { userId: string; email: string }
  /** منتظِرٌ في القائمة — لا مقعدَ له فلا رسالةَ تقويم */
  waiting: { userId: string; email: string }
}

let n = 0
/** مدرّبٌ لكلّ شعبة — فلا تتعارض لقاءاتُ الشعب — ومتعلّمان: صاحبُ مقعدٍ ومنتظِر */
async function cast(tag: string, cohort: Record<string, unknown> = {}): Promise<Cast> {
  n += 1
  const email = `smr-t${n}-${STAMP}@test.local`
  const u = await auth.register(email, PASS, `مدرّب ${tag}`)
  await auth.setRoles(u.userId, ['trainer'])
  const application = await prisma.trainerApplication.create({
    data: { reference: `WJ-TR-SMR-${n}-${STAMP}`, email, fullName: `مدرّب ${tag}`, status: 'active' },
  })
  const profileId = (await prisma.trainerProfile.create({ data: { applicationId: application.id, userId: u.userId } })).id
  const course = await prisma.course.findFirstOrThrow({ select: { id: true } })
  const c = await prisma.cohort.create({
    data: {
      courseId: course.id, title: `شعبة ${tag}`, status: 'open', capacity: 20, timezone: 'Asia/Amman',
      scheduleWindowStart: new Date(Date.now() - 2 * DAY), scheduleWindowEnd: new Date(Date.now() + 400 * DAY),
      ...cohort,
    },
  })
  await prisma.cohortTrainer.create({ data: { cohortId: c.id, profileId, role: 'lead' } })
  const learner = async (key: string, status: string) => {
    const le = `smr-${key}${n}-${STAMP}@test.local`
    const lu = await prisma.user.create({ data: { email: le, displayName: `متعلّم ${key}`, passwordHash: 'x' } })
    await prisma.enrollment.create({ data: { userId: lu.id, cohortId: c.id, status } })
    return { userId: lu.id, email: le }
  }
  return {
    cohortId: c.id,
    trainer: { userId: u.userId, email, profileId, cookie: `${SESSION_COOKIE}=${(await auth.login(email, PASS)).token}` },
    seated: await learner('s', 'enrolled'),
    waiting: await learner('w', 'waitlisted'),
  }
}

/** لقاءٌ معتمَدٌ في تقاويمهم — بعد `hours` ساعة، ساعتين */
async function approved(c: Cast, startsAt: Date, title = 'لقاء النقل') {
  const s = await prisma.cohortSession.create({
    data: { cohortId: c.cohortId, title, startsAt, endsAt: new Date(startsAt.getTime() + 2 * H), approvalState: 'approved' },
  })
  return s
}

const mails = (sessionId: string, purpose: string) => prisma.outboxMail.findMany({ where: { batchId: sessionId, purpose } })
const mailTo = async (sessionId: string, purpose: string, to: string) => {
  const rows = (await mails(sessionId, purpose)).filter((m) => m.to === to)
  expect(rows, `لم تصل ${to} رسالةُ ${purpose}`).toHaveLength(1)
  return rows[0]!
}
const bells = (userId: string, channel: 'in_app' | 'email') =>
  prisma.notification.findMany({ where: { userId, channel, templateKey: 'cohort.schedule_changed' }, orderBy: { queuedAt: 'asc' } })

beforeAll(async () => {
  await setupTestDb()
  prisma = await testPrisma()
  auth = new AuthService(prisma)
  app = await buildApp(prisma)
  cohorts = new CohortService(prisma)
  const admin = await auth.register(`smr-admin-${STAMP}@test.local`, PASS, 'المعتمِد')
  await auth.setRoles(admin.userId, ['academic_manager'])
  adminId = admin.userId
}, 240_000)

describe('① المدرّبُ ينقل لقاءه المعتمَد — بسببه يصل الجميعَ', () => {
  let c: Cast
  let sessionId = ''
  let from = new Date()
  const to = new Date(Date.now() + 30 * H)

  it('⚠️ بلا سبب يُردّ ولا يتحرّك شيء — لا موعدَ ولا رسالة', async () => {
    c = await cast('النقل')
    /* بعد عشرين ساعة، ويُؤجَّل عشرا: قريبٌ بلا موعد محور، فيبقى معتمَدا (`keepsApprovalOnMove`) */
    from = new Date(Date.now() + 20 * H)
    sessionId = (await approved(c, from)).id
    const patch = (payload: Record<string, unknown>) => app.inject({
      method: 'PATCH', url: `/api/trainer/sessions/${sessionId}`, headers: { cookie: c.trainer.cookie },
      payload: { startsAt: to.toISOString(), endsAt: new Date(to.getTime() + 2 * H).toISOString(), ...payload } as never,
    })
    for (const payload of [{}, { reasonAr: '  ' }, { reasonAr: 'لا' }]) {
      const r = await patch(payload)
      expect(r.statusCode, r.body).toBe(422)
      expect(r.json().error.code).toBe('reason_required')
    }
    const s = await prisma.cohortSession.findUniqueOrThrow({ where: { id: sessionId } })
    expect(s.startsAt.toISOString(), 'نُقل بلا سبب').toBe(from.toISOString())
    expect(await mails(sessionId, 'session.invite.update')).toHaveLength(0)
    expect(await bells(c.seated.userId, 'in_app')).toHaveLength(0)

    const ok = await patch({ reasonAr: 'سفر طارئ' })
    expect(ok.statusCode, ok.body).toBe(200)
    expect(ok.json().approvalState).toBe('approved')
  })

  it('⚠️ رسالةُ التقويم «كان … وصار …» — والمتعلّمُ يقرأ ما كتبه مدرّبه', async () => {
    const updates = await mails(sessionId, 'session.invite.update')
    expect(updates.map((m) => m.to).sort(), 'لم تصل الجميعَ — أو وصلت المنتظِرَ في القائمة')
      .toEqual([c.seated.email, c.trainer.email, ...GUESTS].sort())
    const mine = await mailTo(sessionId, 'session.invite.update', c.seated.email)
    expect(mine.subject).toMatch(/^تغيّر موعد/)
    expect(mine.text).toContain(`كان: ${whenAr(from)}`)
    expect(mine.text).toContain(`صار: ${whenAr(to)} — بتوقيت عمّان`)
    expect(mine.text, 'لا يُقال للمتعلّم لماذا نُقل').toContain('نقله مدرّبك، وكتب: «سفر طارئ».')
    expect(mine.icsContent).toContain(`DTSTART:${to.toISOString().replace(/[-:]/g, '').split('.')[0]}Z`)
    /* والعنوانان كالمتعلّم: يريان من نقل ولماذا */
    expect((await mailTo(sessionId, 'session.invite.update', GUESTS[0]!)).text).toContain('نقله مدرّبك، وكتب: «سفر طارئ».')
  })

  it('⚠️ وللمدرّب «نقلته بطلبك» وما كتبه لطلابه — لا «نقله مدرّبك»', async () => {
    const his = await mailTo(sessionId, 'session.invite.update', c.trainer.email)
    expect(his.text).toContain('نقلته بطلبك، وكتبت لطلابك: «سفر طارئ».')
    expect(his.text).not.toContain('نقله مدرّبك')
    expect(his.text).toContain(`كان: ${whenAr(from)}`)
  })

  it('⚠️ والجرسُ يقول الموعدين والسبب — ولا بريدَ ثانٍ لمن وصلته رسالةُ التقويم («One email»)', async () => {
    const [bell] = await bells(c.seated.userId, 'in_app')
    expect(bell?.body).toContain(`تأخّر موعده من ${whenAr(from)} إلى ${whenAr(to)}.`)
    expect(bell?.body).toContain('نقله مدرّبك، وكتب: «سفر طارئ».')
    expect(await bells(c.seated.userId, 'email'), 'وصله الخبرُ مرّتين: رسالةُ التقويم وبريدُ الجرس').toHaveLength(0)
    /* والمنتظِرُ لا رسالةَ تقويمٍ له — فبريدُ الجرس خبرُه الوحيد */
    expect(await bells(c.waiting.userId, 'in_app')).toHaveLength(1)
    expect(await bells(c.waiting.userId, 'email'), 'سكت عن المنتظِر بريدُه الوحيد').toHaveLength(1)
  })

  it('⚠️ والأثرُ يحفظ ما قرأه المتعلّمون', async () => {
    const ev = await prisma.auditEvent.findFirstOrThrow({ where: { action: 'cohort.session.move', entityId: sessionId } })
    expect(ev.meta).toMatchObject({ whyAr: 'نقله مدرّبك، وكتب: «سفر طارئ».', keptApproval: true })
  })
})

describe('①ب ونقلٌ يعيده إلى انتظار الإدارة — يُرفع بسببه', () => {
  it('⚠️ رسالةُ الرفع تقول ما كتبه المدرّب لكلٍّ بلغته — والجرسُ بلا بريدٍ ثانٍ لصاحب المقعد', async () => {
    const c = await cast('العائد')
    /* بعد ثلاثة أيّام بلا موعد محور: النقلُ يعيده إلى الانتظار (`keepsApprovalOnMove`) */
    const from = new Date(Date.now() + 72 * H)
    const s = await approved(c, from)
    const to = new Date(from.getTime() + 2 * H)
    const moved = await cohorts.trainerMoveSession(c.trainer.userId, s.id, { startsAt: to, endsAt: new Date(to.getTime() + 2 * H), reasonAr: 'تغير موعد عملي' })
    expect(moved.approvalState).toBe('pending')
    const learner = await mailTo(s.id, 'session.invite.cancel', c.seated.email)
    expect(learner.text).toContain(whenAr(from))
    expect(learner.text).toContain('نقله مدرّبك، وكتب: «تغير موعد عملي». ويراجع الآن عند الإدارة')
    const trainer = await mailTo(s.id, 'session.invite.cancel', c.trainer.email)
    expect(trainer.text).toContain('نقلته بطلبك، وكتبت لطلابك: «تغير موعد عملي». ويراجع الآن عند الإدارة')
    expect(trainer.text).not.toContain('نقله مدرّبك')
    const [bell] = await bells(c.seated.userId, 'in_app')
    expect(bell?.body).toContain('نقله مدرّبك، وكتب: «تغير موعد عملي». ويراجع الآن عند الإدارة')
    expect(await bells(c.seated.userId, 'email'), 'وصله الخبرُ مرّتين: رسالةُ الرفع وبريدُ الجرس').toHaveLength(0)
    expect(await bells(c.waiting.userId, 'email'), 'سكت عن المنتظِر بريدُه الوحيد').toHaveLength(1)
  })
})

describe('② وما لم يُعتمَد لم يره متعلّم — يُنقل بلا سبب', () => {
  it('⚠️ المنتظِرُ يُنقل بلا سبب، ولا رسالةَ تخرج', async () => {
    const c = await cast('المنتظر')
    const at = new Date(Date.now() + 20 * H)
    const s = await prisma.cohortSession.create({
      data: { cohortId: c.cohortId, title: 'لقاء منتظر', startsAt: at, endsAt: new Date(at.getTime() + 2 * H), approvalState: 'pending' },
    })
    const to = new Date(at.getTime() + 5 * H)
    const moved = await cohorts.trainerMoveSession(c.trainer.userId, s.id, { startsAt: to, endsAt: new Date(to.getTime() + 2 * H) })
    expect(moved.startsAt.toISOString()).toBe(to.toISOString())
    expect(await prisma.outboxMail.count({ where: { batchId: s.id } })).toBe(0)
  })
})

describe('③ بطاقةُ الإدارة يقبلها المدرّب — السببُ بقلمها', () => {
  it('⚠️ المتعلّمُ يقرأ «نقلته إدارة الأكاديمية» وسببَها، والمدرّبُ «بطلب الإدارة وقبلته»', async () => {
    const c = await cast('البطاقة')
    const from = new Date(Date.now() + 20 * H)
    const s = await approved(c, from)
    const plan = await prisma.cohortDeliveryPlan.create({
      data: { cohortId: c.cohortId, trainerId: c.trainer.profileId, status: 'draft', content: { kind: 'trainer', modules: [], resources: [] } as never },
    })
    const to = new Date(from.getTime() + 6 * H)
    const edits = new PlanEditService(prisma)
    await edits.propose(adminId, plan.id, [{
      kind: 'session_move', sessionId: s.id, reasonAr: 'يوافق عطلة رسمية',
      startsAt: to.toISOString(), endsAt: new Date(to.getTime() + 2 * H).toISOString(),
    } as never])
    const card = await prisma.planEditSuggestion.findFirstOrThrow({ where: { planId: plan.id } })
    await edits.review(adminId, card.id, true)
    await edits.accept(c.trainer.userId, card.id)

    expect((await prisma.cohortSession.findUniqueOrThrow({ where: { id: s.id } })).startsAt.toISOString()).toBe(to.toISOString())
    const learner = await mailTo(s.id, 'session.invite.update', c.seated.email)
    expect(learner.text).toContain(`كان: ${whenAr(from)}`)
    expect(learner.text, 'نُسب نقلُ الإدارة إلى المدرّب').toContain('نقلته إدارة الأكاديمية: يوافق عطلة رسمية.')
    expect(learner.text).not.toContain('نقله مدرّبك')
    const trainer = await mailTo(s.id, 'session.invite.update', c.trainer.email)
    expect(trainer.text).toContain('نقل بطلب الإدارة وقبلته: يوافق عطلة رسمية.')
    const [bell] = await bells(c.seated.userId, 'in_app')
    expect(bell?.body).toContain('نقلته إدارة الأكاديمية: يوافق عطلة رسمية.')
    expect(bell?.body).not.toContain('مدرّبك')
  })
})

describe('④ موعدٌ بلا تعارض — سببُه كما وقع', () => {
  it('⚠️ بلا «نقترح» وذيلِها، و«كان موعدها يتعارض» — في رسالة كلّ لقاءٍ وفي الجرس الواحد', async () => {
    const c = await cast('التعارض')
    const firstAt = new Date(Date.now() + 10 * DAY)
    const sessions = [await approved(c, firstAt, 'اللقاء الأول'), await approved(c, new Date(firstAt.getTime() + 7 * DAY), 'اللقاء الثاني')]
    const plan = await prisma.cohortDeliveryPlan.create({
      data: { cohortId: c.cohortId, trainerId: c.trainer.profileId, status: 'approved', content: { kind: 'trainer', modules: [], resources: [] } as never },
    })
    const moves = sessions.map((s) => {
      const at = new Date(s.startsAt.getTime() + 2 * H)
      return { sessionId: s.id, startsAt: at.toISOString(), endsAt: new Date(at.getTime() + 2 * H).toISOString() }
    })
    const why = `${CLASH_REASON_PREFIX} مع «تحليل البيانات» وهي من المسار نفسه، والطالب نفسه قد يريد الدورتين`
    const reasonAr = `${why}${PROPOSAL_TAIL_AR}الساعة 21:00 في أيامها نفسها (الخميس): ينتقل لقاءان من 2، ولا يتغير يوم ولا موعد مهمة.`
    const edits = new PlanEditService(prisma)
    await edits.proposeClashFree(adminId, plan.id, { kind: 'schedule', weekday: 4, clock: '21:00', moves, tasks: [] }, reasonAr)
    const card = await prisma.planEditSuggestion.findFirstOrThrow({ where: { planId: plan.id } })
    await edits.accept(c.trainer.userId, card.id)

    for (const s of sessions) {
      const m = await mailTo(s.id, 'session.invite.update', c.seated.email)
      expect(m.text).toContain(`كان: ${whenAr(s.startsAt)}`)
      expect(m.text).toContain('نقلته إدارة الأكاديمية: كان موعدها يتعارض مع «تحليل البيانات» وهي من المسار نفسه، والطالب نفسه قد يريد الدورتين.')
      expect(m.text, 'قيل للمتعلّم «نقترح» عن نقلٍ وقع').not.toContain('نقترح')
      expect(m.text).not.toContain('الآن يتعارض')
      const t = await mailTo(s.id, 'session.invite.update', c.trainer.email)
      expect(t.text).toContain('نقل بطلب الإدارة وقبلته: كان موعدها يتعارض مع «تحليل البيانات»')
    }
    /* والجرسُ واحدٌ للجدول كلِّه (٢٤ أكتوبر ٢٠٢٦) — ومعه سببُه */
    const told = await bells(c.seated.userId, 'in_app')
    expect(told).toHaveLength(1)
    expect(told[0]!.body).toContain('صارت لقاءات شعبتك')
    expect(told[0]!.body).toContain('نقلته إدارة الأكاديمية: كان موعدها يتعارض مع «تحليل البيانات»')
  })
})

describe('④ب وجدولٌ سقط بعد أن نُقلت لقاءاتُه — يعود كلُّه، ويُقال لهم إنّه عاد', () => {
  it('⚠️ المعتمَدُ يعود إلى موعده بلا «اكتب سبب النقل» — ورسالتُه تقول إنّه عاد لا من نقله', async () => {
    const c = await cast('السقوط')
    const from = new Date(Date.now() + 12 * DAY)
    const s = await approved(c, from)
    const task = await prisma.cohortAssessment.create({
      data: { cohortId: c.cohortId, title: 'واجب يتبع اللقاء', type: 'assignment', maxScore: 10, dueAt: new Date(from.getTime() + 4 * DAY) },
    })
    const plan = await prisma.cohortDeliveryPlan.create({
      data: { cohortId: c.cohortId, trainerId: c.trainer.profileId, status: 'approved', content: { kind: 'trainer', modules: [], resources: [] } as never },
    })
    const to = new Date(from.getTime() + 2 * H)
    const edits = new PlanEditService(prisma)
    await edits.proposeClashFree(adminId, plan.id, {
      kind: 'schedule', weekday: 4, clock: '21:00',
      moves: [{ sessionId: s.id, startsAt: to.toISOString(), endsAt: new Date(to.getTime() + 2 * H).toISOString() }],
      tasks: [{ assessmentId: task.id, dueAt: new Date(to.getTime() + 4 * DAY).toISOString() }],
    }, 'يوافق عطلة رسمية')
    const card = await prisma.planEditSuggestion.findFirstOrThrow({ where: { planId: plan.id } })
    /* يسقط موعدُ الواجب بعد أن نُقل اللقاء — عطبٌ لا يُفحص قبله */
    const spy = vi.spyOn(AssessmentService.prototype, 'updateAssessment').mockRejectedValueOnce(new Error('انقطعت القاعدة'))
    try {
      await expect(edits.accept(c.trainer.userId, card.id)).rejects.toThrow('انقطعت القاعدة')
    } finally { spy.mockRestore() }

    expect((await prisma.cohortSession.findUniqueOrThrow({ where: { id: s.id } })).startsAt.toISOString(), 'بقي نصفُ جدول')
      .toBe(from.toISOString())
    const updates = (await mails(s.id, 'session.invite.update')).filter((m) => m.to === c.seated.email)
    expect(updates, 'لم يُقل له إنّه عاد — بقي في تقويمه بموعدٍ لم يعد').toHaveLength(2)
    const back = updates.find((m) => m.text.includes(`صار: ${whenAr(from)}`))
    expect(back, 'لا رسالةَ تعيده إلى موعده').toBeDefined()
    expect(back!.text).toContain(`كان: ${whenAr(to)}`)
    expect(back!.text).toContain('تعذّر نقل جدول الشعبة كاملا، فعاد هذا اللقاء إلى موعده.')
    expect(back!.text, 'نُسب العائدُ إلى سبب البطاقة').not.toContain('يوافق عطلة رسمية')
  })
})

/* شعبةٌ تبدأ في الفصل القادم بلقاءين — كما في `cohort-move.test.ts` */
const upcoming = nextTerm(termOf(new Date()))
const target = nextTerm(upcoming)
async function termCohort(tag: string) {
  const first = new Date(termBounds(upcoming.year, upcoming.season).startsOn.getTime() + 10 * DAY)
  first.setUTCHours(16, 0, 0, 0)
  const term = await prisma.term.upsert({
    where: { year_season: { year: upcoming.year, season: upcoming.season } }, update: {},
    create: { year: upcoming.year, season: upcoming.season, titleAr: 'الفصل القادم', startsOn: new Date(), endsOn: new Date(Date.now() + 90 * DAY) },
  })
  const c = await cast(tag, {
    termId: term.id, startsAt: first, endsAt: new Date(first.getTime() + 7 * DAY), joinClosesAt: new Date(first.getTime() - DAY),
  })
  const sessions = [await approved(c, first, 'اللقاء الأول'), await approved(c, new Date(first.getTime() + 7 * DAY), 'اللقاء الثاني')]
  return { c, sessions }
}

describe('⑤ والإدارةُ تنقل الشعبةَ بنفسها', () => {
  it('⚠️ كلُّ لقاءٍ «كان … وصار …» وسببُها — وللمدرّب «نقلته الإدارة»', async () => {
    const { c, sessions } = await termCohort('نقل الإدارة')
    await new CohortMoveService(prisma).staffMove(adminId, c.cohortId, {
      toYear: target.year, toSeason: target.season, reason: 'نجمع شعب المسار في فصل واحد',
    })
    for (const s of sessions) {
      const now = await prisma.cohortSession.findUniqueOrThrow({ where: { id: s.id } })
      expect(now.startsAt.getTime(), 'لم تُزَح').toBeGreaterThan(s.startsAt.getTime())
      const m = await mailTo(s.id, 'session.invite.update', c.seated.email)
      expect(m.text, 'لا يُقال من أيّ موعدٍ نُقل').toContain(`كان: ${whenAr(s.startsAt)}`)
      expect(m.text).toContain(`صار: ${whenAr(now.startsAt)}`)
      expect(m.text).toContain('نقلته إدارة الأكاديمية: نجمع شعب المسار في فصل واحد.')
      expect((await mailTo(s.id, 'session.invite.update', c.trainer.email)).text).toContain('نقلته الإدارة: نجمع شعب المسار في فصل واحد.')
    }
    const told = await bells(c.seated.userId, 'in_app')
    expect(told.at(-1)?.body).toContain('نقلته إدارة الأكاديمية: نجمع شعب المسار في فصل واحد.')
  })

  it('⚠️ وطلبُ المدرّب تعتمده الإدارة — يقرأ المتعلّمون «نقله مدرّبك» وما كتبه', async () => {
    const { c, sessions } = await termCohort('طلب المدرب')
    const svc = new CohortMoveService(prisma)
    const r = await svc.request(c.trainer.userId, c.cohortId, { toYear: target.year, toSeason: target.season, reason: 'ظرف عائلي في هذا الفصل' })
    await svc.review(adminId, r.id, { action: 'approve' })
    const m = await mailTo(sessions[0]!.id, 'session.invite.update', c.seated.email)
    expect(m.text).toContain('نقله مدرّبك، وكتب: «ظرف عائلي في هذا الفصل».')
    expect((await mailTo(sessions[0]!.id, 'session.invite.update', c.trainer.email)).text).toContain('نقلته بطلبك')
  })
})

describe('⑥ واقتراحُ التأجيل يقبله المدرّب', () => {
  it('⚠️ سببُ الإدارة يصل المتعلّمين مع مواعيدهم الجديدة — وللمدرّب «بطلب الإدارة وقبلته»', async () => {
    const c = await cast('التأجيل')
    const first = new Date(Date.now() + 9 * DAY)
    const s = await approved(c, first)
    const offer = await prisma.cohortPostponeOffer.create({
      data: {
        cohortId: c.cohortId, proposedBy: adminId, shiftDays: 28, fromFirstAt: first,
        toFirstAt: new Date(first.getTime() + 28 * DAY), reasonAr: 'ننتظر اكتمال المقاعد', deadlineAt: new Date(Date.now() + 2 * DAY),
      },
    })
    await new CohortPostponeService(prisma).decide(c.trainer.userId, offer.id, 'accept')
    const m = await mailTo(s.id, 'session.invite.update', c.seated.email)
    expect(m.text).toContain(`كان: ${whenAr(first)}`)
    expect(m.text).toContain(`صار: ${whenAr(new Date(first.getTime() + 28 * DAY))}`)
    expect(m.text).toContain('نقلته إدارة الأكاديمية: ننتظر اكتمال المقاعد.')
    expect((await mailTo(s.id, 'session.invite.update', c.trainer.email)).text).toContain('نقل بطلب الإدارة وقبلته: ننتظر اكتمال المقاعد.')
  })
})
