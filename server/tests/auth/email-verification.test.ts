/* توثيق بريد الحساب (١هـ) — العقد كاملا.

   الحاجز يجب أن يمنع ما يُقصد منعه ويسمح بما يُقصد السماح به. وأخطرُ ما فيه
   حالتان متقابلتان: أن يمرّ غيرُ الموثَّق حين تعمل قناة البريد (فالحاجز
   زينة)، وأن يُحبَس الجميع حين لا تعمل (فالحاجز قفلٌ لا مفتاح له). كلتاهما
   مغطّاة هنا صراحة. */

import { beforeAll, afterEach, describe, expect, it } from 'vitest'
import type { PrismaClient } from '@prisma/client'
import { setupTestDb, testPrisma } from '../helpers/db'
import { AuthService } from '../../services/auth.service'
import { CommerceService } from '../../services/commerce.service'
import { CertificateService } from '../../services/certificate.service'

let prisma: PrismaClient
let auth: AuthService
let commerce: CommerceService
let certificates: CertificateService
let cohortId: string
let freeCohortId: string

/** يفعّل قناة البريد لهذا الاختبار وحده — عبر غشاء البيئة الذي تقرأه getEmailConfig */
function withEmailChannel(on: boolean) {
  if (on) process.env.RESEND_API_KEY = 're_test'
  else delete process.env.RESEND_API_KEY
}

beforeAll(async () => {
  await setupTestDb()
  prisma = await testPrisma()
  auth = new AuthService(prisma)
  commerce = new CommerceService(prisma)
  certificates = new CertificateService(prisma)
  const cohort = await prisma.cohort.create({
    data: {
      courseId: 'C-BIZ-101', title: 'شعبة توثيق البريد', status: 'open',
      registrationOpen: true, financialReady: true, price: 100, currency: 'JOD', capacity: 20,
    },
  })
  cohortId = cohort.id

  /* شعبة ثانية لاختبار الشهادة: لا قواعد إكمال عليها ولا على دورتها، فتمرّ
     evaluateCompletion ويُختبر حاجز البريد وحده. */
  const free = await prisma.cohort.create({
    data: {
      courseId: 'C-BIZ-101', title: 'شعبة الشهادة الاختبارية', status: 'open',
      registrationOpen: true, financialReady: true, price: 0, currency: 'JOD', capacity: 50,
    },
  })
  await prisma.completionRule.deleteMany({ where: { OR: [{ cohortId: free.id }, { courseId: 'C-BIZ-101', cohortId: null }] } })
  freeCohortId = free.id
}, 240_000)

afterEach(() => { withEmailChannel(false) })

let seq = 0
async function newLearner() {
  seq += 1
  const { userId } = await auth.register(`verify-${seq}@test.local`, 'Learner#12345', `متعلم ${seq}`)
  return userId
}

describe('إصدار الرمز واستهلاكه', () => {
  it('الحساب الجديد غير موثَّق، ورمزه يوثّقه', async () => {
    const userId = await newLearner()
    expect(await auth.isEmailVerified(userId)).toBe(false)
    const issued = await auth.issueEmailVerification(userId)
    expect(issued?.token).toBeTruthy()
    const res = await auth.verifyEmail(issued!.token)
    expect(res).toEqual({ userId, alreadyVerified: false })
    expect(await auth.isEmailVerified(userId)).toBe(true)
  })

  it('الرمز يُستهلك — الرابط لا يعمل مرتين', async () => {
    const userId = await newLearner()
    const issued = await auth.issueEmailVerification(userId)
    await auth.verifyEmail(issued!.token)
    await expect(auth.verifyEmail(issued!.token)).rejects.toMatchObject({ code: 'invalid_token' })
  })

  it('إصدار رمز جديد يُبطل ما قبله — فالرابط الأقدم في البريد لا يفتح', async () => {
    const userId = await newLearner()
    const first = await auth.issueEmailVerification(userId)
    const second = await auth.issueEmailVerification(userId)
    expect(second!.token).not.toBe(first!.token)
    await expect(auth.verifyEmail(first!.token)).rejects.toMatchObject({ code: 'invalid_token' })
    await expect(auth.verifyEmail(second!.token)).resolves.toMatchObject({ alreadyVerified: false })
  })

  it('الرمز المنتهي يُرفض ولا يوثّق', async () => {
    const userId = await newLearner()
    const issued = await auth.issueEmailVerification(userId)
    await prisma.user.update({ where: { id: userId }, data: { emailVerifyExpiresAt: new Date(Date.now() - 1000) } })
    await expect(auth.verifyEmail(issued!.token)).rejects.toMatchObject({ code: 'expired_token' })
    expect(await auth.isEmailVerified(userId)).toBe(false)
  })

  it('رمز مجهول يُرفض بنفس رسالة المستهلَك — لا يُخبر المهاجم أيّ رموزه صحيح', async () => {
    await expect(auth.verifyEmail('not-a-real-token-at-all')).rejects.toMatchObject({ code: 'invalid_token' })
  })

  it('الموثَّق أصلا لا يُصدر له رمز — لا رمز بلا حاجة إليه', async () => {
    const userId = await newLearner()
    const issued = await auth.issueEmailVerification(userId)
    await auth.verifyEmail(issued!.token)
    expect(await auth.issueEmailVerification(userId)).toBeNull()
  })

  it('الجلسة تحمل حالة التوثيق — الواجهة لا تحتاج نداء ثانيا', async () => {
    const userId = await newLearner()
    const { token } = await auth.login(`verify-${seq}@test.local`, 'Learner#12345', '127.0.0.1', 'test')
    expect((await auth.resolve(token))?.emailVerified).toBe(false)
    const issued = await auth.issueEmailVerification(userId)
    await auth.verifyEmail(issued!.token)
    expect((await auth.resolve(token))?.emailVerified).toBe(true)
  })
})

