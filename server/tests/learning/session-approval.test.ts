/* ═══ لقاءُ المدرّب ينتظر قرارَ الإدارة — ولا يُعلَن قبله ═══

   نصُّ صاحب المنصّة (١٥ سبتمبر ٢٠٢٦): «وبعدها الإدارةُ توافق، ويصبح هناك
   جلسةُ زووم لايف تُنشَر في منصّة الطلبة بتاريخها، ويُرسَل إيميلٌ للطلاب
   بالاجتماع وللإدارة».

   وكان `trainerAddSessionWithMeeting` يُنشئ الاجتماعَ ويُبلّغ المسجَّلين في
   النداء نفسِه. فخطأٌ في تاريخٍ يصل عشرين إنسانا قبل أن يُقرأ.

   ═══ وأربعةُ حدودٍ تُقاس بالسلوك لا بقراءة نصّ ═══

   ① **لا يُبلَّغ أحدٌ عند الجدولة**، ولا يُنشأ اجتماعٌ — فرابطٌ حيٌّ قبل
      الاعتماد يُنسَخ من شاشة المدرّب ويُنشَر.

   ② **ولا يراه المتعلّمُ**: البوّابةُ في الاستعلام لا في الشاشة. وهذا
      أخطرُها لأنّه يسقط صامتا — لا عطبَ يظهر، بل موعدٌ زائدٌ يُعرض.

   ③ **وبالاعتماد يقع كلُّ شيء معا**: الاجتماعُ ثمّ الختمُ ثمّ التبليغ.
      والترتيبُ ليس أسلوبا: لو خُتم الاعتمادُ قبل الاجتماع وسقط إنشاؤه
      لبقي لقاءٌ «معتمَدٌ» بلا باب.

   ④ **والمردودُ يُلغى** ولا يصل أحدا.

   ولا شبكةَ هنا: `fetch` مُلتقَط. */

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
let cohortId = ''
const enrolled: string[] = []

const SAVED = { ...process.env }
const ZOOM_ENV = ['ZOOM_ACCOUNT_ID', 'ZOOM_CLIENT_ID', 'ZOOM_CLIENT_SECRET', 'ZOOM_HOST_EMAIL'] as const

const withKeys = () => {
  process.env.ZOOM_ACCOUNT_ID = 'acc'
  process.env.ZOOM_CLIENT_ID = 'cid'
  process.env.ZOOM_CLIENT_SECRET = 'sec'
  process.env.ZOOM_HOST_EMAIL = 'lessons@wajeez.test'
}

function stubZoom() {
  globalThis.fetch = (async (url: string) => {
    if (String(url).includes('/oauth/token')) {
      return { ok: true, status: 200, json: async () => ({ access_token: 't', expires_in: 3600 }) }
    }
    return {
      ok: true, status: 201,
      json: async () => ({ id: 777, join_url: 'https://zoom.us/j/777', start_url: 'https://zoom.us/s/777', password: 'pw77' }),
    }
  }) as unknown as typeof fetch
  forgetZoomToken()
}

/** تسجيلُ متعلّمٍ في هذه الشعبة — مفتاحُ قراءةِ رحلته */
const enrollmentOf = async (userId: string) =>
  (await prisma.enrollment.findFirstOrThrow({ where: { cohortId, userId }, select: { id: true } })).id

/** لقاءٌ جديدٌ داخلَ النافذة — يُنادى في كلّ اختبارٍ بموعدٍ مختلفٍ لئلّا يتعارض */
const schedule = (day: number, opts: { withZoom?: boolean } = {}) =>
  cohorts.trainerAddSessionWithMeeting(trainerUserId, cohortId, {
    title: `لقاءُ اليوم ${day}`,
    startsAt: new Date(`2027-01-${String(day).padStart(2, '0')}T15:00:00.000Z`),
    endsAt: new Date(`2027-01-${String(day).padStart(2, '0')}T17:00:00.000Z`),
    noteAr: 'أحضِر الكرّاسة',
    withZoom: opts.withZoom ?? true,
  })

