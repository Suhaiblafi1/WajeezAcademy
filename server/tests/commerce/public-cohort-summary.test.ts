/* نبذةُ الشعبة في القائمة العامّة — «سطران يقرؤهما المتعلّم قبل أن يدفع» (١٠ أكتوبر ٢٠٢٦).

   تطلبها خطوةُ «المعلومات الأساسيّة» من المدرّب بهذا الوعد، ولم تكن تظهر في أيّ صفحة. والحارسُ
   هنا على **ما يُعلَن**: نبذةُ خطّة المدرّب المعتمَدة وحدَها — لا مسودّتُه ولا ما ينتظر الإدارة،
   ولا خطّةُ الأكاديميّة التي لا مدرّبَ لها. وشعبةٌ لم تُعتمد خطّةُ مدرّبها لا تُعلَن أصلا
   (`openRegistrationWhere`)، فالمسودّةُ الأحدثُ بعد اعتمادٍ هي ما يُخشى أن يتسرّب. */

import { beforeAll, describe, expect, it } from 'vitest'
import type { PrismaClient } from '@prisma/client'
import { setupTestDb, testPrisma } from '../helpers/db'
import { PublicCatalogService } from '../../services/public-catalog.service'

let prisma: PrismaClient
let publicCatalog: PublicCatalogService
let cohortId = ''
let profileId = ''

const DAY = 86_400_000
const at = (days: number) => new Date(Date.now() + days * DAY)

async function listed() {
  const row = (await publicCatalog.cohorts()).find((c) => c.id === cohortId)
  expect(row, 'الشعبةُ لا تظهر في القائمة العامّة').toBeTruthy()
  return row!
}

const plan = (status: string, summaryAr: string, minutesAgo: number, trainer = true) =>
  prisma.cohortDeliveryPlan.create({
    data: {
      cohortId, trainerId: trainer ? profileId : null, status,
      content: { kind: 'trainer', modules: [], resources: [], summaryAr },
      createdAt: new Date(Date.now() - minutesAgo * 60_000),
    },
  })

beforeAll(async () => {
  await setupTestDb()
  prisma = await testPrisma()
  publicCatalog = new PublicCatalogService(prisma)
  const application = await prisma.trainerApplication.create({
    data: {
      reference: `TR-SUM-${Date.now()}`, fullName: 'مدرّبةُ النبذة', email: `sum-${Date.now()}@test.local`,
      phone: '0790000013', status: 'active', motivation: 'اختبار', privacyConsentAt: new Date(),
    },
  })
  profileId = (await prisma.trainerProfile.create({ data: { applicationId: application.id, isVerified: true } })).id
  cohortId = (await prisma.cohort.create({
    data: {
      courseId: 'C-BIZ-101', title: `شعبةُ النبذة ${Date.now()}`,
      status: 'open', registrationOpen: true, financialReady: true,
      price: 100, currency: 'USD', capacity: 20, startsAt: at(20),
    },
  })).id
}, 180_000)

describe('نبذةُ الشعبة قبل الدفع', () => {
  it('⚠️ شعبةٌ خطّةُ مدرّبها لم تُعتمد لا تُعلَن أصلا — فلا نبذةَ تخرج من مسودّتها', async () => {
    await plan('draft', 'مسودّةٌ لم تُرسل', 30)
    await plan('submitted', 'تنتظر الإدارة', 20)
    const rows = await publicCatalog.cohorts()
    expect(rows.find((c) => c.id === cohortId), 'شعبةٌ بلا خطّةٍ معتمدة أُعلنت').toBeUndefined()
    expect(JSON.stringify(rows)).not.toContain('مسودّةٌ لم تُرسل')
  })

  it('⚠️ وبعد الاعتماد نبذةُ الخطّة المعتمَدة — لا مسودّةٌ أحدثُ منها، ولا خطّةُ الأكاديميّة', async () => {
    await plan('approved', 'نبذةٌ معتمدة', 15)
    await plan('draft', 'مسودّةٌ أحدثُ لم تُعتمد', 3)
    await plan('approved', 'خطّةُ الأكاديميّة بلا مدرّب', 2, false)
    expect((await listed()).summaryAr).toBe('نبذةٌ معتمدة')
  })

  it('والأحدثُ من المعتمَد والمنشور — بلا فراغٍ زائد', async () => {
    await plan('published', '  شعبةٌ عمليّةٌ في ستّة أسابيع.\n\nتخرج منها بخطّةٍ مكتوبة.  ', 1)
    expect((await listed()).summaryAr).toBe('شعبةٌ عمليّةٌ في ستّة أسابيع.\n\nتخرج منها بخطّةٍ مكتوبة.')
  })
})
