/* التقييم (١و) — العقد كاملا، وأثقلُه قواعد الخصوصية.

   ما يُختبر هنا ليس «هل تُحفظ الدرجة» بل ثلاثة أشياء تنكسر صامتةً:
   إخفاءُ الهوية إن تسرّب معرّف المُقيِّم، والعتبةُ إن عُرض تقييمٌ واحد، وصدقُ
   المعدّل إن استثنى قرارُ الإدارة درجةً من حسابه. */

import { beforeAll, describe, expect, it } from 'vitest'
import type { PrismaClient } from '@prisma/client'
import { setupTestDb, testPrisma } from '../helpers/db'
import { AuthService } from '../../services/auth.service'
import { RatingService, MIN_RATINGS_TO_REVEAL } from '../../services/rating.service'

let prisma: PrismaClient
let auth: AuthService
let ratings: RatingService
let cohortId: string
let profileId: string
let adminId: string
const COURSE = 'C-BIZ-101'

/** متعلّم مسجَّل في الشعبة — يعيد معرّفيه */
let seq = 0
async function enrolledLearner() {
  seq += 1
  const { userId } = await auth.register(`rate-${seq}@test.local`, 'Learner#12345', `مقيّم ${seq}`)
  const e = await prisma.enrollment.create({ data: { userId, cohortId, status: 'enrolled' } })
  return { userId, enrollmentId: e.id }
}

beforeAll(async () => {
  await setupTestDb()
  prisma = await testPrisma()
  auth = new AuthService(prisma)
  ratings = new RatingService(prisma)

  const a = await auth.register('rate-admin@test.local', 'Admin#12345', 'مدير التقييم')
  adminId = a.userId
  await auth.setRoles(adminId, ['academic_manager'])

  /* شعبة بدأت أمس — شرط التقييم أن تكون الشعبة قد بدأت فعلا */
  const cohort = await prisma.cohort.create({
    data: {
      courseId: COURSE, title: 'شعبة التقييم', status: 'active', registrationOpen: false,
      financialReady: true, price: 100, currency: 'JOD', capacity: 50,
      startsAt: new Date(Date.now() - 86_400_000),
    },
  })
  cohortId = cohort.id

  /* مدرّب معتمَد مربوط بالشعبة */
  const application = await prisma.trainerApplication.create({
    data: {
      reference: `TR-RATE-${Date.now()}`, fullName: 'مدرّب التقييم', email: `tr-rate-${Date.now()}@test.local`,
      phone: '0790000000', status: 'active', motivation: 'اختبار', privacyConsentAt: new Date(),
    },
  })
  const profile = await prisma.trainerProfile.create({
    data: { applicationId: application.id, isVerified: true, publicVisibility: true, publishApprovedAt: new Date() },
  })
  profileId = profile.id
  await prisma.cohortTrainer.create({ data: { cohortId, profileId, role: 'lead' } })
}, 240_000)

describe('ما يستطيع المتعلّم تقييمه', () => {
  it('الدورة ومدرّبها يظهران لمن سجّل وبدأت شعبته', async () => {
    const { userId } = await enrolledLearner()
    const list = await ratings.rateableFor(userId)
    expect(list.map((r) => r.subjectType).sort()).toEqual(['course', 'trainer'])
    expect(list.find((r) => r.subjectType === 'trainer')?.subjectId).toBe(profileId)
    expect(list.every((r) => r.myScore === null)).toBe(true)
  })

  it('شعبة لم تبدأ بعد لا تُقيَّم — لا رأي فيما لم يُجرَّب', async () => {
    seq += 1
    const { userId } = await auth.register(`rate-future-${seq}@test.local`, 'Learner#12345', 'متعلّم مبكّر')
    const future = await prisma.cohort.create({
      data: {
        courseId: COURSE, title: 'شعبة لم تبدأ', status: 'open', registrationOpen: true,
        financialReady: true, price: 100, currency: 'JOD', capacity: 5,
        startsAt: new Date(Date.now() + 30 * 86_400_000),
      },
    })
    await prisma.enrollment.create({ data: { userId, cohortId: future.id, status: 'enrolled' } })
    expect(await ratings.rateableFor(userId)).toEqual([])
  })

  it('غير المسجَّل لا يُقيِّم شيئا', async () => {
    seq += 1
    const { userId } = await auth.register(`rate-out-${seq}@test.local`, 'Learner#12345', 'متطفّل')
    expect(await ratings.rateableFor(userId)).toEqual([])
    await expect(
      ratings.submit(userId, { enrollmentId: crypto.randomUUID(), subjectType: 'trainer', subjectId: profileId, score: 5 }),
    ).rejects.toMatchObject({ code: 'not_rateable' })
  })

  it('لا يُقيَّم مدرّبٌ ليس مدرّبَ شعبتي ولو أُرسل معرّفه', async () => {
    const { userId, enrollmentId } = await enrolledLearner()
    await expect(
      ratings.submit(userId, { enrollmentId, subjectType: 'trainer', subjectId: crypto.randomUUID(), score: 1 }),
    ).rejects.toMatchObject({ code: 'not_rateable' })
  })
})

