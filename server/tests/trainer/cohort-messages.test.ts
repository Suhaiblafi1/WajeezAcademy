/* المدرب يخاطب شعبته، ويقترح موعدا ولا يغيّره.

   كان يرى المتعثّر ولا يملك أن يخاطبه: التغذية الراجعة تُكتب على تسليم، ومن لم
   يُسلّم شيئا لا يبلغه شيء. وكانت الجدولة بيد الإدارة وحدها وهو من يعرف
   انقطاعه. والقراران المتّفق عليهما: رسائل **تُسجَّل** لا تمرّ، وموعدٌ
   **يُقترح** لا يُغيَّر.

   وما يُحرس هنا ثلاثة، وكلّها تسقط صامتةً لو انفرطت:
   ١) الرسالة أثرٌ باقٍ لا إشعارٌ عابر — من مسح الإشعار لم يمسح الرسالة.
   ٢) لا يخاطب مدرّبٌ متعلّم شعبةٍ ليست له بمعرّفٍ يُخمَّن.
   ٣) الموعد لا يتحرّك عند المتعلّمين إلا باعتماد الإدارة — ولا يتحرّك بالرفض. */

import { beforeAll, describe, expect, it } from 'vitest'
import type { PrismaClient } from '@prisma/client'
import { setupTestDb, testPrisma } from '../helpers/db'
import { AuthService } from '../../services/auth.service'
import { CohortMessageService } from '../../services/cohort-message.service'

let prisma: PrismaClient
let svc: CohortMessageService
let trainerUserId = ''
let adminId = ''
let learnerId = ''
let otherLearnerId = ''
let cohortId = ''
let otherCohortId = ''
let enrollmentId = ''
let outsiderEnrollmentId = ''
let sessionId = ''

const notifsFor = (userId: string) =>
  prisma.notification.findMany({ where: { userId }, orderBy: { queuedAt: 'desc' } })

beforeAll(async () => {
  await setupTestDb()
  prisma = await testPrisma()
  const auth = new AuthService(prisma)
  svc = new CohortMessageService(prisma)

  const t = await auth.register('msg-trainer@test.local', 'Trainer#12345', 'أستاذ الرسائل')
  trainerUserId = t.userId
  await auth.setRoles(trainerUserId, ['trainer'])
  const a = await auth.register('msg-admin@test.local', 'Admin#12345', 'المدير الأكاديمي')
  adminId = a.userId
  await auth.setRoles(adminId, ['academic_manager'])

  const application = await prisma.trainerApplication.create({
    data: {
      reference: `TR-MSG-${Date.now()}`, fullName: 'أستاذ الرسائل', email: 'msg-trainer@test.local',
      status: 'active', motivation: 'اختبار', privacyConsentAt: new Date(),
    },
  })
  const profile = await prisma.trainerProfile.create({
    data: { applicationId: application.id, userId: trainerUserId, isVerified: true },
  })

  const cohort = await prisma.cohort.create({
    data: { courseId: 'C-BIZ-101', title: 'شعبة الرسائل', status: 'active', capacity: 10 },
  })
  cohortId = cohort.id
  await prisma.cohortTrainer.create({ data: { cohortId, profileId: profile.id, role: 'lead' } })

  const other = await prisma.cohort.create({
    data: { courseId: 'C-BIZ-101', title: 'شعبة أخرى', status: 'active', capacity: 10 },
  })
  otherCohortId = other.id

  const l = await auth.register('msg-learner@test.local', 'Learner#12345', 'متعلّم الشعبة')
  learnerId = l.userId
  enrollmentId = (await prisma.enrollment.create({ data: { userId: learnerId, cohortId, status: 'enrolled' } })).id

  const o = await auth.register('msg-outsider@test.local', 'Learner#12345', 'متعلّم شعبة أخرى')
  otherLearnerId = o.userId
  outsiderEnrollmentId = (await prisma.enrollment.create({
    data: { userId: otherLearnerId, cohortId: otherCohortId, status: 'enrolled' },
  })).id

  const s = await prisma.cohortSession.create({
    data: {
      cohortId, title: 'الجلسة الأولى',
      startsAt: new Date(Date.now() + 7 * 86400000),
      endsAt: new Date(Date.now() + 7 * 86400000 + 5400000),
    },
  })
  sessionId = s.id
}, 240_000)

