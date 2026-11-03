/* توثيقُ البريد واحدٌ للإنسان، لا اثنان (٣ نوفمبر ٢٠٢٦).

   سأل صاحبُ المنصّة: «لماذا يستلم المستخدم ايميل توثيق حسابه بالرغم انه موثق فعلا». وكانت العلّةُ
   عَلَمَين لا يعرف أحدُهما الآخر: توثيقُ طلب الانضمام وتوثيقُ الحساب. فمن وثّق من رسالة طلبه طرقه
   تذكيرُ الحساب، ومن وثّق حسابَه طلبت منه رسالةُ الطلب أن يوثّق ثانيةً. والعلّةُ في `email-proof.ts`.

   والفحصُ بالصفوف وعامل التذكير نفسِه، لا بورود نداءٍ في ملفّ. ونُقض كلُّ حارسٍ مرّةً فسقط:
   نزعُ `proveAccountFromApplication` يُحمّر الأوّلَين، ونزعُ `inheritsProof` يُحمّر الثالث،
   ونزعُ `proveApplicationFromAccount` من `verifyEmail` يُحمّر الرابع، ونزعُ شرط البريد يُحمّر الخامس. */

import { beforeAll, describe, expect, it } from 'vitest'
import type { PrismaClient } from '@prisma/client'
import { setupTestDb, testPrisma } from '../helpers/db'
import { AuthService } from '../../services/auth.service'
import { TrainerApplicationService } from '../../services/trainer-application.service'
import { sendVerificationReminders } from '../../worker/jobs'

let prisma: PrismaClient
let auth: AuthService
let apps: TrainerApplicationService

const S = Date.now().toString(36).slice(-5)
const DAY = 24 * 3_600_000
const PASS = 'kalimat-sirriya-9'

const phase1 = (email: string) => ({
  fullName: 'مدرب توثيق البريد', email, password: PASS,
  specialties: ['القيادة وتطوير المدراء'], domainYears: '5_10', trainingYears: '3_5',
  trainingLanguages: ['العربية'], deliveryMode: 'remote' as const,
  motivation:
    'أريد الانضمام إلى وجيز لأنني درّبت فرقا حقيقية في بيئات عمل عربية، وأعرف الفرق بين من يعرف المادة ' +
    'ومن يستطيع تعليمها. سأقدّم للمتعلمين مهمة تطبيقية من واقع عملهم في كل وحدة، وأراجع مخرجاتهم بنفسي.',
  privacyConsent: true as const,
})

/** طلبٌ مكتمل — الحسابُ يُنشأ معه ببريده نفسِه */
async function applied(email: string) {
  const p1 = await apps.submitPhase1(phase1(email))
  await apps.completePhase2(p1.reference, p1.candidateToken, {
    previousCourses: [], teachableCourseIds: [], availability: {}, demoConsent: true, contact: { channel: 'email' },
  })
  return p1
}

beforeAll(async () => {
  await setupTestDb()
  prisma = await testPrisma()
  auth = new AuthService(prisma)
  apps = new TrainerApplicationService(prisma)
  /* قناةُ بريدٍ موصولة — عاملُ التذكير يسألها قبل أن يمسّ أحدا. ولا يخرج بريدٌ حقيقيّ: بوّابةُ `MAIL_LIVE` */
  await prisma.integrationSetting.upsert({
    where: { provider: 'email' },
    update: { enabled: true, config: { apiKey: 'test-key', fromEmail: 'no-reply@test.local' } },
    create: { provider: 'email', enabled: true, config: { apiKey: 'test-key', fromEmail: 'no-reply@test.local' } },
  })
}, 240_000)

describe('توثيقُ البريد بين الطلب والحساب', () => {
  it('من وثّق من رسالة طلبه يوثَّق حسابُه معه', async () => {
    const email = `proof-app-${S}@test.local`
    const p1 = await applied(email)
    const { tokenForDelivery } = await apps.resendVerification(email)
    await apps.verifyEmail(p1.reference, tokenForDelivery!)
    const user = await prisma.user.findUniqueOrThrow({ where: { id: p1.userId } })
    expect(user.emailVerifiedAt, 'وثّق من رسالة طلبه وبقي حسابُه غيرَ موثَّق').not.toBeNull()
  })

  it('ولا يطرقه تذكيرُ «بقي توثيق بريدك» بعد يومين', async () => {
    const email = `proof-remind-${S}@test.local`
    const p1 = await applied(email)
    const { tokenForDelivery } = await apps.resendVerification(email)
    await apps.verifyEmail(p1.reference, tokenForDelivery!)
    await prisma.user.update({ where: { id: p1.userId }, data: { createdAt: new Date(Date.now() - 2 * DAY) } })
    await sendVerificationReminders(prisma)
    const bells = await prisma.notification.count({
      where: { userId: p1.userId, templateKey: { startsWith: 'account.verify.reminder.' } },
    })
    expect(bells, 'ذُكِّر بتوثيق بريدٍ وثّقه من رسالة طلبه').toBe(0)
  })

  it('ومن تقدّم بحسابٍ موثَّق لا يُطلب منه التوثيقُ في رسالة طلبه', async () => {
    const email = `proof-learner-${S}@test.local`
    const { userId } = await auth.register(email, PASS, 'متعلّم موثَّق')
    await prisma.user.update({ where: { id: userId }, data: { emailVerifiedAt: new Date() } })
    const p1 = await applied(email)
    const app = await prisma.trainerApplication.findUniqueOrThrow({ where: { reference: p1.reference } })
    expect(app.emailVerifiedAt, 'حسابُه موثَّقٌ وطلبُه يُقال عنه غيرُ موثَّق').not.toBeNull()
    expect(app.emailVerifyTokenHash, 'سُكّ رمزُ توثيقٍ لبريدٍ موثَّق').toBeNull()
  })

  it('ومن وثّق حسابَه يوثَّق طلبُه معه', async () => {
    const email = `proof-acct-${S}@test.local`
    const p1 = await applied(email)
    const issued = await auth.issueEmailVerification(p1.userId)
    await auth.verifyEmail(issued!.token)
    const app = await prisma.trainerApplication.findUniqueOrThrow({ where: { reference: p1.reference } })
    expect(app.emailVerifiedAt, 'وثّق حسابَه وبقي طلبُه يطلب التوثيق').not.toBeNull()
  })

  it('وتوثيقُ عنوانٍ لا يوثّق غيرَه — طلبٌ ببريدٍ آخر لا يوثّق الحساب', async () => {
    const email = `proof-other-${S}@test.local`
    const p1 = await applied(email)
    const { tokenForDelivery } = await apps.resendVerification(email)
    /* الحسابُ صار ببريدٍ غيرِ بريد الطلب (نقلُ ملكيّةٍ مثلا) */
    await prisma.user.update({ where: { id: p1.userId }, data: { email: `proof-moved-${S}@test.local` } })
    await apps.verifyEmail(p1.reference, tokenForDelivery!)
    const user = await prisma.user.findUniqueOrThrow({ where: { id: p1.userId } })
    expect(user.emailVerifiedAt, 'وُثّق حسابٌ ببريدٍ لم يُفتح منه رابط').toBeNull()
  })
})