describe('الإرسال والتعديل', () => {
  it('الدرجة خارج ١..٥ مرفوضة', async () => {
    const { userId, enrollmentId } = await enrolledLearner()
    for (const score of [0, 6, 2.5]) {
      await expect(
        ratings.submit(userId, { enrollmentId, subjectType: 'course', subjectId: COURSE, score }),
      ).rejects.toMatchObject({ code: 'bad_score' })
    }
  })

  it('تقييم واحد لكل تسجيل لكل هدف — الثاني يستبدل ولا يُضاعف', async () => {
    const { userId, enrollmentId } = await enrolledLearner()
    await ratings.submit(userId, { enrollmentId, subjectType: 'course', subjectId: COURSE, score: 2 })
    await ratings.submit(userId, { enrollmentId, subjectType: 'course', subjectId: COURSE, score: 5 })
    const rows = await prisma.rating.findMany({ where: { enrollmentId, subjectType: 'course' } })
    expect(rows).toHaveLength(1)
    expect(rows[0].score).toBe(5)
  })

  it('تعديل تعليقٍ اعتُمد يعيده إلى المراجعة — نصٌّ تغيّر لم يُراجَع', async () => {
    const { userId, enrollmentId } = await enrolledLearner()
    await ratings.submit(userId, { enrollmentId, subjectType: 'course', subjectId: COURSE, score: 4, commentAr: 'جيدة' })
    const row = await prisma.rating.findFirst({ where: { enrollmentId, subjectType: 'course' } })
    await ratings.moderate(row!.id, adminId, true)
    expect((await prisma.rating.findUnique({ where: { id: row!.id } }))?.publishStatus).toBe('approved')
    await ratings.submit(userId, { enrollmentId, subjectType: 'course', subjectId: COURSE, score: 1, commentAr: 'نصّ آخر تماما' })
    expect((await prisma.rating.findUnique({ where: { id: row!.id } }))?.publishStatus).toBe('pending')
  })
})

describe('عتبة إخفاء الهوية', () => {
  it('تحت العتبة لا يرى صاحبُ الشأن شيئا، ولا يُكتب متوسّطه العام', async () => {
    const application = await prisma.trainerApplication.create({
      data: {
        reference: `TR-LOW-${Date.now()}`, fullName: 'مدرّب قليل التقييم', email: `tr-low-${Date.now()}@test.local`,
        phone: '0790000001', status: 'active', motivation: 'اختبار', privacyConsentAt: new Date(),
      },
    })
    const p = await prisma.trainerProfile.create({ data: { applicationId: application.id, isVerified: true } })
    const c = await prisma.cohort.create({
      data: {
        courseId: COURSE, title: 'شعبة قليلة', status: 'active', registrationOpen: false, financialReady: true,
        price: 10, currency: 'JOD', capacity: 5, startsAt: new Date(Date.now() - 86_400_000),
      },
    })
    await prisma.cohortTrainer.create({ data: { cohortId: c.id, profileId: p.id, role: 'lead' } })
    seq += 1
    const { userId } = await auth.register(`rate-low-${seq}@test.local`, 'Learner#12345', 'متعلّم')
    const e = await prisma.enrollment.create({ data: { userId, cohortId: c.id, status: 'enrolled' } })
    await ratings.submit(userId, { enrollmentId: e.id, subjectType: 'trainer', subjectId: p.id, score: 1, commentAr: 'سيئ' })

    const view = await ratings.forSubject('trainer', p.id)
    expect(view.revealed).toBe(false)
    expect(view.count).toBe(0)
    expect(JSON.stringify(view)).not.toContain('سيئ')

    const fresh = await prisma.trainerProfile.findUnique({ where: { id: p.id } })
    expect(fresh?.ratingAvg).toBeNull()
    expect(fresh?.ratingCount).toBeNull()

    expect((await ratings.publicFor('trainer', p.id)).revealed).toBe(false)
  })

  it('عند بلوغ العتبة يُكشف المجمّع ويُكتب المتوسّط العام', async () => {
    const scores = [5, 4, 3]
    for (const score of scores) {
      const { userId, enrollmentId } = await enrolledLearner()
      await ratings.submit(userId, { enrollmentId, subjectType: 'trainer', subjectId: profileId, score, commentAr: `رأي ${score}` })
    }
    const view = await ratings.forSubject('trainer', profileId)
    expect(view.revealed).toBe(true)
    expect(view.count).toBe(MIN_RATINGS_TO_REVEAL)
    expect(view.avg).toBe(4)

    const fresh = await prisma.trainerProfile.findUnique({ where: { id: profileId } })
    expect(fresh?.ratingCount).toBe(3)
    expect(fresh?.ratingAvg).toBe(4)
  })

  it('ما يصل صاحبَ الشأن لا يحمل معرّف مُقيِّم ولا تسجيل — ولو بحثتَ في النصّ', async () => {
    const view = await ratings.forSubject('trainer', profileId)
    const raters = await prisma.rating.findMany({
      where: { subjectType: 'trainer', subjectId: profileId },
      select: { raterId: true, enrollmentId: true, id: true },
    })
    const blob = JSON.stringify(view)
    expect(raters.length).toBeGreaterThan(0)
    for (const r of raters) {
      expect(blob).not.toContain(r.raterId)
      expect(blob).not.toContain(r.enrollmentId)
      expect(blob).not.toContain(r.id)
    }
  })
})

