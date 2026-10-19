/* صفحةُ «حالة طلبك» بعد التوقيع وبعد فتح البوّابة — وحسابُه البنكيّ قبل تفعيله (١٩ أكتوبر ٢٠٢٦).

   ثلاثةُ أعطابٍ رآها صاحبُ المنصّة في صورها قبل النشر:
   ① **التوقيعُ لا يغيّر حالَ الطلب** — يبقى `contract_pending` حتّى نعتمده. فكانت صفحتُه تقول «أرسلنا لك العقد.
      بعد توقيعه…» لمن وقّعه. فيُعاد معه `contractSignedAt`، والشاشةُ تقول «وقعت العقد».
   ② **وباعتماد توقيعه يُرفع من `trainer_applicant` إلى `trainer`** — فيسقط عنه `trainer.application.own`، ومن فتح
      «حالة طلبك» قرأ «هذا الإجراء يتطلّب صلاحيّة…». فيقرأ المدرّبُ طلبَه هو — والسحبُ يبقى للمتقدّم وحدَه.
   ③ **والحسابُ البنكيّ في التهيئة** كان يُعرض ثمّ يُردّ حفظُه بـ٤٠٣. فيُقال ما يمنعه قبل الكتابة (`writeProblemAr`). */

import { beforeAll, describe, expect, it } from 'vitest'
import type { PrismaClient } from '@prisma/client'
import type { FastifyInstance } from 'fastify'
import { setupTestDb, testPrisma } from '../helpers/db'
import { TrainerApplicationService } from '../../services/trainer-application.service'
import { TrainerBankService } from '../../services/trainer-bank.service'
import { AuthService } from '../../services/auth.service'
import { buildApp } from '../../http/app'
import { SESSION_COOKIE } from '../../http/auth-plugin'

let prisma: PrismaClient
let apps: TrainerApplicationService
let auth: AuthService
let app: FastifyInstance
const PASS = 'kalimat-sirriya-9'
const S = Date.now()

/** متقدّمٌ بحسابه وملفّه — وحالُ طلبه ما يُمرَّر */
async function applicant(tag: string, status: string) {
  const email = `status-${tag}-${S}@wajeez.test`
  const res = await apps.submitPhase1({
    fullName: 'مدرب صفحة الحالة', email, password: PASS,
    specialties: ['القيادة وتطوير المدراء'], domainYears: '5_10', trainingYears: '3_5',
    trainingLanguages: ['العربية'], deliveryMode: 'remote' as const,
    motivation:
      'أريد الانضمام إلى وجيز لأنني درّبت فرقا حقيقية في بيئات عمل عربية، وأعرف الفرق بين من يعرف المادة ' +
      'ومن يستطيع تعليمها. سأقدّم للمتعلمين مهمة تطبيقية من واقع عملهم في كل وحدة، وأراجع مخرجاتهم بنفسي.',
    privacyConsent: true as const,
  })
  const row = await prisma.trainerApplication.update({ where: { reference: res.reference }, data: { status } })
  const profile = await prisma.trainerProfile.create({ data: { applicationId: row.id, userId: res.userId } })
  const cookie = `${SESSION_COOKIE}=${(await auth.login(email, PASS)).token}`
  return { userId: res.userId, profileId: profile.id, cookie }
}
const mine = (cookie: string) => app.inject({ method: 'GET', url: '/api/v1/trainer-applications/mine', headers: { cookie } })
const setRoles = async (userId: string, roles: string[]) => {
  await prisma.userRole.deleteMany({ where: { userId } })
  for (const roleId of roles) await prisma.userRole.create({ data: { userId, roleId } })
}

beforeAll(async () => {
  await setupTestDb()
  prisma = await testPrisma()
  apps = new TrainerApplicationService(prisma)
  auth = new AuthService(prisma)
  app = await buildApp(prisma)
}, 180_000)

describe('① التوقيعُ يُقرأ في صفحته', () => {
  it('⚠️ عقدٌ أُرسل لا يُقال موقَّعا — وما وقّعه يُعاد بتاريخه', async () => {
    const a = await applicant('signed', 'contract_pending')
    const c = await prisma.trainerContract.create({ data: { profileId: a.profileId, title: 'عقد الاختبار', status: 'sent' } })
    const before = await mine(a.cookie)
    expect(before.statusCode, before.body).toBe(200)
    expect(before.json().contractSignedAt, 'عقد لم يوقّع يقال موقّعا').toBeNull()

    const signedAt = new Date()
    await prisma.trainerContract.update({ where: { id: c.id }, data: { status: 'signed', signedAt } })
    expect((await mine(a.cookie)).json().contractSignedAt, 'وقّع ولم تعلم صفحته').toBe(signedAt.toISOString())
  })
})

describe('② ومن صار مدرّبا يقرأ طلبه — ولا يسحبه', () => {
  it('⚠️ بدور المدرّب وحدَه: «حالة طلبك» تُقرأ، والسحبُ يُردّ', async () => {
    const a = await applicant('onboarding', 'onboarding')
    await setRoles(a.userId, ['trainer'])
    const r = await mine(a.cookie)
    expect(r.statusCode, 'من صار مدرّبا يقرأ «يتطلّب صلاحيّة» مكان طلبه').toBe(200)
    expect(r.json().status).toBe('onboarding')
    const w = await app.inject({ method: 'POST', url: '/api/v1/trainer-applications/mine/withdraw', headers: { cookie: a.cookie }, payload: {} })
    expect(w.statusCode, 'فتحُ القراءة فتح السحب معها').toBe(403)
  })

  it('ومن لا دور له في التدريب لا يقرؤه', async () => {
    const a = await applicant('learner', 'submitted')
    await setRoles(a.userId, ['learner'])
    expect((await mine(a.cookie)).statusCode).toBe(403)
  })
})

describe('③ والحسابُ البنكيّ قبل التفعيل يُقال ما يمنعه', () => {
  it('⚠️ في التهيئة يُقال متى يُضاف — والنشطُ لا مانعَ له', async () => {
    const bank = new TrainerBankService(prisma)
    const a = await applicant('bank', 'onboarding')
    await setRoles(a.userId, ['trainer'])
    expect((await bank.mine(a.userId)).writeProblemAr, 'تعرض الخانة ثمّ يردّ حفظها').toBe('تضيف حسابك البنكي هنا بعد تفعيلك، حين نعتمد دوراتك.')
    await prisma.trainerApplication.updateMany({ where: { userId: a.userId }, data: { status: 'active' } })
    expect((await bank.mine(a.userId)).writeProblemAr).toBeNull()
  })
})
