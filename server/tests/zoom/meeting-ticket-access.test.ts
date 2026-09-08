/* من يُوقَّع له دخولُ الجلسة — والدورُ الذي يُعطاه.

   الحدُّ هو حدُّ بوّابة المتعلّم نفسُه: «المتعلّم لا يرى محتوى شعبةٍ غير
   مسجَّلٍ فيها، والمدرّب لا يرى شعبا خارجَ شعبه». وهنا يزيد عليه شيءٌ أخطر:

   **الدورُ لا يُطلب، يُشتقّ.** `role: 1` في توقيع Zoom مضيفٌ يفتح الاجتماعَ
   ويُخرج منه الحاضرين. فلو أُخذ الدورُ من جسم الطلب لصار كلُّ متعلّمٍ مضيفا
   بتعديل حقلٍ في متصفّحه — يُخرج زملاءَه من محاضرتهم. ولهذا لا تقبل
   `meetingSdkTicket` دورا أصلا: توقيعُها يُبنى ممّا في قاعدة البيانات.

   ولهذا كان هذا الملفُّ بقاعدةٍ حقيقيّةٍ لا بمحاكاة: العلاقةُ التي يُشتقّ منها
   الدورُ (مدرّبٌ مُسنَدٌ · تسجيلٌ حالتُه كذا) هي نفسُها ما تحرسه القاعدة. */

import { beforeAll, afterAll, describe, expect, it } from 'vitest'
import type { PrismaClient } from '@prisma/client'
import { setupTestDb, testPrisma } from '../helpers/db'
import { AuthService } from '../../services/auth.service'
import { CohortService } from '../../services/cohort.service'
import { AuthError } from '../../services/auth.service'

let prisma: PrismaClient
let cohorts: CohortService

let trainerUserId = ''
let learnerId = ''
let droppedLearnerId = ''
let outsiderId = ''
let sessionId = ''        // جلسةٌ باجتماعٍ ورقم
let noNumberSessionId = '' // جلسةٌ برابطٍ بلا رقم
let cancelledSessionId = ''

const savedEnv = { key: process.env.ZOOM_SDK_KEY, secret: process.env.ZOOM_SDK_SECRET }

beforeAll(async () => {
  process.env.ZOOM_SDK_KEY = 'sdk_key_for_access_test'
  process.env.ZOOM_SDK_SECRET = 'sdk_secret_for_access_test'

  await setupTestDb()
  prisma = await testPrisma()
  const auth = new AuthService(prisma)
  cohorts = new CohortService(prisma)

  const t = await auth.register('zoom-trainer@test.local', 'Trainer#12345', 'مدرّبُ الجلسة')
  trainerUserId = t.userId
  await auth.setRoles(trainerUserId, ['trainer'])

  const application = await prisma.trainerApplication.create({
    data: {
      reference: `TR-ZOOM-${Date.now()}`, fullName: 'مدرّبُ الجلسة', email: 'zoom-trainer@test.local',
      status: 'active', motivation: 'اختبار', privacyConsentAt: new Date(),
    },
  })
  const profile = await prisma.trainerProfile.create({
    data: { applicationId: application.id, userId: trainerUserId, isVerified: true },
  })

  const cohort = await prisma.cohort.create({
    data: { courseId: 'C-BIZ-101', title: 'شعبةُ التضمين', status: 'active', capacity: 10 },
  })
  await prisma.cohortTrainer.create({ data: { cohortId: cohort.id, profileId: profile.id, role: 'lead' } })

  const l = await auth.register('zoom-learner@test.local', 'Learner#12345', 'متعلّمٌ مسجَّل')
  learnerId = l.userId
  await prisma.enrollment.create({ data: { userId: learnerId, cohortId: cohort.id, status: 'enrolled' } })

  const d = await auth.register('zoom-dropped@test.local', 'Learner#12345', 'متعلّمٌ منسحب')
  droppedLearnerId = d.userId
  await prisma.enrollment.create({ data: { userId: droppedLearnerId, cohortId: cohort.id, status: 'dropped' } })

  const o = await auth.register('zoom-outsider@test.local', 'Learner#12345', 'من شعبةٍ أخرى')
  outsiderId = o.userId

  const startsAt = new Date(Date.now() + 86_400_000)
  const mk = async (title: string, status = 'scheduled') =>
    (await prisma.cohortSession.create({
      data: { cohortId: cohort.id, title, startsAt, endsAt: new Date(startsAt.getTime() + 3_600_000), status },
    })).id

  sessionId = await mk('جلسةٌ برقم')
  await prisma.zoomMeeting.create({
    data: { sessionId, joinUrl: 'https://zoom.us/j/81234567890', meetingId: '812-3456-7890', passcodeEnc: 'p4ss' },
  })

  noNumberSessionId = await mk('جلسةٌ بلا رقم')
  await prisma.zoomMeeting.create({
    data: { sessionId: noNumberSessionId, joinUrl: 'https://zoom.us/j/81234567890' },
  })

  cancelledSessionId = await mk('جلسةٌ ملغاة', 'cancelled')
  await prisma.zoomMeeting.create({
    data: { sessionId: cancelledSessionId, joinUrl: 'https://zoom.us/j/81234567890', meetingId: '81234567890' },
  })
})