describe('المعدّل المعلَن يقول الحقيقة', () => {
  it('رفضُ تعليقٍ لا يُخرج درجته من المعدّل — الاعتماد على النصّ لا على الرقم', async () => {
    const application = await prisma.trainerApplication.create({
      data: {
        reference: `TR-AVG-${Date.now()}`, fullName: 'مدرّب المعدّل', email: `tr-avg-${Date.now()}@test.local`,
        phone: '0790000002', status: 'active', motivation: 'اختبار', privacyConsentAt: new Date(),
      },
    })
    const p = await prisma.trainerProfile.create({ data: { applicationId: application.id, isVerified: true } })
    const c = await prisma.cohort.create({
      data: {
        courseId: COURSE, title: 'شعبة المعدّل', status: 'active', registrationOpen: false, financialReady: true,
        price: 10, currency: 'JOD', capacity: 20, startsAt: new Date(Date.now() - 86_400_000),
      },
    })
    await prisma.cohortTrainer.create({ data: { cohortId: c.id, profileId: p.id, role: 'lead' } })

    const ids: string[] = []
    for (const score of [1, 5, 5, 5]) {
      seq += 1
      const { userId } = await auth.register(`rate-avg-${seq}@test.local`, 'Learner#12345', 'متعلّم')
      const e = await prisma.enrollment.create({ data: { userId, cohortId: c.id, status: 'enrolled' } })
      await ratings.submit(userId, { enrollmentId: e.id, subjectType: 'trainer', subjectId: p.id, score, commentAr: `درجة ${score}` })
      const row = await prisma.rating.findFirst({ where: { enrollmentId: e.id, subjectType: 'trainer' } })
      ids.push(row!.id)
    }
    /* الإدارة ترفض التعليق الأسوأ — ويجب أن تبقى درجتُه في المعدّل */
    await ratings.moderate(ids[0], adminId, false, 'لغة غير لائقة')

    const pub = await ratings.publicFor('trainer', p.id)
    expect(pub.revealed).toBe(true)
    expect(pub.count).toBe(4)
    expect(pub.avg).toBe(4) // (1+5+5+5)/4 — لا 5
    expect(pub.comments.map((x) => x.commentAr)).not.toContain('درجة 1')
    expect(pub.comments).toHaveLength(0) // البقية ما زالت بانتظار المراجعة
  })

  it('التعليق المعتمَد وحده يُنشر، والمعلَّق لا يظهر', async () => {
    const rows = await prisma.rating.findMany({ where: { subjectType: 'trainer', subjectId: profileId, commentAr: { not: null } } })
    await ratings.moderate(rows[0].id, adminId, true)
    const pub = await ratings.publicFor('trainer', profileId)
    expect(pub.comments).toHaveLength(1)
    expect(pub.comments[0].commentAr).toBe(rows[0].commentAr)
  })

  it('الرفض بلا سبب مكتوب مرفوض', async () => {
    const rows = await prisma.rating.findMany({ where: { publishStatus: 'pending', commentAr: { not: null } }, take: 1 })
    await expect(ratings.moderate(rows[0].id, adminId, false)).rejects.toMatchObject({ code: 'reason_required' })
  })

  it('طابور المراجعة لا يحمل معرّف مُقيِّم', async () => {
    const queue = await ratings.moderationQueue('pending')
    expect(queue.length).toBeGreaterThan(0)
    for (const item of queue) {
      expect(Object.keys(item)).not.toContain('raterId')
      expect(Object.keys(item)).not.toContain('enrollmentId')
    }
  })
})
