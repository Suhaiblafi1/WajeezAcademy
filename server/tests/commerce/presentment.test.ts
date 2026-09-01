/* عملةُ البطاقة تتبدّل، ودفترُنا لا يتحرّك.

   قرارُ صاحب المنصّة: «يختار العملة فقط عند الدفع، وباقي الأسعار بالدولار
   وحتى بالمنصّات تكون بالدولار». فهذا الملفّ يحرس الحدَّ بين الاثنين:

   · الطلبُ والفاتورةُ يبقيان بالدولار مهما اختار المشتري — وإلّا صارت
     المحاسبةُ بعملاتٍ مختلطة، وهو ما يمنعه الخادمُ أصلا في الشعب.
   · والدفعةُ تُسجَّل بما اقتُطع فعلا — فلو سُجّلت بالدولار وقُبضت بالدرهم لم
     يبقَ في نظامنا أثرٌ للرقم الذي يراه المشتري في كشف بطاقته.

   ولماذا لا تدوير: خدمةُ العرض القديمة كانت تدوّر إلى أقرب خمسة ليبدو الرقم
   جميلا. وهو مقبولٌ في مُلصَقٍ تقريبيّ، ومحرَّمٌ فيما يُقتطع — الجميلُ هناك
   يعني أن يدفع المشتري غيرَ ما وُعد به. */

import { beforeAll, describe, expect, it } from 'vitest'
import type { PrismaClient } from '@prisma/client'
import { setupTestDb, testPrisma } from '../helpers/db'
import { AuthService } from '../../services/auth.service'
import { CommerceService } from '../../services/commerce.service'
import {
  PRESENTMENT_CURRENCIES, PRESENTMENT_CODES, convertFromUsd, isPresentmentCurrency,
} from '../../../src/application/commerce/presentment'

let prisma: PrismaClient
let commerce: CommerceService
let buyerId = ''
let cohortId = ''

beforeAll(async () => {
  await setupTestDb()
  prisma = await testPrisma()
  commerce = new CommerceService(prisma)
  const auth = new AuthService(prisma)
  buyerId = (await auth.register('presentment-buyer@test.local', 'Buyer#12345', 'مشترٍ')).userId
  cohortId = (await prisma.cohort.create({
    data: {
      courseId: 'C-BIZ-101', title: 'شعبة عملة العرض',
      status: 'open', registrationOpen: true, financialReady: true,
      price: 100, currency: 'USD', capacity: 50,
      startsAt: new Date(Date.now() + 30 * 86_400_000),
    },
  })).id
}, 180_000)

describe('أسعارُ الربط ثابتةٌ ورسميّة', () => {
  it('الدولارُ لا يُحوَّل', () => {
    expect(convertFromUsd(100, 'USD')).toBe(100)
  })

  /* الرقمان رسميّان: ٣٫٦٧٢٥ درهما و٣٫٧٥ ريالا للدولار. وثباتُهما هو سببُ
     اختيار هاتين العملتين دون العائمة — فلا يشيخ رقمٌ في الشيفرة. */
  it('الدرهمُ على ٣٫٦٧٢٥ — ومئةُ دولارٍ ٣٦٧٫٢٥ درهما', () => {
    expect(PRESENTMENT_CURRENCIES.AED.perUsd).toBe(3.6725)
    expect(convertFromUsd(100, 'AED')).toBe(367.25)
  })

  it('والريالُ على ٣٫٧٥ — ومئةُ دولارٍ ٣٧٥ ريالا', () => {
    expect(PRESENTMENT_CURRENCIES.SAR.perUsd).toBe(3.75)
    expect(convertFromUsd(100, 'SAR')).toBe(375)
  })

  it('ولا تدويرَ «جميل» — الكسرُ يبقى كما هو', () => {
    /* ١٢٥ × ٣٫٦٧٢٥ = ٤٥٩٫٠٦٢٥ → ٤٥٩٫٠٦ بالفلس، لا ٤٦٠ ولا ٤٥٥ */
    expect(convertFromUsd(125, 'AED')).toBe(459.06)
    expect(convertFromUsd(33, 'SAR')).toBe(123.75)
  })

  it('والقائمةُ ثلاثٌ مغلقة — والدينارُ خارجَها لأنّ الحساب لا يقبله', () => {
    expect(PRESENTMENT_CODES.sort()).toEqual(['AED', 'SAR', 'USD'])
    expect(isPresentmentCurrency('JOD')).toBe(false)
    expect(isPresentmentCurrency('EGP')).toBe(false)
  })
})

describe('الدفترُ بالدولار والبطاقةُ بما اختار', () => {
  it('الطلبُ والفاتورةُ بالدولار مهما كانت عملةُ العرض', async () => {
    const r = await commerce.checkout(buyerId, [cohortId])
    const order = await prisma.order.findUnique({ where: { id: r.orderId }, include: { invoice: true } })
    expect(order!.currency, 'عملةُ الطلب تبدّلت').toBe('USD')
    expect(order!.invoice!.currency, 'عملةُ الفاتورة تبدّلت').toBe('USD')
    expect(Number(order!.total)).toBe(100)
  })

  it('والدفعةُ تحمل ما اقتُطع فعلا — درهما لا دولارا', async () => {
    const order = await prisma.order.findFirst({ where: { userId: buyerId }, orderBy: { createdAt: 'desc' } })
    const pay = await commerce.payOrder(order!.id, buyerId, `pres-aed-${order!.id}`, 'AED')
    expect(pay.currency).toBe('AED')
    expect(Number(pay.amount)).toBe(367.25)

    /* والدفترُ لم يتحرّك بعد الدفع */
    const after = await prisma.order.findUnique({ where: { id: order!.id } })
    expect(after!.currency).toBe('USD')
    expect(Number(after!.total)).toBe(100)
  })
})
