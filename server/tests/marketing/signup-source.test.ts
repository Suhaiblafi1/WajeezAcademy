/* مصدرُ التسجيل على قاعدةٍ حقيقيّة (٢٦ أكتوبر ٢٠٢٦).

   سؤالُ صاحب المنصّة: «كيف أعلم هذا المتعلّم من أين وصل وكيف وصل؟». والمقيس:
   ① **التسجيلُ يحفظه** — ما أرسله المتصفّح، منظَّفا.
   ② **وما ليس وسما لا يُكتب**، وغيابُه لا يُسقط التسجيل.
   ③ **وقائمةُ المستخدمين تسمّيه** — ورابطُ المدرّب بصاحبه، ومن أضافه مدير يُقال. */

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
let adminCookie = ''
const S = Date.now()
const PASS = 'Pass#12345'

const register = (email: string, source?: unknown) => app.inject({
  method: 'POST', url: '/api/auth/register',
  payload: { email, password: PASS, displayName: 'متعلم', ...(source !== undefined ? { source } : {}) },
})
const listed = async (email: string) => {
  const res = await app.inject({ method: 'GET', url: '/api/admin/users', headers: { cookie: adminCookie } })
  expect(res.statusCode).toBe(200)
  return (res.json() as { email: string; source: { labelAr: string; detailAr: string | null } }[]).find((u) => u.email === email)
}

beforeAll(async () => {
  await setupTestDb()
  prisma = await testPrisma()
  auth = new AuthService(prisma)
  app = await buildApp(prisma)
  const { userId } = await auth.register(`ss-admin-${S}@test.local`, PASS, 'مدير')
  await auth.setRoles(userId, ['super_admin'])
  adminCookie = `${SESSION_COOKIE}=${(await auth.login(`ss-admin-${S}@test.local`, PASS)).token}`
}, 240_000)

describe('① التسجيلُ يحفظه', () => {
  it('⚠️ وسمُ الحملة والصفحةُ الأولى يُحفظان مع الحساب', async () => {
    const email = `ss-fb-${S}@example.com`
    const res = await register(email, {
      utmSource: 'facebook', utmMedium: 'cpc', utmCampaign: 'oct-ai', landingPath: '/courses', at: '2026-10-26T10:00:00.000Z',
    })
    expect(res.statusCode).toBe(201)
    const row = await prisma.signupSource.findFirst({ where: { user: { email } } })
    expect(row).toMatchObject({ via: 'self', utmSource: 'facebook', utmCampaign: 'oct-ai', landingPath: '/courses' })
    expect(row?.firstSeenAt?.toISOString()).toBe('2026-10-26T10:00:00.000Z')
    expect((await listed(email))?.source).toEqual({ labelAr: 'فيسبوك (إعلان)', detailAr: 'حملة: oct-ai · أول صفحة: /courses' })
  })
})

describe('② ما ليس وسما لا يُكتب', () => {
  it('حقولٌ عابثة تُترك والتسجيلُ يمضي', async () => {
    const email = `ss-bad-${S}@example.com`
    const res = await register(email, { utmSource: '<img src=x>', referrerHost: 'a.com/path?q=1', landingPath: 'http://x' })
    expect(res.statusCode).toBe(201)
    const row = await prisma.signupSource.findFirst({ where: { user: { email } } })
    expect(row).toMatchObject({ via: 'self', utmSource: null, referrerHost: null, landingPath: null })
    expect((await listed(email))?.source.labelAr).toBe('دخول مباشر')
  })

  it('بلا مصدرٍ أصلا: يُسجَّل «مباشر»', async () => {
    const email = `ss-none-${S}@example.com`
    expect((await register(email)).statusCode).toBe(201)
    expect((await listed(email))?.source.labelAr).toBe('دخول مباشر')
  })
})

describe('③ القائمةُ تسمّيه', () => {
  it('من سجّل قبل التتبّع: غير معروف', async () => {
    const email = `ss-old-${S}@example.com`
    await auth.register(email, PASS, 'قديم')
    expect((await listed(email))?.source.labelAr).toBe('غير معروف')
  })

  it('من أضافه مدير', async () => {
    const email = `ss-staff-${S}@example.com`
    const res = await app.inject({
      method: 'POST', url: '/api/admin/users', headers: { cookie: adminCookie },
      payload: { email, displayName: 'موظف', roleIds: ['academic_coordinator'] },
    })
    expect(res.statusCode).toBeLessThan(300)
    expect((await listed(email))?.source.labelAr).toBe('أضافه مدير')
  })
})
