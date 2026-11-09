/* رقمُ واتساب في نموذج التسجيل — اختياريّ (٩ نوفمبر ٢٠٢٦).

   طلبُ صاحب المنصّة: «add whatsApp phone number to the signup form»، واختار «Optional». والمقيس:
   ① **الرقمُ يُحفظ في ملفّه بصيغةٍ واحدة** — فيظهر في ملفّ «من أنشأ حسابا ولم يسجل» (`signed-up-export.ts`).
   ② **وغيابُه لا يُسقط التسجيل** — اختياريّ.
   ③ **وما ليس رقما يُردّ قبل إنشاء الحساب** — فلا يُنشأ حسابٌ ويضيع رقمُه بصمت. */

import { beforeAll, describe, expect, it } from 'vitest'
import type { PrismaClient } from '@prisma/client'
import type { FastifyInstance } from 'fastify'
import { setupTestDb, testPrisma } from '../helpers/db'
import { buildApp } from '../../http/app'

let prisma: PrismaClient
let app: FastifyInstance
const S = Date.now()

const register = (email: string, phone?: string) => app.inject({
  method: 'POST', url: '/api/auth/register', remoteAddress: '10.9.11.9',
  payload: { email, password: 'Pass#12345', displayName: 'متعلم', ...(phone !== undefined ? { phone } : {}) },
})
const profilePhone = async (email: string) =>
  (await prisma.user.findUnique({ where: { email }, select: { learnerProfile: { select: { phone: true } } } }))?.learnerProfile?.phone ?? null

beforeAll(async () => {
  await setupTestDb()
  prisma = await testPrisma()
  app = await buildApp(prisma)
}, 240_000)

describe('رقم واتساب عند التسجيل', () => {
  it('① يُحفظ في ملفّه بصيغةٍ واحدة — أرقامٌ عربيّة ومسافاتٌ و00', async () => {
    const email = `wa-yes-${S}@example.com`
    const res = await register(email, '00962 ٧٩٠ ١٢٣ ٤٥٦')
    expect(res.statusCode, res.body).toBe(201)
    expect(await profilePhone(email)).toBe('+962790123456')
  })

  it('② وبلا رقمٍ يمضي التسجيل', async () => {
    const email = `wa-no-${S}@example.com`
    const res = await register(email)
    expect(res.statusCode, res.body).toBe(201)
    expect(await profilePhone(email)).toBeNull()
  })

  it('③ وما ليس رقما يُردّ ولا يُنشأ الحساب', async () => {
    const email = `wa-bad-${S}@example.com`
    const res = await register(email, 'اتصل بي')
    expect(res.statusCode).toBe(400)
    expect(res.json().error?.code).toBe('invalid_phone')
    expect(await prisma.user.findUnique({ where: { email } })).toBeNull()
  })
})
