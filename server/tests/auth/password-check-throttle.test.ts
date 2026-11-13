/* نموذجُ «انضم كمدرّب» لا يخمّن كلمةَ حسابٍ قائم بلا قفل (١٣ نوفمبر ٢٠٢٦، قرارُ صاحب المنصّة «Same limits as login»).

   كان القسمُ الأوّل يقارن الكلمةَ بكلمة الحساب القائم بنفسه: لا سقفَ للبريد ولا سجلّ، وحدُّه حدُّ المسار لكلّ شبكة.
   فمن بدّل شبكاتِه خمّن كلمةَ أيّ متعلّمٍ أو موظّفٍ بلا قفل — وجُرّب: أربعون تخمينا خاطئا مرّت، ثمّ الصحيحةُ قُبلت،
   وسجلُّ الدخول فارغ. فصار يمرّ بـ`AuthService.checkPassword`: سقوفُ الدخول وسجلُّه، والإخفاقُ يُعدّ مع إخفاق الدخول. */

import { beforeAll, describe, expect, it } from 'vitest'
import type { PrismaClient } from '@prisma/client'
import { setupTestDb, testPrisma } from '../helpers/db'
import { AuthService } from '../../services/auth.service'
import { TrainerApplicationService, type Phase1Input } from '../../services/trainer-application.service'

let prisma: PrismaClient
let auth: AuthService
let svc: TrainerApplicationService
const STAMP = Date.now()
let seq = 0
const PASSWORD = 'Correct#12345'

async function victim() {
  const email = `pct-${++seq}-${STAMP}@test.local`
  await auth.register(email, PASSWORD, `حساب ${seq}`)
  return email
}
const apply = (email: string, password: string, ip?: string) => svc.submitPhase1({
  fullName: 'متقدم للتدريب', email, password, ip,
  specialties: ['الموارد البشرية'], domainYears: '4-7', trainingYears: '1-3',
  trainingLanguages: ['ar'], deliveryMode: 'remote', motivation: 'أريد أن أنقل خبرتي في الموارد البشرية إلى المتعلمين بأمثلة من عملي اليومي في التوظيف وتقييم الأداء وبناء الفرق.',
  privacyConsent: true,
} as Phase1Input)

beforeAll(async () => {
  await setupTestDb()
  prisma = await testPrisma()
  auth = new AuthService(prisma)
  svc = new TrainerApplicationService(prisma)
}, 240_000)

describe('كلمة الحساب القائم في نموذج المدرب', () => {
  it('⚠️ من شبكات كثيرة: يقفل البريد بعد سقف الدخول — ولا تقبل الكلمة الصحيحة بعده، ولا الدخول', async () => {
    const email = await victim()
    for (let i = 0; i < 25; i++) {
      await expect(apply(email, `Guess#${i}0000`, `10.9.${seq}.${i}`)).rejects.toMatchObject({ code: 'email_taken' })
    }
    expect(await prisma.loginAttempt.count({ where: { email, success: false } }), 'لم تسجل الإخفاقات').toBe(25)
    await expect(apply(email, PASSWORD, '10.9.99.1'), 'قبلت الكلمة بعد خمسة وعشرين تخمينا').rejects.toMatchObject({ code: 'too_many_attempts', status: 429 })
    await expect(auth.login(email, PASSWORD, '10.9.99.2'), 'لم تعد الإخفاقات مع إخفاق الدخول').rejects.toMatchObject({ code: 'too_many_attempts' })
    expect(await prisma.trainerApplication.count({ where: { email } })).toBe(0)
  })

  it('⚠️ ومن شبكة واحدة: خمس محاولات للشخص كالدخول', async () => {
    const email = await victim()
    for (let i = 0; i < 5; i++) await expect(apply(email, `Guess#${i}0000`, '10.8.0.1')).rejects.toMatchObject({ code: 'email_taken' })
    await expect(apply(email, PASSWORD, '10.8.0.1')).rejects.toMatchObject({ code: 'too_many_attempts' })
  })

  it('وصاحب الحساب بكلمته يقدم كما كان — ويسجل دخولا ناجحا', async () => {
    const email = await victim()
    const out = await apply(email, PASSWORD, '10.7.0.1')
    expect(out.reference).toBeTruthy()
    expect(await prisma.loginAttempt.count({ where: { email, success: true } })).toBe(1)
  })
})
