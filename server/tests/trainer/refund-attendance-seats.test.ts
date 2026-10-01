/* ═══ بيّنةُ البند 4-15 من القاعدة — لا الحكمُ وحدَه ═══

   الحكمُ (`seatCounts`) مقيسٌ في `contract-v20-amendments.test.ts` على بيّنةٍ
   تُكتب باليد. وهنا يُقاس **جمعُ البيّنة**: أيُّ جلسةٍ هي «الأولى»، وأيُّ حضورٍ
   يُعَدّ حضورا، ومن أيّ طريقٍ يُعرف أنّ ثمنَ المقعد رُدّ. فحكمٌ صحيحٌ على بيّنةٍ
   خاطئةٍ يدفع عن غير حقّ — أو يُسقط حقّا.

   والقاعدةُ هنا بلا حدٍّ أدنى (`minSeats: 0`) بقصد: الأرضيّةُ تُكمّل المجموعَ
   فتُخفي مقعدا ضاع، وهذا الملفُّ يعدّ المقاعدَ لا يقيس الأرضيّة. فكلُّ مقعدٍ
   يُحتسب ١٥ دولارا، والمجموعُ عددُ المقاعد × ١٥ بلا تأويل.

   ولكلّ حالةٍ شعبتُها: فإن سقط فحصٌ عُرفت الحالةُ من اسمه لا من مجموعٍ مختلط. */

import { beforeAll, describe, expect, it } from 'vitest'
import type { PrismaClient } from '@prisma/client'
import { setupTestDb, testPrisma } from '../helpers/db'
import { makeReadyForApproval } from '../helpers/trainer-ready'
import { AuthService } from '../../services/auth.service'
import { TrainerApplicationService, type AvailabilityInput } from '../../services/trainer-application.service'
import { TrainerReviewService } from '../../services/trainer-review.service'
import { EarningsService } from '../../services/earnings.service'

const RATE = 15
let prisma: PrismaClient
let earnings: EarningsService
let auth: AuthService
let adminId = ''
let profileId = ''
let n = 0

const phase1 = (email: string) => ({
  fullName: 'مدرّبُ الاسترداد', email, country: 'الأردن', timezone: 'Asia/Amman', phoneCountryCode: '+962', phone: '790000015',
  specialties: ['تحليل البيانات والمالية'], domainYears: '8-12' as const, trainingYears: 'formal_teaching',
  trainingLanguages: ['العربية'], deliveryMode: 'both' as const,
  motivation: 'أريد الانضمام إلى وجيز لأنني درّبت فرقا حقيقية في بيئات عمل عربية، وأعرف الفرق بين من يعرف المادة ومن يستطيع تعليمها. سأقدّم للمتعلمين مهمة تطبيقية من واقع عملهم.',
  privacyConsent: true as const, password: 'Trainer#12345',
})

/** شعبةٌ جاريةٌ للمدرّب، فيها جلستان: الأولى ثمّ ثانيةٌ بعدها بأسبوع */
async function cohort(title: string) {
  const c = await prisma.cohort.create({
    data: { courseId: 'C-BIZ-101', title, status: 'active', registrationOpen: true, financialReady: true, price: 100, currency: 'USD', capacity: 20 },
  })
  await prisma.cohortTrainer.create({ data: { cohortId: c.id, profileId, role: 'lead', assignedBy: adminId } })
  const first = await prisma.cohortSession.create({ data: { cohortId: c.id, title: 'الأولى', startsAt: new Date('2026-11-02T17:00:00Z') } })
  const second = await prisma.cohortSession.create({ data: { cohortId: c.id, title: 'الثانية', startsAt: new Date('2026-11-09T17:00:00Z') } })
  return { cohortId: c.id, firstId: first.id, secondId: second.id }
}

/** متعلّمٌ مسجَّلٌ في الشعبة — وحالتُه ما يُمرَّر */
async function learner(cohortId: string, status = 'enrolled') {
  const userId = (await auth.register(`seat-${++n}@test.local`, 'Learner#12345', `متعلّم ${n}`)).userId
  const e = await prisma.enrollment.create({ data: { cohortId, userId, status } })
  return { userId, enrollmentId: e.id }
}

/** طلبٌ فيه بندُ هذه الشعبة باسمها */
async function order(userId: string, cohortId: string, status: string) {
  return prisma.order.create({
    data: {
      userId, status, subtotal: 100, total: 100,
      items: { create: [{ kind: 'cohort', refId: cohortId, titleAr: 'مقعد', unitPrice: 100 }] },
    },
  })
}

const attend = (sessionId: string, enrollmentId: string, status = 'present') =>
  prisma.attendance.create({ data: { sessionId, enrollmentId, status } })

const total = async (cohortId: string) => (await earnings.computeCohort(cohortId)).total

