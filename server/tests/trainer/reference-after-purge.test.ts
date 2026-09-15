/* المرجعُ بعد الحذف النهائيّ — العدُّ ينقص، وأعلى رقمٍ صُرف لا ينقص.

   كان مرجعُ الطلب `WJ-TR-<سنة>-<عدد الصفوف + ١>`. والحذفُ النهائيّ (`purge`)
   يُنقص العدد: يُحذف طلبٌ في الوسط فيصير «العددُ + ١» رقمَ طلبٍ قائم، فيسقط
   كلُّ تقديمٍ جديدٍ على قيد التفرّد — ويقرأ المتقدّمُ «خطأ داخلي غير متوقع»
   ويعمل الدخولُ كأنّ شيئا لم يكن. وقع في الإنتاج في ١٥ سبتمبر ٢٠٢٦ بعد حذف
   طلبات الاختبار، وبقي «انضم كمدرّب» مغلقا على كلّ من طرقه.

   والفحصُ على السلوك لا على نصّ الشيفرة: يُحذف الأوسطُ ثمّ يُقدَّم طلبٌ رابع.
   وأُثبت سقوطُه قبل الإصلاح — بـ`P2002` على `reference`. */

import { beforeAll, describe, expect, it } from 'vitest'
import type { PrismaClient } from '@prisma/client'
import { setupTestDb, testPrisma } from '../helpers/db'
import { TrainerApplicationService } from '../../services/trainer-application.service'
import { TrainerReviewService } from '../../services/trainer-review.service'
import { AuthService } from '../../services/auth.service'
import { nextTrainerApplicationReference } from '../../services/trainer-application-reference'

let prisma: PrismaClient
let apps: TrainerApplicationService
let review: TrainerReviewService
let adminId: string

const phase1 = (email: string) => ({
  fullName: 'متقدّمٌ للاختبار', email,
  specialties: ['تحليل البيانات والمالية'],
  domainYears: '8-12' as const, trainingYears: 'formal_teaching',
  trainingLanguages: ['العربية'], deliveryMode: 'both' as const,
  motivation: 'أريد الانضمام إلى وجيز لأنني درّبت فرقا حقيقية في بيئات عمل عربية، وأعرف الفرق بين من يعرف المادة ومن يستطيع تعليمها. سأقدّم للمتعلمين مهمة تطبيقية من واقع عملهم في كل وحدة.',
  privacyConsent: true as const,
  password: 'Trainer#12345',
})

/** الرقمُ التسلسليُّ في آخر المرجع */
const seq = (reference: string) => Number(reference.slice(-5))

beforeAll(async () => {
  await setupTestDb()
  prisma = await testPrisma()
  apps = new TrainerApplicationService(prisma)
  review = new TrainerReviewService(prisma)
  const auth = new AuthService(prisma)
  const admin = await auth.register('admin-ref-purge@test.local', 'Admin#12345', 'المدير')
  adminId = admin.userId
  await auth.setRoles(adminId, ['super_admin'])
}, 180_000)

describe('مرجعُ الطلب بعد حذفٍ نهائيّ', () => {
  it('يُحذف طلبٌ في الوسط فلا يتصادم المرجعُ التالي بمرجعٍ قائم', async () => {
    await apps.submitPhase1(phase1('ref-a@test.local'))
    const b = await apps.submitPhase1(phase1('ref-b@test.local'))
    const c = await apps.submitPhase1(phase1('ref-c@test.local'))

    await apps.purge(b.reference, null, 'طلبُ اختبارٍ يُمحى')

    /* هنا كان السقوط: العددُ نقص واحدا، فصار «العدد + ١» مرجعَ (c) بعينه */
    const d = await apps.submitPhase1(phase1('ref-d@test.local'))
    expect(d.reference).toMatch(/^WJ-TR-\d{4}-\d{5}$/)
    expect(d.reference).not.toBe(c.reference)
    expect(seq(d.reference), 'الرقمُ يتقدّم على أعلى رقمٍ قائم').toBeGreaterThan(seq(c.reference))
  })

  it('والإضافةُ المباشرةُ من الإدارة تسلك الطريقَ نفسَه — فلا تتصادم بعد الحذف', async () => {
    await apps.submitPhase1(phase1('ref-e@test.local'))
    const gone = await apps.submitPhase1(phase1('ref-f@test.local'))
    const latest = await apps.submitPhase1(phase1('ref-g@test.local'))
    await apps.purge(gone.reference, null, 'طلبُ اختبارٍ يُمحى')

    const added = await review.createTrainerDirectly(adminId, {
      fullName: 'مدرّبةٌ تُضاف مباشرة', email: 'ref-direct@test.local',
    })
    expect(added.reference).toMatch(/^WJ-TR-\d{4}-\d{5}$/)
    expect(seq(added.reference), 'الرقمُ يتقدّم على أعلى رقمٍ قائم').toBeGreaterThan(seq(latest.reference))
  })

  it('المولّدُ يقرأ أعلى رقمٍ قائمٍ لهذه السنة ويتجاهل مرجعا على غير الصيغة', async () => {
    const year = new Date().getFullYear()
    /* مرجعٌ على غير الصيغة (كما تكتبه بعضُ الاختبارات) يسبق حروفُه الأرقامَ في
       الترتيب النصّيّ — فلو قُرئ «الأعلى» نصّا لسقط المولّد إلى ١ وتصادم */
    await prisma.trainerApplication.create({
      data: { reference: 'WJ-TR-ZZZZ-1', email: 'odd-ref@test.local', fullName: 'على غير الصيغة', status: 'withdrawn' },
    })
    const top = await prisma.trainerApplication.findMany({
      where: { reference: { startsWith: `WJ-TR-${year}-` } }, select: { reference: true },
    })
    const highest = Math.max(0, ...top.map((r) => seq(r.reference)).filter(Number.isFinite))

    const next = await nextTrainerApplicationReference(prisma)
    expect(next).toBe(`WJ-TR-${year}-${String(highest + 1).padStart(5, '0')}`)
  })
})
