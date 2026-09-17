/* ═══ فكُّ الحصار: الفصلُ يفتح البابَ، والحذفُ مخرجُه ═══

   شكا صاحبُ المنصّة (١٧ سبتمبر ٢٠٢٦) من رسالةٍ تصدر عند اختيار الفصل ولا
   تُفهَم. وتتبُّعُ المسار كشف ثلاثةَ أعطابٍ متسلسلةٍ لا رسالةً سيّئة:

     ① `setTerm` يكتب حدَّي النافذة ولا يكتب `maxSessions`، والشرطُ كان
       يطلب الثلاثةَ بـ«و» — فيختار الفصلَ ويُمنع من الجدولة بعده.
     ② ولو فُتح البابُ لقيل له «بلغتَ سقفَ اللقاءات» وشعبتُه فارغة، لأنّ
       «الباقي» كان صفرا حين لا سقف.
     ③ ولو أراد أن ينفّذ ما تأمره به الرسالةُ («انقلها أو احذفها») لم
       يستطع: النقلُ يمرّ بالنافذة المغلقة، والحذفُ لم يكن له مسلكٌ أصلا.

   وقرارُ صاحب المنصّة في النقل (١٧ سبتمبر): «يغيّرُه فيرجع لانتظار الإدارة».

   ويُقاس هذا كلُّه **بالسلوك على قاعدةٍ حقيقيّة** لا بقراءة نصّ: قاعدةُ
   `schedule-window.ts` وحدَها تمرّ في فحصٍ خالصٍ سريع، لكنّ العطبَ كان في
   **وصلِها بالخادم** — وذاك لا يظهر إلّا هنا. */

import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import type { PrismaClient } from '@prisma/client'
import { setupTestDb, testPrisma } from '../helpers/db'
import { CohortService } from '../../services/cohort.service'
import { EnrollmentService } from '../../services/enrollment.service'
import { forgetZoomToken } from '../../services/zoom.service'

let prisma: PrismaClient
let cohorts: CohortService
let enrollments: EnrollmentService
let adminId = ''
let trainerUserId = ''
let learnerId = ''
let learnerEnrollmentId = ''
/** شعبةٌ بحدَّين **بلا سقف** — وهي بعينها ما يصنعه الفصل */
let uncappedId = ''

/** ما يصل المتعلّمَ فعلا — بالبوّابة التي في الاستعلام لا في الشاشة */
const learnerSessionIds = async () =>
  (await enrollments.learnerCohortView(learnerEnrollmentId)).cohort.sessions.map((s) => s.id)

const SAVED = { ...process.env }

function stubZoom() {
  globalThis.fetch = (async (url: string, init?: { method?: string }) => {
    if (String(url).includes('/oauth/token')) {
      return { ok: true, status: 200, json: async () => ({ access_token: 't', expires_in: 3600 }) }
    }
    if (init?.method === 'DELETE') return { ok: true, status: 204, json: async () => ({}) }
    return {
      ok: true, status: 201,
      json: async () => ({ id: 901, join_url: 'https://zoom.us/j/901', start_url: 'https://zoom.us/s/901', password: 'pw901' }),
    }
  }) as unknown as typeof fetch
  forgetZoomToken()
}

const at = (day: number) => new Date(`2027-02-${String(day).padStart(2, '0')}T15:00:00.000Z`)
const until = (day: number) => new Date(`2027-02-${String(day).padStart(2, '0')}T17:00:00.000Z`)

const schedule = (day: number) =>
  cohorts.trainerAddSessionWithMeeting(trainerUserId, uncappedId, {
    title: `لقاءُ ${day}`, startsAt: at(day), endsAt: until(day), withZoom: true,
  })

