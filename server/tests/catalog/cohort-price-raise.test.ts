/* رفعُ أسعار الشعب القائمة ١٠٪ مع سعر القائمة — مرّةً، بلا إعلان (١٧ نوفمبر ٢٠٢٦). والعلّةُ في رأس
   `server/services/cohort-price-raise.service.ts`.

   ① ما سعرُه درجةٌ من السلّم القديم بالدولار يرتفع بالسلّم الجديد — ١٧٠←١٨٥ و٢٥٥←٢٨٠.
   ② ولا يُمسّ: ما فيه مقعدٌ محجوزٌ أو مدفوع، وما سُعّر بيدٍ بغير السلّم، والمنتهي، وغيرُ الدولار.
   ③ ومرّةً واحدةً بأثرٍ يقول كم — ولا بريدَ يخرج. */

import { beforeAll, describe, expect, it } from 'vitest'
import type { PrismaClient } from '@prisma/client'
import { setupTestDb, testPrisma } from '../helpers/db'
import { AuthService } from '../../services/auth.service'
import { applyCohortPriceRaise, PRICE_RAISE_ACTION } from '../../services/cohort-price-raise.service'

let prisma: PrismaClient
let courseId = ''
let userId = ''
let seq = 0

beforeAll(async () => {
  await setupTestDb()
  prisma = await testPrisma()
  courseId = (await prisma.course.findFirstOrThrow({ where: { status: 'published' }, select: { id: true } })).id
  userId = (await new AuthService(prisma).register(`raise-${Date.now()}@test.local`, 'Learner#12345', 'متعلم')).userId
}, 240_000)

async function cohort(price: number | null, status = 'open', currency = 'USD') {
  return prisma.cohort.create({ data: { courseId, title: `شعبة الرفع ${++seq}`, status, price, currency } as never })
}
const priceOf = async (id: string) => Number((await prisma.cohort.findUniqueOrThrow({ where: { id }, select: { price: true } })).price)

describe('رفع أسعار الشعب القائمة ١٠٪', () => {
  it('⚠️ السلّم القديم يرتفع، وما فيه مقعد أو سُعّر بيد أو انتهى لا يُمسّ — مرّة واحدة بلا بريد', async () => {
    const a = await cohort(170)
    const b = await cohort(255, 'draft')
    const c = await cohort(100, 'active')
    const held = await cohort(150)
    await prisma.enrollmentRequest.create({ data: { userId, cohortId: held.id, status: 'seat_held' } })
    const custom = await cohort(133)
    const done = await cohort(190, 'completed')
    const jod = await cohort(170, 'open', 'JOD')
    const mails = await prisma.outboxMail.count()
    /* وملفٌّ قبله في العامل نفسِه قد أدار وظيفةَ المنح فرفع مرّتَه — فتُمحى ليُرى الرفعُ هنا (`helpers/db.ts`) */
    await prisma.auditEvent.deleteMany({ where: { action: PRICE_RAISE_ACTION } })

    const r = await applyCohortPriceRaise(prisma)
    expect(r, 'لم يرفع').not.toBeNull()
    expect(await priceOf(a.id)).toBe(185)
    expect(await priceOf(b.id)).toBe(280)
    expect(await priceOf(c.id)).toBe(110)
    expect(await priceOf(held.id), 'رفع شعبة فيها مقعد محجوز').toBe(150)
    expect(await priceOf(custom.id), 'رفع سعرا بيد').toBe(133)
    expect(await priceOf(done.id), 'رفع شعبة منتهية').toBe(190)
    expect(await priceOf(jod.id), 'رفع غير الدولار').toBe(170)
    expect(r!.skippedCommitted).toBeGreaterThanOrEqual(1)
    expect(await prisma.outboxMail.count(), 'خرج بريد').toBe(mails)
    expect(await prisma.auditEvent.count({ where: { action: PRICE_RAISE_ACTION } })).toBe(1)

    expect(await applyCohortPriceRaise(prisma), 'رفع مرتين').toBeNull()
    expect(await priceOf(a.id), 'رفع مرتين').toBe(185)
  })
})
