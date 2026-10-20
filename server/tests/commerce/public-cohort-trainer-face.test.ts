/* وجهُ مدرّب الشعبة في القائمة العامّة — اسمُه وصورتُه ومعرّفُ بطاقته (٢٠ أكتوبر ٢٠٢٦).

   «يجب أن تظهر وكأنّهم شعبتان للدورة، وهو يختار الشعبة المناسبة له كتوقيتٍ ومدرّب.. ويفضّل أن
   يظهر اسمُ المدرّب بوضوح وصورتُه بنفس صندوق الشعبة» (صاحب المنصّة). والحارسُ هنا على ما يخرج:
   مدرّبٌ معتمَدٌ نشرُه يخرج بوجهه، ومن لم يُعتمد نشرُه لا اسمَ له ولا صورة — البوّابةُ الواحدة
   (`trainer-visibility.ts`) ترشّح الوجهَ كما ترشّح الاسم. */

import { beforeAll, describe, expect, it } from 'vitest'
import type { PrismaClient } from '@prisma/client'
import { setupTestDb, testPrisma } from '../helpers/db'
import { PublicCatalogService } from '../../services/public-catalog.service'

let prisma: PrismaClient
let publicCatalog: PublicCatalogService
let cohortId = ''
let shownId = ''

const at = (days: number) => new Date(Date.now() + days * 86_400_000)

async function trainer(name: string, published: boolean, photoUrl: string | null) {
  const application = await prisma.trainerApplication.create({
    data: {
      reference: `TR-FACE-${name}-${Date.now()}`, fullName: name, email: `face-${name}-${Date.now()}@test.local`,
      phone: '0790000014', status: 'active', motivation: 'اختبار', privacyConsentAt: new Date(),
    },
  })
  return (await prisma.trainerProfile.create({
    data: {
      applicationId: application.id, isVerified: true, photoUrl,
      publicVisibility: published, publishApprovedAt: published ? new Date() : null,
    },
  })).id
}

beforeAll(async () => {
  await setupTestDb()
  prisma = await testPrisma()
  publicCatalog = new PublicCatalogService(prisma)
  shownId = await trainer('ريم المعلنة', true, 'storage:trainer-photos/reem.webp')
  const hiddenId = await trainer('سامر المخفي', false, 'storage:trainer-photos/samer.webp')
  cohortId = (await prisma.cohort.create({
    data: {
      courseId: 'C-BIZ-101', title: `شعبة الوجه ${Date.now()}`,
      status: 'open', registrationOpen: true, financialReady: true,
      price: 100, currency: 'USD', capacity: 20, startsAt: at(20),
      trainers: { create: [{ profileId: shownId, role: 'lead' }, { profileId: hiddenId, role: 'assistant' }] },
    },
  })).id
  await prisma.cohortDeliveryPlan.create({
    data: { cohortId, trainerId: shownId, status: 'approved', content: { kind: 'trainer', modules: [], resources: [] } },
  })
}, 180_000)

describe('وجه مدرّب الشعبة قبل الدفع', () => {
  it('⚠️ المعلن يخرج باسمه وصورته ومعرّف بطاقته — والمخفي لا اسم له ولا صورة', async () => {
    const row = (await publicCatalog.cohorts()).find((c) => c.id === cohortId)
    expect(row, 'الشعبة لا تظهر في القائمة العامّة').toBeTruthy()
    expect(row!.trainerProfiles).toEqual([
      { id: shownId, name: 'ريم المعلنة', photoUrl: '/api/v1/trainer-photos/trainer-photos/reem.webp' },
    ])
    expect(row!.trainers).toEqual(['ريم المعلنة'])
    expect(JSON.stringify(row)).not.toContain('سامر')
    expect(JSON.stringify(row)).not.toContain('samer')
  })
})