beforeAll(async () => {
  await setupTestDb()
  prisma = await testPrisma()
  cohorts = new CohortService(prisma)
  enrollments = new EnrollmentService(prisma)
  process.env.ZOOM_ACCOUNT_ID = 'acc'
  process.env.ZOOM_CLIENT_ID = 'cid'
  process.env.ZOOM_CLIENT_SECRET = 'sec'
  process.env.ZOOM_HOST_EMAIL = 'lessons@wajeez.test'
  stubZoom()

  const admin = await prisma.user.create({
    data: { email: `wd-admin-${Date.now()}@wajeez.test`, displayName: 'المديرُ الأكاديميّ', passwordHash: 'x' },
  })
  adminId = admin.id
  await prisma.userRole.create({ data: { userId: adminId, roleId: 'academic_manager' } })

  const tUser = await prisma.user.create({
    data: { email: `wd-trainer-${Date.now()}@wajeez.test`, displayName: 'مدرّبُ الشعبة', passwordHash: 'x' },
  })
  trainerUserId = tUser.id
  const application = await prisma.trainerApplication.create({
    data: { reference: `WJ-TR-WD-${Date.now()}`, fullName: 'مدرّبُ الشعبة', email: tUser.email, status: 'approved' },
  })
  const profile = await prisma.trainerProfile.create({ data: { userId: tUser.id, applicationId: application.id } })

  const course = await prisma.course.findFirst({ select: { id: true } })
  const cohort = await prisma.cohort.create({
    data: {
      courseId: course!.id, title: 'شعبةٌ بفصلٍ بلا سقف', status: 'open',
      capacity: 20, price: 100, currency: 'USD', timezone: 'Asia/Amman',
      /* ═══ هذا هو الصفُّ الذي يصنعه `setTerm` ═══
         حدّان من حدود الفصل، و`maxSessions` **فارغٌ** لأنّ الإدارةَ لم تضع
         سقفا. وكان هذا الصفُّ بعينه يُقرأ «نافذةٌ مغلقة». */
      scheduleWindowStart: new Date('2027-02-01T00:00:00.000Z'),
      scheduleWindowEnd: new Date('2027-04-30T00:00:00.000Z'),
      maxSessions: null,
    },
  })
  uncappedId = cohort.id
  await prisma.cohortTrainer.create({ data: { cohortId: uncappedId, profileId: profile.id, role: 'lead' } })

  const lUser = await prisma.user.create({
    data: { email: `wd-learner-${Date.now()}@wajeez.test`, displayName: 'متعلّمٌ واحد', passwordHash: 'x' },
  })
  learnerId = lUser.id
  const enrollment = await prisma.enrollment.create({
    data: { cohortId: uncappedId, userId: learnerId, status: 'enrolled' },
  })
  learnerEnrollmentId = enrollment.id
})

afterAll(async () => { process.env = { ...SAVED }; forgetZoomToken() })

describe('الفصلُ وحدَه يفتح بابَ الجدولة', () => {
  it('⚠️ حدّان بلا سقفٍ: النافذةُ مفتوحةٌ و«الباقي» بلا سقفٍ لا صفر', async () => {
    const win = await cohorts.scheduleWindowFor(trainerUserId, uncappedId)
    expect(win.open, 'الفصلُ محدَّدٌ والبابُ مغلق — وهذا هو الحصار').toBe(true)
    expect(win.maxSessions).toBeNull()
    expect(win.remaining, 'غيابُ السقف قُرئ صفرا، فقيل لشعبةٍ فارغةٍ بلغتَ سقفَك').toBeNull()
  })

  it('⚠️ ويجدول فعلا — لا يُردّ بـ«لم تفتح الإدارةُ نافذةَ جدولة»', async () => {
    const first = await schedule(3)
    expect(first.session.id).toBeTruthy()
    expect(first.pending, 'اللقاءُ لا يُعتمَد بنفسه').toBe(true)
    /* ولا سقفَ يوقفه مهما زاد: من لا سقفَ له لا يبلغه */
    await expect(schedule(5)).resolves.toBeTruthy()
    await expect(schedule(7)).resolves.toBeTruthy()
    const win = await cohorts.scheduleWindowFor(trainerUserId, uncappedId)
    expect(win.used).toBeGreaterThanOrEqual(3)
    expect(win.remaining).toBeNull()
  })

  it('وما خرج عن المدى يُردّ — البابُ مفتوحٌ لا مرفوع', async () => {
    await expect(cohorts.trainerAddSessionWithMeeting(trainerUserId, uncappedId, {
      title: 'لقاءٌ بعد الفصل',
      startsAt: new Date('2027-06-01T15:00:00.000Z'),
      endsAt: new Date('2027-06-01T17:00:00.000Z'),
    })).rejects.toMatchObject({ status: 403 })
  })
})

