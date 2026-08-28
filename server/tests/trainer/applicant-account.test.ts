/* حساب «متقدّم مدرب» — لا حساب متعلم، ولا طلبَ غيرِه.

   كان المتقدّم يتابع طلبه برقم مرجعي ورمز مرشح ينسخهما من الشاشة: من فقدهما
   فقد طلبه. والحساب يحفظهما عنه — لكن حسابا خاطئ الدور أسوأ من لا حساب:
   AuthService.register تُسند learner دائما، فحسابٌ منها يفتح بوابة المتعلم
   لمن تقدّم للتدريب. وهذه تحرس الفرق. */

import { beforeAll, describe, expect, it } from 'vitest'
import type { PrismaClient } from '@prisma/client'
import { setupTestDb, testPrisma } from '../helpers/db'
import { TrainerApplicationService } from '../../services/trainer-application.service'
import { AuthService } from '../../services/auth.service'

let prisma: PrismaClient
let apps: TrainerApplicationService
let auth: AuthService

const phase1 = (email: string) => ({
  fullName: 'مدرب حساب التقديم', email,
  specialties: ['القيادة وتطوير المدراء'], domainYears: '5_10', trainingYears: '3_5',
  trainingLanguages: ['العربية'], deliveryMode: 'remote' as const,
  motivation:
    'أريد الانضمام إلى وجيز لأنني درّبت فرقا حقيقية في بيئات عمل عربية، وأعرف الفرق بين من يعرف المادة ' +
    'ومن يستطيع تعليمها. سأقدّم للمتعلمين مهمة تطبيقية من واقع عملهم في كل وحدة، وأراجع مخرجاتهم بنفسي.',
  privacyConsent: true as const,
})

beforeAll(async () => {
  await setupTestDb()
  prisma = await testPrisma()
  apps = new TrainerApplicationService(prisma)
  auth = new AuthService(prisma)
}, 180_000)

describe('حساب المتقدّم', () => {
  it('يُنشأ بدور trainer_applicant وحده — لا learner ولا trainer', async () => {
    const email = `acct-${Date.now()}@wajeez.test`
    const res = await apps.submitPhase1(phase1(email))
    const token = res.candidateToken ?? (await apps.verifyEmail(res.reference, res.verificationTokenForDelivery)).candidateToken!
    const acct = await apps.createApplicantAccount(res.reference, token, 'kalimat-sirriya-9')

    const roles = await prisma.userRole.findMany({ where: { userId: acct.userId }, select: { roleId: true } })
    expect(roles.map((r) => r.roleId)).toEqual(['trainer_applicant'])
    expect(acct.email).toBe(email.toLowerCase())
  })

  it('بريد الحساب هو بريد الطلب — لا بريدا يختاره المتقدّم', async () => {
    const email = `acct2-${Date.now()}@wajeez.test`
    const res = await apps.submitPhase1(phase1(email))
    const token = res.candidateToken ?? (await apps.verifyEmail(res.reference, res.verificationTokenForDelivery)).candidateToken!
    const acct = await apps.createApplicantAccount(res.reference, token, 'kalimat-sirriya-9')
    const user = await prisma.user.findUniqueOrThrow({ where: { id: acct.userId } })
    expect(user.email).toBe(email.toLowerCase())
  })

  it('رمز مرشح خاطئ لا يربط طلبا بحساب', async () => {
    const email = `acct3-${Date.now()}@wajeez.test`
    const res = await apps.submitPhase1(phase1(email))
    await expect(apps.createApplicantAccount(res.reference, 'رمز-مزوّر-طويل-كفاية', 'kalimat-sirriya-9'))
      .rejects.toMatchObject({ code: 'invalid_candidate_token' })
  })

  it('كلمة مرور قصيرة مرفوضة، وحسابٌ ثانٍ لنفس الطلب مرفوض', async () => {
    const email = `acct4-${Date.now()}@wajeez.test`
    const res = await apps.submitPhase1(phase1(email))
    const token = res.candidateToken ?? (await apps.verifyEmail(res.reference, res.verificationTokenForDelivery)).candidateToken!
    await expect(apps.createApplicantAccount(res.reference, token, 'قصيرة'))
      .rejects.toMatchObject({ code: 'weak_password' })
    await apps.createApplicantAccount(res.reference, token, 'kalimat-sirriya-9')
    await expect(apps.createApplicantAccount(res.reference, token, 'kalimat-sirriya-9'))
      .rejects.toMatchObject({ code: 'account_exists' })
  })

  /* من كان متعلما ثم تقدّم للتدريب: حسابٌ واحد يُضاف إليه الدور، لا ثانٍ
     بالبريد نفسه — والثاني مستحيل أصلا (البريد فريد) فيكون الرفض أو الربط. */
  it('بريد له حساب متعلم: يُربط ويُضاف الدور — لا يُرفض ولا يُنشأ ثانٍ', async () => {
    const email = `acct5-${Date.now()}@wajeez.test`
    const learner = await auth.register(email, 'kalimat-sirriya-9', 'متعلم صار متقدّما')
    const res = await apps.submitPhase1(phase1(email))
    const token = res.candidateToken ?? (await apps.verifyEmail(res.reference, res.verificationTokenForDelivery)).candidateToken!
    const acct = await apps.createApplicantAccount(res.reference, token, 'kalimat-sirriya-9')
    expect(acct.userId).toBe(learner.userId)
    const roles = await prisma.userRole.findMany({ where: { userId: learner.userId }, select: { roleId: true } })
    expect(roles.map((r) => r.roleId).sort()).toEqual(['learner', 'trainer_applicant'])
    expect(await prisma.user.count({ where: { email: email.toLowerCase() } })).toBe(1)
  })

  it('صاحب الحساب يقرأ طلبه هو، ومن لا طلب له يُردّ', async () => {
    const email = `acct6-${Date.now()}@wajeez.test`
    const res = await apps.submitPhase1(phase1(email))
    const token = res.candidateToken ?? (await apps.verifyEmail(res.reference, res.verificationTokenForDelivery)).candidateToken!
    const acct = await apps.createApplicantAccount(res.reference, token, 'kalimat-sirriya-9')
    const mine = await apps.myApplication(acct.userId)
    expect(mine.reference).toBe(res.reference)
    expect(mine.email).toBe(email.toLowerCase())

    const other = await auth.register(`nobody-${Date.now()}@wajeez.test`, 'kalimat-sirriya-9', 'بلا طلب')
    await expect(apps.myApplication(other.userId)).rejects.toMatchObject({ code: 'no_application' })
  })
})
