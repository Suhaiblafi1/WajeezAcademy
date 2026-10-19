/* مهلةُ المقعد المحجوز بلا دفع — ساعةٌ لمن اشترى بنفسه، ويومان لما حجزه الفريق (١٩ أكتوبر ٢٠٢٦).

   كانت ساعةً للجميع، ومن حجز له الفريقُ وهو غائبٌ يجد مقعدَه ذهب قبل أن يقرأ بريدَه — و«رحلتي»
   تقول له «ومقعدك باق ما دامت الشعبة مفتوحة». فيُحرس هنا (`commerce/seat-hold.ts`):

   ١) ما حجزه الفريقُ لا يُلغى بعد ساعة، ويُلغى بعد يومين.
   ٢) والشراءُ المباشرُ يبقى ساعةً كما كان.
   ٣) و«فواتيري» تقرأ موعدَ الدفع من المهلة نفسِها — لا تقديرا في المتصفّح.
   ٤) والخبرُ يقول المهلة. */

import { beforeAll, describe, expect as vexpect, it } from 'vitest'
import { plainExpect } from '../helpers/plain-expect'
const expect = plainExpect(vexpect)
import type { PrismaClient } from '@prisma/client'
import { setupTestDb, testPrisma } from '../helpers/db'
import { AuthService } from '../../services/auth.service'
import { CommerceService } from '../../services/commerce.service'
import { reclaimAbandonedOrders } from '../../worker/jobs'
import { approvedTrainerPlan } from '../helpers/approved-trainer'

let prisma: PrismaClient
let auth: AuthService
let commerce: CommerceService
let managerId = ''
const H = 3_600_000

const learner = async (tag: string) => (await auth.register(`hold-${tag}@test.local`, 'Learner#12345', 'متعلّم')).userId

const cohort = async (title: string) => (await prisma.cohort.create({
  data: {
    plans: { create: await approvedTrainerPlan(prisma) },
    courseId: 'C-BIZ-101', title, status: 'open', registrationOpen: true,
    financialReady: true, price: 100, currency: 'USD', capacity: 50,
  },
})).id

/** حجزُ الفريق — بمزوّدٍ لا يُسوّي وحدَه، فيبقى الطلبُ بانتظار الدفع */
const teamHold = async (tag: string) => {
  const userId = await learner(tag)
  const req = await commerce.requestEnrollment(userId, await cohort(`شعبةُ ${tag}`))
  const order = await commerce.approveEnrollmentRequest(req.id, managerId)
  return { userId, orderId: order.id }
}

const age = (orderId: string, hours: number) =>
  prisma.order.update({ where: { id: orderId }, data: { createdAt: new Date(Date.now() - hours * H) } })
const statusOf = async (orderId: string) => (await prisma.order.findUniqueOrThrow({ where: { id: orderId } })).status

beforeAll(async () => {
  await setupTestDb()
  prisma = await testPrisma()
  auth = new AuthService(prisma)
  commerce = new CommerceService(prisma)
  const m = await auth.register('hold-manager@test.local', 'Manager#12345', 'مدير')
  managerId = m.userId
  await auth.setRoles(managerId, ['academic_manager'])
  await prisma.integrationSetting.upsert({
    where: { provider: 'payment' },
    update: { enabled: true, config: { driver: 'manual' } },
    create: { provider: 'payment', enabled: true, config: { driver: 'manual' } },
  })
}, 240_000)

describe('ما حجزه الفريقُ يبقى يومين', () => {
  it('لا يُلغى بعد ثلاث ساعات', async () => {
    const { orderId } = await teamHold('team-3h')
    expect(await statusOf(orderId)).toBe('pending_payment')
    await age(orderId, 3)
    await reclaimAbandonedOrders(prisma)
    expect(await statusOf(orderId), 'أُلغي حجزُ الفريق بعد ساعات — قبل أن يقرأ صاحبُه بريدَه').toBe('pending_payment')
  })

  it('ويُلغى بعد يومين', async () => {
    const { orderId } = await teamHold('team-49h')
    await age(orderId, 49)
    await reclaimAbandonedOrders(prisma)
    expect(await statusOf(orderId)).toBe('cancelled')
  })

  it('والشراءُ المباشرُ يبقى ساعةً كما كان', async () => {
    const userId = await learner('checkout')
    const out = await commerce.checkout(userId, [await cohort('شعبةُ الشراء المباشر')])
    await age(out.orderId, 2)
    await reclaimAbandonedOrders(prisma)
    expect(await statusOf(out.orderId)).toBe('cancelled')
  })
})

describe('وموعدُ الدفع يُقال', () => {
  it('«فواتيري» تقرأ موعدَ الدفع من المهلة نفسِها', async () => {
    const team = await teamHold('payby-team')
    const own = await learner('payby-own')
    const out = await commerce.checkout(own, [await cohort('شعبةُ موعد الدفع')])

    const t = (await commerce.myOrders(team.userId)).find((o) => o.id === team.orderId)!
    vexpect(t.payBy!.getTime() - t.createdAt.getTime()).toBe(48 * H)
    const c = (await commerce.myOrders(own)).find((o) => o.id === out.orderId)!
    vexpect(c.payBy!.getTime() - c.createdAt.getTime()).toBe(H)
  })

  it('والخبرُ يقول المهلةَ لمن حجز له الفريق', async () => {
    const { userId } = await teamHold('notice')
    const n = await prisma.notification.findFirstOrThrow({ where: { userId, templateKey: 'order.seats_held', channel: 'in_app' } })
    expect(n.body).toContain('خلال يومين')
  })
})
