/* حذفُ الشعبة التي لا مدرّبَ لها — من صندوق «شعب تحتاج فصلا منك».

   قرارُ صاحب المنصّة (٢٠ أكتوبر ٢٠٢٦): «لماذا ما زالت هنا! احذفها» — عن ستِّ شعبٍ قديمةٍ بلا مدرّب
   تركها ترحيلُ ١٩ أكتوبر لأثرٍ تعلّق بها. فيُحرس هنا:
   ١) أنّ ما لا متعلّمَ فيه يُحذف — ومعه عرضُ تدريسٍ ينتظر يُسحب، وقاعدةُ أجرٍ يتيمةٌ تُحذف؛
   ٢) وأنّ ما فيه ملتحقٌ أو طلبُ تسجيلٍ لا يُحذف، ويُقال سببُه؛
   ٣) وأنّ ما له مدرّبٌ لا يمسّه هذا الزرّ؛
   ٤) ولكلّ حذفٍ أثرُه.

   ورُئي ساقطا: أُسقط فحصُ طلب التسجيل فحاول الحذفَ وردّه القيدُ «تعذر حذفها»، وأُسقط سحبُ العرض
   فبقي «offered» بلا شعبة، وأُسقط فحصُ المدرّب فحُذفت شعبتُه. ثمّ أُعيدت. */

import { beforeAll, describe, expect, it } from 'vitest'
import type { PrismaClient } from '@prisma/client'
import { setupTestDb, testPrisma } from '../helpers/db'
import { TrainerReviewService } from '../../services/trainer-review.service'
import { TrainerlessCohortDeleteService } from '../../services/trainerless-cohort-delete.service'

let prisma: PrismaClient
let svc: TrainerlessCohortDeleteService
const ACTOR = '00000000-0000-0000-0000-000000000009'
const COURSE = 'C-BIZ-101'
let profileId = ''

const cohort = (title: string) => prisma.cohort.create({ data: { courseId: COURSE, title, status: 'draft' } })
const learner = (email: string) => prisma.user.create({ data: { email, passwordHash: 'x', displayName: 'متعلم' } })

beforeAll(async () => {
  await setupTestDb()
  prisma = await testPrisma()
  svc = new TrainerlessCohortDeleteService(prisma)
  profileId = (await new TrainerReviewService(prisma)
    .createTrainerDirectly(ACTOR, { fullName: 'مدرّب عرض عليه', email: 'trainerless-a@test.local' })).profileId
}, 240_000)

describe('ما لا متعلّم فيه يُحذف', () => {
  it('⚠️ تُحذف — ويُسحب عرضُها المنتظِر، وتُحذف قاعدةُ أجرها، ويبقى أثرُها', async () => {
    const c = await cohort('دورة قديمة — الدفعة الأولى')
    await prisma.cohortSession.create({ data: { cohortId: c.id, startsAt: new Date(Date.now() + 7 * 86_400_000), title: 'لقاء' } })
    const offer = await prisma.trainerAssignmentOffer.create({
      data: { profileId, courseId: COURSE, cohortId: c.id, expiresAt: new Date(Date.now() + 86_400_000) },
    })
    await prisma.trainerCompensationRule.create({ data: { profileId, type: 'per_seat', rate: 10, cohortId: c.id } })

    const r = await svc.delete(ACTOR, [c.id])
    expect(r.deleted.map((d) => d.title)).toEqual(['دورة قديمة — الدفعة الأولى'])
    expect(r.kept).toEqual([])
    expect(await prisma.cohort.findUnique({ where: { id: c.id } })).toBeNull()
    const o = await prisma.trainerAssignmentOffer.findUniqueOrThrow({ where: { id: offer.id } })
    expect(o.status, 'بقي عرضٌ ينتظر جوابا لشعبةٍ حُذفت').toBe('withdrawn')
    expect(await prisma.trainerCompensationRule.count({ where: { cohortId: c.id } }), 'بقيت قاعدة أجر يتيمة').toBe(0)
    expect(await prisma.auditEvent.count({ where: { action: 'cohort.delete_trainerless', entityId: c.id, actorId: ACTOR } })).toBe(1)
  })
})

describe('وما فيه أثرُ متعلّمٍ أو مدرّبٍ لا يُحذف', () => {
  it('⚠️ طلبُ تسجيلٍ يبقيها — ويُقال سببُه', async () => {
    const c = await cohort('شعبة فيها طلب')
    const u = await learner('trainerless-req@test.local')
    await prisma.enrollmentRequest.create({ data: { userId: u.id, cohortId: c.id, status: 'rejected' } })
    const r = await svc.delete(ACTOR, [c.id])
    expect(r.deleted).toEqual([])
    expect(r.kept[0]?.reasonAr).toBe('فيها 1 طلب تسجيل — لا تحذف')
    expect(await prisma.cohort.findUnique({ where: { id: c.id } })).not.toBeNull()
  })

  it('⚠️ وملتحقٌ يبقيها', async () => {
    const c = await cohort('شعبة فيها ملتحق')
    const u = await learner('trainerless-enr@test.local')
    await prisma.enrollment.create({ data: { userId: u.id, cohortId: c.id, status: 'enrolled' } })
    const r = await svc.delete(ACTOR, [c.id])
    expect(r.kept[0]?.reasonAr).toBe('فيها 1 ملتحق — لا تحذف')
    expect(await prisma.cohort.findUnique({ where: { id: c.id } })).not.toBeNull()
  })

  it('⚠️ وما له مدرّبٌ لا يمسّه هذا الزرّ', async () => {
    const c = await cohort('شعبة لها مدرب')
    await prisma.cohortTrainer.create({ data: { cohortId: c.id, profileId, role: 'lead' } })
    const r = await svc.delete(ACTOR, [c.id])
    expect(r.kept[0]?.reasonAr).toBe('لها مدرب')
    expect(await prisma.cohort.findUnique({ where: { id: c.id } })).not.toBeNull()
  })

  it('⚠️ والملغاةُ تُحذف كغيرها — زرُّ «تشغيل الشعب» يحذف ما أُلغي', async () => {
    const c = await prisma.cohort.create({ data: { courseId: COURSE, title: 'ملغاة بلا مدرب', status: 'cancelled' } })
    const r = await svc.delete(ACTOR, [c.id])
    expect(r.deleted.map((d) => d.id), 'لم تحذف الملغاة').toEqual([c.id])
  })

  it('وواحدةٌ تبقى لا توقف حذفَ غيرها', async () => {
    const keep = await cohort('تبقى')
    await prisma.cohortTrainer.create({ data: { cohortId: keep.id, profileId, role: 'lead' } })
    const gone = await cohort('تحذف')
    const r = await svc.delete(ACTOR, [keep.id, gone.id])
    expect(r.deleted.map((d) => d.id)).toEqual([gone.id])
    expect(r.kept.map((k) => k.id)).toEqual([keep.id])
  })
})
