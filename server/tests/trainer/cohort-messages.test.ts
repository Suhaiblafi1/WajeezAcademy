/* المدرب يخاطب شعبته.

   كان يرى المتعثّر ولا يملك أن يخاطبه: التغذية الراجعة تُكتب على تسليم، ومن لم
   يُسلّم شيئا لا يبلغه شيء. والقرارُ المتّفق عليه: رسائل **تُسجَّل** لا تمرّ.

   وما يُحرس هنا، وكلّه يسقط صامتا لو انفرط:
   ١) الرسالة أثرٌ باقٍ لا إشعارٌ عابر — من مسح الإشعار لم يمسح الرسالة.
   ٢) لا يخاطب مدرّبٌ متعلّم شعبةٍ ليست له بمعرّفٍ يُخمَّن.
   ٣) وكان معهما «اقتراحُ التأجيل»: موعدٌ يُقترح ولا يتحرّك إلّا باعتماد الإدارة. ثمّ صار المدرّبُ ينقل لقاءَه
      بنفسه (١٧ سبتمبر ٢٠٢٦)، وخرج الاقتراحُ وطابورُه (٢٧ أكتوبر ٢٠٢٦، المرحلة السادسة — ج). فبقي هنا ترحيلُه:
      يُغلق ما بقي معلَّقا بلا قرار، ولا يمسّ ما حُسم ولا موعدَ اللقاء. */

import { beforeAll, describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import type { PrismaClient } from '@prisma/client'
import { setupTestDb, testPrisma } from '../helpers/db'
import { AuthService } from '../../services/auth.service'
import { CohortMessageService } from '../../services/cohort-message.service'

let prisma: PrismaClient
let svc: CohortMessageService
let trainerUserId = ''
let learnerId = ''
let otherLearnerId = ''
let cohortId = ''
let otherCohortId = ''
let enrollmentId = ''
let outsiderEnrollmentId = ''
let sessionId = ''
const root = join(dirname(fileURLToPath(import.meta.url)), '../../..')

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

describe('وخرج اقتراحُ التأجيل — وترحيلُه يُغلق ما بقي معلَّقا', () => {
  it('⚠️ المعلَّقُ يُغلق بلا قرارٍ وسببُه على الصفّ — والمحسومُ وموعدُ اللقاء كما هما', async () => {
    const before = await prisma.cohortSession.findUniqueOrThrow({ where: { id: sessionId } })
    const row = (status: string) => ({
      sessionId, requestedBy: trainerUserId, status,
      currentStartsAt: before.startsAt, proposedStartsAt: new Date(Date.now() + 14 * 86400000), reason: 'اقتراحٌ قبل ١٧ سبتمبر',
    })
    const pending = await prisma.sessionRescheduleRequest.create({ data: row('pending') })
    const rejected = await prisma.sessionRescheduleRequest.create({ data: { ...row('rejected'), reviewerComment: 'يصطدم بشعبة أخرى' } })

    const sql = readFileSync(join(root, 'prisma/migrations/20261027130000_close_session_reschedules/migration.sql'), 'utf8')
    await prisma.$executeRawUnsafe(sql)

    const closed = await prisma.sessionRescheduleRequest.findUniqueOrThrow({ where: { id: pending.id } })
    expect(closed.status).toBe('withdrawn')
    expect(closed.reviewedAt).not.toBeNull()
    expect(closed.reviewerComment).toContain('ينقل المدرب لقاءه بنفسه')
    const kept = await prisma.sessionRescheduleRequest.findUniqueOrThrow({ where: { id: rejected.id } })
    expect(kept.status).toBe('rejected')
    expect(kept.reviewerComment).toBe('يصطدم بشعبة أخرى')
    const after = await prisma.cohortSession.findUniqueOrThrow({ where: { id: sessionId } })
    expect(after.startsAt.getTime(), 'تحرّك الموعد بإغلاق الاقتراح').toBe(before.startsAt.getTime())
  })
})
