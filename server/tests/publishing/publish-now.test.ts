/* «انشر الآن» في لوحة النشر (٢٧ أكتوبر ٢٠٢٦، المرحلة الثامنة — ج).

   كانت اللوحةُ تطلب وسمَ إصدارٍ يُكتب باليد ثمّ «أنشئ وانشر»، وقبله «تحقّق» و«تحليل أثر». فصار زرّا واحدا يفعل ما يفعله
   كلُّ تحديثٍ للموقع (`publishSnapshotIfChanged`):

   ① ينشر ما في الجداول بتسميةٍ آليّة، ويُكتب اسمُ من ضغط على الإصدار وحدثه — والنشرُ مع البناء بلا اسمٍ كما كان.
   ② ولا ينشر شيئا إن لم يتغيّر شيء.
   ③ ولا يملكه من يرى الإصدارات وحدَها (`catalog.impact.view`). */

import { beforeAll, describe, expect, it } from 'vitest'
import type { PrismaClient } from '@prisma/client'
import type { FastifyInstance } from 'fastify'
import { setupTestDb, testPrisma } from '../helpers/db'
import { AuthService } from '../../services/auth.service'
import { publishSnapshotIfChanged } from '../../services/auto-publish.service'
import { buildApp } from '../../http/app'
import { SESSION_COOKIE } from '../../http/auth-plugin'

let prisma: PrismaClient
let app: FastifyInstance
let superCookie = ''
let superId = ''
let diagCookie = ''
const STAMP = Date.now()

/** فرقٌ بين الجداول واللقطة المنشورة — سؤالٌ يتوقّف أو يعود */
const flipQuestion = async () => {
  const q = await prisma.question.findFirstOrThrow({ orderBy: { id: 'asc' }, select: { id: true, active: true } })
  await prisma.question.update({ where: { id: q.id }, data: { active: !q.active } })
}

beforeAll(async () => {
  await setupTestDb()
  prisma = await testPrisma()
  app = await buildApp(prisma)
  await app.ready()
  const auth = new AuthService(prisma)
  const sessionFor = async (email: string, role: string) => {
    const u = await auth.register(email, 'PublishNow#12345', role)
    await auth.setRoles(u.userId, [role])
    const { token } = await auth.login(email, 'PublishNow#12345')
    return { cookie: `${SESSION_COOKIE}=${token}`, userId: u.userId }
  }
  const boss = await sessionFor(`publish-super-${STAMP}@test.local`, 'super_admin')
  superCookie = boss.cookie
  superId = boss.userId
  diagCookie = (await sessionFor(`publish-diag-${STAMP}@test.local`, 'diagnostic_manager')).cookie
  /* ويبدأ كلُّ حارسٍ من لقطةٍ تطابق الجداول */
  await publishSnapshotIfChanged(prisma)
}, 240_000)

const publishNow = (cookie: string) =>
  app.inject({ method: 'POST', url: '/api/admin/publishing/publish-now', headers: { cookie }, payload: {} })

describe('①② «انشر الآن» ينشر ما تغير باسم من ضغط — ولا شيء إن لم يتغير', () => {
  it('⚠️ ينشر بتسمية آلية ويكتب اسم من ضغط على الإصدار وحدثه', { timeout: 240_000 }, async () => {
    await flipQuestion()
    const res = await publishNow(superCookie)
    expect(res.statusCode, res.body).toBe(200)
    const out = res.json() as { published: boolean; label: string; changedCount: number; totalPersonas: number }
    expect(out.published).toBe(true)
    expect(out.label).toMatch(/^auto-/)
    expect(out.totalPersonas, 'لا يقول من كم شخصية قيس الأثر').toBeGreaterThan(0)
    const v = await prisma.catalogVersion.findUniqueOrThrow({ where: { label: out.label }, include: { events: true } })
    expect(v.status).toBe('published')
    expect(v.publishedBy, 'نشر من اللوحة بلا اسم من ضغط').toBe(superId)
    expect(v.createdBy).toBe(superId)
    expect(v.events.map((e) => [e.action, e.actorId])).toEqual([['publish', superId]])
  })

  it('ولا ينشر شيئا إن لم يتغير شيء', { timeout: 240_000 }, async () => {
    const before = await prisma.catalogVersion.count()
    const res = await publishNow(superCookie)
    expect(res.statusCode, res.body).toBe(200)
    expect(res.json()).toMatchObject({ published: false })
    expect(await prisma.catalogVersion.count(), 'أنشأ إصدارا بلا جديد').toBe(before)
  })

  it('والنشر مع البناء بلا اسم كما كان', { timeout: 240_000 }, async () => {
    await flipQuestion()
    const out = await publishSnapshotIfChanged(prisma)
    expect(out.published).toBe(true)
    const v = await prisma.catalogVersion.findUniqueOrThrow({ where: { label: out.label! } })
    expect(v.publishedBy).toBeNull()
  })
})

describe('③ ولا يملكه من يرى الإصدارات وحدها', () => {
  it('⚠️ مدير التشخيص يرى الإصدارات ولا ينشر', async () => {
    const res = await publishNow(diagCookie)
    expect(res.statusCode, 'نشر من لا يملك النشر').toBe(403)
    const list = await app.inject({ method: 'GET', url: '/api/admin/publishing/versions', headers: { cookie: diagCookie } })
    expect(list.statusCode).toBe(200)
  })
})
