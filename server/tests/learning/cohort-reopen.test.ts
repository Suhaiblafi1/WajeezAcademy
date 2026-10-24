/* إعادةُ فتح الشعبة الملغاة — على قاعدةٍ حقيقيّة (٢٤ أكتوبر ٢٠٢٦).

   «ماذا لو أردت أن أتراجع عن الإلغاء؟» (صاحب المنصّة)، واختار زرّا يعيدها. فيُحرس:
   ١) تعود إلى حالها قبل الإلغاء بمتعلّميها، ويصل مدرّبَها ومتعلّميها أنّها عادت؛
   ٢) ولا تُعاد ما مضى أوّلُ لقاءٍ فيها، ولا ما ليست ملغاة. */

import { beforeAll, describe, expect, it } from 'vitest'
import type { PrismaClient } from '@prisma/client'
import { setupTestDb, testPrisma } from '../helpers/db'
import { TrainerReviewService } from '../../services/trainer-review.service'
import { CohortService } from '../../services/cohort.service'

let prisma: PrismaClient
const ACTOR = '00000000-0000-0000-0000-000000000009'
const COURSE = 'C-BIZ-101'
const DAY = 86_400_000
let profileId = ''
let trainerUserId = ''
let seq = 0

beforeAll(async () => {
  await setupTestDb()
  prisma = await testPrisma()
  profileId = (await new TrainerReviewService(prisma)
    .createTrainerDirectly(ACTOR, { fullName: 'مدرب يعود', email: 'reopen-trainer@test.local' })).profileId
  trainerUserId = (await prisma.trainerProfile.findUniqueOrThrow({ where: { id: profileId } })).userId!
}, 240_000)

const svc = () => new CohortService(prisma)
async function cohort(title: string, status: string, inDays: number) {
  const c = await prisma.cohort.create({ data: { courseId: COURSE, title, status, startsAt: new Date(Date.now() + inDays * DAY) } })
  await prisma.cohortTrainer.create({ data: { cohortId: c.id, profileId, role: 'lead' } })
  return c
}

describe('إعادة فتح الملغاة', () => {
  it('⚠️ تعود إلى حالها قبل الإلغاء بمتعلميها — ويصل مدربها ومتعلميها أنها عادت', async () => {
    const c = await cohort('شعبة تلغى ثم تعود', 'full', 10)
    const u = await prisma.user.create({ data: { email: `reopen-${++seq}@test.local`, passwordHash: 'x', displayName: 'متعلم' } })
    await prisma.enrollment.create({ data: { userId: u.id, cohortId: c.id } })
    await svc().transition(c.id, 'cancelled', ACTOR, 'اختبار', { reasonAr: 'قلة التسجيل' })

    const r = await svc().reopen(c.id, ACTOR)
    expect(r.status, 'لم تعد إلى حالها قبل الإلغاء').toBe('full')
    const after = await prisma.cohort.findUniqueOrThrow({ where: { id: c.id }, include: { enrollments: true } })
    expect(after.status).toBe('full')
    expect(after.enrollments.map((e) => e.status)).toEqual(['enrolled'])
    expect(await prisma.notification.count({ where: { userId: u.id, channel: 'in_app', templateKey: 'cohort.reopened' } })).toBe(1)
    const told = await prisma.notification.findMany({ where: { userId: trainerUserId, templateKey: 'cohort.reopened.trainer' } })
    expect(told.map((n) => n.channel).sort()).toEqual(['email', 'in_app'])
    expect(await prisma.auditEvent.count({ where: { action: 'cohort.reopen', entityId: c.id } })).toBe(1)
  })

  it('⚠️ ولا تعاد ما مضى أول لقاء فيها، ولا ما ليست ملغاة', async () => {
    const past = await cohort('ملغاة مضى موعدها', 'cancelled', -2)
    await expect(svc().reopen(past.id, ACTOR)).rejects.toThrow(/مضى موعد أول لقاء/)
    expect((await prisma.cohort.findUniqueOrThrow({ where: { id: past.id } })).status).toBe('cancelled')
    const open = await cohort('مفتوحة', 'open', 5)
    await expect(svc().reopen(open.id, ACTOR)).rejects.toThrow(/ليست ملغاة/)
  })
})
