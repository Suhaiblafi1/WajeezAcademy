/* ═══ الاعتمادُ واحد: الخطّةُ ولقاءاتُها معا — والردُّ لكلّ خطوةٍ ملاحظتُها (٣ب) ═══

   كان المعتمِدُ يقرأ المنهجَ كاملا (٣أ) ثمّ يعتمد الخطّةَ، ثمّ يعتمد لقاءاتِها
   بطاقةً بطاقة وقد قرأها. وكان الردُّ صندوقا بسطرٍ واحد. فصار:

   ① قبل أوّل اعتمادٍ للخطّة لا يُنادى على الإدارة بكلّ لقاءٍ يُجدوَل: يُعتمَد
      مع خطّته. وشعبةٌ لا خطّةَ لمدرّبها تبقى على البطاقات.
   ② والردُّ يُحفظ بأقسامه، ويُجمع نصّا واحدا للجرس والأثر. والنصُّ القديمُ
      ملاحظةٌ عامّة. والفارغُ كلُّه ليس ردّا.
   ③ واعتمادُ الخطّة يعتمد كلَّ لقاءٍ منتظِرٍ في الشعبة بمسلك البطاقة نفسِه —
      اجتماعُه وإعلانُه — ويصل المدرّبَ خبرٌ واحد. وملاحظاتُ الردّ تُرفع.
   ④ وسقوطُ اجتماعٍ لا يُسقط الاعتماد: يبقى ذلك اللقاءُ منتظِرا ويُسمّى،
      ويصير بطاقةً تُعاد محاولتُها.
   ⑤ وبعد الاعتماد كلُّ لقاءٍ يُضاف يُقرَّر وحدَه، ويُنادى عليه.
   ⑥ والمسلكُ يقبل الأقسامَ المعروفةَ وحدَها.

   ولا شبكةَ هنا: `fetch` مُلتقَط. */

import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import type { PrismaClient } from '@prisma/client'
import type { FastifyInstance } from 'fastify'
import { setupTestDb, testPrisma } from '../helpers/db'
import { CohortService } from '../../services/cohort.service'
import { CohortPlanService } from '../../services/cohort-plan.service'
import { AuthService } from '../../services/auth.service'
import { forgetZoomToken } from '../../services/zoom.service'
import { buildApp } from '../../http/app'
import { SESSION_COOKIE } from '../../http/auth-plugin'

let prisma: PrismaClient
let cohorts: CohortService
let plans: CohortPlanService
let adminId = ''
let trainerUserId = ''
let profileId = ''
const enrolled: string[] = []
const STAMP = Date.now()

const SAVED = { ...process.env }
const ZOOM_ENV = ['ZOOM_ACCOUNT_ID', 'ZOOM_CLIENT_ID', 'ZOOM_CLIENT_SECRET', 'ZOOM_HOST_EMAIL'] as const
/** لقاءٌ في عنوانه هذا يسقط إنشاءُ اجتماعه — Zoom لا يستجيب */
const FAILS = 'يسقط اجتماعُه'

function stubZoom() {
  process.env.ZOOM_ACCOUNT_ID = 'acc'
  process.env.ZOOM_CLIENT_ID = 'cid'
  process.env.ZOOM_CLIENT_SECRET = 'sec'
  process.env.ZOOM_HOST_EMAIL = 'lessons@wajeez.test'
  let n = 0
  globalThis.fetch = (async (url: string, init?: { body?: string }) => {
    if (String(url).includes('/oauth/token')) {
      return { ok: true, status: 200, json: async () => ({ access_token: 't', expires_in: 3600 }) }
    }
    if (String(init?.body ?? '').includes(FAILS)) return { ok: false, status: 500, json: async () => ({}) }
    n += 1
    return {
      ok: true, status: 201,
      json: async () => ({ id: 900 + n, join_url: `https://zoom.us/j/${900 + n}`, start_url: 'https://zoom.us/s/1', password: 'pw' }),
    }
  }) as unknown as typeof fetch
  forgetZoomToken()
}

