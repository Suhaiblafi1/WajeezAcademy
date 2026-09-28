/* رقمُ الفاتورة لا يتسابق عليه شراءان — ولا يصطدم برقمٍ محجوز.

   كان `count + 1` يُقرأ في كلّ معاملةٍ وحدَها: شراءان في اللحظة نفسِها يكتبان
   الرقمَ نفسَه، فيسقط الثاني بخطأ فرادةٍ خامٍ ويضيع طلبُه ومقعدُه. ورقمٌ فوق
   العدد (فاتورةٌ حُذفت، أو رقمٌ كُتب خارج التسلسل) يجعل كلَّ شراءٍ بعده يصطدم.

   ① شراءاتٌ متزامنةٌ كلُّها تمرّ، بأرقامٍ متتاليةٍ لا تتكرّر.
   ② ورقمٌ محجوزٌ عند `count + 1` يُتخطّى إلى ما بعده.
   ③ والتسلسلُ هو القائم: لا قفزةَ في الدفتر، والصيغةُ `WJ-INV-السنة-#####`. */

import { beforeAll, describe, expect, it } from 'vitest'
import type { PrismaClient } from '@prisma/client'
import { setupTestDb, testPrisma } from '../helpers/db'
import { AuthService } from '../../services/auth.service'
import { CommerceService } from '../../services/commerce.service'

let prisma: PrismaClient
let auth: AuthService
let commerce: CommerceService
let cohortId = ''
const STAMP = Date.now()
const YEAR = new Date().getFullYear()
const pad = (n: number) => `WJ-INV-${YEAR}-${String(n).padStart(5, '0')}`
const learner = async (tag: string) => (await auth.register(`inv-${tag}-${STAMP}@test.local`, 'Learner#12345', `متعلّم ${tag}`)).userId
const invoiceOf = async (orderId: string) => (await prisma.invoice.findUniqueOrThrow({ where: { orderId } })).number

beforeAll(async () => {
  await setupTestDb()
  prisma = await testPrisma()
  auth = new AuthService(prisma)
  commerce = new CommerceService(prisma)
  const course = await prisma.course.findFirstOrThrow({ select: { id: true } })
  cohortId = (await prisma.cohort.create({
    data: {
      courseId: course.id, title: 'شعبةُ الفواتير', status: 'open', registrationOpen: true,
      financialReady: true, price: 100, currency: 'USD', capacity: 50,
    },
  })).id
}, 240_000)

describe('رقمُ الفاتورة', () => {
  it('① ⚠️ شراءاتٌ متزامنةٌ كلُّها تمرّ — بأرقامٍ متتاليةٍ لا تتكرّر', async () => {
    const before = await prisma.invoice.count()
    const buyers = await Promise.all(['a', 'b', 'c', 'd', 'e'].map(learner))
    const results = await Promise.allSettled(buyers.map((u) => commerce.checkout(u, [cohortId])))
    const failed = results.filter((r) => r.status === 'rejected') as PromiseRejectedResult[]
    expect(failed.map((f) => String(f.reason?.code ?? f.reason)), 'سقط شراءٌ على رقم الفاتورة').toEqual([])

    const numbers = await Promise.all(
      (results as PromiseFulfilledResult<{ orderId: string }>[]).map((r) => invoiceOf(r.value.orderId)),
    )
    expect(new Set(numbers).size, 'رقمٌ تكرّر').toBe(numbers.length)
    /* ③ والتسلسلُ هو القائم: العددُ ثمّ واحد، بلا قفزة */
    expect([...numbers].sort()).toEqual([1, 2, 3, 4, 5].map((i) => pad(before + i)))
  })

  it('② ⚠️ ورقمٌ محجوزٌ عند العدد يُتخطّى — لا يصطدم به كلُّ شراءٍ بعده', async () => {
    const count = await prisma.invoice.count()
    /* رقمٌ كُتب فوق العدد بواحد: بعد كتابته يصير `count + 1` هو إيّاه */
    const owner = await learner('manual')
    const order = await prisma.order.create({ data: { userId: owner, subtotal: 1, total: 1, currency: 'USD' } })
    await prisma.invoice.create({ data: { number: pad(count + 2), orderId: order.id, amount: 1, currency: 'USD' } })

    const buyer = await learner('after')
    const out = await commerce.checkout(buyer, [cohortId])
    expect(await invoiceOf(out.orderId), 'اصطدم الشراءُ بالرقم المحجوز').toBe(pad(count + 3))
  })
})
