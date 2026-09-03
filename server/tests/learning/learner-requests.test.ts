/* طلباتُ آخر الرحلة — شهادةُ دورةٍ، وشهادةُ مسارٍ كاملا، وتوصيةٌ مهنيّة.

   كانت الشهادةُ لا تُطلب أصلا: تُصدَر من لوحة الإدارة، فمن أنهى دورتَه في
   شعبةٍ لا أحدَ يفتحها بقي بلا شهادةٍ إلى أن يتذكّره أحد. وقولُ صاحب المنصّة:
   «وفي نهاية كل دورة يظهر له طلب شهادة للدورة، وفي نهاية المسار يظهر له طلب
   شهادة المسار كاملا وتوصية لعمله أو لجماعته».

   والحارسُ هنا على أربعة قراراتٍ لا على وجود المسار:

   ١) لا طلبَ قبل الاستحقاق — والأهليّةُ بالقواعد نفسِها التي يفحصها الإصدار،
      فلا شاشةٌ تقول «مؤهَّل» ثمّ يرفض الطلب.
   ٢) وحاجزُ توثيق البريد قائمٌ هنا كما هو في الإصدار: الشهادةُ تُنسب إلى شخص.
   ٣) وشهادةُ المسار تلزمها دوراتُه **المطلوبة** كلُّها — لا المساندةُ، وإلّا
      استحالت على من أنجز تصميمَه كاملا.
   ٤) والضغطُ مرّتين لا يصنع طلبين. */

import { beforeAll, describe, expect, it } from 'vitest'
import type { PrismaClient } from '@prisma/client'
import { setupTestDb, testPrisma } from '../helpers/db'
import { AuthService } from '../../services/auth.service'
import { EnrollmentService } from '../../services/enrollment.service'
import { LearnerRequestService } from '../../services/learner-request.service'
import { AuthError } from '../../services/auth.service'

let prisma: PrismaClient
let requests: LearnerRequestService
let doneId = ''       // أنهى ووثّق بريده
let unverifiedId = '' // أنهى وبريدُه غير موثَّق
let notDoneId = ''    // لم يستوفِ القواعد
let doneUserId = ''
let unverifiedUserId = ''
let notDoneUserId = ''

const ADMIN = '44444444-4444-4444-8444-444444444444'
/* مسارٌ بدورتين مطلوبتين ودورةٍ مساندة — عليه تُقاس شهادةُ المسار */
const PATHWAY = 'PW-TEST-REQ'
const C_ONE = 'C-BIZ-101'
const C_TWO = 'C-BIZ-102'
const C_SUPPORT = 'C-BIZ-103'

beforeAll(async () => {
  await setupTestDb()
  prisma = await testPrisma()
  requests = new LearnerRequestService(prisma)
  const auth = new AuthService(prisma)
  const enrollments = new EnrollmentService(prisma)

  const cohort = await prisma.cohort.create({
    data: {
      courseId: C_ONE, title: 'شعبة طلبات الشهادة', status: 'active',
      registrationOpen: true, financialReady: true,
      price: 100, currency: 'USD', capacity: 30,
      startsAt: new Date(Date.now() - 30 * 86_400_000),
    },
  })
  await prisma.completionRule.create({
    data: { courseId: C_ONE, cohortId: cohort.id, type: 'modules_completed', threshold: 1, required: true },
  })

  const mk = async (email: string, name: string, verified: boolean) => {
    const u = await auth.register(email, 'Learner#12345', name)
    if (verified) await prisma.user.update({ where: { id: u.userId }, data: { emailVerifiedAt: new Date() } })
    const e = await enrollments.enroll(cohort.id, u.userId, null, {})
    return { userId: u.userId, enrollmentId: e.id }
  }

  const a = await mk('req-done@test.local', 'من أنهى', true)
  const b = await mk('req-unverified@test.local', 'بلا توثيق', false)
  const c = await mk('req-notdone@test.local', 'لم يُنهِ', true)
  doneId = a.enrollmentId; doneUserId = a.userId
  unverifiedId = b.enrollmentId; unverifiedUserId = b.userId
  notDoneId = c.enrollmentId; notDoneUserId = c.userId

  for (const id of [doneId, unverifiedId]) {
    await prisma.courseProgress.upsert({
      where: { enrollmentId: id },
      update: { percent: 100, evidence: { modulesCompleted: 5 } },
      create: { enrollmentId: id, percent: 100, evidence: { modulesCompleted: 5 } },
    })
  }

  /* مسارُ الفحص: دورتان مطلوبتان وواحدةٌ مساندة.
     ودوراتُه تُنشأ إن لم تكن: `PathwayCourse` يشير إلى `Course` بمفتاحٍ
     أجنبيّ، فربطُ دورةٍ لا وجودَ لها يُسقط التهيئةَ كلَّها. */
  await prisma.course.createMany({
    data: [C_ONE, C_TWO, C_SUPPORT].map((id) => ({ id, status: 'published' })),
    skipDuplicates: true,
  })
  await prisma.pathway.create({ data: { id: PATHWAY, status: 'published' } })
  await prisma.pathwayCourse.createMany({
    data: [
      { pathwayId: PATHWAY, courseId: C_ONE, sequence: 1, kind: 'required' },
      { pathwayId: PATHWAY, courseId: C_TWO, sequence: 2, kind: 'required' },
      { pathwayId: PATHWAY, courseId: C_SUPPORT, sequence: 3, kind: 'support' },
    ],
  })
}, 240_000)

