/* من طُلبت منه معلوماتٌ يعود إلى موضعه — لا إلى أوّل الطابور.

   ═══ العطبُ الذي وُضع له هذا الحارس ═══

   فُتح طلبُ المعلومات من كلّ حالةٍ حيّة (٢٢ سبتمبر ٢٠٢٦) بقرار صاحب المنصّة:
   «أضِف خانةَ طلب المعلومات الإضافية من المدرّب حتى لو تمّ اعتمادُه داخليّا».

   وكان استكمالُ المرحلة الثانية بعد الطلب ينقل صاحبَه إلى `under_review`
   **مسكوكةً**. وذاك يصحّ حين لم يكن الطلبُ يُفتح إلّا من أوائل الطريق —
   فلمّا فُتح من كلّ حالةٍ صار يَسلب: من كان في «التهيئة» فطُلبت منه ورقةٌ
   ثمّ أرسلها يهبط إلى أوّل الطابور. **يُعاقَب لأنّه أجاب**: يخسر تجهيزَه
   وعقدَه وقراءةً سبقت، ويُقرأ طلبُه من جديدٍ وقد قُرئ.

   فيُحفظ موضعُه في `infoRequestedFrom` ويُعاد إليه، ويُمحى بالرجوع.

   ═══ ولمَ هنا لا في اختبارِ متصفّح ═══

   الرجوعُ يقع داخل معاملةٍ مع كتابةِ المرحلة الثانية، ويقرأ عمودا في القاعدة
   ويمحوه. فما يُثبته حقّا قاعدةٌ حقيقيّةٌ تُقرأ بعد الكتابة. */

import { beforeAll, describe, expect, it } from 'vitest'
import type { PrismaClient } from '@prisma/client'
import { setupTestDb, testPrisma } from '../helpers/db'
import { AuthService } from '../../services/auth.service'
import { TrainerApplicationService } from '../../services/trainer-application.service'
import { TrainerReviewService } from '../../services/trainer-review.service'

let prisma: PrismaClient
let auth: AuthService
let apps: TrainerApplicationService
let review: TrainerReviewService
let adminId: string

const base = {
  phoneCountryCode: '+962', phone: '771050000', country: 'الأردن', timezone: 'Asia/Amman',
  jobTitle: 'مدرّبة تسويق', specialties: ['التسويق الرقمي'],
  domainYears: '8-12' as const, trainingYears: 'formal_teaching',
  bio: 'خبرةٌ ميدانيّة', trainingLanguages: ['العربية'], deliveryMode: 'both' as const,
  motivation: 'درّبتُ فرقا حقيقيّةً في بيئات عملٍ عربيّة، وأعرف الفرقَ بين من يعرف المادّة ومن يستطيع تعليمها. سأعطي كلَّ متعلّمٍ مهمّةً من واقع عمله في كلّ وحدة، وأراجع مخرجاته بنفسي وأكتب له ما ينقصه تحديدا لا تقييما عاما.',
  privacyConsent: true as const,
  password: 'Trainer#12345',
}

async function applicant(email: string, fullName: string) {
  const res = await apps.submitPhase1({ ...base, email, fullName })
  const row = await prisma.trainerApplication.findUniqueOrThrow({ where: { reference: res.reference } })
  await apps.completePhase2(res.reference, res.candidateToken, {
    previousCourses: [], teachableCourseIds: [], availability: { seasons: ['nov_jan'] },
    demoConsent: true, contact: { channel: 'email' },
  })
  await prisma.trainerApplication.update({ where: { id: row.id }, data: { emailVerifiedAt: new Date() } })
  return { id: row.id, reference: res.reference, token: res.candidateToken }
}

/** يُعيد إرسال المرحلة الثانية — وهو ما يفعله المتقدّمُ حين يُجيب */
async function answer(reference: string, token: string) {
  await apps.completePhase2(reference, token, {
    previousCourses: [], teachableCourseIds: [], availability: { seasons: ['nov_jan'] },
    demoConsent: true, contact: { channel: 'email' },
  })
}

