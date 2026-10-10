/* نبذةُ الشعبة في القائمة العامّة — «سطران يقرؤهما المتعلّم قبل أن يدفع» (١٠ أكتوبر ٢٠٢٦).

   تطلبها خطوةُ «المعلومات الأساسيّة» من المدرّب بهذا الوعد، ولم تكن تظهر في أيّ صفحة. والحارسُ
   هنا على **ما يُعلَن**: نبذةُ خطّة المدرّب المعتمَدة وحدَها — لا مسودّتُه ولا ما ينتظر الإدارة،
   ولا خطّةُ الأكاديميّة التي لا مدرّبَ لها. */

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
  it('⚠️ لا شيءَ قبل أن تُعتمد خطّةُ المدرّب — ولا من مسودّته ولا ممّا ينتظر الإدارة', async () => {
    await plan('draft', 'مسودّةٌ لم تُرسل', 30)
    await plan('submitted', 'تنتظر الإدارة', 20)
    await plan('approved', 'خطّةُ الأكاديميّة بلا مدرّب', 10, false)
    expect((await listed()).summaryAr).toBeNull()
  })

  it('⚠️ ونبذةُ خطّته المعتمَدة تُعلَن — أحدثُها', async () => {
    await plan('approved', 'نبذةٌ قديمة', 15)
    await plan('published', '  شعبةٌ عمليّةٌ في ستّة أسابيع.\n\nتخرج منها بخطّةٍ مكتوبة.  ', 5)
    expect((await listed()).summaryAr).toBe('شعبةٌ عمليّةٌ في ستّة أسابيع.\n\nتخرج منها بخطّةٍ مكتوبة.')
  })
})