beforeAll(async () => {
  await setupTestDb()
  prisma = await testPrisma()
  cohorts = new CohortService(prisma)
  enrollments = new EnrollmentService(prisma)
  withKeys(); stubZoom()

  const admin = await prisma.user.create({
    data: { email: `sa-admin-${Date.now()}@wajeez.test`, displayName: 'المديرُ الأكاديميّ', passwordHash: 'x' },
  })
  adminId = admin.id

  const tUser = await prisma.user.create({
    data: { email: `sa-trainer-${Date.now()}@wajeez.test`, displayName: 'مدرّبُ الشعبة', passwordHash: 'x' },
  })
  trainerUserId = tUser.id
  const application = await prisma.trainerApplication.create({
    data: { reference: `WJ-TR-SA-${Date.now()}`, fullName: 'مدرّبُ الشعبة', email: tUser.email, status: 'approved' },
  })
  const profile = await prisma.trainerProfile.create({ data: { userId: tUser.id, applicationId: application.id } })

  const course = await prisma.course.findFirst({ select: { id: true } })
  const cohort = await prisma.cohort.create({
    data: {
      courseId: course!.id, title: 'شعبةُ اعتمادِ اللقاءات', status: 'open',
      capacity: 20, price: 100, currency: 'USD', timezone: 'Asia/Amman',
      /* النافذةُ مفتوحةٌ على الفصل — وهي ما يصنعه `setTerm` للمدرّب */
      scheduleWindowStart: new Date('2027-01-01T00:00:00.000Z'),
      scheduleWindowEnd: new Date('2027-03-31T00:00:00.000Z'),
      maxSessions: 20,
    },
  })
  cohortId = cohort.id
  await prisma.cohortTrainer.create({ data: { cohortId, profileId: profile.id, role: 'lead' } })

  for (const i of [0, 1, 2]) {
    const u = await prisma.user.create({
      data: { email: `sa-learner-${i}-${Date.now()}@wajeez.test`, displayName: `متعلّم ${i}`, passwordHash: 'x' },
    })
    await prisma.enrollment.create({ data: { cohortId, userId: u.id, status: 'enrolled' } })
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

describe('① الجدولةُ لا تُعلن شيئا', () => {
  it('⚠️ يُكتب اللقاءُ منتظِرا، بلا اجتماعٍ وبلا تبليغِ أحد', async () => {
    const out = await schedule(5)

    expect(out.pending, 'لم يُعلَن أنّه ينتظر').toBe(true)
    expect(out.notified, 'بُلِّغ مسجَّلون قبل الاعتماد').toBe(0)
    expect(out.zoom, 'أُنشئ اجتماعٌ لموعدٍ قد يُردّ').toBeNull()

    const row = await prisma.cohortSession.findUniqueOrThrow({ where: { id: out.session.id } })
    expect(row.approvalState).toBe('pending')
    expect(row.noteAr, 'النبذةُ لم تُحفَظ').toBe('أحضِر الكرّاسة')
    expect(row.wantsMeeting, 'نيّةُ الاجتماع لم تُحفَظ').toBe(true)

    const zoom = await prisma.zoomMeeting.findUnique({ where: { sessionId: out.session.id } })
    expect(zoom, 'أُنشئ صفُّ اجتماعٍ قبل الاعتماد').toBeNull()

    const notes = await prisma.notification.findMany({
      where: { templateKey: 'cohort.session.scheduled', userId: { in: enrolled } },
    })
    expect(notes, 'وصل المسجَّلين خبرُ لقاءٍ لم يُعتمَد').toHaveLength(0)
  })

  it('والإدارةُ تُبلَّغ بأنّ لقاءً ينتظرها', async () => {
    const pending = await prisma.notification.findMany({ where: { templateKey: 'cohort.session.pending' } })
    expect(pending.length, 'لم تُبلَّغ الإدارةُ بشيء').toBeGreaterThan(0)
  })
})

describe('② والمنتظِرُ لا يبلغ المتعلّمَ أصلا', () => {
  it('⚠️ لا يخرج في رحلة المتعلّم — البوّابةُ في الاستعلام لا في الشاشة', async () => {
    const out = await schedule(6)
    const view = await enrollments.learnerCohortView(await enrollmentOf(enrolled[0]))
    expect(view.cohort.sessions.map((s) => s.id), 'وصل المتعلّمَ موعدٌ لم يُعتمَد').not.toContain(out.session.id)
  })

  it('ويظهر بعد الاعتماد — فالبوّابةُ تفتح لا تقفل أبدا', async () => {
    const out = await schedule(7)
    await cohorts.decideSession(adminId, out.session.id, true)
    const view = await enrollments.learnerCohortView(await enrollmentOf(enrolled[0]))
    expect(view.cohort.sessions.map((s) => s.id), 'لم يصل المتعلّمَ لقاءٌ اعتُمد').toContain(out.session.id)
  })
})

describe('③ وبالاعتماد يقع كلُّ شيء', () => {
  it('⚠️ يُنشأ الاجتماعُ ويُبلَّغ المسجَّلون الثلاثة', async () => {
    const out = await schedule(8)
    await prisma.notification.deleteMany({ where: { templateKey: 'cohort.session.scheduled' } })

    const decided = await cohorts.decideSession(adminId, out.session.id, true)

    expect(decided.session.approvalState).toBe('approved')
    expect(decided.session.approvedBy).toBe(adminId)
    expect(decided.zoom?.joinUrl, 'لم يُنشأ اجتماعٌ عند الاعتماد').toBe('https://zoom.us/j/777')
    expect(decided.notified, 'لم يُبلَّغ المسجَّلون').toBe(3)

    const notes = await prisma.notification.findMany({ where: { templateKey: 'cohort.session.scheduled' } })
    expect(new Set(notes.map((n) => n.userId))).toEqual(new Set(enrolled))
  })

  it('و«الحضوريُّ» يُعتمَد بلا اجتماع — النيّةُ محفوظةٌ منذ الجدولة', async () => {
    const out = await schedule(9, { withZoom: false })
    const row = await prisma.cohortSession.findUniqueOrThrow({ where: { id: out.session.id } })
    expect(row.wantsMeeting).toBe(false)

    const decided = await cohorts.decideSession(adminId, out.session.id, true)
    expect(decided.zoom, 'أُنشئ اجتماعٌ للقاءٍ حضوريّ').toBeNull()
    expect(decided.notified, 'الموعدُ خبرٌ وإن لم يكن له رابط').toBe(3)
  })

  it('ولا يُقرَّر مرّتين — فلا يُبلَّغ المسجَّلون بلقاءٍ واحدٍ مرّتين', async () => {
    const out = await schedule(10)
    await cohorts.decideSession(adminId, out.session.id, true)
    await expect(cohorts.decideSession(adminId, out.session.id, true)).rejects.toThrow()
  })
})

describe('④ والمردودُ يُلغى ولا يصل أحدا', () => {
  it('⚠️ يُكتب مردودا وملغًى، ولا يُبلَّغ مسجَّلٌ واحد', async () => {
    const out = await schedule(11)
    await prisma.notification.deleteMany({ where: { templateKey: 'cohort.session.scheduled' } })

    const decided = await cohorts.decideSession(adminId, out.session.id, false, 'الموعدُ يصادف عطلة')

    expect(decided.session.approvalState).toBe('rejected')
    expect(decided.session.status, 'بقي المردودُ حيًّا في الجدول').toBe('cancelled')
    expect(decided.session.reviewNote).toBe('الموعدُ يصادف عطلة')
    expect(decided.notified).toBe(0)

    const notes = await prisma.notification.findMany({ where: { templateKey: 'cohort.session.scheduled' } })
    expect(notes, 'وصل المسجَّلين خبرُ لقاءٍ مردود').toHaveLength(0)

    /* ولا اجتماعَ يُنشأ لمردود — صفٌّ في حسابنا لا يحضره أحد */
    const zoom = await prisma.zoomMeeting.findUnique({ where: { sessionId: out.session.id } })
    expect(zoom).toBeNull()
  })

  it('ومدرّبُه يُبلَّغ بعلّته — لا يُردّ بلا سبب', async () => {
    const notes = await prisma.notification.findMany({
      where: { templateKey: 'cohort.session.rejected', userId: trainerUserId },
    })
    expect(notes.length, 'لم يعلم المدرّبُ أنّ لقاءَه رُدّ').toBeGreaterThan(0)
    expect(notes.some((n) => (n.body ?? '').includes('الموعدُ يصادف عطلة')), 'وصله ردٌّ بلا علّة').toBe(true)
  })
})
