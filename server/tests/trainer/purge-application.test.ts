/* الحذف النهائيّ لطلب مدرّب — وحرّاسُه الثلاثة.

   الحذفُ لا يُستردّ، فما يُحرَس هنا ليس أنّه يحذف بل **أنّه يرفض**:

   ١) من صار مدرّبا لا يُحذف طلبُه. `TrainerProfile` بلا `Cascade` عمدا،
      وملفّه يرتبط بتأهيلاتٍ وإسنادٍ وعقود — فمن تعاقدنا معه له تاريخٌ لا
      يُمحى بضغطة.
   ٢) ولا يُحذف طلبٌ قيد النظر: المنتهيةُ وحدها.
   ٣) ولا حذفَ بلا سبب — ويُكتب في سجلّ التدقيق **قبل** الحذف، فيبقى الأثرُ
      بعد أن يذهب الصفّ. وهذا آخرها هو ما يجعل الحذف مقبولا أصلا. */

import { beforeAll, describe, expect, it } from 'vitest'
import type { PrismaClient } from '@prisma/client'
import { setupTestDb, testPrisma } from '../helpers/db'
import { TrainerApplicationService, PURGEABLE_STATUSES } from '../../services/trainer-application.service'

let prisma: PrismaClient
let svc: TrainerApplicationService
const ACTOR = '44444444-4444-4444-8444-444444444444'
const STAMP = Date.now()

async function makeApplication(status: string, suffix: string) {
  return prisma.trainerApplication.create({
    data: {
      reference: `WJ-TR-TEST-${STAMP}-${suffix}`,
      status,
      email: `purge-${STAMP}-${suffix}@test.local`,
      fullName: 'طلبُ اختبارٍ يُحذف',
    },
  })
}

beforeAll(async () => {
  await setupTestDb()
  prisma = await testPrisma()
  svc = new TrainerApplicationService(prisma)
})

describe('حذف طلب المدرّب نهائيّا', () => {
  it('١) لا حذفَ بلا سبب', async () => {
    const app = await makeApplication('withdrawn', 'a')
    await expect(svc.purge(app.reference, ACTOR, '')).rejects.toThrow()
    await expect(svc.purge(app.reference, ACTOR, 'خطأ')).rejects.toThrow()
    /* وبقي الصفّ — الرفضُ لم يحذف شيئا */
    expect(await prisma.trainerApplication.count({ where: { id: app.id } })).toBe(1)
    await prisma.trainerApplication.delete({ where: { id: app.id } })
  })

  it('٢) ولا يُحذف طلبٌ قيد النظر', async () => {
    const app = await makeApplication('under_review', 'b')
    await expect(svc.purge(app.reference, ACTOR, 'طلبُ اختبارٍ لا قيمة له')).rejects.toThrow()
    expect(await prisma.trainerApplication.count({ where: { id: app.id } })).toBe(1)
    await prisma.trainerApplication.delete({ where: { id: app.id } })
  })

  it('٣) والمنتهيةُ وحدها قابلةٌ للحذف — والقائمة صريحة', () => {
    expect([...PURGEABLE_STATUSES].sort()).toEqual(
      ['draft', 'email_verification_pending', 'rejected', 'withdrawn'],
    )
    expect(PURGEABLE_STATUSES).not.toContain('active')
    expect(PURGEABLE_STATUSES).not.toContain('onboarding')
    expect(PURGEABLE_STATUSES).not.toContain('contract_pending')
  })

  it('٤) والحذفُ يمضي مع أبنائه — ويترك أثرا في سجلّ التدقيق', async () => {
    const app = await makeApplication('withdrawn', 'c')
    await prisma.trainerApplicationDocument.create({
      data: {
        applicationId: app.id, kind: 'cv', storageKey: `test/${STAMP}/cv.pdf`,
        originalName: 'cv.pdf', mime: 'application/pdf', sizeBytes: 10,
      },
    })
    await prisma.trainerApplicationSpecialty.create({
      data: { applicationId: app.id, specialty: 'إدارة' },
    })

    const r = await svc.purge(app.reference, ACTOR, 'طلبُ اختبارٍ من تجربة النشر — يُحذف')
    expect(r.deletedDocuments).toBe(1)

    expect(await prisma.trainerApplication.count({ where: { id: app.id } })).toBe(0)
    expect(await prisma.trainerApplicationDocument.count({ where: { applicationId: app.id } })).toBe(0)
    expect(await prisma.trainerApplicationSpecialty.count({ where: { applicationId: app.id } })).toBe(0)

    /* الأثرُ باقٍ بعد أن ذهب الصفّ — وهو ما يجعل الحذف مقبولا */
    const audit = await prisma.auditEvent.findFirst({
      where: { action: 'trainer.application.purge', entityId: app.id },
    })
    expect(audit).toBeTruthy()
    expect(audit!.reason).toContain('تجربة النشر')
    expect(JSON.stringify(audit!.before)).toContain(app.reference)
  })

  it('٥) ومن صار مدرّبا لا يُحذف طلبُه', async () => {
    const app = await makeApplication('active', 'd')
    await prisma.trainerProfile.create({
      data: { applicationId: app.id, headline: 'مدرّبٌ متعاقَد' },
    })
    await expect(svc.purge(app.reference, ACTOR, 'محاولةُ حذفِ مدرّبٍ متعاقَد')).rejects.toThrow(/مدرّبا/)
    expect(await prisma.trainerApplication.count({ where: { id: app.id } })).toBe(1)

    await prisma.trainerProfile.deleteMany({ where: { applicationId: app.id } })
    await prisma.trainerApplication.delete({ where: { id: app.id } })
  })
})
