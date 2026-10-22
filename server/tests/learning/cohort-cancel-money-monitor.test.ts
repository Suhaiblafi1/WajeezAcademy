/* إلغاءُ الشعبة وحذفُها، ومالُها، ومتابعتُها — على قاعدةٍ حقيقيّة (٢٢ أكتوبر ٢٠٢٦).

   طلباتُ صاحب المنصّة في رسالةٍ واحدة:
   ١) «أقرّر إيقافَها وأبلغ المدرّب بأنّنا ألغيناها» — فالإلغاءُ يصل المدرّبَ جرسا وبريدا بسببه؛
   ٢) «اجعل خيارَ الحذف واضحا جدّا» — فالملغاةُ تُحذف ولو كان لها مدرّب، باختيارٍ صريحٍ مع خطّته،
      ولا يُحذف ما فيه متعلّمٌ ولا ما لم يُلغَ؛
   ٣) «كم الحدُّ الأدنى الذي سنعطيه للمدرّب وكم حصّلنا» — من قاعدته ومن الطلبات المدفوعة؛
   ٤) «من حضر ومن سلّم ومشاريعُ التخرّج… ورسائلُه للطلاب» — تقريرٌ يُقرأ. */

import { beforeAll, describe, expect, it } from 'vitest'
import type { PrismaClient } from '@prisma/client'
import { setupTestDb, testPrisma } from '../helpers/db'
import { TrainerReviewService } from '../../services/trainer-review.service'
import { CohortService } from '../../services/cohort.service'
import { CancelledCohortDeleteService } from '../../services/cancelled-cohort-delete.service'
import { CohortEconomicsService } from '../../services/cohort-economics.service'
import { CohortMonitorService } from '../../services/cohort-monitor.service'

let prisma: PrismaClient
const ACTOR = '00000000-0000-0000-0000-000000000009'
const COURSE = 'C-BIZ-101'
let profileId = ''
let trainerUserId = ''
let seq = 0

const cohort = (title: string, status = 'open') => prisma.cohort.create({ data: { courseId: COURSE, title, status } })
const learner = async (name = 'متعلم') => prisma.user.create({ data: { email: `ccm-${++seq}@test.local`, passwordHash: 'x', displayName: name } })
const lead = (cohortId: string) => prisma.cohortTrainer.create({ data: { cohortId, profileId, role: 'lead' } })

beforeAll(async () => {
  await setupTestDb()
  prisma = await testPrisma()
  profileId = (await new TrainerReviewService(prisma)
    .createTrainerDirectly(ACTOR, { fullName: 'مدرّب الإلغاء', email: 'ccm-trainer@test.local' })).profileId
  trainerUserId = (await prisma.trainerProfile.findUniqueOrThrow({ where: { id: profileId } })).userId!
}, 240_000)

describe('① الإلغاء يصل المدرب بسببه', () => {
  it('⚠️ جرس وبريد للمدرب — والسبب في نصه، وأثره مكتوب', async () => {
    const c = await cohort('شعبة تلغى لقلة التسجيل')
    await lead(c.id)
    await new CohortService(prisma).transition(c.id, 'cancelled', ACTOR, 'إلغاء من لوحة الإدارة', { reasonAr: 'قلة التسجيل — لم يكتمل الحد الأدنى' })
    const rows = await prisma.notification.findMany({ where: { userId: trainerUserId, templateKey: 'cohort.cancelled.trainer' } })
    expect(rows.map((r) => r.channel).sort()).toEqual(['email', 'in_app'])
    expect(rows.every((r) => r.audience === 'trainer')).toBe(true)
    expect(rows[0].body).toContain('السبب: قلة التسجيل — لم يكتمل الحد الأدنى')
    expect(await prisma.auditEvent.count({ where: { action: 'cohort.cancel.reason', entityId: c.id } })).toBe(1)
  })
})

describe('② حذف الملغاة', () => {
  const svc = () => new CancelledCohortDeleteService(prisma)

  it('⚠️ غير الملغاة لا تحذف — الإلغاء أولا', async () => {
    const c = await cohort('شعبة مفتوحة')
    expect((await svc().preview(c.id)).canDelete).toBe(false)
    await expect(svc().delete(ACTOR, c.id, { withTrainerPlan: true })).rejects.toThrow(/ألغها أولا/)
  })

  it('⚠️ وما فيه ملتحق لا يحذف', async () => {
    const c = await cohort('ملغاة فيها ملتحق', 'cancelled')
    await prisma.enrollment.create({ data: { userId: (await learner()).id, cohortId: c.id, status: 'dropped' } })
    const p = await svc().preview(c.id)
    expect(p.blockedAr).toBe('لا تحذف: فيها 1 ملتحق')
    await expect(svc().delete(ACTOR, c.id, { withTrainerPlan: true })).rejects.toThrow()
  })

  it('⚠️ وما له مدرب لا يحذف إلا باختيار صريح مع خطته', async () => {
    const c = await cohort('ملغاة لها مدرب وخطة', 'cancelled')
    await lead(c.id)
    await prisma.cohortDeliveryPlan.create({ data: { cohortId: c.id, trainerId: profileId, content: { kind: 'trainer' } } })
    const p = await svc().preview(c.id)
    expect(p).toMatchObject({ canDelete: true, trainerNames: ['مدرّب الإلغاء'], plans: 1 })
    await expect(svc().delete(ACTOR, c.id, { withTrainerPlan: false })).rejects.toThrow(/مع خطته/)
    expect(await prisma.cohort.findUnique({ where: { id: c.id } })).not.toBeNull()

    await svc().delete(ACTOR, c.id, { withTrainerPlan: true })
    expect(await prisma.cohort.findUnique({ where: { id: c.id } })).toBeNull()
    expect(await prisma.auditEvent.count({ where: { action: 'cohort.delete_cancelled', entityId: c.id, actorId: ACTOR } })).toBe(1)
  })
})

