/* تفاصيلُ المؤثّر كلُّها تتغيّر: اسمُه ورقمُه وبريدُه، ودعوتُه تُعاد (١٥ نوفمبر ٢٠٢٦) — والعلّةُ في رأس `influencer.service.ts` (١ب).

   قرارُ صاحب المنصّة: «منحني فرصة تغيير اسم صاحب المنحة المؤثر وتغيير كل التفاصيل، إيميله، رقمه وإلى آخره».

   ① **اسمُه ورقمُه** — يُحفظان من الشاشة، والرقمُ بشكله أو فارغ، وأثرُ `influencer.update` يقول ما كان وما صار.
   ② **ورقمُ من قُبل طلبُه من طلبه** — في القبول، وفي الترحيل لمن قُبل قبله.
   ③ **وبريدُه يُغيَّر بنقل ملفّه** — إلى حسابٍ جديدٍ مدعوٍّ أو قائم، ويُنزع دورُ المؤثّر وحدَه من القديم، والملفُّ بماله كما هو،
      وبريدُ الترحيب بكوده وطريقِ دخوله. ولا إلى حساب مؤثّرٍ آخر ولا مؤرشف ولا البريدِ نفسِه.
   ④ **ومن لم يفعّل حسابَه تُعاد له الدعوة** — رابطٌ جديدٌ في بريد الترحيب والقديمُ يبطل، وأثرُها. ولا دعوةَ لمفعَّلٍ أو بلا حساب.
   ⑤ **ومديرُ المنصّة يُربط مؤثّرا ببريده** — يبقى مديرا ويرى صفحةَ المؤثّر بكشفه. */

import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import type { PrismaClient } from '@prisma/client'
import type { FastifyInstance } from 'fastify'

const outbox = vi.hoisted(() => [] as { to: string; subject: string; text: string }[])
vi.mock('../../services/notification.service', async (orig) => {
  const real = await orig<typeof import('../../services/notification.service')>()
  return {
    ...real,
    sendDirectEmail: async (_p: unknown, input: { to: string; subject: string; text: string }) => {
      outbox.push({ to: input.to, subject: input.subject, text: input.text })
      return { status: 'sent' as const }
    },
  }
})

import { setupTestDb, testPrisma } from '../helpers/db'
import { AuthService } from '../../services/auth.service'
import { InfluencerService } from '../../services/influencer.service'
import { buildApp } from '../../http/app'
import { SESSION_COOKIE } from '../../http/auth-plugin'

let prisma: PrismaClient
let app: FastifyInstance
let auth: AuthService
let influencers: InfluencerService
let bossCookie = ''
let bossId = ''
const STAMP = Date.now()
let seq = 0

const mailsTo = (email: string) => outbox.filter((m) => m.to === email.toLowerCase())
const rolesOf = async (userId: string) => (await prisma.userRole.findMany({ where: { userId } })).map((r) => r.roleId).sort()
const invites = (userId: string) => prisma.passwordResetToken.count({ where: { userId, purpose: 'invite', usedAt: null } })
const patch = (id: string, payload: Record<string, unknown>) =>
  app.inject({ method: 'PATCH', url: `/api/admin/influencers/${id}`, headers: { cookie: bossCookie }, payload })
const connect = (id: string, email: string) =>
  app.inject({ method: 'POST', url: `/api/admin/influencers/${id}/account`, headers: { cookie: bossCookie }, payload: { email } })
const resend = (id: string) =>
  app.inject({ method: 'POST', url: `/api/admin/influencers/${id}/resend-invite`, headers: { cookie: bossCookie }, payload: {} })
async function learner(tag: string) {
  const email = `infc-${tag}-${(seq += 1)}-${STAMP}@test.local`
  return { email, userId: (await auth.register(email, 'Learner#12345', `متعلم ${tag}`)).userId }
}
async function addInfluencer(code: string, email: string, phone: string | null = null) {
  return (await influencers.create({ nameAr: `مؤثر ${code}`, code, commissionPercent: 15, email, phone }, bossId)).id
}

