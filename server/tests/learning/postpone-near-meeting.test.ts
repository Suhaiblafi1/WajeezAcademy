/* ═══ تأجيلُ لقاءٍ قريبٍ يبقى معتمَدا — واجتماعُه يُنقل معه (٣ج) ═══

   «وبعد الاعتماد كلُّ تغييرٍ باعتماد — إلّا تأجيلَ لقاءٍ بعده أقلُّ من ثمانٍ
   وأربعين ساعة» (قراراتُ صاحب المنصّة بكلمة «go»، ٢٧ سبتمبر ٢٠٢٦). والقاعدةُ
   بحدودها محضةٌ في `postpone.ts` (`src/tests/trainer/postpone.test.ts`)؛ وهنا
   ما يقع على قاعدةٍ حقيقيّة:

   ① المؤجَّلُ القريبُ داخلَ موعده يبقى معتمَدا، ويُنقل اجتماعُه في Zoom، ويصل
      مسجَّليه موعدُه الجديد — ولا يُنادى على الإدارة.
   ② وما عداه يعود إلى الانتظار كما قرّر ١٧ سبتمبر: البعيدُ، والمقدَّمُ، وما خرج
      عن موعد محوره — واجتماعُه يُنقل معه مع ذلك.
   ③ وسقوطُ Zoom لا يُسقط النقل — ويُكتب في أثره.

   ولا شبكةَ هنا: `fetch` مُلتقَط، وطلباتُ النقل تُعدّ. */

import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import type { PrismaClient } from '@prisma/client'
import { setupTestDb, testPrisma } from '../helpers/db'
import { CohortService } from '../../services/cohort.service'
import { forgetZoomToken } from '../../services/zoom.service'
import { zonedDay } from '../../../src/application/trainer/cohort-period'

let prisma: PrismaClient
let cohorts: CohortService
let adminId = ''
let trainerUserId = ''
let cohortId = ''
const enrolled: string[] = []
const STAMP = Date.now()
const H = 3_600_000
const DAY = 24 * H

const SAVED = { ...process.env }
const ZOOM_ENV = ['ZOOM_ACCOUNT_ID', 'ZOOM_CLIENT_ID', 'ZOOM_CLIENT_SECRET', 'ZOOM_HOST_EMAIL'] as const
/** طلباتُ النقل إلى Zoom — `PATCH /meetings/:id` بجسمها */
const patches: { meetingId: string; body: { start_time?: string; duration?: number } }[] = []
let zoomDown = false
/** والشبكةُ نفسُها تنقطع — لا ردَّ من Zoom أصلا، فيرمي النداءُ لا يعود */
let zoomThrows = false

function stubZoom() {
  process.env.ZOOM_ACCOUNT_ID = 'acc'
  process.env.ZOOM_CLIENT_ID = 'cid'
  process.env.ZOOM_CLIENT_SECRET = 'sec'
  process.env.ZOOM_HOST_EMAIL = 'lessons@wajeez.test'
  globalThis.fetch = (async (url: string, init?: { method?: string; body?: string }) => {
    if (String(url).includes('/oauth/token')) {
      return { ok: true, status: 200, json: async () => ({ access_token: 't', expires_in: 3600 }) }
    }
    if (init?.method === 'PATCH') {
      if (zoomThrows) throw new Error('انقطعت الشبكةُ دون Zoom')
      const meetingId = decodeURIComponent(String(url).split('/meetings/')[1] ?? '')
      patches.push({ meetingId, body: JSON.parse(init.body ?? '{}') })
      return zoomDown ? { ok: false, status: 500, json: async () => ({}) } : { ok: true, status: 204, json: async () => ({}) }
    }
    return { ok: false, status: 404, json: async () => ({}) }
  }) as unknown as typeof fetch
  forgetZoomToken()
}

/* المواعيدُ من اليوم: موعدُ المحور الأوّل أسبوعٌ يبدأ أمسِ بعمّان، والثاني بعده */
const dayAt = (n: number) => zonedDay(new Date(Date.now() + n * DAY))
const SLOTS = () => [
  { startsOn: dayAt(-1), endsOn: dayAt(5), moduleIds: ['PP-M1'] },
  { startsOn: dayAt(6), endsOn: dayAt(12), moduleIds: ['PP-M2'] },
]

