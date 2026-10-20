/* من عبّأ نموذج المنحة ولم يشترِ (٢٠ أكتوبر ٢٠٢٦) — والعلّةُ في رأس `grant-followup.service.ts`.

   ① **القائمةُ تقول ما فعل كلٌّ** — اشترى (بكوده ولو اشترى به غيرُه، أو ببريده بلا كود)، أو ينتظر الدفع، أو
      لم يشترِ بعد؛ ومستشارُه إن كانت له حالة.
   ② **ومن لم يشترِ بعد يومين تُفتح له حالةٌ عند مستشار** — مرّةً واحدة، وتُسند، ويُكتب أثرُها.
   ③ **ولا تُفتح** لمن لم يمضِ عليه يومان، ولا لمن اشترى، ولا لمن ينتظر طلبُه الدفع، ولا لمن له حالةٌ قبلُ.
   ④ **والعاملُ يفتحها.** */

import { beforeAll, describe, expect, it } from 'vitest'
import type { PrismaClient } from '@prisma/client'
import { setupTestDb, testPrisma } from '../helpers/db'
import { AuthService } from '../../services/auth.service'
import { CommerceService } from '../../services/commerce.service'
import { GrantService } from '../../services/grant.service'
import { GrantLandingService } from '../../services/grant-landing.service'
import { GRANT_FOLLOWUP_HOURS, grantRegistrants, openGrantFollowups } from '../../services/grant-followup.service'
import { runJob } from '../../worker/jobs'
import { approvedTrainerPlan } from '../helpers/approved-trainer'

let prisma: PrismaClient
let auth: AuthService
let commerce: CommerceService
let landing: GrantLandingService
let ownerId = ''
let pool: string[] = []
let seq = 0
const STAMP = Date.now()
const HOUR = 3_600_000

const nextCourse = () => {
  const id = pool.shift()
  if (!id) throw new Error('نفدت الدوراتُ المنشورة')
  return id
}
async function cohort() {
  return prisma.cohort.create({
    data: {
      plans: { create: await approvedTrainerPlan(prisma) }, courseId: nextCourse(), title: `شعبة المتابعة ${++seq}`,
      status: 'open', registrationOpen: true, financialReady: true, price: 150, currency: 'USD', capacity: 20,
      startsAt: new Date(Date.now() + 30 * 24 * HOUR),
    },
  })
}
/** عضوٌ عبّأ النموذج قبل `hoursAgo` ساعة */
async function member(hoursAgo = GRANT_FOLLOWUP_HOURS + 1) {
  seq += 1
  const email = `fu-${seq}-${STAMP}@test.local`
  const out = await landing.apply({ fullName: `عضو ${seq}`, phone: `0792${String(600000 + seq)}`, email, workField: 'الهندسة' })
  await prisma.lead.update({ where: { id: out.ref }, data: { createdAt: new Date(Date.now() - hoursAgo * HOUR) } })
  return { ref: out.ref, code: out.grant!.code!, email }
}
const learner = async (email = `fu-buyer-${++seq}-${STAMP}@test.local`) => (await auth.register(email, 'Buyer#12345', `مشتر ${seq}`)).userId
const casesOf = (leadId: string) => prisma.advisorCase.findMany({ where: { leadId }, include: { assignments: true } })

beforeAll(async () => {
  await setupTestDb()
  prisma = await testPrisma()
  auth = new AuthService(prisma)
  commerce = new CommerceService(prisma)
  landing = new GrantLandingService(prisma)
  ownerId = (await auth.register(`fu-owner-${STAMP}@test.local`, 'Owner#12345', 'صاحب المنصة')).userId
  const adv = (await auth.register(`fu-adv-${STAMP}@test.local`, 'Advisor#12345', 'مستشار المتابعة')).userId
  await auth.setRoles(adv, ['advisor'])
  pool = (await prisma.course.findMany({ where: { status: 'published' }, select: { id: true }, orderBy: { id: 'asc' } })).map((c) => c.id)
  await new GrantService(prisma).update({ active: true, percentOff: 60, maxCodes: null, maxCourses: 4, closesAt: null }, ownerId)
}, 240_000)

