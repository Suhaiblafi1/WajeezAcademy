/* اللقاءُ واجتماعُه وتبليغُ المسجَّلين — فعلٌ واحدٌ أو لا شيء.

   ثلاثةُ حدودٍ تُحرَس هنا، وكلُّها وقعت في المنصّة قبل أن تُحرَس:

   ١) **لا جلسةَ نصفَ مجدولة.** من طلب اجتماعا وفشل إنشاؤه يجب ألّا يجد في
      الجدول لقاءً بلا باب. والطالبُ لا يعرف أنّ اللقاءَ ناقصٌ إلّا في موعده.

   ٢) **يُبلَّغ كلُّ مسجَّل.** جولةُ البند ③ وجدت أنّ `addSession` لا تُشعر
      أحدا — فاللقاءُ يظهر في الجدول ولا يعلم به أحد. والتبليغُ يُقاس
      **بعدد من وصلَه** لا بوجود سطرِ إشعارٍ واحد.

   ٣) **المنسحبُ لا يُبلَّغ.** من ترك الشعبة لا يُدعى إلى لقائها.

   ولا شبكةَ هنا: `fetch` مُلتقَط. */

import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import type { PrismaClient } from '@prisma/client'
import { setupTestDb, testPrisma } from '../helpers/db'
import { CohortService } from '../../services/cohort.service'
import { forgetZoomToken } from '../../services/zoom.service'

let prisma: PrismaClient
let cohorts: CohortService
let actorId = ''
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
const withoutKeys = () => { for (const k of ZOOM_ENV) delete process.env[k] }

/** ردٌّ ناجحٌ من Zoom — أو فشلٌ عند الإنشاء وحدَه */
function stubZoom(opts: { failCreate?: boolean } = {}) {
  globalThis.fetch = (async (url: string) => {
    if (String(url).includes('/oauth/token')) {
      return { ok: true, status: 200, json: async () => ({ access_token: 't', expires_in: 3600 }) }
    }
    if (opts.failCreate) return { ok: false, status: 403, json: async () => ({}) }
    return {
      ok: true, status: 201,
      json: async () => ({
        id: 555, join_url: 'https://zoom.us/j/555',
        start_url: 'https://zoom.us/s/555?zak=HOST-SECRET', password: 'pw55',
      }),
    }
  }) as unknown as typeof fetch
  forgetZoomToken()
}

beforeAll(async () => {
  await setupTestDb()
  prisma = await testPrisma()
  cohorts = new CohortService(prisma)

  const actor = await prisma.user.create({
    data: { email: `sm-actor-${Date.now()}@wajeez.test`, displayName: 'مديرُ الاختبار', passwordHash: 'x' },
  })
  actorId = actor.id

  const course = await prisma.course.findFirst({ select: { id: true } })
  const cohort = await prisma.cohort.create({
    data: {
      courseId: course!.id, title: 'شعبةُ اختبارِ اللقاءات', status: 'open',
      capacity: 20, price: 100, currency: 'USD', timezone: 'Asia/Amman',
    },
  })
  cohortId = cohort.id

  /* ثلاثةٌ مسجَّلون ورابعٌ منسحب — فيُقاس من يُبلَّغ ومن لا يُبلَّغ */
  for (const [i, status] of ['enrolled', 'enrolled', 'enrolled', 'dropped'].entries()) {
    const u = await prisma.user.create({
      data: { email: `sm-learner-${i}-${Date.now()}@wajeez.test`, displayName: `متعلّم ${i}`, passwordHash: 'x' },
    })
    await prisma.enrollment.create({ data: { cohortId, userId: u.id, status } })
    if (status === 'enrolled') enrolled.push(u.id)
  }
}, 240_000)

afterAll(() => {
  for (const k of ZOOM_ENV) {
    if (SAVED[k] === undefined) delete process.env[k]
    else process.env[k] = SAVED[k]
  }
  forgetZoomToken()
})

beforeEach(async () => {
  await prisma.notification.deleteMany({ where: { templateKey: 'cohort.session.scheduled' } })
})