/** لقاءٌ معتمَدٌ باجتماعٍ في Zoom — يبدأ بعد `hours` ساعة */
let seq = 0
async function approvedMeeting(hours: number, moduleId = 'PP-M1') {
  seq += 1
  const startsAt = new Date(Date.now() + hours * H)
  const s = await prisma.cohortSession.create({
    data: {
      cohortId, title: `لقاءٌ معتمَد ${seq}`, startsAt, endsAt: new Date(startsAt.getTime() + 2 * H),
      moduleId, moduleIds: [moduleId], approvalState: 'approved', approvedBy: adminId, approvedAt: new Date(),
    },
  })
  await prisma.zoomMeeting.create({
    data: { sessionId: s.id, provider: 'zoom_api', meetingId: `mtg-${STAMP}-${seq}`, joinUrl: `https://zoom.us/j/${seq}` },
  })
  return s
}

const move = (id: string, startsAt: Date, hours = 2) =>
  cohorts.trainerMoveSession(trainerUserId, id, { startsAt, endsAt: new Date(startsAt.getTime() + hours * H) })
const pendingNotices = () => prisma.notification.count({ where: { templateKey: 'cohort.session.pending', userId: adminId } })
const toldLearners = (sessionId: string) => prisma.notification.findMany({
  where: { templateKey: 'cohort.schedule_changed', userId: { in: enrolled }, data: { path: ['sessionId'], equals: sessionId } },
})
const lastMoveAudit = (sessionId: string) => prisma.auditEvent.findFirstOrThrow({
  where: { action: 'cohort.session.move', entityId: sessionId }, orderBy: { createdAt: 'desc' },
})

