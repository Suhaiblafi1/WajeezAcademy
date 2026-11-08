/* مدّةُ التقارير بتوقيت عمّان، وترشيحُ الدورة برمزها (٨ نوفمبر ٢٠٢٦) — والعلّةُ في `reports.routes.ts` و`reports.service.ts`.

   ① **«من ١ نوفمبر إلى ٣٠ نوفمبر» يشمل الثلاثين كلَّه، ويبدأ الأوّلَ من منتصف ليل عمّان** — كان يُسقط اليومَ الأخير، ويبدأ اليومَ
      في الثالثة فجرا بعمّان. فدفعاتُ الشهر الثلاث هنا لم يظهر منها شيء.
   ② **والشهرُ شهرُ عمّان** — دفعةُ أوّل ديسمبر فجرا كانت تُعدّ في نوفمبر.
   ③ **والدورةُ برمزها** — كان الحقلُ يطلب معرّفا عشوائيّا فيُردّ كلُّ ترشيحٍ بدورة. */

import { beforeAll, describe, expect, it } from 'vitest'
import type { PrismaClient } from '@prisma/client'
import type { FastifyInstance } from 'fastify'
import { setupTestDb, testPrisma } from '../helpers/db'
import { AuthService } from '../../services/auth.service'
import { buildApp } from '../../http/app'
import { SESSION_COOKIE } from '../../http/auth-plugin'

let prisma: PrismaClient
let app: FastifyInstance
let cookie = ''
let seq = 0

/** فاتورةٌ مدفوعةٌ بمئة دولار في لحظةٍ بعينها */
const paidAt = async (userId: string, at: string) => {
  seq += 1
  const order = await prisma.order.create({ data: { userId, status: 'paid', currency: 'USD', total: 100, subtotal: 100 } as never })
  await prisma.invoice.create({ data: { orderId: order.id, number: `RR-${seq}-${Date.now()}`, amount: 100, currency: 'USD', status: 'paid', paidAt: new Date(at) } as never })
}
const revenue = async (query: string) => {
  const res = await app.inject({ method: 'GET', url: `/api/admin/reports/revenue${query}`, headers: { cookie } })
  expect(res.statusCode).toBe(200)
  return Object.fromEntries((res.json().rows as { monthCurrency: string; revenue: number }[]).map((r) => [r.monthCurrency, r.revenue]))
}

beforeAll(async () => {
  await setupTestDb()
  prisma = await testPrisma()
  const auth = new AuthService(prisma)
  const admin = await auth.register('rr-admin@test.local', 'Admin#12345', 'المدير')
  await auth.setRoles(admin.userId, ['super_admin'])
  cookie = `${SESSION_COOKIE}=${(await auth.login('rr-admin@test.local', 'Admin#12345')).token}`
  const buyer = (await auth.register('rr-buyer@test.local', 'Learn#12345', 'مشتر')).userId
  await paidAt(buyer, '2026-10-31T22:30:00Z') // أوّل نوفمبر ١:٣٠ فجرا بعمّان
  await paidAt(buyer, '2026-11-30T12:00:00Z') // ٣٠ نوفمبر ٣ عصرا بعمّان
  await paidAt(buyer, '2026-11-30T22:30:00Z') // أوّل ديسمبر ١:٣٠ فجرا بعمّان
  app = await buildApp(prisma)
}, 240_000)

describe('① المدة أيام عمان كاملة', () => {
  it('⚠️ من ١ إلى ٣٠ نوفمبر: أول يوم من منتصف ليله، وآخر يوم كله — ولا شيء من ديسمبر', async () => {
    expect(await revenue('?from=2026-11-01&to=2026-11-30'), 'أسقط أول الشهر أو آخره').toEqual({ '2026-11 USD': 200 })
  })

  it('ويوم واحد يشمل ساعاته كلها', async () => {
    expect(await revenue('?from=2026-11-30&to=2026-11-30')).toEqual({ '2026-11 USD': 100 })
  })

  it('وتاريخ لا يقرأ يرد ٤٢٢ لا خطأ خادم', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/admin/reports/revenue?from=not-a-day', headers: { cookie } })
    expect(res.statusCode).toBe(422)
  })
})

describe('② والشهر شهر عمان', () => {
  it('⚠️ دفعة أول ديسمبر فجرا في ديسمبر، وأول نوفمبر فجرا في نوفمبر', async () => {
    expect(await revenue(''), 'جمع الأشهر بغرينتش').toEqual({ '2026-11 USD': 200, '2026-12 USD': 100 })
  })
})

describe('③ والدورة برمزها', () => {
  it('⚠️ ترشيح الدورات والشعب برمز الدورة يمضي', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/admin/reports/courses-cohorts?courseId=C-BIZ-101', headers: { cookie } })
    expect(res.statusCode, 'رد الترشيح برمز الدورة').toBe(200)
  })
})