describe('المنقولُ يرجع إلى انتظار الإدارة', () => {
  it('⚠️ لقاءٌ معتمَدٌ يُنقل فيسقط إلى pending ويغيب عن المتعلّم', async () => {
    const made = await schedule(10)
    await cohorts.decideSession(adminId, made.session.id, true)
    const approved = await prisma.cohortSession.findUniqueOrThrow({ where: { id: made.session.id } })
    expect(approved.approvalState, 'لم يُعتمَد أصلا فالفحصُ التالي بلا معنى').toBe('approved')

    /* وقبل النقل يراه المتعلّم — وإلّا كان الغيابُ بعده بلا دلالة */
    expect(await learnerSessionIds(), 'المتعلّمُ لا يرى لقاءً معتمَدا').toContain(made.session.id)

    await cohorts.trainerMoveSession(trainerUserId, made.session.id, {
      startsAt: at(12), endsAt: until(12),
    })

    const moved = await prisma.cohortSession.findUniqueOrThrow({ where: { id: made.session.id } })
    expect(moved.startsAt.toISOString()).toBe(at(12).toISOString())
    expect(moved.approvalState, 'نُقل وبقي معتمَدا — فوصل الناسَ موعدٌ لم يُراجَع').toBe('pending')
    expect(moved.approvedAt, 'ختمُ الاعتماد القديم بقي على موعدٍ جديد').toBeNull()

    expect(await learnerSessionIds(), 'اللقاءُ المنقولُ ما زال معروضا للمتعلّم').not.toContain(made.session.id)
  })

  it('وما لم يُعتمَد بعدُ يبقى منتظِرا كما هو — لا يُنبَّه له مرّتان', async () => {
    const made = await schedule(14)
    await cohorts.trainerMoveSession(trainerUserId, made.session.id, { startsAt: at(16), endsAt: until(16) })
    const moved = await prisma.cohortSession.findUniqueOrThrow({ where: { id: made.session.id } })
    expect(moved.approvalState).toBe('pending')
  })
})

describe('الحذفُ — الفعلُ الذي كانت الشاشةُ تأمر به ولا بابَ له', () => {
  it('⚠️ لقاءٌ لم ينعقد يُحذف، ويذهب اجتماعُه معه', async () => {
    const made = await schedule(18)
    await cohorts.decideSession(adminId, made.session.id, true)
    expect(await prisma.zoomMeeting.count({ where: { sessionId: made.session.id } })).toBe(1)

    await cohorts.trainerDeleteSession(trainerUserId, made.session.id)

    expect(await prisma.cohortSession.count({ where: { id: made.session.id } })).toBe(0)
    expect(await prisma.zoomMeeting.count({ where: { sessionId: made.session.id } }),
      'بقي اجتماعٌ في حسابنا لا لقاءَ له').toBe(0)
  })

  it('⚠️ وما حضره أحدٌ لا يُحذف — الحضورُ واقعةٌ لا مسودّة', async () => {
    const made = await schedule(20)
    await cohorts.decideSession(adminId, made.session.id, true)
    await prisma.attendance.create({
      data: { sessionId: made.session.id, enrollmentId: learnerEnrollmentId, status: 'present' },
    })

    await expect(cohorts.trainerDeleteSession(trainerUserId, made.session.id))
      .rejects.toMatchObject({ status: 409 })
    expect(await prisma.cohortSession.count({ where: { id: made.session.id } }),
      'حُذف لقاءٌ فيه حضورٌ مسجَّل').toBe(1)
  })

  it('ولا يحذف مدرّبٌ لقاءَ شعبةٍ ليست له', async () => {
    const made = await schedule(22)
    const stranger = await prisma.user.create({
      data: { email: `wd-stranger-${Date.now()}@wajeez.test`, displayName: 'غريب', passwordHash: 'x' },
    })
    await expect(cohorts.trainerDeleteSession(stranger.id, made.session.id))
      .rejects.toMatchObject({ status: 403 })
  })
})