afterAll(() => {
  if (savedEnv.key === undefined) delete process.env.ZOOM_SDK_KEY
  else process.env.ZOOM_SDK_KEY = savedEnv.key
  if (savedEnv.secret === undefined) delete process.env.ZOOM_SDK_SECRET
  else process.env.ZOOM_SDK_SECRET = savedEnv.secret
})

const roleOf = (jwt: string) =>
  JSON.parse(Buffer.from(jwt.split('.')[1].replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString()).role

describe('تذكرةُ فتح الجلسة — من يُوقَّع له وبأيّ دور', () => {
  it('مدرّبُ الشعبة مضيف — ودورُه من إسناده لا من طلبه', async () => {
    const t = await cohorts.meetingSdkTicket(trainerUserId, sessionId)
    expect(t.role).toBe(1)
    expect(roleOf(t.signature)).toBe(1)
  })

  it('المتعلّمُ المسجَّل مشاركٌ لا مضيف — وهذا ما يمنع إخراجَه زملاءَه', async () => {
    const t = await cohorts.meetingSdkTicket(learnerId, sessionId)
    expect(t.role).toBe(0)
    expect(roleOf(t.signature)).toBe(0)
    /* ورقمُ الاجتماع يصل نظيفا من الشُّرَط التي في القاعدة */
    expect(t.meetingNumber).toBe('81234567890')
    expect(t.passcode).toBe('p4ss')
  })

  it('السرُّ لا يخرج في التذكرة — المفتاحُ العلنيُّ وحدَه', async () => {
    const t = await cohorts.meetingSdkTicket(learnerId, sessionId)
    expect(JSON.stringify(t)).not.toContain('sdk_secret_for_access_test')
    expect(t.sdkKey).toBe('sdk_key_for_access_test')
  })

  it('من ليس في الشعبة لا يُوقَّع له — ولو كان متعلّما في المنصّة', async () => {
    await expect(cohorts.meetingSdkTicket(outsiderId, sessionId)).rejects.toThrow(AuthError)
  })

  it('والمنسحبُ مثلُه — التسجيلُ القائمُ لا مجرّدُ وجودِ صفٍّ في الجدول', async () => {
    await expect(cohorts.meetingSdkTicket(droppedLearnerId, sessionId)).rejects.toThrow(AuthError)
  })

  it('جلسةٌ بلا رقمِ اجتماعٍ تُردّ بعربيّةٍ تدلّ على تطبيق Zoom — لا تُفتح فارغة', async () => {
    await expect(cohorts.meetingSdkTicket(learnerId, noNumberSessionId)).rejects.toThrow(/رقم اجتماع/)
  })

  it('والملغاةُ لا تُفتح أصلا', async () => {
    await expect(cohorts.meetingSdkTicket(learnerId, cancelledSessionId)).rejects.toThrow(AuthError)
  })

  it('وبلا مفاتيحَ لا يُوقَّع لأحدٍ — ولا حتّى للمدرّب', async () => {
    const key = process.env.ZOOM_SDK_KEY
    delete process.env.ZOOM_SDK_KEY
    try {
      await expect(cohorts.meetingSdkTicket(trainerUserId, sessionId)).rejects.toThrow(AuthError)
    } finally {
      process.env.ZOOM_SDK_KEY = key
    }
  })
})
