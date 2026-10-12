/* خصمُ إكمال الخطّة على الخادم — من الطلب الأوّل إلى الأخير (١٢ أكتوبر ٢٠٢٦).

   قرارُ صاحب المنصّة («أ٢»): مشتري التشخيص الذي بعضُ دوراته بلا شعبةٍ بعد يشتري ما
   فُتح بسلّمه، فإذا أكمل الخطّةَ لاحقا خُصم من فاتورته ما فاته، حتّى تبلغ الخطّةُ
   كلُّها سعرَها لو اشتُريت معا.

   والحسابُ نفسُه في `src/tests/commerce/plan-carry.test.ts`. وهنا ما لا يُرى إلّا
   بقاعدة: أنّ الطلبَ يحفظ ما خُصم بحكم الباقة، وأنّ الدفعةَ التالية تقرؤه، وأنّ ما
   لا يُعدّ مشترًى (مقعدٌ انسحب منه) لا يُقاصّ به، وأنّ العرضَ هو الفاتورة. */

import { beforeAll, describe, expect, it } from 'vitest'
import type { PrismaClient } from '@prisma/client'
import { setupTestDb, testPrisma } from '../helpers/db'
import { AuthService } from '../../services/auth.service'
import { PlanService } from '../../services/plan.service'
import { CommerceService } from '../../services/commerce.service'
import { approvedTrainerPlan } from '../helpers/approved-trainer'

let prisma: PrismaClient
let auth: AuthService
let plans: PlanService
let commerce: CommerceService

let pool: string[] = []
const nextCourse = () => {
  const id = pool.shift()
  if (!id) throw new Error('نفدت الدوراتُ المنشورة')
  return id
}

let seq = 0
async function learner() {
  seq += 1
  return (await auth.register(`carry-${seq}@test.local`, 'Learner#12345', `مشترٍ ${seq}`)).userId
}

/** شعبةٌ تُباع: مفتوحةٌ بخطّة مدرّبٍ معتمَدة وسعرٍ بالدولار */
async function openCohort(courseId: string, price = 150) {
  return prisma.cohort.create({
    data: {
      plans: { create: await approvedTrainerPlan(prisma) },
      courseId, title: `شعبة ${courseId} ${seq}-${Math.random()}`,
      status: 'open', registrationOpen: true, financialReady: true,
      price, currency: 'USD', capacity: 20, startsAt: new Date(Date.now() + 30 * 86_400_000),
    },
  })
}

/** يشتري ويدفع — كما يفعل المشتري من لوح الشراء */
async function buy(userId: string, cohortIds: string[]) {
  const out = await commerce.checkout(userId, cohortIds)
  await commerce.payOrder(out.orderId, userId, `carry-${out.orderId}`)
  return out
}

beforeAll(async () => {
  await setupTestDb()
  prisma = await testPrisma()
  auth = new AuthService(prisma)
  plans = new PlanService(prisma)
  commerce = new CommerceService(prisma)
  pool = (await prisma.course.findMany({ where: { status: 'published' }, select: { id: true }, orderBy: { id: 'desc' } }))
    .map((c) => c.id)
}, 240_000)

describe('خطّةٌ من أربعٍ على دفعتين — تبلغ سعرَها معا', () => {
  it('⚠️ الأولى بسلّمها، والثانية يُخصم منها ما فات — والمجموعُ ٤٣٢ لا ٥٥٢', async () => {
    const u = await learner()
    const [A, B, C, D] = [nextCourse(), nextCourse(), nextCourse(), nextCourse()]
    await plans.adopt(u, { nameAr: 'خطّتي', composed: true, courseIds: [A, B, C, D] })

    /* اليوم: دورتان لهما شعبة، واثنتان بلا — فيشتري ما فُتح بسلّم دورتين (٨٪) */
    const first = await buy(u, [(await openCohort(A)).id, (await openCohort(B)).id])
    expect(first.total).toBe(276)
    expect(first.planCredit).toBe(0)
    /* والطلبُ يحفظ ما خُصم بحكم الباقة — منه تُقاصّ الدفعةُ التالية */
    const saved = await prisma.order.findUniqueOrThrow({ where: { id: first.orderId } })
    expect(Number(saved.bundleDiscount)).toBe(24)

    /* ثمّ تُفتح الباقيتان — والعرضُ يقول ما تُصدره الفاتورة */
    const later = [(await openCohort(C)).id, (await openCohort(D)).id]
    const quote = await commerce.quote(u, later)
    expect(quote.planCredit, 'لم يُخصم ما فات').toBe(120)
    expect(quote.total).toBe(156)
    const second = await buy(u, later)
    expect(second.total).toBe(quote.total)
    expect(first.total + second.total).toBe(432)
  })
})