describe('حاجز الشراء', () => {
  it('قناة البريد تعمل وغير الموثَّق يُمنع', async () => {
    withEmailChannel(true)
    const userId = await newLearner()
    await expect(commerce.requestEnrollment(userId, cohortId)).rejects.toMatchObject({
      code: 'email_unverified', status: 403,
    })
    expect(await prisma.enrollmentRequest.count({ where: { userId } })).toBe(0)
  })

  it('قناة البريد تعمل والموثَّق يمرّ', async () => {
    withEmailChannel(true)
    const userId = await newLearner()
    const issued = await auth.issueEmailVerification(userId)
    await auth.verifyEmail(issued!.token)
    const req = await commerce.requestEnrollment(userId, cohortId)
    expect(req.status).toBe('pending')
  })

  it('قناة البريد معطّلة: يمرّ غير الموثَّق بأثر صريح — الحاجز لا يصير قفلا بلا مفتاح', async () => {
    withEmailChannel(false)
    const userId = await newLearner()
    const req = await commerce.requestEnrollment(userId, cohortId)
    expect(req.status).toBe('pending')
    const audit = await prisma.auditEvent.findFirst({
      where: { entityId: req.id, action: 'enrollment_request.create' },
      orderBy: { createdAt: 'desc' },
    })
    expect((audit?.meta as { emailUnverified?: boolean })?.emailUnverified).toBe(true)
  })
})

describe('حاجز الشهادة', () => {
  /* شعبة بلا قواعد إكمال: evaluateCompletion يعيد complete حين لا قاعدة
     مطلوبة، فيصل التنفيذ إلى حاجز البريد ويُختبر وحده لا مختلطا بـrules_unmet. */
  async function enrollmentPastCompletionRules(userId: string) {
    return prisma.enrollment.create({ data: { userId, cohortId: freeCohortId, status: 'enrolled' } })
  }

  it('لا تصدر شهادة لبريد غير موثَّق — والسبب المعلَن هو البريد لا القواعد', async () => {
    const userId = await newLearner()
    const enrollment = await enrollmentPastCompletionRules(userId)
    await expect(certificates.issue(enrollment.id, null)).rejects.toMatchObject({ code: 'email_unverified' })
    expect(await prisma.certificate.count({ where: { enrollmentId: enrollment.id } })).toBe(0)
  })

  it('وتصدر للموثَّق — الحاجز يمنع ما يُقصد منعه ولا يمنع غيره', async () => {
    const userId = await newLearner()
    const issued = await auth.issueEmailVerification(userId)
    await auth.verifyEmail(issued!.token)
    const enrollment = await enrollmentPastCompletionRules(userId)
    const cert = await certificates.issue(enrollment.id, null)
    expect(cert.number).toMatch(/^WJ-CERT-\d{4}-\d{5}$/)
  })

  it('الحاجز صارم هنا ولو تعطّلت قناة البريد — الشهادة تُنسب إلى شخص', async () => {
    withEmailChannel(false)
    const userId = await newLearner()
    const enrollment = await enrollmentPastCompletionRules(userId)
    await expect(certificates.issue(enrollment.id, null)).rejects.toMatchObject({ code: 'email_unverified' })
  })
})