describe('بيّنةُ البند 4-15 من القاعدة', () => {
  beforeAll(async () => {
    await setupTestDb()
    prisma = await testPrisma()
    auth = new AuthService(prisma)
    const apps = new TrainerApplicationService(prisma)
    const review = new TrainerReviewService(prisma)
    earnings = new EarningsService(prisma)

    adminId = (await auth.register('admin-seats@test.local', 'Admin#12345', 'المدير')).userId
    await auth.setRoles(adminId, ['academic_manager'])

    const res = await apps.submitPhase1(phase1('trainer-seats@test.local'))
    await apps.completePhase2(res.reference, res.candidateToken, {
      previousCourses: [], teachableCourseIds: ['C-BIZ-101'],
      availability: { seasons: ['nov_jan'] } as AvailabilityInput, demoConsent: true as const, contact: { channel: 'email' },
    })
    const app = await prisma.trainerApplication.findUniqueOrThrow({ where: { reference: res.reference } })
    await review.decide(app.id, adminId, 'move_to_review')
    await makeReadyForApproval(prisma, app.id, adminId)
    await review.decide(app.id, adminId, 'approve')
    profileId = (await prisma.trainerProfile.findUniqueOrThrow({ where: { applicationId: app.id } })).id

    await earnings.setRule(adminId, { profileId, type: 'per_seat', rate: RATE, minSeats: 0 })
  })

  it('⚠️ لم يحضر الأولى ورُدّ إليه ثمنُه كاملا — لا يُدفَع عنه', async () => {
    const { cohortId } = await cohort('ردٌّ بلا حضور')
    const l = await learner(cohortId)
    await order(l.userId, cohortId, 'refunded')
    expect(await total(cohortId), 'دُفع عن مقعدٍ رُدّ ثمنُه قبل أن يُقدَّم له شيء').toBe(0)
  })

  it('⚠️ وحضر الأولى ثمّ رُدّ إليه — يُدفَع عنه', async () => {
    const { cohortId, firstId } = await cohort('ردٌّ بعد الحضور')
    const l = await learner(cohortId)
    await order(l.userId, cohortId, 'refunded')
    await attend(firstId, l.enrollmentId)
    expect(await total(cohortId), 'نقصت أتعابُ المقعد بما رُدّ بعد الجلسة الأولى').toBe(RATE)
  })

  /* و«الأولى» الأولى لا أيُّ جلسة: من غاب عنها وحضر الثانيةَ لم يحضر الأولى */
  it('⚠️ وحضورُ الثانية وحدَها ليس حضورا للأولى', async () => {
    const { cohortId, secondId } = await cohort('حضر الثانية وحدَها')
    const l = await learner(cohortId)
    await order(l.userId, cohortId, 'refunded')
    await attend(secondId, l.enrollmentId)
    expect(await total(cohortId), 'عُدّ حضورُ الثانية حضورا للأولى').toBe(0)
  })

  /* وإن أُلغيت الأولى فالتي انعقدت بعدها هي «الأولى» */
  it('وإن أُلغيت الجلسةُ الأولى فالتي بعدها هي الأولى', async () => {
    const { cohortId, firstId, secondId } = await cohort('أُلغيت الأولى')
    await prisma.cohortSession.update({ where: { id: firstId }, data: { status: 'cancelled' } })
    const l = await learner(cohortId)
    await order(l.userId, cohortId, 'refunded')
    await attend(secondId, l.enrollmentId)
    expect(await total(cohortId), 'عُدّت الملغاةُ أولى فضاع حضورُ من حضر').toBe(RATE)
  })

  it('⚠️ وأُسقط بعد أن حضر الأولى — يُدفَع عنه «في كل حال»', async () => {
    const { cohortId, firstId } = await cohort('أُسقط بعد الحضور')
    const l = await learner(cohortId, 'dropped')
    await attend(firstId, l.enrollmentId)
    expect(await total(cohortId), 'ضاع مقعدُ من حضر الأولى لأنّه أُسقط بعدها').toBe(RATE)
  })

  /* ═══ وطريقُ الخطّة: طلبٌ لا يحمل بندَ الشعبة باسمها ═══
     يُعرف من `EnrollmentRequest.orderId` — ولو قُرئ بندُ الشعبة وحدَه لَبقي
     مقعدُ خطّةٍ رُدّ ثمنُها كاملا يُدفَع عنه. */
  it('⚠️ والطلبُ المعروفُ من طلب التسجيل وحدَه يُقرأ — طريقُ الخطّة', async () => {
    const { cohortId } = await cohort('طلبُ خطّة')
    const l = await learner(cohortId)
    const o = await prisma.order.create({
      data: {
        userId: l.userId, status: 'refunded', subtotal: 300, total: 300,
        items: { create: [{ kind: 'pathway', refId: 'P-1', titleAr: 'مسار', unitPrice: 300 }] },
      },
    })
    await prisma.enrollmentRequest.create({ data: { userId: l.userId, cohortId, status: 'converted', orderId: o.id } })
    expect(await total(cohortId), 'لم يُقرأ ردُّ طلبٍ لا يحمل بندَ الشعبة').toBe(0)
  })

  /* والغيابُ بعذرٍ ليس حضورا: «ويعتد في الحضور بما تسجله المنصة»، وما سجّلته
     غياب — والعذرُ يرفع اللومَ عن المتعلّم لا يجعله حاضرا. */
  it('والغيابُ بعذرٍ ليس حضورا — والمتأخّرُ حاضر', async () => {
    const excused = await cohort('غاب بعذر')
    const a = await learner(excused.cohortId)
    await order(a.userId, excused.cohortId, 'refunded')
    await attend(excused.firstId, a.enrollmentId, 'excused')
    expect(await total(excused.cohortId), 'عُدّ الغيابُ بعذرٍ حضورا').toBe(0)

    const late = await cohort('تأخّر')
    const b = await learner(late.cohortId)
    await order(b.userId, late.cohortId, 'refunded')
    await attend(late.firstId, b.enrollmentId, 'late')
    expect(await total(late.cohortId), 'لم يُعَدّ المتأخّرُ حاضرا').toBe(RATE)
  })

  it('ومقعدٌ بلا طلبٍ، وآخرُ رُدّ بعضُ ثمنه — كلاهما يُدفَع عنه', async () => {
    const { cohortId } = await cohort('بلا طلب وردٌّ جزئيّ')
    await learner(cohortId)
    const p = await learner(cohortId)
    await order(p.userId, cohortId, 'partially_refunded')
    expect(await total(cohortId)).toBe(2 * RATE)
  })
})