/** شعبةٌ بنافذةٍ مفتوحةٍ ومدرّبِها — ومعها خطّةٌ له إن طُلبت */
async function makeCohort(tag: string, withPlan: boolean) {
  const course = await prisma.course.findFirst({ select: { id: true } })
  const cohort = await prisma.cohort.create({
    data: {
      courseId: course!.id, title: `شعبةُ الاعتماد الواحد ${tag}`, status: 'open',
      capacity: 20, price: 100, currency: 'USD', timezone: 'Asia/Amman',
      scheduleWindowStart: new Date('2027-01-01T00:00:00.000Z'),
      scheduleWindowEnd: new Date('2027-03-31T00:00:00.000Z'),
      maxSessions: 30,
    },
  })
  await prisma.cohortTrainer.create({ data: { cohortId: cohort.id, profileId, role: 'lead' } })
  const plan = withPlan
    ? await prisma.cohortDeliveryPlan.create({
        data: { cohortId: cohort.id, trainerId: profileId, status: 'draft', content: { kind: 'trainer', modules: [], resources: [] } },
      })
    : null
  return { cohortId: cohort.id, planId: plan?.id ?? '' }
}

/** لقاءٌ يجدوله المدرّب — بموعدٍ مختلفٍ في كلّ نداءٍ لئلّا يتعارض */
let day = 3
const schedule = (cohortId: string, title = `لقاءُ اليوم ${day}`) => {
  const d = String(day++).padStart(2, '0')
  return cohorts.trainerAddSessionWithMeeting(trainerUserId, cohortId, {
    title,
    startsAt: new Date(`2027-01-${d}T15:00:00.000Z`),
    endsAt: new Date(`2027-01-${d}T17:00:00.000Z`),
  })
}

const pendingNotices = () => prisma.notification.count({ where: { templateKey: 'cohort.session.pending', userId: adminId } })
const submit = (planId: string) => prisma.cohortDeliveryPlan.update({ where: { id: planId }, data: { status: 'submitted' } })

let A = { cohortId: '', planId: '' }

/** لقاءاتُ الاعتماد — والردُّ لا لقاءاتَ له */
const meetingsOf = (r: Awaited<ReturnType<CohortPlanService['decide']>>) => ('meetings' in r ? r.meetings : null)

beforeAll(async () => {
  await setupTestDb()
  prisma = await testPrisma()
  cohorts = new CohortService(prisma)
  plans = new CohortPlanService(prisma)
  stubZoom()

  const admin = await prisma.user.create({
    data: { email: `psa-admin-${STAMP}@wajeez.test`, displayName: 'المديرُ الأكاديميّ', passwordHash: 'x' },
  })
  adminId = admin.id
  /* ودورُه يُسنَد فعلا: `notifyRole` يقرأ حاملي الدور — ومديرٌ بلا دورٍ يمرّ
     عليه حارسُ «لم يُنادَ عليه» صفرا كاذبا */
  await prisma.userRole.create({ data: { userId: adminId, roleId: 'academic_manager' } })

  const tUser = await prisma.user.create({
    data: { email: `psa-trainer-${STAMP}@wajeez.test`, displayName: 'مدرّبُ الشعبة', passwordHash: 'x' },
  })
  trainerUserId = tUser.id
  const application = await prisma.trainerApplication.create({
    data: { reference: `WJ-TR-PSA-${STAMP}`, fullName: 'مدرّبُ الشعبة', email: tUser.email, status: 'active' },
  })
  profileId = (await prisma.trainerProfile.create({ data: { userId: tUser.id, applicationId: application.id } })).id

  A = await makeCohort('أ', true)
  for (const i of [0, 1, 2]) {
    const u = await prisma.user.create({
      data: { email: `psa-learner-${i}-${STAMP}@wajeez.test`, displayName: `متعلّم ${i}`, passwordHash: 'x' },
    })
    await prisma.enrollment.create({ data: { cohortId: A.cohortId, userId: u.id, status: 'enrolled' } })
    enrolled.push(u.id)
  }
}, 240_000)

afterAll(() => {
  for (const k of ZOOM_ENV) {
    if (SAVED[k] === undefined) delete process.env[k]
    else process.env[k] = SAVED[k]
  }
  forgetZoomToken()
})

