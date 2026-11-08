/* دفعةُ المؤثّر تُسجَّل مرّةً واحدة (٨ نوفمبر ٢٠٢٦) — والعلّةُ في `InfluencerService.recordPayout`.

   كان الرصيدُ يُقرأ ثمّ تُكتب الدفعةُ بلا قفل: فتسجيلان معا للحوالة نفسِها (ضغطتان، أو موظّفا ماليّة) يقرآن الرصيدَ نفسَه
   ويمضيان — استحقّ ١٥ فسُجّل له ٣٠، ورصيدُه −١٥ بلا «سلفة» في الأثر. والإعدادُ من `influencer-grant.test.ts`. */

import { beforeAll, describe, expect, it } from 'vitest'
import type { PrismaClient } from '@prisma/client'
import { setupTestDb, testPrisma } from '../helpers/db'
import { AuthService } from '../../services/auth.service'
import { CommerceService } from '../../services/commerce.service'
import { GrantService } from '../../services/grant.service'
import { GrantLandingService } from '../../services/grant-landing.service'
import { InfluencerService } from '../../services/influencer.service'
import { approvedTrainerPlan } from '../helpers/approved-trainer'
import { INFLUENCER_GRANT_SLUG } from '../../../src/application/commerce/grant'

let prisma: PrismaClient
let auth: AuthService
let commerce: CommerceService
let grant: GrantService
let landing: GrantLandingService
let influencers: InfluencerService
let ownerId = ''
let pool: string[] = []
let seq = 0
const STAMP = Date.now()

const nextCourse = () => {
  const id = pool.shift()
  if (!id) throw new Error('نفدت الدوراتُ المنشورة')
  return id
}
async function openCohort(price = 100) {
  return (await prisma.cohort.create({
    data: {
      plans: { create: await approvedTrainerPlan(prisma) },
      courseId: nextCourse(), title: `شعبة منحة المؤثرين ${++seq}`,
      status: 'open', registrationOpen: true, financialReady: true,
      price, currency: 'USD', capacity: 20, startsAt: new Date(Date.now() + 30 * 86_400_000),
    } as never,
  })).id
}
async function learner(name = `متابعة ${seq} مؤثر`) {
  seq += 1
  return (await auth.register(`inf-${seq}-${STAMP}@test.local`, 'Learner#12345', name)).userId
}
const person = (over: Record<string, unknown> = {}) => ({
  fullName: `متابع ${++seq}`, phone: `0792${String(600000 + seq)}`, email: `follower-${seq}-${STAMP}@test.local`,
  workField: 'الموارد البشرية', ...over,
})
async function pay(userId: string, cohortIds: string[], code: string) {
  const out = await commerce.checkout(userId, cohortIds, code)
  await commerce.payOrder(out.orderId, userId, `inf-${out.orderId}`)
  return out.orderId
}
async function addInfluencer(code: string, commissionPercent = 15) {
  return (await influencers.create({ nameAr: `مؤثر ${code}`, code, commissionPercent }, ownerId)).id
}

beforeAll(async () => {
  await setupTestDb()
  prisma = await testPrisma()
  auth = new AuthService(prisma)
  commerce = new CommerceService(prisma)
  grant = new GrantService(prisma, INFLUENCER_GRANT_SLUG)
  landing = new GrantLandingService(prisma, INFLUENCER_GRANT_SLUG)
  influencers = new InfluencerService(prisma)
  await grant.update({ active: true }, (await auth.register(`inf-opener-${STAMP}@test.local`, 'Owner#12345', 'فاتح المنحة')).userId)
  ownerId = (await auth.register(`inf-owner-${STAMP}@test.local`, 'Owner#12345', 'صاحب المنصة')).userId
  pool = (await prisma.course.findMany({ where: { status: 'published' }, select: { id: true }, orderBy: { id: 'asc' } }))
    .map((c) => c.id)
}, 240_000)

describe('دفعة المؤثر تسجل مرة', () => {
  it('⚠️ دفعتان معا بقدر الرصيد: تمضي واحدة وترد الأخرى بأنها تتجاوز الرصيد', async () => {
    const id = await addInfluencer('RACEPAY')
    const out = await landing.apply(person({ influencerCode: 'RACEPAY' }))
    await pay(await learner(), [await openCohort(100)], out.grant!.code!)
    expect((await influencers.statement(id)).totals.balance).toBe(15)

    const r = await Promise.allSettled([
      influencers.recordPayout(id, { amount: 15 }, ownerId),
      influencers.recordPayout(id, { amount: 15 }, ownerId),
    ])
    expect(r.filter((x) => x.status === 'fulfilled'), 'سجلت الدفعة مرتين').toHaveLength(1)
    expect((r.find((x) => x.status === 'rejected') as PromiseRejectedResult).reason).toMatchObject({ code: 'payout_exceeds_balance' })
    expect((await influencers.statement(id)).totals).toMatchObject({ earned: 15, paid: 15, balance: 0 })
  })

  it('والسلفة المؤكدة تمضي وتكتب في الأثر', async () => {
    const id = await addInfluencer('ADVPAY')
    await influencers.recordPayout(id, { amount: 20, advance: true }, ownerId)
    expect((await influencers.statement(id)).totals.balance).toBe(-20)
    expect(await prisma.auditEvent.count({ where: { action: 'influencer.payout', entityId: id, meta: { path: ['advance'], equals: true } } })).toBe(1)
  })
})