describe('③ المال: الحد الأدنى وما حصل', () => {
  it('⚠️ من قاعدة المدرب ومن الطلبات المدفوعة لهذه الشعبة — بعد الخصم', async () => {
    const c = await cohort('شعبة بمالها')
    await lead(c.id)
    await prisma.trainerCompensationRule.create({ data: { profileId, type: 'per_seat', rate: 15, minSeats: 15, cohortId: c.id } })
    const u = await learner()
    await prisma.enrollment.create({ data: { userId: u.id, cohortId: c.id, status: 'enrolled' } })
    /* طلبٌ مدفوعٌ بشعبتين، خُصم منه ٢٠: حصّةُ هذه نصفُ الصافي */
    await prisma.order.create({
      data: {
        userId: u.id, status: 'paid', subtotal: 200, discount: 20, total: 180,
        items: { create: [{ kind: 'cohort', refId: c.id, titleAr: 'أ', unitPrice: 100 }, { kind: 'cohort', refId: 'other', titleAr: 'ب', unitPrice: 100 }] },
      },
    })
    /* وطلبٌ لم يُدفع لا يُحصَّل منه شيء */
    await prisma.order.create({
      data: { userId: u.id, status: 'pending_payment', subtotal: 100, total: 100, items: { create: [{ kind: 'cohort', refId: c.id, titleAr: 'أ', unitPrice: 100 }] } },
    })
    const m = await new CohortEconomicsService(prisma).forCohort(c.id)
    expect(m).toMatchObject({ minimum: 225, collected: 90, costIfRun: 225, verdict: 'short', trainerName: 'مدرّب الإلغاء', enrolled: 1, counted: 1 })
  })

  it('⚠️ و«تبدأ قريبا» بأقربها أولا — وما بدأ أو مضى ليس منها', async () => {
    const soon = await cohort('تبدأ بعد أسبوع')
    const later = await cohort('تبدأ بعد ثلاثة أسابيع')
    const started = await cohort('جارية', 'active')
    const day = 86_400_000
    await prisma.cohortSession.create({ data: { cohortId: later.id, title: 'أول', startsAt: new Date(Date.now() + 21 * day) } })
    await prisma.cohortSession.create({ data: { cohortId: soon.id, title: 'أول', startsAt: new Date(Date.now() + 7 * day) } })
    await prisma.cohortSession.create({ data: { cohortId: started.id, title: 'أول', startsAt: new Date(Date.now() + 3 * day) } })
    const ids = (await new CohortEconomicsService(prisma).upcoming(30)).map((r) => r.id)
    expect(ids.indexOf(soon.id)).toBeGreaterThan(-1)
    expect(ids.indexOf(soon.id)).toBeLessThan(ids.indexOf(later.id))
    expect(ids).not.toContain(started.id)
  })
})

describe('④ المتابعة', () => {
  it('⚠️ من حضر ومن سلم ومشروع التخرج ورسائل المدرب', async () => {
    const c = await cohort('شعبة جارية للمتابعة', 'active')
    await lead(c.id)
    const [a, b] = [await learner('سارة'), await learner('خالد')]
    const ea = await prisma.enrollment.create({ data: { userId: a.id, cohortId: c.id } })
    const eb = await prisma.enrollment.create({ data: { userId: b.id, cohortId: c.id } })
    const s = await prisma.cohortSession.create({ data: { cohortId: c.id, title: 'اللقاء الأول', startsAt: new Date(Date.now() - 3 * 86_400_000) } })
    await prisma.cohortSession.create({ data: { cohortId: c.id, title: 'لقاء بلا حضور', startsAt: new Date(Date.now() - 2 * 86_400_000) } })
    await prisma.attendance.create({ data: { sessionId: s.id, enrollmentId: ea.id, status: 'present' } })
    await prisma.attendance.create({ data: { sessionId: s.id, enrollmentId: eb.id, status: 'absent' } })
    const project = await prisma.cohortAssessment.create({ data: { cohortId: c.id, title: 'مشروع التخرج', type: 'project' } })
    await prisma.assignmentSubmission.create({ data: { assessmentId: project.id, enrollmentId: ea.id, status: 'submitted' } })
    await prisma.cohortMessage.create({ data: { cohortId: c.id, authorId: trainerUserId, audience: 'cohort', body: 'أهلا بكم', recipients: 2 } })

    const r = await new CohortMonitorService(prisma).report(c.id)
    expect(r.counts).toMatchObject({ learners: 2, sessionsHeld: 2, attendancePct: 50, waitingReview: 1 })
    const first = r.sessions.find((x) => x.id === s.id)!
    expect(first).toMatchObject({ marked: true, present: 1, absentNames: ['خالد'] })
    expect(r.tasks[0]).toMatchObject({ isProject: true, submitted: 1, waiting: 1, missingNames: ['خالد'] })
    expect(r.learners.find((l) => l.name === 'سارة')).toMatchObject({ attended: 1, held: 1, attendancePct: 100, tasksDone: 1 })
    expect(r.messages[0]).toMatchObject({ body: 'أهلا بكم', byTrainer: true })
    expect(r.alerts).toContain('لقاء مضى بلا حضور مسجل')
  })
})