describe('① قبل أوّل اعتمادٍ: اللقاءُ ينتظر خطّتَه', () => {
  it('⚠️ لا يُنادى على الإدارة بلقاءٍ يُعتمَد مع خطّته — ويُعلَّم بذلك في طابورها', async () => {
    const before = await pendingNotices()
    const a = await schedule(A.cohortId)
    expect(await pendingNotices(), 'نُودي على الإدارة بلقاءٍ يُعتمَد مع خطّته').toBe(before)
    const row = (await cohorts.pendingSessions(A.cohortId)).find((p) => p.id === a.session.id)
    expect(row?.withPlan, 'عُرض بطاقةً تُقرَّر وحدَها').toBe(true)
  })

  it('⚠️ وشعبةٌ لا خطّةَ لمدرّبها تبقى على البطاقات — ويُنادى عليها', async () => {
    const bare = await makeCohort('بلا خطّة', false)
    const before = await pendingNotices()
    const a = await schedule(bare.cohortId)
    expect(await pendingNotices(), 'لقاءٌ لا خطّةَ تحمله انتظر بصمت').toBe(before + 1)
    const row = (await cohorts.pendingSessions(bare.cohortId)).find((p) => p.id === a.session.id)
    expect(row?.withPlan).toBe(false)
  })
})

describe('② الردُّ: لكلّ خطوةٍ ملاحظتُها', () => {
  it('⚠️ يُحفظ بأقسامه، ويُجمع نصّا واحدا للجرس والأثر', async () => {
    await submit(A.planId)
    await plans.decide(adminId, A.planId, false, {
      modules: '  المحورُ الثالث بلا متن  ', sessions: 'لقاءُ الموعد الثاني خارجه', bogus: 'مفتاحٌ غريب',
    } as never)
    const row = await prisma.cohortDeliveryPlan.findUniqueOrThrow({ where: { id: A.planId } })
    expect(row.status).toBe('changes_requested')
    expect(row.reviewerNotes).toEqual({ modules: 'المحورُ الثالث بلا متن', sessions: 'لقاءُ الموعد الثاني خارجه' })
    expect(row.reviewerNote).toBe('«المحاور ومواعيدها»: المحورُ الثالث بلا متن\n\n«اللقاءات»: لقاءُ الموعد الثاني خارجه')

    /* والورشةُ تحملها بأقسامها — فتُقرأ كلُّ واحدةٍ في رأس خطوتها */
    const ws = await plans.workspace(trainerUserId, A.cohortId)
    expect(ws.plan?.reviewerNotes).toEqual({ modules: 'المحورُ الثالث بلا متن', sessions: 'لقاءُ الموعد الثاني خارجه' })

    const bell = await prisma.notification.findFirstOrThrow({
      where: { userId: trainerUserId, templateKey: 'cohort.plan.decision' }, orderBy: { queuedAt: 'desc' },
    })
    expect(bell.body).toContain('«اللقاءات»: لقاءُ الموعد الثاني خارجه')

    const audit = await prisma.auditEvent.findFirstOrThrow({
      where: { action: 'cohort.plan.changes_requested', entityId: A.cohortId }, orderBy: { createdAt: 'desc' },
    })
    expect((audit.meta as { sections: string[] }).sections).toEqual(['modules', 'sessions'])
  })

  it('⚠️ وملاحظاتٌ فارغةٌ كلُّها ليست ردّا', async () => {
    await submit(A.planId)
    await expect(plans.decide(adminId, A.planId, false, { general: ' ', identity: '' }))
      .rejects.toMatchObject({ code: 'reason_required' })
    await expect(plans.decide(adminId, A.planId, false, '  ')).rejects.toMatchObject({ code: 'reason_required' })
    const row = await prisma.cohortDeliveryPlan.findUniqueOrThrow({ where: { id: A.planId } })
    expect(row.status, 'رُدّت بلا سبب').toBe('submitted')
  })

  it('والنصُّ الواحدُ كما كان — يُحفظ ملاحظةً عامّة', async () => {
    await plans.decide(adminId, A.planId, false, 'أعِد ترتيبَ المحاور')
    const row = await prisma.cohortDeliveryPlan.findUniqueOrThrow({ where: { id: A.planId } })
    expect(row.reviewerNotes).toEqual({ general: 'أعِد ترتيبَ المحاور' })
    expect(row.reviewerNote).toBe('أعِد ترتيبَ المحاور')
  })

  /* وبقاؤها بعد إعادة الإرسال الحقيقيّة (`plans.submit`) في `cohort-plan.test.ts`:
     الإرسالُ هناك يمرّ بقائمة التمام كاملةً، وهنا يُختصر إلى حاله */
})