beforeAll(async () => {
  await setupTestDb()
  prisma = await testPrisma()
  app = await buildApp(prisma)
  await app.ready()
  auth = new AuthService(prisma)
  influencers = new InfluencerService(prisma)
  const boss = await auth.register(`infc-boss-${STAMP}@test.local`, 'Influence#12345', 'صاحب المنصة')
  await auth.setRoles(boss.userId, ['super_admin'])
  bossId = boss.userId
  bossCookie = `${SESSION_COOKIE}=${(await auth.login(`infc-boss-${STAMP}@test.local`, 'Influence#12345')).token}`
}, 240_000)

beforeEach(() => { outbox.length = 0 })

describe('① اسمه ورقمه', () => {
  it('⚠️ يحفظان من الشاشة — والرقم بشكله أو فارغ، والأثر يقول ما كان وما صار', async () => {
    const id = await addInfluencer('CNAME', (await learner('name')).email, ' +962  79 123-4567 ')
    expect((await prisma.influencer.findUniqueOrThrow({ where: { id } })).phone, 'لم يحفظ رقمه في الإضافة').toBe('+962 79 123-4567')

    const res = await patch(id, { nameAr: 'سارة الجديدة', phone: '+962 77 000 1111' })
    expect(res.statusCode, res.body).toBe(200)
    expect(await prisma.influencer.findUniqueOrThrow({ where: { id } })).toMatchObject({ nameAr: 'سارة الجديدة', phone: '+962 77 000 1111' })
    const audit = await prisma.auditEvent.findFirstOrThrow({ where: { action: 'influencer.update', entityId: id }, orderBy: { createdAt: 'desc' } })
    expect(audit).toMatchObject({
      actorId: bossId,
      before: { nameAr: 'مؤثر CNAME', phone: '+962 79 123-4567' }, after: { nameAr: 'سارة الجديدة', phone: '+962 77 000 1111' },
    })

    for (const phone of ['abc', '12345', '+962 79 12a 4567', '1'.repeat(21)]) {
      const bad = await patch(id, { phone })
      expect(bad.statusCode, `قبل رقما بلا شكله: ${phone}`).toBe(400)
      expect((bad.json() as { error: { code: string } }).error.code).toBe('bad_phone')
    }
    expect((await patch(id, { phone: null })).statusCode).toBe(200)
    expect((await prisma.influencer.findUniqueOrThrow({ where: { id } })).phone, 'لم يمح رقمه').toBeNull()
    await expect(influencers.create({ nameAr: 'خطأ', code: 'CBADPH', commissionPercent: 15, email: (await learner('badph')).email, phone: 'x1' }, bossId))
      .rejects.toMatchObject({ code: 'bad_phone' })
  })
})

describe('② ورقم من قبل طلبه من طلبه', () => {
  it('⚠️ الترحيل يملأ رقم المؤثر من طلبه — ولا يمس من له رقم', async () => {
    const empty = (await prisma.influencer.create({ data: { nameAr: 'مقبول قديم', code: `CAPP${STAMP % 100000}` } })).id
    const kept = (await prisma.influencer.create({ data: { nameAr: 'له رقم', code: `CKEEP${STAMP % 100000}`, phone: '0790000000' } })).id
    for (const [influencerId, n] of [[empty, 1], [kept, 2]] as const) {
      await prisma.influencerApplication.create({
        data: {
          reference: `WJ-IN-C-${n}-${STAMP}`, fullName: 'متقدم', email: `infc-app-${n}-${STAMP}@test.local`,
          phoneCountryCode: '+962', phone: '791112222', pitchAr: 'منشور', termsAcceptedAt: new Date(), status: 'approved', influencerId,
        } as never,
      })
    }
    const sql = readFileSync(join(process.cwd(), 'prisma/migrations/20261115200000_influencer_contact/migration.sql'), 'utf8')
    const update = sql.slice(sql.indexOf('UPDATE "Influencer"'))
    await prisma.$executeRawUnsafe(update.slice(0, update.indexOf(';')))
    expect((await prisma.influencer.findUniqueOrThrow({ where: { id: empty } })).phone, 'لم يملأ رقمه من طلبه').toBe('+962 791112222')
    expect((await prisma.influencer.findUniqueOrThrow({ where: { id: kept } })).phone, 'مس رقما كتب').toBe('0790000000')
  })
})