beforeAll(async () => {
  await setupTestDb()
  prisma = await testPrisma()
  cohorts = new CohortService(prisma)
  stubZoom()

  adminId = (await prisma.user.create({ data: { email: `pp-admin-${STAMP}@wajeez.test`, displayName: 'المعتمِد', passwordHash: 'x' } })).id
  await prisma.userRole.create({ data: { userId: adminId, roleId: 'academic_manager' } })
  const tUser = await prisma.user.create({ data: { email: `pp-trainer-${STAMP}@wajeez.test`, displayName: 'مدرّبُ الشعبة', passwordHash: 'x' } })
  trainerUserId = tUser.id
  const application = await prisma.trainerApplication.create({
    data: { reference: `WJ-TR-PP-${STAMP}`, fullName: 'مدرّبُ الشعبة', email: tUser.email, status: 'active' },
  })
  const profile = await prisma.trainerProfile.create({ data: { userId: tUser.id, applicationId: application.id } })

  const course = await prisma.course.findFirst({ select: { id: true } })
  const cohort = await prisma.cohort.create({
    data: {
      courseId: course!.id, title: 'شعبةُ التأجيل', status: 'active', capacity: 20, price: 100, currency: 'USD', timezone: 'Asia/Amman',
      scheduleWindowStart: new Date(Date.now() - 2 * DAY), scheduleWindowEnd: new Date(Date.now() + 30 * DAY), maxSessions: 30,
    },
  })
  cohortId = cohort.id
  await prisma.cohortTrainer.create({ data: { cohortId, profileId: profile.id, role: 'lead' } })
  /* خطّتُه المعتمَدةُ بمواعيدها — منها يُحكم على «داخلَ موعد محوره» */
  await prisma.cohortDeliveryPlan.create({
    data: {
      cohortId, trainerId: profile.id, status: 'approved',
      content: { kind: 'trainer', modules: [{ moduleId: 'PP-M1', titleAr: 'الأوّل' }, { moduleId: 'PP-M2', titleAr: 'الثاني' }], resources: [], slots: SLOTS() },
    },
  })
  for (const i of [0, 1]) {
    const u = await prisma.user.create({ data: { email: `pp-learner-${i}-${STAMP}@wajeez.test`, displayName: `متعلّم ${i}`, passwordHash: 'x' } })
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

describe('① التأجيلُ القريبُ داخلَ موعده يبقى معتمَدا', () => {
  it('⚠️ يبقى معتمَدا، ويُنقل اجتماعُه، ويصل مسجَّليه موعدُه الجديد — ولا يُنادى على الإدارة', async () => {
    const s = await approvedMeeting(20)
    const before = await pendingNotices()
    const to = new Date(s.startsAt.getTime() + DAY)

    /* وثلاثُ ساعاتٍ لا ساعتان — فالمدّةُ في Zoom تُحسب من النقل لا تُفترض */
    const moved = await move(s.id, to, 3)

    expect(moved.approvalState, 'عاد المؤجَّلُ القريبُ إلى الانتظار').toBe('approved')
    expect(moved.startsAt.toISOString()).toBe(to.toISOString())
    const call = patches.find((p) => p.meetingId === `mtg-${STAMP}-${seq}`)
    expect(call?.body.start_time, 'لم يُنقل الاجتماعُ في Zoom').toBe(to.toISOString())
    expect(call?.body.duration, 'مدّةُ الاجتماع لم تتبع النقل').toBe(180)
    expect(await pendingNotices(), 'نُودي على الإدارة بتأجيلٍ لا يحتاجها').toBe(before)
    const told = await toldLearners(s.id)
    expect(told).toHaveLength(enrolled.length)
    expect(told[0].body).toContain('أجّله مدرّبُك إلى')
    const meta = (await lastMoveAudit(s.id)).meta as { postponed: boolean; backToPending: boolean; zoomMoved: boolean }
    expect(meta).toMatchObject({ postponed: true, backToPending: false, zoomMoved: true })
  })
})

describe('② وما عداه يعود إلى الانتظار — واجتماعُه يُنقل معه', () => {
  it('⚠️ البعيدُ (بعد أكثرَ من يومين) يعود إلى الانتظار ويُنادى على الإدارة — واجتماعُه يُنقل', async () => {
    const s = await approvedMeeting(72)
    const before = await pendingNotices()
    const to = new Date(s.startsAt.getTime() + 3 * H)

    const moved = await move(s.id, to)

    expect(moved.approvalState).toBe('pending')
    expect(await pendingNotices(), 'عاد إلى الانتظار ولم يُنادَ على أحد').toBe(before + 1)
    expect(patches.find((p) => p.meetingId === `mtg-${STAMP}-${seq}`)?.body.start_time, 'بقي اجتماعُه على موعده القديم').toBe(to.toISOString())
    expect((await toldLearners(s.id))[0]?.body).toContain('يُراجَع الآن عند الإدارة')
  })

  it('⚠️ والمقدَّمُ — وإن كان قريبا — يعود إلى الانتظار', async () => {
    const s = await approvedMeeting(30)
    const moved = await move(s.id, new Date(s.startsAt.getTime() - 4 * H))
    expect(moved.approvalState).toBe('pending')
  })

  it('⚠️ وما خرج عن موعد محوره — وإن كان تأجيلا قريبا — يعود إلى الانتظار', async () => {
    const s = await approvedMeeting(20)
    /* موعدُ الأوّل ينتهي بعد خمسة أيّام — وهذا بعد سبعة */
    const moved = await move(s.id, new Date(Date.now() + 7 * DAY))
    expect(moved.approvalState).toBe('pending')
    expect(((await lastMoveAudit(s.id)).meta as { postponed: boolean }).postponed).toBe(false)
  })
})

describe('③ وسقوطُ Zoom لا يُسقط النقل', () => {
  /* ردٌّ بخطأٍ (٥٠٠) يعود من النداء نتيجةً — والانقطاعُ يرمي. فالحالتان كلتاهما:
     الأولى وحدَها لا تمرّ بفرع الاعتراض أصلا، فيمرّ حارسُها وإن زال الاعتراض */
  it('⚠️ وانقطاعُ الشبكة كذلك — لا يرمي النقلُ ولا يبقى نصفَ نقل', async () => {
    const s = await approvedMeeting(23)
    zoomThrows = true
    try {
      const moved = await move(s.id, new Date(s.startsAt.getTime() + 5 * H))
      expect(moved.approvalState).toBe('approved')
      expect(((await lastMoveAudit(s.id)).meta as { zoomMoved: boolean }).zoomMoved).toBe(false)
      expect(await toldLearners(s.id), 'نُقل ولم يُبلَّغ أحد — نصفُ نقل').toHaveLength(enrolled.length)
    } finally {
      zoomThrows = false
    }
  })

  it('⚠️ يُنقل اللقاءُ ويبقى معتمَدا — ويُكتب في الأثر أنّ اجتماعَه لم يُنقل', async () => {
    const s = await approvedMeeting(22)
    zoomDown = true
    try {
      const moved = await move(s.id, new Date(s.startsAt.getTime() + 6 * H))
      expect(moved.approvalState).toBe('approved')
      expect(((await lastMoveAudit(s.id)).meta as { zoomMoved: boolean }).zoomMoved).toBe(false)
    } finally {
      zoomDown = false
    }
  })
})
