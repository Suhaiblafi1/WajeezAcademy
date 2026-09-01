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
})
