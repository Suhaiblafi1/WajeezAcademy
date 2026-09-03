/* المعروضُ هو المُصدَر — لا رقمان لسلّةٍ واحدة.

   كانت الواجهةُ تحسب ما تعرض والخادمُ يحسب ما يُصدر، فافترقا في ثلاثة
   مواضع: خصمُ الباقة لم يكن يُحسب أصلا، والهديّةُ رايةُ عرضٍ تُحاسَب بسعرها
   الكامل، والكوبونُ لا تُرسله الواجهة. والعلاجُ بنيويّ لا اتّفاقيّ:
   `quote` و`checkout` ينادِيان `priceCart` نفسَها بالمدخلات نفسِها.

   وهذا الملفّ يحرس ذلك على قاعدةٍ حقيقيّة لا على دالّةٍ منفردة: يسعّر، ثمّ
   يشتري، ثمّ يقرأ صفَّ الطلب من القاعدة — ويقارن الثلاثة.

   ويحرس معه شرطَ الهديّة: «ودورةٌ من اختيارك هديّة **داخل الخطّة**» — فمن
   اشترى الهديّةَ وحدَها دفع ثمنَها، وإلّا صارت بابا لأخذ أغلى دورةٍ مجّانا. */

import { beforeAll, describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import type { PrismaClient } from '@prisma/client'
import { setupTestDb, testPrisma } from '../helpers/db'
import { AuthService } from '../../services/auth.service'
import { CommerceService } from '../../services/commerce.service'
import { buildDiscountPct } from '../../../src/application/commerce/discount-policy'

/* المعرّفات من الكتالوج لا مكتوبةً يدا: دمجُ دورتين يُسقط معرّفا فتنكسر
   الاختباراتُ بـForeign key — حمرةٌ سببها معرّفٌ متقادم لا خللٌ في المقيس. */
const POOL: string[] = (
  JSON.parse(
    readFileSync(join(process.cwd(), 'src/data/catalog/core-catalog.v2.json'), 'utf8'),
  ) as { courses: { course_id: string }[] }
).courses.map((c) => c.course_id)

let prisma: PrismaClient
let commerce: CommerceService
let buyerId = ''
/** أربعُ شعبٍ بأسعارٍ مختلفة — فلو خُلط بندٌ ببندٍ ظهر الفرق */
const cohortIds: string[] = []
const courseIds: string[] = []
const PRICES = [100, 150, 200, 250]

beforeAll(async () => {
  await setupTestDb()
  prisma = await testPrisma()
  commerce = new CommerceService(prisma)
  const auth = new AuthService(prisma)
  buyerId = (await auth.register('quote-parity@test.local', 'Buyer#12345', 'مشترٍ')).userId

  for (let i = 0; i < 4; i += 1) {
    const courseId = POOL[40 + i]
    courseIds.push(courseId)
    const c = await prisma.cohort.create({
      data: {
        courseId, title: `شعبة تسعير ${i}`, status: 'open',
        registrationOpen: true, financialReady: true,
        price: PRICES[i], currency: 'USD', capacity: 30,
        startsAt: new Date(Date.now() + 45 * 86_400_000),
      },
    })
    cohortIds.push(c.id)
  }
}, 180_000)

describe('التسعيرُ المعروض هو المُصدَر', () => {
  it('لا يكتب `quote` شيئا — لا مقعدَ محجوزا ولا طلبا', async () => {
    const before = await prisma.order.count({ where: { userId: buyerId } })
    await commerce.quote(buyerId, cohortIds.slice(0, 3))
    expect(await prisma.order.count({ where: { userId: buyerId } })).toBe(before)
    expect(await prisma.enrollmentRequest.count({ where: { userId: buyerId } })).toBe(0)
  })

  it('ويطابق ما يكتبه `checkout` في القاعدة — رقما رقما', async () => {
    const ids = cohortIds.slice(0, 3)
    const q = await commerce.quote(buyerId, ids)
    /* ثلاثُ دورات: ١٠٠+١٥٠+٢٠٠ = ٤٥٠، وسلّمُ الثلاث ١٢٪ */
    expect(q.subtotal).toBe(450)
    expect(q.bundlePct).toBe(buildDiscountPct(3))
    expect(q.total).toBe(450 - 450 * buildDiscountPct(3) / 100)

    const done = await commerce.checkout(buyerId, ids)
    expect(done.subtotal).toBe(q.subtotal)
    expect(done.total).toBe(q.total)
    expect(done.bundlePct).toBe(q.bundlePct)

    const row = await prisma.order.findUnique({
      where: { id: done.orderId },
      include: { invoice: true, items: true },
    })
    expect(Number(row!.subtotal), 'صفُّ الطلب يخالف المعروض').toBe(q.subtotal)
    expect(Number(row!.discount)).toBe(q.discount)
    expect(Number(row!.total)).toBe(q.total)
    expect(Number(row!.invoice!.amount), 'الفاتورة تخالف الطلب').toBe(q.total)
    expect(row!.items).toHaveLength(3)
  })
})

/* ─────────── سلّةٌ فيها ما يملكه المشتري ───────────

   كان `quote` يرمي عند أوّل شعبةٍ يملكها أو حُجز مقعدُه فيها، فيسقط اللوحُ
   كلُّه: من اشترى دورةً من مسارٍ رباعيّ يرى رسالةَ خطأٍ وزرَّ دفعٍ مطفأً
   ولا سبيلَ له إلى الثلاث الباقية من موضع القرار نفسِه.

   فصار يُسعّر ما يُشترى ويسمّي ما استُبعد. و`checkout` يبقى صارما — وهو
   ما يمنع طلبا ثانيا فوق مقعدٍ دُفع ثمنُه. */
describe('السلّةُ لا تسقط بمانعٍ في بندٍ منها', () => {
  let partial = ''
  let ownedCohort = ''
  let heldCohort = ''
  let freeCohorts: string[] = []

  beforeAll(async () => {
    const auth = new AuthService(prisma)
    partial = (await auth.register('partial-cart@test.local', 'Buyer#12345', 'مالكُ بعضِها')).userId

    /* أربعُ شعبٍ جديدة لهذا المشتري وحدَه — فلا يخلط حالتُه بحالة غيره */
    const made: string[] = []
    for (let i = 0; i < 4; i += 1) {
      const c = await prisma.cohort.create({
        data: {
          courseId: POOL[50 + i], title: `شعبة جزئيّة ${i}`, status: 'open',
          registrationOpen: true, financialReady: true,
          price: PRICES[i], currency: 'USD', capacity: 30,
          startsAt: new Date(Date.now() + 45 * 86_400_000),
        },
      })
      made.push(c.id)
    }
    ownedCohort = made[0]   // مسجَّلٌ فيها فعلا
    heldCohort = made[1]    // مقعدُه محجوزٌ بطلبٍ حيّ
    freeCohorts = [made[2], made[3]]

    await prisma.enrollment.create({ data: { cohortId: ownedCohort, userId: partial, status: 'enrolled' } })
    /* حجزٌ مربوطٌ بطلبٍ لم يكتمل دفعُه — كحال من غادر صفحة الدفع */
    const order = await prisma.order.create({
      data: { userId: partial, subtotal: 150, total: 150, currency: 'USD' },
    })
    await prisma.enrollmentRequest.create({
      data: { userId: partial, cohortId: heldCohort, status: 'seat_held', orderId: order.id, decidedAt: new Date() },
    })
  })

  it('يُسعَّر ما يُشترى، ويُسمّى ما استُبعد وسببُه', async () => {
    const q = await commerce.quote(partial, [ownedCohort, heldCohort, ...freeCohorts])

    /* البندان الحرّان وحدَهما في التسعير: ٢٠٠+٢٥٠ */
    expect(q.items.map((i) => i.cohortId).sort()).toEqual([...freeCohorts].sort())
    expect(q.subtotal).toBe(450)
    expect(q.bundlePct, 'سلّمُ الباقة حُسب على المستبعَد أيضا').toBe(buildDiscountPct(2))
    expect(q.total).toBe(450 - (450 * buildDiscountPct(2)) / 100)

    const reasons = new Map(q.excluded.map((e) => [e.cohortId, e.reason]))
    expect(reasons.get(ownedCohort)).toBe('already_enrolled')
    expect(reasons.get(heldCohort)).toBe('order_pending')
    for (const e of q.excluded) {
      expect(e.messageAr.length, 'استُبعد بلا سببٍ يُقرأ').toBeGreaterThan(5)
      expect(e.titleAr.length).toBeGreaterThan(0)
      expect(e.courseId.length).toBeGreaterThan(0)
    }
  })

  it('ويُشترى الباقي فعلا — والفاتورةُ بما عُرض لا بما طُلب', async () => {
    const q = await commerce.quote(partial, [ownedCohort, heldCohort, ...freeCohorts])
    /* اللوحُ يُرسل ما سعّره الخادمُ لا ما اختاره هو */
    const done = await commerce.checkout(partial, q.items.map((i) => i.cohortId))
    expect(done.total).toBe(q.total)
    expect(done.items).toHaveLength(2)

    const row = await prisma.order.findUnique({
      where: { id: done.orderId }, include: { invoice: true, items: true },
    })
    expect(Number(row!.total)).toBe(q.total)
    expect(Number(row!.invoice!.amount)).toBe(q.total)
    expect(row!.items.map((i) => i.refId).sort()).toEqual([...freeCohorts].sort())

    /* والحجزُ القائمُ لم يُمسّ: طلبُه الأوّل يبقى قابلا للتسوية */
    const hold = await prisma.enrollmentRequest.findFirst({ where: { userId: partial, cohortId: heldCohort } })
    expect(hold?.status).toBe('seat_held')
  })

  it('و`checkout` يبقى صارما: لا طلبَ فوق مقعدٍ مملوك', async () => {
    /* شعبةٌ حرّةٌ طازجة لكلّ حالة — فالسببُ المرميّ يكون سببَ البند المقصود
       لا سببَ بندٍ آخر صادف أن سبقه في ترتيب القراءة. */
    const fresh = async (i: number) =>
      (await prisma.cohort.create({
        data: {
          courseId: POOL[60 + i], title: `شعبة صرامة ${i}`, status: 'open',
          registrationOpen: true, financialReady: true,
          price: 120, currency: 'USD', capacity: 30,
          startsAt: new Date(Date.now() + 45 * 86_400_000),
        },
      })).id

    await expect(commerce.checkout(partial, [ownedCohort, await fresh(0)]))
      .rejects.toMatchObject({ code: 'already_enrolled' })
    await expect(commerce.checkout(partial, [heldCohort, await fresh(1)]))
      .rejects.toMatchObject({ code: 'order_pending' })
  })

  it('وسلّةٌ كلُّها مملوكة تُسعَّر بصفرٍ وتُسمّي كلَّ بندٍ — بلا خطأ', async () => {
    const q = await commerce.quote(partial, [ownedCohort, heldCohort])
    expect(q.items).toHaveLength(0)
    expect(q.total).toBe(0)
    expect(q.excluded).toHaveLength(2)
    expect(q.currency, 'عملةٌ مجهولةٌ في سلّةٍ فارغة').toBe('USD')
  })
})

describe('الهديّةُ تأتي مع الخطّة لا وحدَها', () => {
  let giftBuyer = ''

  beforeAll(async () => {
    const auth = new AuthService(prisma)
    giftBuyer = (await auth.register('gift-buyer@test.local', 'Buyer#12345', 'صاحبُ خطّة')).userId
    /* خطّةٌ من أربعِ دورات، أغلاها (٢٥٠) هديّة */
    await prisma.learnerPlan.create({
      data: {
        userId: giftBuyer, nameAr: 'خطّتي', composed: false,
        giftCourseId: courseIds[3],
        items: { create: courseIds.map((courseId, i) => ({ courseId, sequence: i + 1 })) },
      },
    })
  })

  it('من اشترى الهديّةَ وحدَها دفع ثمنَها — وإلّا صارت بابا لأغلى دورةٍ مجّانا', async () => {
    const q = await commerce.quote(giftBuyer, [cohortIds[3]])
    expect(q.items[0].isGift, 'مُنحت الهديّةُ لمن لم يشترِ خطّته').toBe(false)
    expect(q.total).toBe(250)
  })

  it('ومن اشترى خطّتَه كاملةً نالها بصفر — والبندُ باقٍ في الفاتورة', async () => {
    const q = await commerce.quote(giftBuyer, cohortIds)
    const gift = q.items.find((i) => i.courseId === courseIds[3])!
    expect(gift.isGift).toBe(true)
    expect(gift.unitPrice).toBe(0)
    expect(gift.listPrice, 'سعرُ القائمة اختفى، فلا يُرى ما وُفِّر').toBe(250)
    expect(q.items, 'الهديّةُ حُذفت من البنود').toHaveLength(4)

    /* الثلاثُ المدفوعة ٤٥٠، وسلّمُها سلّمُ الثلاث لا الأربع */
    expect(q.subtotal).toBe(450)
    expect(q.bundlePct).toBe(buildDiscountPct(3))
    expect(q.listTotal).toBe(700)
  })

  it('ونقصُ دورةٍ واحدة من الخطّة يُسقط الهديّة — «داخل الخطّة» شرطٌ لا وصف', async () => {
    const q = await commerce.quote(giftBuyer, [cohortIds[0], cohortIds[1], cohortIds[3]])
    expect(q.items.every((i) => !i.isGift)).toBe(true)
    expect(q.total).toBe((100 + 150 + 250) * (100 - buildDiscountPct(3)) / 100)
  })

  /* دورةٌ دُفع ثمنُها ولم يصل تأكيدُها: صارت تُستبعد من السلّة (فلا يُدفع
     ثمنُها مرّتين)، فلو لم تُحتسب مغطّاةً لسقطت الهديّةُ في الدقائق التي
     بين الدفع وتأكيده — ويُسعَّر على المشتري الباقي بأغلى ممّا وُعد. */
  it('ودورةٌ دُفع ثمنُها ولم تُسوَّ بعد تُحتسب مغطّاة — فلا تسقط الهديّةُ بتأخّر webhook', async () => {
    const paid = await prisma.order.create({
      data: { userId: giftBuyer, status: 'paid', subtotal: 100, total: 100, currency: 'USD', paidAt: new Date() },
    })
    await prisma.enrollmentRequest.create({
      data: { userId: giftBuyer, cohortId: cohortIds[0], status: 'seat_held', orderId: paid.id, decidedAt: new Date() },
    })

    const q = await commerce.quote(giftBuyer, cohortIds)
    /* المدفوعةُ خارج التسعير — ومقالٌ سببُها */
    expect(q.items.map((i) => i.cohortId)).not.toContain(cohortIds[0])
    expect(q.excluded.find((e) => e.cohortId === cohortIds[0])?.reason).toBe('settling')

    /* والهديّةُ باقية: خطّتُه كلُّها بين مشتراةٍ الآن ومدفوعةٍ من قبل */
    const gift = q.items.find((i) => i.courseId === courseIds[3])
    expect(gift?.isGift, 'سقطت الهديّةُ لأنّ تأكيد الدفع تأخّر').toBe(true)
    expect(gift?.unitPrice).toBe(0)
    /* المدفوعُ ثمنُه الآن: ١٥٠+٢٠٠ وسلّمُ الاثنتين */
    expect(q.subtotal).toBe(350)
    expect(q.bundlePct).toBe(buildDiscountPct(2))

    /* وطلبٌ لم يكتمل دفعُه لا يكفي — وإلّا صار فتحُه وإلغاؤه بابا للهديّة */
    await prisma.order.update({ where: { id: paid.id }, data: { status: 'pending_payment', paidAt: null } })
    const q2 = await commerce.quote(giftBuyer, cohortIds)
    expect(q2.items.every((i) => !i.isGift), 'مُنحت الهديّةُ على طلبٍ لم يُدفع').toBe(true)
  })
})
