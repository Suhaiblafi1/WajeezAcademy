/* ج-٣ — جاهزية المسار: تعريفٌ واحد يخدم المعالج وحاجز النشر.

   ما تحميه هذه الاختبارات: أن الخطوات الخمس لا تصير تعريفين يتباعدان، وأن
   النقص الذي ينتج «جوكرا» (بلا جمهور · بلا مجال) يمنع النشر لا يُبلَّغ فقط. */

import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import type { PrismaClient } from '@prisma/client'
import { setupTestDb, testPrisma } from '../helpers/db'
import { AuthError } from '../../services/auth.service'
import { CatalogAdminService, PATHWAY_IMPACT_REF } from '../../services/catalog-admin.service'
import { PublishingService } from '../../services/publishing.service'

const ID = 'PW-RDY-001'
let prisma: PrismaClient
let admin: CatalogAdminService

beforeAll(async () => {
  await setupTestDb()
  prisma = await testPrisma()
  admin = new CatalogAdminService(prisma)
}, 180_000)

afterAll(async () => {
  await prisma.impactAnalysisRun.deleteMany({ where: { changeRef: PATHWAY_IMPACT_REF(ID) } }).catch(() => {})
  await prisma.diagnosticProfile.deleteMany({ where: { entityType: 'pathway', entityId: ID } }).catch(() => {})
  await prisma.pathwayDomain.deleteMany({ where: { pathwayId: ID } }).catch(() => {})
  await prisma.pathwayCourse.deleteMany({ where: { pathwayId: ID } }).catch(() => {})
  await prisma.pathwayVersion.deleteMany({ where: { pathwayId: ID } }).catch(() => {})
  await prisma.pathway.deleteMany({ where: { id: ID } }).catch(() => {})
})

describe('الخطوات الخمس على مسار ينمو', () => {
  it('مسار كامل الإنشاء: البيانات والدورات والجمهور والمجال سليمة، والأثر وحده ناقص', async () => {
    await admin.createPathway({
      id: ID, title: 'مسار اختبار الجاهزية',
      audience: 'موظف يريد الانتقال إلى إدارة فريق صغير',
      beforeText: 'ينفّذ مهامه وحده ولا يوزّع العمل',
      afterText: 'يدير فريقا بخطة أسبوعية ومتابعة مكتوبة',
      courseIds: ['C-MGR-101'],
      domainIds: ['people_leadership'],
      personas: ['employee'], goals: ['promotion'],
    })
    const r = await admin.pathwayReadiness(ID)
    const by = Object.fromEntries(r.steps.map((s) => [s.key, s]))
    expect(by.basics.ok, by.basics.reasonAr).toBe(true)
    expect(by.courses.ok, by.courses.reasonAr).toBe(true)
    expect(by.profile.ok, by.profile.reasonAr).toBe(true)
    expect(by.domains.ok, by.domains.reasonAr).toBe(true)
    /* الأثر لم يُفحص بعد — الخطوة الخامسة هي الوحيدة الناقصة */
    expect(by.impact.ok).toBe(false)
    expect(by.impact.reasonAr).toContain('لم يُفحص')
    expect(r.ok).toBe(false)
  })

  it('حذف الجمهور يُسقط خطوته بسبب يقول أثر الفراغ', async () => {
    await prisma.diagnosticProfile.update({
      where: { entityType_entityId: { entityType: 'pathway', entityId: ID } },
      data: { audience: [], goals: [], profile: { personas: [], goals: [] } },
    })
    const r = await admin.pathwayReadiness(ID)
    const profile = r.steps.find((s) => s.key === 'profile')!
    expect(profile.ok).toBe(false)
    expect(profile.reasonAr).toContain('يطابق الجميع')
    /* ثم إعادته تُصلحه — بالباب المخصص لا بكتابة خام */
    await admin.setPathwayProfile(ID, { personas: ['employee'], goals: ['promotion'] })
    expect((await admin.pathwayReadiness(ID)).steps.find((s) => s.key === 'profile')!.ok).toBe(true)
  })

  it('حذف المجال يُسقط خطوته', async () => {
    await prisma.pathwayDomain.deleteMany({ where: { pathwayId: ID } })
    const domains = (await admin.pathwayReadiness(ID)).steps.find((s) => s.key === 'domains')!
    expect(domains.ok).toBe(false)
    expect(domains.reasonAr).toContain('لا يدخل مطابقة المجالات')
    await admin.setPathwayDomains(ID, ['people_leadership'])
  })

  it('فحص الأثر يُكمل الخطوة، وتعديلٌ بعده يُبطله', async () => {
    await prisma.impactAnalysisRun.create({
      data: { changeRef: PATHWAY_IMPACT_REF(ID), summary: {} },
    })
    expect((await admin.pathwayReadiness(ID)).steps.find((s) => s.key === 'impact')!.ok).toBe(true)

    /* تعديل الجمهور بعد الفحص يجعل الفحص يصف حالة أخرى — فيُبطل */
    await admin.setPathwayProfile(ID, { personas: ['employee', 'manager'], goals: ['promotion'] })
    const impact = (await admin.pathwayReadiness(ID)).steps.find((s) => s.key === 'impact')!
    expect(impact.ok).toBe(false)
    expect(impact.reasonAr).toContain('أقدم من آخر تعديل')
  })
})

describe('المفاتيح المجهولة تُرفض لا تُحذف صامتا', () => {
  it('شخصية أو هدف غير معروف يرفعان خطأ', async () => {
    await expect(admin.setPathwayProfile(ID, { personas: ['not_a_persona'], goals: ['promotion'] }))
      .rejects.toThrow(AuthError)
    await expect(admin.setPathwayProfile(ID, { personas: ['employee'], goals: ['not_a_goal_at_all'] }))
      .rejects.toThrow(AuthError)
  })
})

describe('حاجز النشر يستعمل نفس التعريف', () => {
  it('مسار معتمد بلا جمهور يُرفض نشره بنص خطوة الجاهزية نفسه', async () => {
    await prisma.pathway.update({ where: { id: ID }, data: { status: 'approved' } })
    await prisma.diagnosticProfile.update({
      where: { entityType_entityId: { entityType: 'pathway', entityId: ID } },
      data: { audience: [], goals: [] },
    })
    try {
      const { errors } = await new PublishingService(prisma).validateDrafts()
      const line = errors.find((e) => e.includes(ID) && e.includes('الجمهور والهدف'))
      expect(line, errors.join(' | ')).toBeDefined()
      expect(line).toContain('يطابق الجميع')

      /* وخطوة «فحص الأثر» لا تمنع النشر — تلك الشاشة تشغّلها بنفسها */
      expect(errors.some((e) => e.includes(ID) && e.includes('فحص الأثر'))).toBe(false)
    } finally {
      await prisma.pathway.update({ where: { id: ID }, data: { status: 'draft' } })
    }
  })
})