describe('ولا بابَ لمن لا يُكمل', () => {
  it('⚠️ دورةٌ واحدةٌ من خطّةٍ خماسيّة بسعرها كاملا — لا بخصم الخمس', async () => {
    const u = await learner()
    const ids = [nextCourse(), nextCourse(), nextCourse(), nextCourse(), nextCourse()]
    await plans.adopt(u, { nameAr: 'خطّتي', composed: true, courseIds: ids })
    const q = await commerce.quote(u, [(await openCohort(ids[0], 225)).id])
    expect(q.planCredit).toBe(0)
    expect(q.total).toBe(225)
  })

  it('⚠️ ومقعدٌ انسحب منه لا يُقاصّ به', async () => {
    const u = await learner()
    const [A, B, C] = [nextCourse(), nextCourse(), nextCourse()]
    await plans.adopt(u, { nameAr: 'خطّتي', composed: true, courseIds: [A, B, C] })
    const a = await openCohort(A)
    await buy(u, [a.id])
    await prisma.enrollment.updateMany({ where: { userId: u, cohortId: a.id }, data: { status: 'dropped' } })

    const later = [(await openCohort(B)).id, (await openCohort(C)).id]
    const q = await commerce.quote(u, later)
    expect(q.planCredit, 'قوصّ بمقعدٍ لم يعد له').toBe(0)
    /* سلّمُ دورتين وحدَه: ٣٠٠ − ٨٪ */
    expect(q.total).toBe(276)
  })

  it('وبلا خطّةٍ لا خصمَ إكمال — ولو اشترى من قبل', async () => {
    const u = await learner()
    const [A, B] = [nextCourse(), nextCourse()]
    await buy(u, [(await openCohort(A)).id])
    const q = await commerce.quote(u, [(await openCohort(B)).id])
    expect(q.planCredit).toBe(0)
    expect(q.total).toBe(150)
  })
})

describe('والطلبُ القديم بلا عمودٍ يُقرأ كما خُصم فعلا', () => {
  it('⚠️ طلبٌ قبل هذا العمود بكوبون: يُعاد حسابُ باقته — لا يُقاصّ بالكوبون', async () => {
    const u = await learner()
    const [A, B, C, D] = [nextCourse(), nextCourse(), nextCourse(), nextCourse()]
    await plans.adopt(u, { nameAr: 'خطّتي', composed: true, courseIds: [A, B, C, D] })
    const first = await buy(u, [(await openCohort(A)).id, (await openCohort(B)).id])
    /* كأنّه قبل العمود: لا `bundleDiscount`، وخصمُه الكلّيّ فيه كوبونٌ أيضا */
    const coupon = await prisma.coupon.create({ data: { code: `OLD${seq}${Date.now()}`, percentOff: 10 } })
    await prisma.order.update({ where: { id: first.orderId }, data: { bundleDiscount: null, couponId: coupon.id, discount: 51.6 } })

    const q = await commerce.quote(u, [(await openCohort(C)).id, (await openCohort(D)).id])
    /* الباقةُ المعادُ حسابُها ٢٤ لا الخصمُ الكلّيّ ٥١٫٦ — فالخصمُ ١٢٠ كما لو حُفظ */
    expect(q.planCredit).toBe(120)
  })
})