beforeAll(async () => {
  await setupTestDb()
  prisma = await testPrisma()
  auth = new AuthService(prisma)
  apps = new TrainerApplicationService(prisma)
  review = new TrainerReviewService(prisma)
  const admin = await auth.register('admin-inforeturn@test.local', 'Admin#12345', 'المدير الأكاديمي')
  adminId = admin.userId
  await auth.setRoles(adminId, ['academic_manager'])
}, 180_000)

describe('طلبُ المعلومات بعد القبول الداخليّ يعيد صاحبَه إلى موضعه', () => {
  it('المقبولُ داخليّا يُسأل فيُجيب فيعود مقبولا داخليّا — لا إلى أوّل الطابور', async () => {
    const a = await applicant('inforeturn-1@test.local', 'سلمى المدرّبة')
    await review.decide(a.id, adminId, 'conditionally_approve')

    await review.decide(a.id, adminId, 'request_info', 'ينقص إثباتُ الاعتماد')
    const asked = await prisma.trainerApplication.findUniqueOrThrow({ where: { id: a.id } })
    expect(asked.status).toBe('information_requested')
    expect(asked.infoRequestedFrom, 'لم يُحفظ موضعُه فلا سبيلَ إلى إعادته').toBe('conditionally_approved')

    await answer(a.reference, a.token)
    const back = await prisma.trainerApplication.findUniqueOrThrow({ where: { id: a.id } })
    expect(back.status, 'هبط إلى أوّل الطابور لأنّه أجاب').toBe('conditionally_approved')
    expect(back.infoRequestedFrom, 'بقي الموضعُ محفوظا بعد استهلاكه').toBeNull()
  })

  it('ومن كان في التهيئة يعود إلى التهيئة', async () => {
    const a = await applicant('inforeturn-2@test.local', 'ريم المدرّبة')
    await review.decide(a.id, adminId, 'conditionally_approve')
    await review.decide(a.id, adminId, 'start_onboarding')

    await review.decide(a.id, adminId, 'request_info', 'ينقص رقمُ الحساب')
    await answer(a.reference, a.token)
    const back = await prisma.trainerApplication.findUniqueOrThrow({ where: { id: a.id } })
    expect(back.status, 'خسر تهيئتَه لأنّه أجاب').toBe('onboarding')
  })

  /* وقرارٌ آخرُ يقع قبل أن يُجيب: الموضعُ المحفوظُ يبطُل — وإلّا أُعيد
     إلى موضعٍ قرّر المراجعُ نقلَه عنه. */
  it('وإن قرّر المراجعُ شيئا آخرَ قبل جوابه بطَل الموضعُ المحفوظ', async () => {
    const a = await applicant('inforeturn-3@test.local', 'هدى المدرّبة')
    await review.decide(a.id, adminId, 'conditionally_approve')
    await review.decide(a.id, adminId, 'request_info', 'ينقص إثبات')
    await review.decide(a.id, adminId, 'waitlist')

    const moved = await prisma.trainerApplication.findUniqueOrThrow({ where: { id: a.id } })
    expect(moved.status).toBe('waitlisted')
    expect(moved.infoRequestedFrom, 'بقي وعدٌ بموضعٍ انقضى').toBeNull()
  })

  /* والطلبُ القديمُ لا موضعَ محفوظٌ له — فاحتياطُه `under_review` كما كان */
  it('وطلبٌ قديمٌ بلا موضعٍ محفوظٍ يعود إلى قيد المراجعة كما كان', async () => {
    const a = await applicant('inforeturn-4@test.local', 'ليلى المدرّبة')
    await review.decide(a.id, adminId, 'request_info', 'ينقص إثبات')
    await prisma.trainerApplication.update({ where: { id: a.id }, data: { infoRequestedFrom: null } })

    await answer(a.reference, a.token)
    const back = await prisma.trainerApplication.findUniqueOrThrow({ where: { id: a.id } })
    expect(back.status).toBe('under_review')
  })
})