describe('١) شهادةُ الدورة — لا طلبَ قبل الاستحقاق', () => {
  it('من أنهى ووثّق بريده مؤهَّل بلا أسباب', async () => {
    const e = await requests.courseEligibility(doneUserId, doneId)
    expect(e.eligible).toBe(true)
    expect(e.reasonsAr).toEqual([])
  })

  it('ومن لم يستوفِ القواعد يُمنع — وسببُه بالنصّ لا بزرٍّ مطفأ', async () => {
    const e = await requests.courseEligibility(notDoneUserId, notDoneId)
    expect(e.eligible).toBe(false)
    expect(e.reasonsAr.length, 'مُنع بلا سببٍ يُقرأ').toBeGreaterThan(0)
    /* والسببُ بلغةٍ تُقرأ لا بمفتاحٍ إنجليزيّ من محرّك القواعد */
    expect(e.reasonsAr.join(' ')).not.toMatch(/modules_completed|attendance_pct/)
  })

  it('وحاجزُ توثيق البريد قائمٌ — الشهادةُ تُنسب إلى شخص', async () => {
    const e = await requests.courseEligibility(unverifiedUserId, unverifiedId)
    expect(e.eligible).toBe(false)
    expect(e.reasonsAr.join(' ')).toContain('وثّق بريدك')
  })

  it('وتسجيلُ غيرِه لا يُقرأ له — ولو عرف معرّفه', async () => {
    await expect(requests.courseEligibility(notDoneUserId, doneId)).rejects.toThrow(AuthError)
  })

  it('والطلبُ يُرفض بأسبابه لا يُنشأ ثمّ يُعتذَر عنه', async () => {
    await expect(
      requests.create(notDoneUserId, { kind: 'course_certificate', enrollmentId: notDoneId }),
    ).rejects.toThrow(/المطلوب|الدروس|بريدك/)
    expect(await prisma.learnerRequest.count({ where: { userId: notDoneUserId } })).toBe(0)
  })

  it('والمؤهَّلُ يُنشأ طلبُه ويُقرأ في طلباته', async () => {
    const created = await requests.create(doneUserId, { kind: 'course_certificate', enrollmentId: doneId })
    expect(created.status).toBe('pending')
    const mine = await requests.mine(doneUserId)
    expect(mine).toHaveLength(1)
    expect(mine[0].kind).toBe('course_certificate')
    expect(mine[0].enrollmentId).toBe(doneId)
  })

  it('والضغطُ مرّتين لا يصنع طلبين — يُعاد القائم', async () => {
    const again = await requests.create(doneUserId, { kind: 'course_certificate', enrollmentId: doneId })
    expect(await prisma.learnerRequest.count({ where: { userId: doneUserId, kind: 'course_certificate' } })).toBe(1)
    expect(again.status).toBe('pending')
  })
})