describe('اللقاءُ واجتماعُه يُنشآن معا', () => {
  it('الاجتماعُ `zoom_api` لا `manual`، ورمزُه محفوظٌ ورابطُ المضيف ليس كذلك', async () => {
    withKeys(); stubZoom()
    const out = await cohorts.addSessionWithMeeting(actorId, cohortId, {
      title: 'لقاءُ الافتتاح', startsAt: new Date('2026-10-06T15:00:00.000Z'),
      endsAt: new Date('2026-10-06T16:30:00.000Z'), withZoom: true,
    })
    expect(out.zoom?.provider).toBe('zoom_api')
    expect(out.zoom?.joinUrl).toBe('https://zoom.us/j/555')
    expect(out.zoom?.passcodeEnc).toBe('pw55')

    /* رابطُ المضيف يفتح الاجتماعَ بصلاحيّة المضيف — لا يُخزَّن في أيّ عمود */
    const row = await prisma.zoomMeeting.findUnique({ where: { sessionId: out.session.id } })
    expect(JSON.stringify(row)).not.toContain('zak=')
    expect(JSON.stringify(row)).not.toContain('/s/555')
  })

  it('ويُبلَّغ المسجَّلون الثلاثةُ — والمنسحبُ لا يُبلَّغ', async () => {
    withKeys(); stubZoom()
    const out = await cohorts.addSessionWithMeeting(actorId, cohortId, {
      title: 'لقاءُ التبليغ', startsAt: new Date('2026-10-08T15:00:00.000Z'), withZoom: true,
    })
    expect(out.notified).toBe(3)
    const notes = await prisma.notification.findMany({ where: { templateKey: 'cohort.session.scheduled' } })
    expect(notes).toHaveLength(3)
    expect(new Set(notes.map((n) => n.userId))).toEqual(new Set(enrolled))
    expect(notes[0].title).toContain('شعبةُ اختبارِ اللقاءات')
  })

  it('ولقاءٌ بلا اجتماعٍ يُبلَّغ أيضا — الموعدُ خبرٌ وإن لم يكن له رابط', async () => {
    withoutKeys()
    const out = await cohorts.addSessionWithMeeting(actorId, cohortId, {
      title: 'لقاءٌ حضوريّ', startsAt: new Date('2026-10-09T15:00:00.000Z'),
    })
    expect(out.zoom).toBeNull()
    expect(out.notified).toBe(3)
  })
})

describe('ولا جلسةَ نصفَ مجدولة', () => {
  it('بلا مفاتيحَ يُرفض الطلبُ ولا تُنشأ جلسةٌ أصلا', async () => {
    withoutKeys()
    const before = await prisma.cohortSession.count({ where: { cohortId } })
    const rolledBefore = await prisma.auditEvent.count({ where: { action: 'zoom.create_failed' } })
    await expect(cohorts.addSessionWithMeeting(actorId, cohortId, {
      title: 'لقاءٌ لن يُولد', startsAt: new Date('2026-10-10T15:00:00.000Z'), withZoom: true,
    })).rejects.toThrow(/غير مكتمل/)
    expect(await prisma.cohortSession.count({ where: { cohortId } })).toBe(before)
    /* والرفضُ **قبل** الإنشاء لا بعده: لو فُحصت الجاهزيّةُ متأخّرةً لَوُلدت
       الجلسةُ ثمّ حُذفت، ولَخلّف الحذفُ أثرَ `zoom.create_failed` في السجلّ —
       فيقرأ المدقّقُ عطبَ اتّصالٍ حيث لا اتّصالَ جُرّب أصلا. */
    expect(await prisma.auditEvent.count({ where: { action: 'zoom.create_failed' } })).toBe(rolledBefore)
  })

  it('وإن سقط Zoom بعد إنشاء الجلسة تُحذف الجلسةُ معه', async () => {
    withKeys(); stubZoom({ failCreate: true })
    const before = await prisma.cohortSession.count({ where: { cohortId } })
    await expect(cohorts.addSessionWithMeeting(actorId, cohortId, {
      title: 'لقاءٌ يسقط اجتماعُه', startsAt: new Date('2026-10-11T15:00:00.000Z'), withZoom: true,
    })).rejects.toThrow()
    expect(await prisma.cohortSession.count({ where: { cohortId } })).toBe(before)
    /* ولا يُبلَّغ أحدٌ بلقاءٍ أُلغي */
    expect(await prisma.notification.count({ where: { templateKey: 'cohort.session.scheduled' } })).toBe(0)
  })
})