describe('مخاطبة الشعبة', () => {
  it('إعلانٌ للشعبة يُسجَّل ويصل كلّ مسجَّل فيها', async () => {
    const msg = await svc.send(trainerUserId, cohortId, { audience: 'cohort', body: 'جلستنا القادمة عن رسم العملية — احضروا معكم عمليةً من عملكم.' })
    expect(msg.recipients).toBe(1)

    /* الأثر الباقي: الرسالة نفسها، لا الإشعار الذي قد يُمسح */
    const kept = await prisma.cohortMessage.findMany({ where: { cohortId } })
    expect(kept).toHaveLength(1)
    expect(kept[0].body).toContain('رسم العملية')

    const n = await notifsFor(learnerId)
    expect(n[0].audience, 'الإشعار في بوابة غير بوابة صاحبه').toBe('learner')
    expect(n[0].title).toContain('شعبة الرسائل')
  })

  it('رسالةٌ إلى متعلّم بعينه لا تبلغ غيره', async () => {
    const before = (await notifsFor(otherLearnerId)).length
    await svc.send(trainerUserId, cohortId, { audience: 'learner', enrollmentId, body: 'غبتَ جلستين — تواصل معي لنعوّض ما فاتك.' })
    const mine = await prisma.cohortMessage.findMany({ where: { enrollmentId } })
    expect(mine).toHaveLength(1)
    expect((await notifsFor(otherLearnerId)).length, 'وصلت متعلّما ليس مقصودا').toBe(before)
  })

  it('لا يخاطب متعلّم شعبةٍ ليست له — ولو عرف معرّفه', async () => {
    await expect(
      svc.send(trainerUserId, cohortId, { audience: 'learner', enrollmentId: outsiderEnrollmentId, body: 'رسالةٌ لا تخصّه أبدا' }),
    ).rejects.toMatchObject({ code: 'not_in_cohort' })
    expect(await prisma.cohortMessage.count({ where: { enrollmentId: outsiderEnrollmentId } })).toBe(0)
  })

  it('السجلّ يُقرأ بأحدثه، ويحمل صاحبه ومن قُصد به', async () => {
    const list = await svc.list(cohortId)
    expect(list.length).toBeGreaterThanOrEqual(2)
    expect(list[0].createdAt.getTime()).toBeGreaterThanOrEqual(list[1].createdAt.getTime())
    expect(list[0].author.displayName).toBe('أستاذ الرسائل')
  })
})

describe('اقتراح تأجيل جلسة', () => {
  it('الاقتراح لا يحرّك الموعد — والاعتماد وحده يحرّكه، بمدّة الجلسة نفسها', async () => {
    const before = await prisma.cohortSession.findUniqueOrThrow({ where: { id: sessionId } })
    const span = before.endsAt!.getTime() - before.startsAt.getTime()
    const proposed = new Date(Date.now() + 14 * 86400000)

    const req = await svc.propose(trainerUserId, sessionId, { proposedStartsAt: proposed, reason: 'سفرٌ في موعد الجلسة، وأقترح تأجيلها أسبوعا' })
    const during = await prisma.cohortSession.findUniqueOrThrow({ where: { id: sessionId } })
    expect(during.startsAt.getTime(), 'الاقتراح وحده حرّك الموعد').toBe(before.startsAt.getTime())

    await svc.review(adminId, req.id, { action: 'approve' })
    const after = await prisma.cohortSession.findUniqueOrThrow({ where: { id: sessionId } })
    expect(after.startsAt.getTime()).toBe(proposed.getTime())
    expect(after.endsAt!.getTime() - after.startsAt.getTime(), 'التأجيل قصّر الجلسة').toBe(span)

    const n = await notifsFor(learnerId)
    expect(n[0].title, 'المتعلّم لم يُخبَر بتغيّر موعده').toContain('تغيّر موعد')
  })

  it('الردّ لا يحرّك الموعد، ويصل المدرب في بوابته هو', async () => {
    const before = await prisma.cohortSession.findUniqueOrThrow({ where: { id: sessionId } })
    const req = await svc.propose(trainerUserId, sessionId, { proposedStartsAt: new Date(Date.now() + 30 * 86400000), reason: 'اقتراحٌ ثانٍ للتجربة والفحص' })
    await svc.review(adminId, req.id, { action: 'reject', comment: 'الموعد يصطدم بشعبة أخرى' })

    const after = await prisma.cohortSession.findUniqueOrThrow({ where: { id: sessionId } })
    expect(after.startsAt.getTime(), 'الردّ حرّك الموعد').toBe(before.startsAt.getTime())

    const n = await notifsFor(trainerUserId)
    expect(n[0].audience, 'شأن المدرب وقع في بوابة غير بوابته').toBe('trainer')
    expect(n[0].body).toContain('يصطدم')
    /* والسبب يبقى مكتوبا في الاقتراح نفسه لا في إشعارٍ يُمسح */
    const kept = await prisma.sessionRescheduleRequest.findUniqueOrThrow({ where: { id: req.id } })
    expect(kept.status).toBe('rejected')
    expect(kept.reviewerComment).toContain('يصطدم')
  })

  it('اقتراحٌ معلّقٌ واحدٌ للجلسة، ولا موعدَ في الماضي، ولا قرارَ مرّتين', async () => {
    const req = await svc.propose(trainerUserId, sessionId, { proposedStartsAt: new Date(Date.now() + 40 * 86400000), reason: 'اقتراحٌ ثالثٌ لفحص الحدود' })
    await expect(
      svc.propose(trainerUserId, sessionId, { proposedStartsAt: new Date(Date.now() + 41 * 86400000), reason: 'اقتراحٌ رابعٌ يزاحم الثالث' }),
    ).rejects.toMatchObject({ code: 'already_pending' })

    await svc.review(adminId, req.id, { action: 'reject' })
    await expect(svc.review(adminId, req.id, { action: 'approve' })).rejects.toMatchObject({ code: 'not_pending' })

    await expect(
      svc.propose(trainerUserId, sessionId, { proposedStartsAt: new Date(Date.now() - 86400000), reason: 'موعدٌ في الماضي لا يُقبل' }),
    ).rejects.toMatchObject({ code: 'past_date' })
  })
})