describe('① القائمة تقول ما فعل كل واحد', () => {
  it('⚠️ اشترى بكوده ولو اشترى به غيره، أو ببريده بلا كود — أو ينتظر الدفع، أو لم يشتر', async () => {
    const gifted = await member()
    const friend = await learner()
    const o = await commerce.checkout(friend, [(await cohort()).id], gifted.code)
    await commerce.payOrder(o.orderId, friend, `fu-${o.orderId}`)

    const byEmail = await member()
    const self = await learner(byEmail.email)
    const o2 = await commerce.checkout(self, [(await cohort()).id])
    await commerce.payOrder(o2.orderId, self, `fu-${o2.orderId}`)

    const pending = await member()
    await commerce.checkout(await learner(), [(await cohort()).id], pending.code)

    const idle = await member()
    await landing.askAdvisor(idle.ref)

    const list = await grantRegistrants(prisma)
    const of = (ref: string) => list.find((r) => r.id === ref)!
    expect(of(gifted.ref).state, 'لم يحسب شراء صديقه بكوده').toBe('bought')
    expect(of(byEmail.ref).state, 'لم يحسب شراءه ببريده').toBe('bought')
    expect(of(pending.ref).state).toBe('pending')
    expect(of(idle.ref).state).toBe('none')
    expect(of(idle.ref).advisor, 'لم يقل مستشاره').toBeTruthy()
    expect(of(gifted.ref).code).toBe(gifted.code)
  })
})

describe('② و③ من لم يشتر بعد يومين — حالة عند مستشار، مرة واحدة', () => {
  it('⚠️ تفتح وتسند ويكتب أثرها — ولا تفتح للجديد ولا للمشتري ولا لمن ينتظر الدفع ولا لمن له حالة', async () => {
    const late = await member()
    const fresh = await member(GRANT_FOLLOWUP_HOURS - 1)
    const bought = await member()
    const buyer = await learner()
    const o = await commerce.checkout(buyer, [(await cohort()).id], bought.code)
    await commerce.payOrder(o.orderId, buyer, `fu-${o.orderId}`)
    const paying = await member()
    await commerce.checkout(await learner(), [(await cohort()).id], paying.code)
    const asked = await member()
    await landing.askAdvisor(asked.ref)
    /* واشترى ببريده بلا كود */
    const direct = await member()
    const me = await learner(direct.email)
    const o3 = await commerce.checkout(me, [(await cohort()).id])
    await commerce.payOrder(o3.orderId, me, `fu-${o3.orderId}`)

    await openGrantFollowups(prisma)
    const cases = await casesOf(late.ref)
    expect(cases, 'لم تفتح حالة لمن لم يشتر بعد يومين').toHaveLength(1)
    expect(cases[0].nextAction).toContain('عبأ نموذج المنحة قبل يومين')
    expect(cases[0].assignments.some((x) => x.unassignedAt === null), 'لم تسند').toBe(true)
    expect(await prisma.auditEvent.count({ where: { action: 'advisor.case.grant_followup', entityId: cases[0].id } })).toBe(1)
    expect(await casesOf(fresh.ref), 'فتحت قبل يومين').toHaveLength(0)
    expect(await casesOf(bought.ref), 'فتحت لمن اشترى').toHaveLength(0)
    expect(await casesOf(direct.ref), 'فتحت لمن اشترى ببريده بلا كود').toHaveLength(0)
    expect(await casesOf(paying.ref), 'فتحت لمن ينتظر طلبه الدفع').toHaveLength(0)
    expect(await casesOf(asked.ref), 'فتحت ثانية لمن طلب مستشارا').toHaveLength(1)

    await openGrantFollowups(prisma)
    expect(await casesOf(late.ref), 'فتحت مرتين').toHaveLength(1)
  })
})

describe('④ والعامل يفتحها', () => {
  it('⚠️ وظيفة grant_followup', async () => {
    const late = await member()
    await runJob(prisma, 'grant_followup')
    expect(await casesOf(late.ref)).toHaveLength(1)
  })
})
