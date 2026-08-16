/* إثبات حماية نقطة الدخول: قفل بعد 5 إخفاقات (429) وتحديد معدل صارم على المسار */

import { beforeAll, describe, expect, it } from 'vitest'
import type { PrismaClient } from '@prisma/client'
import type { FastifyInstance } from 'fastify'
import { setupTestDb, testPrisma } from '../helpers/db'
import { AuthService } from '../../services/auth.service'
import { buildApp } from '../../http/app'

let app: FastifyInstance
let prisma: PrismaClient

beforeAll(async () => {
  await setupTestDb()
  prisma = await testPrisma()
  const auth = new AuthService(prisma)
  await auth.register('throttle@test.local', 'Correct#12345', 'مختبَر')
  app = await buildApp(prisma)
}, 240_000)

describe('حماية الدخول من المحاولات المتكررة', () => {
  it('خمس إخفاقات تُقفل السادسة برمز 429 برسالة عربية واضحة', async () => {
    const statuses: number[] = []
    for (let i = 0; i < 6; i++) {
      const res = await app.inject({
        method: 'POST', url: '/api/auth/login',
        payload: { email: 'throttle@test.local', password: 'wrong-password' },
      })
      statuses.push(res.statusCode)
    }
    expect(statuses.slice(0, 5)).toEqual([401, 401, 401, 401, 401])
    expect(statuses[5]).toBe(429)
    const seventh = await app.inject({
      method: 'POST', url: '/api/auth/login',
      payload: { email: 'throttle@test.local', password: 'wrong-password' },
    })
    const body = JSON.parse(seventh.body) as { error?: { code?: string; message_ar?: string } }
    expect(body?.error?.code).toBe('too_many_attempts')
    expect(body?.error?.message_ar ?? '').toContain('محاولات كثيرة')
  })

  it('حتى كلمة المرور الصحيحة تُرفض أثناء القفل — لا التفاف حوله', async () => {
    const res = await app.inject({
      method: 'POST', url: '/api/auth/login',
      payload: { email: 'throttle@test.local', password: 'Correct#12345' },
    })
    expect(res.statusCode).toBe(429)
  })
})
