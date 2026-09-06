/* اختبار مسار تبديل أدوار الديمو:
   - يرفض 404 عندما DEMO_MODE غير مفعّل (حماية خادمية — مستحيل في الإنتاج).
   - ينجح عند التفعيل وينشئ جلسة حقيقية بكوكي httpOnly تفتح بوابة الدور.
   - /status يعكس العلامة بصدق. */

import { afterEach, beforeAll, describe, expect, it } from 'vitest'
import type { PrismaClient } from '@prisma/client'
import type { FastifyInstance } from 'fastify'
import { setupTestDb, testPrisma } from '../helpers/db'
import { buildApp } from '../../http/app'
import { seedDemo, DEMO_ACCOUNTS } from '../../db/seed-demo'

let prisma: PrismaClient
let app: FastifyInstance

beforeAll(async () => {
  await setupTestDb()
  prisma = await testPrisma()
  await seedDemo(prisma)
  app = await buildApp(prisma)
})

afterEach(() => {
  delete process.env.DEMO_MODE
  delete process.env.APP_ENV
  process.env.NODE_ENV = savedNodeEnv
})

const savedNodeEnv = process.env.NODE_ENV ?? 'test'

describe('مسار تبديل أدوار الديمو', () => {
  it('يرفض 404 عند غياب DEMO_MODE — حتى لدور صالح', async () => {
    const res = await app.inject({ method: 'POST', url: '/api/demo/switch-role', payload: { role: 'student' } })
    expect(res.statusCode).toBe(404)
  })

  it('/status يعيد enabled=false بدون العلامة', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/demo/status' })
    expect(res.json()).toEqual({ enabled: false })
  })

  it('/status يعيد enabled=true مع العلامة', async () => {
    process.env.DEMO_MODE = 'true'
    const res = await app.inject({ method: 'GET', url: '/api/demo/status' })
    expect(res.json()).toEqual({ enabled: true })
  })

  it('ينشئ جلسة ديمو حقيقية لكل دور من الأدوار التسعة', async () => {
    process.env.DEMO_MODE = 'true'
    for (const account of DEMO_ACCOUNTS) {
      const res = await app.inject({ method: 'POST', url: '/api/demo/switch-role', payload: { role: account.key } })
      expect(res.statusCode, `دور ${account.key}`).toBe(200)
      const cookie = res.cookies.find((c) => c.name === 'wajeez_session')
      expect(cookie?.value, `كوكي ${account.key}`).toBeTruthy()
      const body = res.json() as { user: { roles: string[] } }
      expect(body.user.roles).toEqual(expect.arrayContaining([...account.roles]))
    }
  })

  it('الجلسة المديموهة تفتح بوابة المتعلم فعلا', async () => {
    process.env.DEMO_MODE = 'true'
    const login = await app.inject({ method: 'POST', url: '/api/demo/switch-role', payload: { role: 'student' } })
    const cookie = login.cookies.find((c) => c.name === 'wajeez_session')!
    const portal = await app.inject({ method: 'GET', url: '/api/learner/my-learning', cookies: { wajeez_session: cookie.value } })
    expect(portal.statusCode).toBe(200)
  })

  it('يرفض دورا غير معروف حتى في وضع الديمو', async () => {
    process.env.DEMO_MODE = 'true'
    const res = await app.inject({ method: 'POST', url: '/api/demo/switch-role', payload: { role: 'hacker' } })
    expect(res.statusCode).toBe(400)
  })

  /* ── الطبقة الثالثة: النشر الإنتاجيّ يغلبُ العلم ──

     العلم ضُبط على Production فعلا في ٢٤ آب، فبقي `/api/demo/switch-role`
     يستقبل على الإنترنت ستّة أيّام — ولو كانت حسابات الديمو مزروعةً هناك
     لسلّم جلسةَ super_admin لكلّ طارق. فالحارس لا يسأل من ضبط العلم. */

  it('يرفض ٤٠٤ على نشرٍ إنتاجيٍّ بـAPP_ENV رغم ضبط DEMO_MODE', async () => {
    process.env.DEMO_MODE = 'true'
    process.env.APP_ENV = 'production'
    const res = await app.inject({ method: 'POST', url: '/api/demo/switch-role', payload: { role: 'superadmin' } })
    expect(res.statusCode).toBe(404)
    expect(res.headers['set-cookie']).toBeUndefined()
  })

  it('يرفض ٤٠٤ على استضافةٍ ذاتيّة بـNODE_ENV=production رغم ضبط DEMO_MODE', async () => {
    process.env.DEMO_MODE = 'true'
    process.env.NODE_ENV = 'production'
    const res = await app.inject({ method: 'POST', url: '/api/demo/switch-role', payload: { role: 'superadmin' } })
    expect(res.statusCode).toBe(404)
    expect(res.headers['set-cookie']).toBeUndefined()
  })

  it('/status يصدُق: enabled=false في الإنتاج مهما ضُبط العلم', async () => {
    process.env.DEMO_MODE = 'true'
    process.env.APP_ENV = 'production'
    const res = await app.inject({ method: 'GET', url: '/api/demo/status' })
    expect(res.json()).toEqual({ enabled: false })
  })
})