describe('③ الاعتمادُ واحد: الخطّةُ ولقاءاتُها', () => {
  let waiting: string[] = []

  it('⚠️ يعتمد كلَّ لقاءٍ منتظِرٍ معها — باجتماعه وإعلانه للمسجَّلين', async () => {
    await schedule(A.cohortId)
    await submit(A.planId)
    waiting = (await prisma.cohortSession.findMany({
      where: { cohortId: A.cohortId, approvalState: 'pending' }, select: { id: true },
    })).map((s) => s.id)
    expect(waiting.length, 'لا لقاءاتٍ منتظرة يُختبر بها').toBe(2)
    await prisma.notification.deleteMany({ where: { templateKey: 'cohort.session.scheduled' } })

    const r = await plans.decide(adminId, A.planId, true)

    expect(r.status).toBe('approved')
    expect(meetingsOf(r)).toEqual({ approved: 2, failed: [] })
    const rows = await prisma.cohortSession.findMany({ where: { id: { in: waiting } }, include: { zoom: true } })
    for (const s of rows) {
      expect(s.approvalState, `بقي «${s.title}» منتظِرا`).toBe('approved')
      expect(s.approvedBy).toBe(adminId)
      expect(s.zoom?.joinUrl, `اعتُمد «${s.title}» بلا اجتماع`).toMatch(/^https:\/\/zoom\.us\/j\//)
    }
    const told = await prisma.notification.findMany({ where: { templateKey: 'cohort.session.scheduled', userId: { in: enrolled } } })
    expect(told, 'لم يُبلَّغ كلُّ مسجَّلٍ بكلّ لقاء').toHaveLength(waiting.length * enrolled.length)
  })

  it('⚠️ والمدرّبُ يصله خبرٌ واحد عن الخطّة ولقاءاتها — لا خبرٌ لكلّ لقاء', async () => {
    const perMeeting = await prisma.notification.count({ where: { userId: trainerUserId, templateKey: 'cohort.session.approved' } })
    expect(perMeeting, 'وصل المدرّبَ خبرٌ لكلّ لقاء').toBe(0)
    const bell = await prisma.notification.findFirstOrThrow({
      where: { userId: trainerUserId, templateKey: 'cohort.plan.decision' }, orderBy: { queuedAt: 'desc' },
    })
    expect(bell.title).toContain('اعتُمدت خطّةُ')
    expect(bell.body).toContain('لقاءاتُك (2)')
  })

  it('وملاحظاتُ الردّ تُرفع بالاعتماد — ويُكتب في الأثر كم اعتُمد معها', async () => {
    const row = await prisma.cohortDeliveryPlan.findUniqueOrThrow({ where: { id: A.planId } })
    expect(row.reviewerNotes).toBeNull()
    const audit = await prisma.auditEvent.findFirstOrThrow({
      where: { action: 'cohort.plan.approve', entityId: A.cohortId }, orderBy: { createdAt: 'desc' },
    })
    expect((audit.meta as { meetingsApproved: number }).meetingsApproved).toBe(2)
  })
})

describe('④ وسقوطُ اجتماعٍ لا يُسقط الاعتماد', () => {
  it('⚠️ يبقى ذلك اللقاءُ منتظِرا ويُسمّى — والخطّةُ معتمَدة، وهو بطاقةٌ تُعاد محاولتُها', async () => {
    const B = await makeCohort('ب', true)
    const ok = await schedule(B.cohortId)
    const bad = await schedule(B.cohortId, `لقاءٌ ${FAILS}`)
    await submit(B.planId)

    const r = await plans.decide(adminId, B.planId, true)

    expect(r.status).toBe('approved')
    const m = meetingsOf(r)
    expect(m?.approved).toBe(1)
    expect(m?.failed.map((f) => f.id)).toEqual([bad.session.id])
    expect(m?.failed[0].reason).toContain('Zoom')
    expect((await prisma.cohortSession.findUniqueOrThrow({ where: { id: ok.session.id } })).approvalState).toBe('approved')
    expect((await prisma.cohortSession.findUniqueOrThrow({ where: { id: bad.session.id } })).approvalState).toBe('pending')
    expect((await prisma.cohortDeliveryPlan.findUniqueOrThrow({ where: { id: B.planId } })).status).toBe('approved')

    /* وصار بطاقةً تُقرَّر وحدَها — فالخطّةُ اعتُمدت ولا خطّةَ تنتظرها */
    const row = (await cohorts.pendingSessions(B.cohortId)).find((p) => p.id === bad.session.id)
    expect(row?.withPlan, 'بقي ينتظر خطّةً اعتُمدت — فلا زرَّ يُعيد محاولتَه').toBe(false)

    /* والمدرّبُ لا يُقال له إنّ لقاءاتِه اعتُمدت كلَّها */
    const bell = await prisma.notification.findFirstOrThrow({
      where: { userId: trainerUserId, templateKey: 'cohort.plan.decision' }, orderBy: { queuedAt: 'desc' },
    })
    /* والواحدُ مفردٌ لا «لقاءاتُك (1)» (٣ أكتوبر ٢٠٢٦، `planApprovedTrainerMsg`) */
    expect(bell.body).toContain('واعتُمد معها لقاؤك')
    expect(bell.body).toContain('وبقي لقاءٌ واحدٌ عند الإدارة')
  })
})

describe('⑤ وبعد الاعتماد كلُّ لقاءٍ يُضاف يُقرَّر وحدَه', () => {
  it('⚠️ يُنادى على الإدارة به، ويُعرض بطاقةً', async () => {
    const before = await pendingNotices()
    const later = await schedule(A.cohortId)
    expect(await pendingNotices(), 'لقاءٌ أُضيف بعد الاعتماد انتظر بصمت').toBe(before + 1)
    const row = (await cohorts.pendingSessions(A.cohortId)).find((p) => p.id === later.session.id)
    expect(row?.withPlan).toBe(false)
  })
})

describe('⑥ والمسلكُ يقبل الأقسامَ المعروفةَ وحدَها', () => {
  let app: FastifyInstance
  let cookie = ''

  beforeAll(async () => {
    app = await buildApp(prisma)
    const auth = new AuthService(prisma)
    const email = `psa-super-${STAMP}@test.local`
    const sa = await auth.register(email, 'Super#12345', 'مديرُ النظام')
    await auth.setRoles(sa.userId, ['super_admin'])
    cookie = `${SESSION_COOKIE}=${(await auth.login(email, 'Super#12345')).token}`
  }, 120_000)

  it('⚠️ قسمٌ غريبٌ يُردّ — ولا يُكتب شيء', async () => {
    const C = await makeCohort('ج', true)
    await submit(C.planId)
    const res = await app.inject({
      method: 'POST', url: `/api/admin/cohort-plans/${C.planId}/decide`, headers: { cookie },
      payload: { approve: false, note: { modules: 'م', pricing: 'السعرُ مرتفع' } },
    })
    /* والتحقّقُ في هذا الخادم يردّ ٤٢٢ لكلّ جسمٍ لا يوافق مخطّطَه */
    expect(res.statusCode).toBe(422)
    expect((await prisma.cohortDeliveryPlan.findUniqueOrThrow({ where: { id: C.planId } })).status).toBe('submitted')

    const ok = await app.inject({
      method: 'POST', url: `/api/admin/cohort-plans/${C.planId}/decide`, headers: { cookie },
      payload: { approve: false, note: { workbooks: 'كرّاسةُ الموعد الأوّل رابطُها معطوب' } },
    })
    expect(ok.statusCode).toBe(200)
    const row = await prisma.cohortDeliveryPlan.findUniqueOrThrow({ where: { id: C.planId } })
    expect(row.reviewerNotes).toEqual({ workbooks: 'كرّاسةُ الموعد الأوّل رابطُها معطوب' })
  })
})
