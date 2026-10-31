/* من فتح صفحةَ المنحة — عبّأ أم لم يعبّئ (٣١ أكتوبر ٢٠٢٦). والعلّةُ في رأس `server/services/grant-visit.service.ts`.

   ① **صفٌّ واحدٌ لكلّ متصفّحٍ في كلّ حملة**: يبقى أوّلُ فتحٍ بمصدره منظّفا، ويُعدّ ما بعده. وكودُ مؤثّرٍ لا يطابق مؤثّرا لا يُحفظ.
   ② **ومن عبّأ من المتصفّح نفسِه يُربط بزيارته** — وإن لم تُسجَّل كُتبت حينها، ومن عبّأ ثانيةً لا يُنقل إلى غيره.
   ③ **والقائمةُ تقرأ «فتح ← عبّأ ← اشترى» لكلّ مصدر.**
   ④ **والبابُ يردّ ما ليس رقما عشوائيّا بشكله.** */

import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { randomUUID } from 'node:crypto'
import type { PrismaClient } from '@prisma/client'
import type { FastifyInstance } from 'fastify'
import { setupTestDb, testPrisma } from '../helpers/db'
import { AuthService } from '../../services/auth.service'
import { GrantService } from '../../services/grant.service'
import { GrantLandingService } from '../../services/grant-landing.service'
import { registrantsFull } from '../../services/grant-registrants.service'
import { MEMBER_GRANT_SLUG } from '../../../src/application/commerce/grant'
import { buildApp } from '../../http/app'

let prisma: PrismaClient
let app: FastifyInstance
let landing: GrantLandingService
let seq = 0
const STAMP = Date.now()

const visit = (visitorId: string, page: Record<string, unknown>, extra: Record<string, unknown> = {}) =>
  app.inject({ method: 'POST', url: '/api/public/grant/visit', payload: { campaign: 'member', visitorId, source: { page }, ...extra } })
const rowOf = (visitorId: string) => prisma.grantVisit.findUniqueOrThrow({ where: { campaign_visitorId: { campaign: MEMBER_GRANT_SLUG, visitorId } } })
const fill = (visitorId: string | null, page: Record<string, unknown> = {}) => {
  seq += 1
  return landing.apply({
    fullName: `زائر الرابط ${seq}`, phone: `0795${String(300000 + seq)}`, email: `gv-${seq}-${STAMP}@test.local`, workField: 'الهندسة',
    visitorId, source: { page: { at: new Date().toISOString(), ...page } },
  })
}

beforeAll(async () => {
  await setupTestDb()
  prisma = await testPrisma()
  app = await buildApp(prisma)
  landing = new GrantLandingService(prisma)
  const owner = (await new AuthService(prisma).register(`gv-owner-${STAMP}@test.local`, 'Owner#123456', 'صاحب المنصة')).userId
  await new GrantService(prisma).update({ active: true, percentOff: 60, maxCodes: null, maxCourses: 4, closesAt: null }, owner)
}, 240_000)

afterAll(async () => { await app?.close() })

describe('① صف واحد لكل متصفح في كل حملة', () => {
  it('⚠️ يبقى أول فتح بمصدره منظفا، ويعد ما بعده', async () => {
    const id = randomUUID()
    const first = await visit(id, { utmSource: 'Facebook', landingPath: '/grant?x=1', at: '2026-10-31T08:00:00.000Z', evil: 1 })
    expect(first.statusCode).toBe(204)
    await visit(id, { referrerHost: 'google.com', at: '2026-10-31T09:00:00.000Z' })
    const v = await rowOf(id)
    expect(v.pageTouch).toEqual({ utmSource: 'facebook', landingPath: '/grant', at: '2026-10-31T08:00:00.000Z' })
    expect(v.visits).toBe(2)
    expect(v.lastAt.getTime()).toBeGreaterThan(v.firstAt.getTime() - 1)
    expect(v.leadId).toBeNull()
  })

  it('⚠️ وكود مؤثر لا يطابق مؤثرا نشطا لا يحفظ', async () => {
    const id = randomUUID()
    await app.inject({ method: 'POST', url: '/api/public/grant/visit', payload: { campaign: 'influencer', visitorId: id, code: 'NOSUCH' } })
    const v = await prisma.grantVisit.findFirstOrThrow({ where: { visitorId: id } })
    expect(v.influencerCode).toBeNull()
  })
})

describe('② من عبأ من المتصفح نفسه يربط بزيارته', () => {
  it('⚠️ يربط، ومن عبأ ثانية لا ينقل إلى غيره', async () => {
    const id = randomUUID()
    await visit(id, { at: new Date().toISOString() })
    const a = await fill(id)
    expect((await rowOf(id)).leadId).toBe(a.ref)
    const b = await fill(id)
    expect(b.ref).not.toBe(a.ref)
    expect((await rowOf(id)).leadId).toBe(a.ref)
  })

  it('⚠️ وإن لم تسجل زيارته تكتب حين يعبئ — فلا يزيد من عبأ على من فتح', async () => {
    const id = randomUUID()
    const a = await fill(id, { refCode: 'WJ-ZZ11' })
    const v = await rowOf(id)
    expect(v.leadId).toBe(a.ref)
    expect(v.pageTouch).toMatchObject({ refCode: 'WJ-ZZ11' })
  })

  it('⚠️ ومن عبأ بلا رقم متصفح لا يكتب له شيء', async () => {
    const before = await prisma.grantVisit.count()
    await fill(null)
    expect(await prisma.grantVisit.count()).toBe(before)
  })
})

describe('③ فتح ← عبأ ← اشترى لكل مصدر', () => {
  it('⚠️ القائمة تقرؤها بأسماء مصادرها', async () => {
    const before = (await registrantsFull(prisma)).funnel
    const ids = [randomUUID(), randomUUID(), randomUUID()]
    await visit(ids[0], { refCode: 'WJ-AA22', at: new Date().toISOString() })
    await visit(ids[1], { refCode: 'WJ-AA22', at: new Date().toISOString() })
    await visit(ids[2], { at: new Date().toISOString() })
    await fill(ids[0], { refCode: 'WJ-AA22' })
    const f = (await registrantsFull(prisma)).funnel
    expect(f.visitors - before.visitors).toBe(3)
    expect(f.filled - before.filled).toBe(1)
    const trainer = (x: typeof f) => x.bySource.find((c) => c.key === 'trainer') ?? { visitors: 0, filled: 0 }
    expect(trainer(f).visitors - trainer(before).visitors).toBe(2)
    expect(trainer(f).filled - trainer(before).filled).toBe(1)
    expect(f.since).not.toBeNull()
  })
})

describe('④ الباب يرد ما ليس رقما عشوائيا بشكله', () => {
  it('⚠️ رقم بغير شكله وحملة مجهولة', async () => {
    expect((await app.inject({ method: 'POST', url: '/api/public/grant/visit', payload: { campaign: 'member', visitorId: 'abc' } })).statusCode).toBe(422)
    expect((await app.inject({ method: 'POST', url: '/api/public/grant/visit', payload: { campaign: 'x', visitorId: randomUUID() } })).statusCode).toBe(422)
  })
})
