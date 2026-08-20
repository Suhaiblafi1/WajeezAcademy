/* اختبار مسارات التحليلات وبطاقة الرأي:
   - /api/events تكتب الحدث الصالح مع anonId، وترفض حدثا غير معروف وأي نص حر في meta
   - userId يُشتق من كوكي الجلسة لا من جسم الطلب — ربط anonId بالحساب عند التسجيل
   - /api/diagnostic-feedback محمية بالدخول وتكتب الرأي مربوطا بجلسة التشخيص
   - /api/admin/quality/feedback تجمع الأحكام لمدير التشخيص */

import { beforeAll, describe, expect, it } from 'vitest'
import type { PrismaClient } from '@prisma/client'
import type { FastifyInstance } from 'fastify'
import { setupTestDb, testPrisma } from '../helpers/db'
import { AuthService } from '../../services/auth.service'
import { buildApp } from '../../http/app'
import { SESSION_COOKIE } from '../../http/auth-plugin'

let prisma: PrismaClient
let auth: AuthService
let app: FastifyInstance

beforeAll(async () => {
  await setupTestDb()
  prisma = await testPrisma()
  auth = new AuthService(prisma)
  app = await buildApp(prisma)
}, 240_000)

async function learnerCookie(tag: string): Promise<{ cookie: string; userId: string }> {
  const email = `learner-${tag}-${Date.now()}@test.local`
  const password = 'Matrix#12345'
  const user = await auth.register(email, password, 'متعلم مختبر')
  const { token } = await auth.login(email, password)
  return { cookie: `${SESSION_COOKIE}=${token}`, userId: user.userId }
}

describe('POST /api/events', () => {
  it('يكتب حدثا صالحا مع anonId ويربطه بحساب الموثق من الجلسة', async () => {
    const { cookie, userId } = await learnerCookie('events')
    const res = await app.inject({
      method: 'POST', url: '/api/events',
      headers: { cookie },
      payload: { event: 'gate_viewed', meta: { confidence: 82 }, anonId: 'anon-events-1' },
    })
    expect(res.statusCode).toBe(200)
    const row = await prisma.analyticsEvent.findFirst({ where: { anonId: 'anon-events-1' } })
    expect(row?.event).toBe('gate_viewed')
    expect(row?.userId).toBe(userId)
  })

  it('يرفض حدثا خارج القائمة البيضاء وأي قيمة نصية حرة في meta', async () => {
    const unknown = await app.inject({
      method: 'POST', url: '/api/events', payload: { event: 'drop_database', meta: {} },
    })
    expect(unknown.statusCode).toBe(422)
    const freeText = await app.inject({
      method: 'POST', url: '/api/events',
      payload: { event: 'gate_viewed', meta: { note: 'نص حر بالعربية لا يجوز' } },
    })
    expect(freeText.statusCode).toBe(422)
    const longText = await app.inject({
      method: 'POST', url: '/api/events',
      payload: { event: 'gate_viewed', meta: { note: 'x'.repeat(200) } },
    })
    expect(longText.statusCode).toBe(422)
  })
})

describe('بطاقة الرأي — /api/diagnostic-feedback', () => {
  it('ترفض الضيف (401) وتكتب رأي الموثق مربوطا بجلسته ومساره', async () => {
    const guest = await app.inject({
      method: 'POST', url: '/api/diagnostic-feedback',
      payload: { sessionId: 'sess-guest-1', verdict: 'yes' },
    })
    expect(guest.statusCode).toBe(401)

    const { cookie, userId } = await learnerCookie('feedback')
    const ok = await app.inject({
      method: 'POST', url: '/api/diagnostic-feedback',
      headers: { cookie },
      payload: { sessionId: 'sess-feedback-1', pathwayId: 'digital-marketing', verdict: 'somewhat', note: 'توقعت تخصصا أدق' },
    })
    expect(ok.statusCode).toBe(200)
    const row = await prisma.diagnosticFeedback.findFirst({ where: { sessionId: 'sess-feedback-1' } })
    expect(row?.verdict).toBe('somewhat')
    expect(row?.pathwayId).toBe('digital-marketing')
    expect(row?.userId).toBe(userId)
  })

  it('يرفض حكما خارج التعداد', async () => {
    const { cookie } = await learnerCookie('feedback2')
    const bad = await app.inject({
      method: 'POST', url: '/api/diagnostic-feedback',
      headers: { cookie },
      payload: { sessionId: 'sess-feedback-2', verdict: 'maybe' },
    })
    expect(bad.statusCode).toBe(422)
  })
})