describe('٢) شهادةُ المسار كاملا — دوراتُه المطلوبة كلُّها', () => {
  it('تُحسب المطلوبةُ وحدَها: المساندةُ زيادةٌ لا شرط', async () => {
    const c = await requests.pathwayEligibility(doneUserId, PATHWAY)
    expect(c.total, 'المساندةُ حُسبت شرطا فاستحالت الشهادة').toBe(2)
    expect(c.done).toBe(1)
    expect(c.eligible).toBe(false)
    expect(c.reasonsAr.join(' ')).toContain('تبقى')
  })

  it('ولا تُطلب قبل إنجازها كلِّها', async () => {
    await expect(
      requests.create(doneUserId, { kind: 'pathway_certificate', pathwayId: PATHWAY }),
    ).rejects.toThrow(/أنجزت/)
  })

  it('ومسارٌ لا وجودَ له يُردّ لا يُحسب صفرا مؤهَّلا', async () => {
    await expect(requests.pathwayEligibility(doneUserId, 'PW-NOPE-999')).rejects.toThrow(AuthError)
  })

  it('فإذا أنجز المطلوبَ كلَّه صار مؤهَّلا — وطُلبت الشهادةُ والتوصية', async () => {
    /* الدورةُ الثانية: شعبةٌ وتسجيلٌ مكتمل */
    const c2 = await prisma.cohort.create({
      data: {
        courseId: C_TWO, title: 'شعبة الدورة الثانية', status: 'active',
        registrationOpen: true, financialReady: true,
        price: 100, currency: 'USD', capacity: 30,
        startsAt: new Date(Date.now() - 20 * 86_400_000),
      },
    })
    const e2 = await new EnrollmentService(prisma).enroll(c2.id, doneUserId, null, {})
    await prisma.enrollment.update({ where: { id: e2.id }, data: { status: 'completed' } })

    const c = await requests.pathwayEligibility(doneUserId, PATHWAY)
    expect(c.done).toBe(2)
    expect(c.eligible).toBe(true)

    const cert = await requests.create(doneUserId, { kind: 'pathway_certificate', pathwayId: PATHWAY })
    expect(cert.kind).toBe('pathway_certificate')

    const rec = await requests.create(doneUserId, {
      kind: 'recommendation', pathwayId: PATHWAY, audienceAr: 'إدارة الموارد البشرية في شركتي',
    })
    expect(rec.audienceAr).toBe('إدارة الموارد البشرية في شركتي')
  })

  it('والتوصيةُ تلزمها جهةٌ تُسمّى — وثيقةٌ عامّةٌ لا تنفع في تقديمٍ حقيقيّ', async () => {
    await prisma.learnerRequest.deleteMany({ where: { userId: doneUserId, kind: 'recommendation' } })
    await expect(
      requests.create(doneUserId, { kind: 'recommendation', pathwayId: PATHWAY }),
    ).rejects.toThrow(/جهة/)
  })
})

describe('٣) القرارُ يُسجَّل ويُبلَّغ صاحبَه', () => {
  it('الاعتذارُ يلزمه سببٌ يُقرأ', async () => {
    const req = await prisma.learnerRequest.findFirstOrThrow({ where: { userId: doneUserId, kind: 'course_certificate' } })
    await expect(requests.decide(req.id, ADMIN, 'declined')).rejects.toThrow(/سببا/)
  })

  it('و«قيد المراجعة» لا يُقفل الطلبَ ولا يُبلَّغ قرارا', async () => {
    const req = await prisma.learnerRequest.findFirstOrThrow({ where: { userId: doneUserId, kind: 'course_certificate' } })
    const out = await requests.decide(req.id, ADMIN, 'in_review')
    expect(out.status).toBe('in_review')
    expect(out.decidedAt).toBeNull()
  })

  it('والإنجازُ يُقفل الطلبَ ويُشعِر صاحبَه', async () => {
    const req = await prisma.learnerRequest.findFirstOrThrow({ where: { userId: doneUserId, kind: 'course_certificate' } })
    const out = await requests.decide(req.id, ADMIN, 'fulfilled', 'صدرت شهادتك ورقمها في «شهاداتي»')
    expect(out.status).toBe('fulfilled')
    expect(out.decidedAt).not.toBeNull()
    expect(out.decidedById).toBe(ADMIN)
    const notes = await prisma.notification.count({ where: { userId: doneUserId, templateKey: 'learner.request_decided' } })
    expect(notes, 'قُرّر الطلبُ بصمتٍ كأنّه لم يُقدَّم').toBeGreaterThan(0)
  })

  it('والطابورُ يعرض المفتوحَ وحدَه — والمقفلُ لا يُشغل المراجع', async () => {
    const open = await requests.queue()
    expect(open.every((r) => r.status === 'pending' || r.status === 'in_review')).toBe(true)
    const fulfilled = await requests.queue('fulfilled')
    expect(fulfilled.length).toBeGreaterThan(0)
  })

  it('وبعد الإنجاز يُقبل طلبٌ جديد — فالقيدُ على المعلَّق لا على التاريخ', async () => {
    const before = await prisma.learnerRequest.count({ where: { userId: doneUserId, kind: 'course_certificate' } })
    await requests.create(doneUserId, { kind: 'course_certificate', enrollmentId: doneId })
    expect(await prisma.learnerRequest.count({ where: { userId: doneUserId, kind: 'course_certificate' } })).toBe(before + 1)
  })
})
