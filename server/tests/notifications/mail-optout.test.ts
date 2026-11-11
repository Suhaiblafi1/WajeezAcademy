/* إلغاءُ الاشتراك في رسائل التسويق (١١ نوفمبر ٢٠٢٦) — والعلّةُ في رأس `mail-optout.service.ts`.

   ① **الرمزُ موقَّعٌ ببريده** — يُقرأ منه بريدُه، ولا يصحّ رمزٌ لبريدٍ آخر ولا رمزٌ عُبث به.
   ② **وفي رسالة التسويق رابطان** — سطرٌ في تذييلها (نصّا وHTML)، ورابطُ النقرة الواحدة محفوظٌ مع الرسالة لرأسها.
   ③ **ومن ألغى لا تصله** — لا تذكيرُ المنحة ولا رسالةُ الإدارة، ويُقال كم لم تصلهم؛ وكودُ المنحة الذي طلبه يصله بلا رابط.
   ④ **والبابان العامّان** — الصفحةُ والنقرةُ الواحدة يلغيان، ومرّةً تكفي، والرمزُ الخاطئ يُردّ. */

import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import type { FastifyInstance } from 'fastify'
import type { PrismaClient } from '@prisma/client'
import { setupTestDb, testPrisma } from '../helpers/db'
import { AuthService } from '../../services/auth.service'
import { GrantService } from '../../services/grant.service'
import { GrantLandingService } from '../../services/grant-landing.service'
import { sendGrantReminders } from '../../services/grant-followup.service'
import { messageRegistrants } from '../../services/grant-registrants.service'
import { emailFromToken, optOut, unsubscribeLinks, unsubscribeToken } from '../../services/mail-optout.service'
import { buildApp } from '../../http/app'
import { OPEN_GRANT_SLUG } from '../../../src/application/commerce/grant'

let prisma: PrismaClient
let app: FastifyInstance
let grant: GrantService
let landing: GrantLandingService
let ownerId = ''
let seq = 0
const STAMP = Date.now()
const HOUR = 3_600_000

const person = () => ({
  fullName: `قارئ ${++seq}`, phone: `0796${String(300000 + seq)}`, email: `optout-${seq}-${STAMP}@test.local`, workField: 'الموارد البشرية',
})

beforeAll(async () => {
  await setupTestDb()
  prisma = await testPrisma()
  app = await buildApp(prisma)
  const auth = new AuthService(prisma)
  ownerId = (await auth.register(`optout-owner-${STAMP}@test.local`, 'Owner#12345', 'صاحب المنصة')).userId
  grant = new GrantService(prisma, OPEN_GRANT_SLUG)
  landing = new GrantLandingService(prisma, OPEN_GRANT_SLUG)
  await grant.update({ active: true, maxCodes: null, closesAt: null }, ownerId)
}, 240_000)

afterAll(async () => { await app?.close() })

describe('① الرمز موقع ببريده', () => {
  it('⚠️ يقرأ منه بريده بحروف صغيرة — ولا يصح لبريد آخر ولا بعد العبث', () => {
    const t = unsubscribeToken('Sara@Example.com')
    expect(emailFromToken(t)).toBe('sara@example.com')
    const [, sig] = t.split('.')
    const other = `${Buffer.from('omar@example.com').toString('base64url')}.${sig}`
    expect(emailFromToken(other), 'ألغى بريدا آخر برمز غيره').toBeNull()
    expect(emailFromToken(`${t}x`)).toBeNull()
    expect(emailFromToken('')).toBeNull()
    expect(emailFromToken('abc')).toBeNull()
  })
})

async function withMail<T>(fn: () => Promise<T>): Promise<T> {
  const had = await prisma.integrationSetting.findUnique({ where: { provider: 'email' }, select: { enabled: true, config: true } })
  const cfg = { apiKey: 'test-key', fromEmail: 'no-reply@test.local' }
  await prisma.integrationSetting.upsert({ where: { provider: 'email' }, update: { enabled: true, config: cfg }, create: { provider: 'email', enabled: true, config: cfg } })
  try { return await fn() } finally {
    if (had) await prisma.integrationSetting.update({ where: { provider: 'email' }, data: { enabled: had.enabled, config: had.config as never } })
    else await prisma.integrationSetting.delete({ where: { provider: 'email' } })
  }
}

