/* حساب «متقدّم مدرب» — يُنشأ مع القسم الأوّل، لا حساب متعلم، ولا طلبَ غيرِه.

   كان المتقدّم يتابع طلبه برقم مرجعي ورمز مرشح ينسخهما من الشاشة: من فقدهما
   فقد طلبه. والحسابُ يُنشأ الآن بكلمةٍ يختارها عند التقديم، فيدخل بها ويرى
   حالته. وحسابا خاطئ الدور أسوأ من لا حساب: AuthService.register تُسند
   learner دائما، فحسابٌ منها يفتح بوابة المتعلم لمن تقدّم للتدريب. وهذه
   تحرس الفرق — وتحرس أن بريدَ غيرِك لا يُربَط بطلبك بمعرفة البريد وحده. */

import { beforeAll, describe, expect, it } from 'vitest'
import type { PrismaClient } from '@prisma/client'
import { setupTestDb, testPrisma } from '../helpers/db'
import { TrainerApplicationService } from '../../services/trainer-application.service'
import { AuthService } from '../../services/auth.service'

let prisma: PrismaClient
let apps: TrainerApplicationService
let auth: AuthService

const PASS = 'kalimat-sirriya-9'

const phase1 = (email: string, password = PASS) => ({
  fullName: 'مدرب حساب التقديم', email, password,
  specialties: ['القيادة وتطوير المدراء'], domainYears: '5_10', trainingYears: '3_5',
  trainingLanguages: ['العربية'], deliveryMode: 'remote' as const,
  motivation:
    'أريد الانضمام إلى وجيز لأنني درّبت فرقا حقيقية في بيئات عمل عربية، وأعرف الفرق بين من يعرف المادة ' +
    'ومن يستطيع تعليمها. سأقدّم للمتعلمين مهمة تطبيقية من واقع عملهم في كل وحدة، وأراجع مخرجاتهم بنفسي.',
  privacyConsent: true as const,
})

const finish = (reference: string, token: string) => apps.completePhase2(reference, token, {
  previousCourses: [], teachableCourseIds: [], availability: {}, demoConsent: true, contact: { channel: 'email' },
})

beforeAll(async () => {
  await setupTestDb()
  prisma = await testPrisma()
  apps = new TrainerApplicationService(prisma)
  auth = new AuthService(prisma)
}, 180_000)

describe('حساب المتقدّم', () => {
  it('يُنشأ مع القسم الأوّل بدور trainer_applicant وحده — لا learner ولا trainer', async () => {
    const email = `acct-${Date.now()}@wajeez.test`
    const res = await apps.submitPhase1(phase1(email))
    expect(res.resumed).toBe(false)
    const roles = await prisma.userRole.findMany({ where: { userId: res.userId }, select: { roleId: true } })
    expect(roles.map((r) => r.roleId)).toEqual(['trainer_applicant'])
    const user = await prisma.user.findUniqueOrThrow({ where: { id: res.userId } })
    expect(user.email).toBe(email.toLowerCase())
    /* ويدخل بكلمته فورا */
    const login = await auth.login(email, PASS)
    const ctx = await auth.resolve(login.token)
    expect(ctx!.permissions).toEqual(['trainer.application.own'])
  })

  it('بريد الحساب هو بريد الطلب — بحروفه الصغيرة', async () => {
    const email = `Acct2-${Date.now()}@Wajeez.test`
    const res = await apps.submitPhase1(phase1(email))
    const user = await prisma.user.findUniqueOrThrow({ where: { id: res.userId } })
    expect(user.email).toBe(email.toLowerCase())
    const app = await prisma.trainerApplication.findUniqueOrThrow({ where: { reference: res.reference } })
    expect(app.email).toBe(email.toLowerCase())
    expect(app.userId).toBe(res.userId)
  })

  it('كلمة مرور قصيرة مرفوضة قبل أن يُكتب شيء', async () => {
    const email = `acct3-${Date.now()}@wajeez.test`
    await expect(apps.submitPhase1(phase1(email, 'قصيرة'))).rejects.toMatchObject({ code: 'weak_password' })
    expect(await prisma.user.findUnique({ where: { email } })).toBeNull()
  })

  it('بريد له حساب متعلم: يُربط بكلمته الصحيحة ويُضاف الدور — ويُردّ بكلمة خاطئة', async () => {
    const email = `acct5-${Date.now()}@wajeez.test`
    const learner = await auth.register(email, PASS, 'متعلم صار متقدّما')
    await expect(apps.submitPhase1(phase1(email, 'kalimat-ukhra-77'))).rejects.toMatchObject({ code: 'email_taken' })
    const res = await apps.submitPhase1(phase1(email))
    expect(res.userId).toBe(learner.userId)
    const roles = await prisma.userRole.findMany({ where: { userId: learner.userId }, select: { roleId: true } })
    expect(roles.map((r) => r.roleId).sort()).toEqual(['learner', 'trainer_applicant'])
  })

  it('المسودّة تُستأنف بنفس البريد والكلمة — بنفس الرقم لا برقمٍ ثانٍ', async () => {
    const email = `acct7-${Date.now()}@wajeez.test`
    const first = await apps.submitPhase1(phase1(email))
    const again = await apps.submitPhase1({ ...phase1(email), fullName: 'اسمٌ صُحِّح' })
    expect(again.resumed).toBe(true)
    expect(again.reference).toBe(first.reference)
    expect(again.candidateToken).not.toBe(first.candidateToken)
    const row = await prisma.trainerApplication.findUniqueOrThrow({ where: { reference: first.reference } })
    expect(row.fullName).toBe('اسمٌ صُحِّح')
    /* والطلبُ المكتمل لا يُقدَّم مرّة ثانية */
    await finish(again.reference, again.candidateToken)
    await expect(apps.submitPhase1(phase1(email))).rejects.toMatchObject({ code: 'duplicate_application' })
  })

  it('صاحب الحساب يقرأ طلبه هو ويستأنفه ويسحبه — ومن لا طلب له يُردّ', async () => {
    const email = `acct6-${Date.now()}@wajeez.test`
    const res = await apps.submitPhase1(phase1(email))
    const mine = await apps.myApplication(res.userId)
    expect(mine.reference).toBe(res.reference)
    expect(mine.email).toBe(email.toLowerCase())
    expect(mine.status).toBe('draft')

    const access = await apps.resumeAccess(res.userId)
    expect(access.reference).toBe(res.reference)
    /* الرمزُ القديم سقط بالاستئناف */
    await expect(apps.resolveCandidate(res.reference, res.candidateToken)).rejects.toMatchObject({ code: 'invalid_candidate_token' })
    await finish(access.reference, access.candidateToken)

    await apps.withdrawMine(res.userId, 'غيّرت رأيي')
    const row = await prisma.trainerApplication.findUniqueOrThrow({ where: { reference: res.reference } })
    expect(row.status).toBe('withdrawn')
    expect(row.withdrawReason).toBe('غيّرت رأيي')

    const stranger = await auth.register(`stranger-${Date.now()}@wajeez.test`, PASS, 'غريب')
    await expect(apps.myApplication(stranger.userId)).rejects.toMatchObject({ code: 'no_application' })
  })
})