describe('③ بريده يغير بنقل ملفه', () => {
  it('⚠️ إلى حساب جديد مدعو ثم إلى حساب قائم — والقديم يفقد دور المؤثر وحده، والملف بماله كما هو، وبريد الترحيب', async () => {
    const first = await learner('first')
    const id = await addInfluencer('CMOVE', first.email)
    await influencers.recordPayout(id, { amount: 5, advance: true, noteAr: 'سلفة' }, bossId)
    expect(await rolesOf(first.userId)).toEqual(['influencer', 'learner'])

    /* بريدٌ جديد: حسابٌ مدعوٌّ بدور المؤثّر، ودعوتُه وترحيبُه */
    const fresh = `infc-fresh-${STAMP}@test.local`
    const r1 = await connect(id, fresh)
    expect(r1.statusCode, r1.body).toBe(200)
    expect(r1.json()).toMatchObject({ account: { created: true }, emailDelivery: 'sent' })
    const freshUser = await prisma.user.findUniqueOrThrow({ where: { email: fresh } })
    expect(freshUser.status).toBe('invited')
    expect(await rolesOf(freshUser.id)).toEqual(['influencer', 'learner'])
    expect(await rolesOf(first.userId), 'لم ينزع دور المؤثر من القديم أو نزع غيره').toEqual(['learner'])
    expect((await prisma.influencer.findUniqueOrThrow({ where: { id } })).userId).toBe(freshUser.id)
    const welcome = mailsTo(fresh).find((m) => m.subject === 'حسابك في منحة مؤثرين وجيز')
    expect(welcome, 'لم يصل بريد الترحيب').toBeTruthy()
    expect(welcome!.text).toContain('/grant/i/CMOVE')
    expect(welcome!.text).toContain('وصلك بريد آخر فيه رابط تفعيل حسابك')
    expect(mailsTo(fresh).some((m) => m.text.includes('/auth/reset?token=')), 'لم تصل دعوة التفعيل').toBe(true)
    const audit = await prisma.auditEvent.findFirstOrThrow({ where: { action: 'influencer.account', entityId: id }, orderBy: { createdAt: 'desc' } })
    expect(audit).toMatchObject({ actorId: bossId, meta: { from: first.email, to: fresh } })

    /* والملفُّ بماله يراه الحسابُ الجديد، والقديمُ لا يرى شيئا */
    const me = await influencers.portal(freshUser.id)
    expect(me).toMatchObject({ code: 'CMOVE' })
    expect(me.payouts.map((p) => p.amount)).toEqual([5])
    await expect(influencers.portal(first.userId)).rejects.toMatchObject({ code: 'not_influencer' })

    /* حسابٌ قائمٌ يدخله: دخولٌ بحسابه بلا دعوة */
    const active = await learner('active')
    outbox.length = 0
    const r2 = await connect(id, active.email)
    expect(r2.json()).toMatchObject({ account: { created: false }, emailDelivery: 'sent' })
    expect(await invites(active.userId)).toBe(0)
    const text = mailsTo(active.email).find((m) => m.subject === 'حسابك في منحة مؤثرين وجيز')!.text
    expect(text).toContain('/influencer')
    expect(text).not.toContain('/auth/reset')
    expect(await rolesOf(freshUser.id), 'بقي للحساب السابق دور المؤثر').toEqual(['learner'])
    expect((await influencers.portal(active.userId)).code).toBe('CMOVE')
  })

  it('⚠️ ولا إلى حساب مؤثر آخر ولا مؤرشف ولا البريد نفسه — والربط كما كان', async () => {
    const mine = await learner('mine')
    const id = await addInfluencer('CSTAY', mine.email)
    const other = await learner('other')
    await addInfluencer('COTHER', other.email)
    const archived = await learner('archived')
    await prisma.user.update({ where: { id: archived.userId }, data: { status: 'archived' } })
    for (const [email, code, status] of [[other.email, 'account_taken', 409], [archived.email, 'archived', 409], [mine.email, 'same_email', 400]] as const) {
      const res = await connect(id, email)
      expect(res.statusCode, `${code}: ${res.body}`).toBe(status)
      expect((res.json() as { error: { code: string } }).error.code).toBe(code)
    }
    expect((await prisma.influencer.findUniqueOrThrow({ where: { id } })).userId).toBe(mine.userId)
    expect(await rolesOf(mine.userId)).toContain('influencer')
  })
})