describe('② و③ رابطان في رسالة التسويق، ومن ألغى لا تصله', () => {
  it('⚠️ تذكير المنحة: سطر في التذييل ورابط لرأسها — ومن ألغى لا يذكر، وكود المنحة يصله بلا رابط', async () => {
    const T = new Date(Date.now() + 5 * 24 * HOUR)
    await withMail(async () => {
      await grant.update({ closesAt: T }, ownerId)
      try {
        const keep = person()
        const leave = person()
        await landing.apply(keep)
        await landing.apply(leave)

        const code = await prisma.outboxMail.findFirstOrThrow({ where: { to: leave.email, purpose: 'grant.code' } })
        expect(code.unsubscribeUrl, 'كود المنحة الذي طلبه رسالة تسويق').toBeNull()
        expect(code.text).not.toContain('ألغ الاشتراك')

        expect((await optOut(prisma, unsubscribeToken(leave.email), 'grant.reminder')).ok).toBe(true)
        await sendGrantReminders(prisma, new Date(T.getTime() - 62.9 * HOUR), OPEN_GRANT_SLUG)

        const mail = await prisma.outboxMail.findFirstOrThrow({ where: { to: keep.email, purpose: 'grant.reminder' } })
        const links = unsubscribeLinks(keep.email)
        expect(mail.unsubscribeUrl).toBe(links.oneClick)
        expect(mail.text).toContain(`ألغ الاشتراك: ${links.page}`)
        expect(mail.html).toContain(links.page.replace(/&/g, '&amp;'))
        expect(await prisma.outboxMail.count({ where: { to: leave.email, purpose: 'grant.reminder' } }), 'ذكر من ألغى').toBe(0)
      } finally {
        await grant.update({ closesAt: null }, ownerId)
      }
    })
  })

  it('⚠️ رسالة الإدارة لمن عبأ: لا تصل من ألغى ويقال كم هم — وتصل غيره برابطها', async () => {
    const a = await landing.apply(person())
    const bp = person()
    const b = await landing.apply(bp)
    await optOut(prisma, unsubscribeToken(bp.email))
    const out = await messageRegistrants(prisma, { ids: [a.ref, b.ref], subject: 'تجربة', body: 'نص الرسالة' }, ownerId)
    expect(out).toMatchObject({ sent: 1, unsubscribed: 1 })
    const rows = await prisma.outboxMail.findMany({ where: { batchId: out.batchId } })
    expect(rows).toHaveLength(1)
    expect(rows[0].unsubscribeUrl).toContain('/api/public/unsubscribe/one-click?t=')
    expect(rows[0].text).toContain('/unsubscribe?t=')
  })
})

describe('④ البابان العامان', () => {
  it('⚠️ الصفحة والنقرة الواحدة تلغيان، ومرة تكفي — والرمز الخاطئ يرد', async () => {
    const page = `page-${STAMP}@test.local`
    const res = await app.inject({ method: 'POST', url: '/api/public/unsubscribe', payload: { t: unsubscribeToken(page) } })
    expect(res.statusCode).toBe(200)
    expect(res.json().email).toBe('p•••@test.local')
    expect(await prisma.mailOptOut.count({ where: { email: page } })).toBe(1)
    expect((await app.inject({ method: 'POST', url: '/api/public/unsubscribe', payload: { t: unsubscribeToken(page) } })).statusCode).toBe(200)
    expect(await prisma.mailOptOut.count({ where: { email: page } })).toBe(1)

    const click = `click-${STAMP}@test.local`
    const one = await app.inject({
      method: 'POST', url: `/api/public/unsubscribe/one-click?t=${encodeURIComponent(unsubscribeToken(click))}`,
      headers: { 'content-type': 'application/x-www-form-urlencoded' }, payload: 'List-Unsubscribe=One-Click',
    })
    expect(one.statusCode).toBe(200)
    expect(await prisma.mailOptOut.count({ where: { email: click } })).toBe(1)

    const bad = await app.inject({ method: 'POST', url: '/api/public/unsubscribe', payload: { t: 'bm9ib2R5QHRlc3QubG9jYWw.xxxxxxxxxxxxxxxxxxxxxx' } })
    expect(bad.statusCode).toBe(400)
    expect(await prisma.mailOptOut.count({ where: { email: 'nobody@test.local' } })).toBe(0)
  })
})