describe('④ ومن لم يفعل حسابه تعاد له الدعوة', () => {
  it('⚠️ رابط جديد في بريد الترحيب والقديم يبطل، وأثرها — ولا دعوة لمفعل أو بلا حساب', async () => {
    const email = `infc-invited-${STAMP}@test.local`
    const id = await addInfluencer('CINVITE', email)
    const user = await prisma.user.findUniqueOrThrow({ where: { email } })
    expect(user.status).toBe('invited')
    const old = await prisma.passwordResetToken.findFirstOrThrow({ where: { userId: user.id, purpose: 'invite', usedAt: null } })
    outbox.length = 0

    const res = await resend(id)
    expect(res.statusCode, res.body).toBe(200)
    expect(res.json()).toMatchObject({ emailDelivery: 'sent' })
    expect((await prisma.passwordResetToken.findUniqueOrThrow({ where: { id: old.id } })).usedAt, 'بقيت الدعوة القديمة').not.toBeNull()
    expect(await invites(user.id)).toBe(1)
    const mails = mailsTo(email)
    expect(mails, 'رسالتان برابطين يبطل أحدهما الآخر').toHaveLength(1)
    expect(mails[0]!.text).toContain('/auth/reset?token=')
    expect(mails[0]!.text).toContain('CINVITE')
    const audit = await prisma.auditEvent.findFirstOrThrow({ where: { action: 'influencer.invite.resend', entityId: id } })
    expect(audit).toMatchObject({ actorId: bossId, meta: { email, sent: true } })

    const active = await learner('resend-active')
    const activeId = await addInfluencer('CACTIVE', active.email)
    expect((await resend(activeId)).json()).toMatchObject({ error: { code: 'not_invited' } })
    const bare = (await prisma.influencer.create({ data: { nameAr: 'بلا حساب', code: `CBARE${STAMP % 100000}` } })).id
    expect((await resend(bare)).json()).toMatchObject({ error: { code: 'no_account' } })
  })
})

describe('⑤ ومدير المنصة يربط مؤثرا ببريده', () => {
  it('⚠️ يبقى مديرا بأدواره، ويرى صفحة المؤثر بكشفه — وبريده يقول افتح صفحتك', async () => {
    const id = (await prisma.influencer.create({ data: { nameAr: 'صاحب المنصة مؤثرا', code: `COWNER${STAMP % 100000}`, commissionPercent: 0, percentOff: 70 } })).id
    const res = await connect(id, `infc-boss-${STAMP}@test.local`)
    expect(res.json()).toMatchObject({ account: { userId: bossId, created: false } })
    expect(await rolesOf(bossId)).toEqual(['influencer', 'super_admin'])
    expect(await invites(bossId), 'دعي حساب المدير المفعل').toBe(0)
    const me = await influencers.portal(bossId)
    expect(me.code).toMatch(/^COWNER/)
    expect(mailsTo(`infc-boss-${STAMP}@test.local`)[0]!.text).toContain('أضفنا دور المؤثر إلى حسابك')
    /* وما زال يدخل الإدارة */
    expect((await app.inject({ method: 'GET', url: '/api/admin/influencers', headers: { cookie: bossCookie } })).statusCode).toBe(200)
  })
})
