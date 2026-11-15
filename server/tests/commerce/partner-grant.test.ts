/* منحُ الشركاء (١٥ نوفمبر ٢٠٢٦) — والعلّةُ في رأس `server/services/partner-grant.service.ts`.

   ① **البريدُ على نطاق الشريك بحدود المقاطع** — `std.hu.edu.jo` منه، و`evilhu.edu.jo` و`hu.edu.jo.evil.com` ليسا منه، ويُردّ
      بسببه قبل أن يُرسَل شيء.
   ② **رابطٌ ثمّ كود**: الرمزُ مجزّأٌ في القاعدة، ويُستعمل مرّةً، وينتهي بمهلته. ومن فتحه أخذ عميلا محتملا وكودا واحدا —
      ومن أكّد البريدَ نفسَه ثانيةً رأى كودَه نفسَه، والجوابُ عن طلب الرابط واحدٌ لكلّ بريد.
   ③ **الكودُ بنسبة الشريك وحدّه عند الدفع** — ٧٥٪ على ٤ دورات، ومنحةٌ واحدةٌ لكلّ متعلّم على المنح كلِّها.
   ④ **الموقوفُ لا صفحةَ له ولا رابطَ ولا كود**، وشعارُه لا يُخدَم.
   ⑤ **والمديرُ وحدَه يضيف ويعدّل، والأثرُ بقبلُ وبعدُ، والرابطُ لا يتغيّر**، والشعارُ صورةٌ تُسأل عنها بايتاتُها.
   ⑥ **والحملاتُ الأربعُ كما كانت**، والجامعةُ الهاشميّةُ تُنشأ مرّةً موقوفةً بدوراتٍ موجودة، ومن لم يشترِ يُتابَع. */

import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import type { PrismaClient } from '@prisma/client'
import type { FastifyInstance } from 'fastify'
import { setupTestDb, testPrisma } from '../helpers/db'
import { AuthService } from '../../services/auth.service'
import { CommerceService } from '../../services/commerce.service'
import { GrantService } from '../../services/grant.service'
import { applyPartnerLaunch, HU_LAUNCH_REASON, PartnerGrantService, PARTNER_LINKS_PER_HOUR } from '../../services/partner-grant.service'
import { openGrantFollowups } from '../../services/grant-followup.service'
import { approvedPlanBy } from '../helpers/approved-trainer'
import { buildApp } from '../../http/app'
import { SESSION_COOKIE } from '../../http/auth-plugin'
import { GRANT_ONCE_AR, GRANT_SLUGS, MEMBER_GRANT_SLUG, grantPagePath } from '../../../src/application/commerce/grant'
import { HU_PARTNER, STUDENT_SUGGESTED_COURSES, partnerCampaignSlug } from '../../../src/application/commerce/partner-grant'

let prisma: PrismaClient
let app: FastifyInstance
let auth: AuthService
let commerce: CommerceService
let partners: PartnerGrantService
let ownerId = ''
let boss = ''
let learnerCookie = ''
let profileId = ''
let pool: string[] = []
let seq = 0
const STAMP = Date.now()
const DAY = 86_400_000
const PNG = Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), Buffer.alloc(64, 7)])
const HTML = Buffer.from('<html><script>alert(1)</script></html>')

async function cohort(price = 100): Promise<{ courseId: string; cohortId: string }> {
  const courseId = pool.shift()
  if (!courseId) throw new Error('نفدت الدوراتُ المنشورة')
  const c = await prisma.cohort.create({
    data: {
      plans: { create: approvedPlanBy(profileId) }, courseId, title: `شعبة منحة الشريك ${++seq}`,
      status: 'open', registrationOpen: true, financialReady: true,
      price, currency: 'USD', capacity: 50, startsAt: new Date(Date.now() + 30 * DAY),
    } as never,
  })
  await prisma.cohortTrainer.create({ data: { cohortId: c.id, profileId, role: 'lead', assignedBy: ownerId } })
  return { courseId, cohortId: c.id }
}
async function learner(email = `pg-${++seq}-${STAMP}@test.local`) {
  return (await auth.register(email, 'Learner#12345', `متعلم ${seq}`)).userId
}
/** شريكٌ مشغَّلٌ برابطه */
async function partner(slug: string, extra: Record<string, unknown> = {}) {
  return partners.create({
    slug, nameAr: `جامعة ${slug}`, nameEn: `University ${slug}`, type: 'university', domains: ['hu.edu.jo'],
    percentOff: 75, maxCourses: 4, active: true, ...extra,
  }, ownerId)
}
/** رمزُ آخر رابطٍ أُرسل إلى بريد — من نصّ البريد نفسِه */
async function lastToken(email: string): Promise<string> {
  const mail = await prisma.outboxMail.findFirst({ where: { to: email, purpose: 'grant.partner_link' }, orderBy: { createdAt: 'desc' } })
  const m = /confirm\?token=([A-Za-z0-9_\-%]+)/.exec(mail?.text ?? '')
  if (!m) throw new Error(`لا رابط في بريد ${email}`)
  return decodeURIComponent(m[1])
}
async function claim(slug: string, email: string) {
  await partners.requestLink(slug, { fullName: 'طالب الجامعة', email })
  return partners.confirm(slug, await lastToken(email))
}
const inject = (method: 'GET' | 'POST' | 'PUT' | 'DELETE', url: string, cookie?: string, payload?: unknown) =>
  app.inject({ method, url, ...(cookie ? { headers: { cookie } } : {}), ...(payload !== undefined ? { payload: payload as object } : {}) })

beforeAll(async () => {
  await setupTestDb()
  prisma = await testPrisma()
  app = await buildApp(prisma)
  auth = new AuthService(prisma)
  commerce = new CommerceService(prisma)
  partners = new PartnerGrantService(prisma)
  ownerId = (await auth.register(`pg-owner-${STAMP}@test.local`, 'Owner#123456', 'صاحب المنصة')).userId
  await auth.setRoles(ownerId, ['super_admin'])
  boss = `${SESSION_COOKIE}=${(await auth.login(`pg-owner-${STAMP}@test.local`, 'Owner#123456')).token}`
  await auth.register(`pg-learner-${STAMP}@test.local`, 'Learner#123456', 'متعلم')
  learnerCookie = `${SESSION_COOKIE}=${(await auth.login(`pg-learner-${STAMP}@test.local`, 'Learner#123456')).token}`
  const user = await prisma.user.create({ data: { email: `pg-tr-${STAMP}@wajeez.test`, displayName: 'مدرب الشريك', passwordHash: 'x' } })
  const application = await prisma.trainerApplication.create({
    data: { reference: `WJ-TR-PG-${STAMP}`, fullName: 'مدرب الشريك', email: user.email, status: 'active' },
  })
  profileId = (await prisma.trainerProfile.create({
    data: { userId: user.id, applicationId: application.id, publicVisibility: true, isVerified: true, publishApprovedAt: new Date() },
  })).id
  /* ودوراتُ الجامعة المقترحةُ تُترك للبذر — لا تُستعمل هنا شعبا */
  pool = (await prisma.course.findMany({
    where: { status: 'published', id: { notIn: [...STUDENT_SUGGESTED_COURSES] } }, select: { id: true }, orderBy: { id: 'asc' },
  })).map((c) => c.id)
}, 240_000)

afterAll(async () => { await app?.close() })

describe('① البريد على نطاق الشريك بحدود المقاطع', () => {
  it('⚠️ يقبل النطاق نفسه وما تحته، ويرد الشبيه — ولا يرسل له شيئا', async () => {
    await partner('dom')
    for (const ok of ['a@hu.edu.jo', 'b@std.hu.edu.jo', 'C@STD.HU.EDU.JO']) {
      await expect(partners.requestLink('dom', { fullName: 'طالب', email: ok }), ok).resolves.toMatchObject({ sentTo: expect.any(String) })
    }
    for (const bad of ['x@hu.edu.jo.evil.com', 'x@evilhu.edu.jo', 'x@hu.edu.jom', 'x@gmail.com', 'hu.edu.jo', 'x@@hu.edu.jo']) {
      await expect(partners.requestLink('dom', { fullName: 'طالب', email: bad }), bad).rejects.toMatchObject({ code: 'bad_email_domain' })
      expect(await prisma.outboxMail.count({ where: { to: bad.toLowerCase() } }), `أرسل إلى ${bad}`).toBe(0)
    }
  })
})

describe('② رابط ثم كود — مرة، وكود واحد لكل بريد', () => {
  it('⚠️ الرمز مجزأ في القاعدة، ويستعمل مرة، ويعطي كودا يرسل إلى بريده', async () => {
    await partner('flow')
    const email = `flow-${STAMP}@std.hu.edu.jo`
    const sent = await partners.requestLink('flow', { fullName: 'سارة', email })
    expect(sent.sentTo).toBe(`f•••@std.hu.edu.jo`)
    const token = await lastToken(email)
    const row = await prisma.partnerEmailLink.findFirstOrThrow({ where: { email } })
    expect(row.tokenHash, 'حفظ الرمز كما هو').not.toBe(token)
    expect(await prisma.partnerEmailLink.count({ where: { tokenHash: token } })).toBe(0)
    expect(row.expiresAt.getTime() - row.createdAt.getTime()).toBeLessThanOrEqual(24 * 3_600_000)

    const out = await partners.confirm('flow', token)
    expect(out.grant?.code).toMatch(/^WG-/)
    expect(out.grant?.percentOff).toBe(75)
    const lead = await prisma.lead.findUniqueOrThrow({ where: { id: out.ref } })
    expect(lead).toMatchObject({ email, campaign: partnerCampaignSlug('flow'), source: 'campaign' })
    expect(await prisma.outboxMail.count({ where: { to: email, purpose: 'grant.code' } })).toBe(1)

    /* نقرةٌ ثانيةٌ على الرابط نفسِه */
    await expect(partners.confirm('flow', token)).rejects.toMatchObject({ code: 'link_used' })
    /* ورمزٌ مختلَق */
    await expect(partners.confirm('flow', 'x'.repeat(43))).rejects.toMatchObject({ code: 'bad_link' })
  })

  it('⚠️ البريد نفسه ثانية: الجواب نفسه، والكود نفسه، ولا كود جديد ولا بريد كود ثان', async () => {
    await partner('again')
    const email = `again-${STAMP}@hu.edu.jo`
    const first = await claim('again', email)
    const c = await prisma.grantCampaign.findUniqueOrThrow({ where: { slug: partnerCampaignSlug('again') } })
    const reply1 = await partners.requestLink('again', { fullName: 'سارة', email })
    const fresh = `new-${STAMP}@hu.edu.jo`
    const reply2 = await partners.requestLink('again', { fullName: 'سارة', email: fresh })
    /* لا يقول الجوابُ أأخذ البريدُ منحتَه قبلُ: الشكلُ نفسُه لبريدٍ أخذ ولبريدٍ لم يأخذ */
    expect(Object.keys(reply1).sort()).toEqual(Object.keys(reply2).sort())
    expect(reply1.messageAr.replace(reply1.sentTo, '')).toBe(reply2.messageAr.replace(reply2.sentTo, ''))
    const second = await partners.confirm('again', await lastToken(email))
    expect(second.grant?.code).toBe(first.grant?.code)
    expect(second.ref).toBe(first.ref)
    expect((await prisma.grantCampaign.findUniqueOrThrow({ where: { id: c.id } })).issuedCount).toBe(1)
    expect(await prisma.grantCode.count({ where: { campaignId: c.id } })).toBe(1)
    expect(await prisma.lead.count({ where: { campaign: c.slug, email } })).toBe(1)
    expect(await prisma.outboxMail.count({ where: { to: email, purpose: 'grant.code' } })).toBe(1)
  })

  it('⚠️ الرابط ينتهي بمهلته', async () => {
    await partner('late')
    const email = `late-${STAMP}@hu.edu.jo`
    await partners.requestLink('late', { fullName: 'سارة', email })
    const token = await lastToken(email)
    await expect(partners.confirm('late', token, undefined, new Date(Date.now() + 25 * 3_600_000))).rejects.toMatchObject({ code: 'link_expired' })
  })

  it('⚠️ ثلاثة روابط في الساعة لكل بريد — وما زاد لا يرسل والجواب هو هو', async () => {
    await partner('cap')
    const email = `cap-${STAMP}@hu.edu.jo`
    const replies = []
    for (let i = 0; i < PARTNER_LINKS_PER_HOUR + 2; i += 1) replies.push(await partners.requestLink('cap', { fullName: 'سارة', email }))
    expect(new Set(replies.map((r) => JSON.stringify(r))).size).toBe(1)
    expect(await prisma.partnerEmailLink.count({ where: { email } })).toBe(PARTNER_LINKS_PER_HOUR)
    expect(await prisma.outboxMail.count({ where: { to: email, purpose: 'grant.partner_link' } })).toBe(PARTNER_LINKS_PER_HOUR)
  })

  it('وعبر الباب العام: النطاق الخطأ 400، والصحيح 202 بلا كود في الجواب', async () => {
    await partner('http')
    const bad = await inject('POST', '/api/public/grant/p/http/link', undefined, { fullName: 'سارة', email: 'x@evilhu.edu.jo' })
    expect(bad.statusCode).toBe(400)
    const ok = await inject('POST', '/api/public/grant/p/http/link', undefined, { fullName: 'سارة', email: `http-${STAMP}@hu.edu.jo` })
    expect(ok.statusCode).toBe(202)
    expect(ok.body).not.toMatch(/WG-/)
    const token = await lastToken(`http-${STAMP}@hu.edu.jo`)
    const res = await inject('POST', '/api/public/grant/p/http/confirm', undefined, { token })
    expect(res.statusCode).toBe(200)
    expect(res.json().grant.code).toMatch(/^WG-/)
  })
})

describe('③ الكود بنسبة الشريك وحده عند الدفع', () => {
  it('⚠️ 75% على أربع دورات، والخامسة بلا منحة', async () => {
    await partner('pay')
    const email = `pay-${STAMP}@hu.edu.jo`
    const code = (await claim('pay', email)).grant!.code
    const userId = await learner(email)
    const [a, b, c, d, e] = [await cohort(100), await cohort(200), await cohort(100), await cohort(100), await cohort(100)]
    const q = await commerce.quote(userId, [a.cohortId, b.cohortId], code)
    expect(q.couponDiscount).toBe(225)
    const out = await commerce.checkout(userId, [a.cohortId, b.cohortId], code)
    expect(out.total).toBe(75)
    await commerce.payOrder(out.orderId, userId, `pg-${out.orderId}`)
    /* وما بقي على الكود دورتان — فثلاثٌ تُردّ */
    await expect(commerce.checkout(userId, [c.cohortId, d.cohortId, e.cohortId], code)).rejects.toMatchObject({ code: 'grant_max_courses' })
    const out2 = await commerce.checkout(userId, [c.cohortId, d.cohortId], code)
    await commerce.payOrder(out2.orderId, userId, `pg-${out2.orderId}`)
    await expect(commerce.checkout(userId, [e.cohortId], code)).rejects.toMatchObject({ code: 'grant_used' })
    /* ولا عمولةَ ولا مؤثّر على كود الشريك */
    expect(await prisma.grantCode.findFirstOrThrow({ where: { coupon: { code } } })).toMatchObject({ influencerId: null, commissionPercent: null })
  })

  it('⚠️ منحة واحدة لكل متعلم: من دفع بمنحة أخرى لا يعطى كود الشريك', async () => {
    await partner('once')
    const email = `once-${STAMP}@hu.edu.jo`
    const userId = await learner(email)
    await new GrantService(prisma, MEMBER_GRANT_SLUG).update({ active: true, maxCodes: null, closesAt: null }, ownerId)
    const memberCode = (await new GrantService(prisma, MEMBER_GRANT_SLUG).issue({})).code
    const x = await cohort(100)
    const o = await commerce.checkout(userId, [x.cohortId], memberCode)
    await commerce.payOrder(o.orderId, userId, `pg-${o.orderId}`)
    const out = await claim('once', email)
    expect(out.grant).toBeNull()
    expect(out.reasonAr).toBe(GRANT_ONCE_AR)
  })
})

describe('④ الموقوف لا صفحة له ولا رابط ولا كود', () => {
  it('⚠️ صفحته 404، ورابطه 404، وكوده لا يستعمل، وشعاره لا يخدم', async () => {
    const p = await partner('off')
    const email = `off-${STAMP}@hu.edu.jo`
    const code = (await claim('off', email)).grant!.code
    await partners.requestLink('off', { fullName: 'سارة', email })
    const pendingToken = await lastToken(email)
    await partners.update(p.id, { active: false }, ownerId)
    expect((await inject('GET', '/api/public/grant/p/off')).statusCode).toBe(404)
    expect((await inject('POST', '/api/public/grant/p/off/link', undefined, { fullName: 'سارة', email: `off2-${STAMP}@hu.edu.jo` })).statusCode).toBe(404)
    expect((await inject('POST', '/api/public/grant/p/off/confirm', undefined, { token: pendingToken })).statusCode).toBe(404)
    const x = await cohort(100)
    await expect(commerce.checkout(await learner(), [x.cohortId], code)).rejects.toMatchObject({ code: 'grant_closed' })
    expect((await inject('GET', '/api/public/grant/p/nobody')).statusCode).toBe(404)
  })

  it('والمنتهية نهايتها: صفحتها تقول مغلقة، ولا رابط', async () => {
    await partner('ended', { closesAt: new Date(Date.now() - DAY) })
    const v = await partners.view('ended')
    expect(v.campaign.open).toBe(false)
    await expect(partners.requestLink('ended', { fullName: 'سارة', email: `ended-${STAMP}@hu.edu.jo` })).rejects.toMatchObject({ code: 'grant_closed' })
  })
})

describe('⑤ المدير وحده، والأثر، والرابط ثابت، والشعار صورة', () => {
  it('⚠️ غير المدير يرد من أبواب الشركاء كلها', async () => {
    const p = await partner('rbac')
    for (const [m, u] of [['GET', '/api/admin/partners'], ['POST', '/api/admin/partners'], ['PUT', `/api/admin/partners/${p.id}`],
      ['POST', `/api/admin/partners/${p.id}/logo`], ['GET', `/api/admin/partners/${p.id}/claims`], ['GET', `/api/admin/partners/${p.id}/claims.xlsx`],
      ['PUT', `/api/admin/partners/${p.id}/courses`]] as const) {
      expect((await inject(m, u, learnerCookie, m === 'GET' ? undefined : {})).statusCode, `${m} ${u}`).toBe(403)
      expect((await inject(m, u, undefined, m === 'GET' ? undefined : {})).statusCode, `${m} ${u} بلا جلسة`).toBe(401)
    }
  })

  it('⚠️ الإضافة والتعديل عبر الباب، بأثر يقول من وما كان وما صار — والرابط لا يتغير', async () => {
    const res = await inject('POST', '/api/admin/partners', boss, {
      slug: 'Audit-U', nameAr: 'جامعة الأثر', type: 'university', domains: ['@Audit.EDU'], percentOff: 70, maxCourses: 3,
    })
    expect(res.statusCode).toBe(201)
    const p = res.json()
    expect(p).toMatchObject({ slug: 'audit-u', domains: ['audit.edu'], active: false, percentOff: 70 })
    const created = await prisma.auditEvent.findFirstOrThrow({ where: { action: 'coupon.partner_create', entityId: p.id } })
    expect(created.actorId).toBe(ownerId)

    const upd = await inject('PUT', `/api/admin/partners/${p.id}`, boss, { percentOff: 60, active: true })
    expect(upd.statusCode).toBe(200)
    const ev = await prisma.auditEvent.findFirstOrThrow({ where: { action: 'coupon.partner_update', entityId: p.id } })
    expect(ev.actorId).toBe(ownerId)
    expect(ev.before).toMatchObject({ percentOff: 70, active: false })
    expect(ev.after).toMatchObject({ percentOff: 60, active: true })

    expect((await inject('PUT', `/api/admin/partners/${p.id}`, boss, { slug: 'other' })).statusCode).toBe(400)
    expect((await inject('POST', '/api/admin/partners', boss, {
      slug: 'audit-u', nameAr: 'مكرر', type: 'university', domains: ['x.edu'], percentOff: 70, maxCourses: 3,
    })).statusCode).toBe(409)
    expect((await inject('PUT', `/api/admin/partners/${p.id}`, boss, { domains: ['edu'] })).statusCode).toBe(400)
  })

  it('⚠️ الشعار صورة حقا: HTML يرد، وPNG يقبل ويخدم ما دام الشريك مشغلا', async () => {
    const p = await partner('logo')
    const up = await inject('POST', `/api/admin/partners/${p.id}/logo`, boss, { mime: 'image/png', sizeBytes: PNG.length })
    expect(up.statusCode).toBe(200)
    const { uploadUrl } = up.json()
    const put = (body: Buffer) => app.inject({ method: 'PUT', url: uploadUrl, headers: { 'content-type': 'application/octet-stream' }, payload: body })
    expect((await put(HTML)).statusCode).toBe(415)
    expect((await inject('POST', `/api/admin/partners/${p.id}/logo/commit`, boss)).statusCode).toBe(409)
    expect((await put(PNG)).statusCode).toBe(200)
    expect((await inject('POST', `/api/admin/partners/${p.id}/logo/commit`, boss)).statusCode).toBe(200)
    const view = (await inject('GET', '/api/public/grant/p/logo')).json()
    expect(view.partner.logoUrl).toMatch(/^\/api\/v1\/partner-logos\//)
    const img = await inject('GET', view.partner.logoUrl)
    expect(img.statusCode).toBe(200)
    expect(img.headers['content-type']).toBe('image/png')
    expect(await prisma.auditEvent.count({ where: { action: 'coupon.partner_logo', entityId: p.id, actorId: ownerId } })).toBe(1)
    /* والموقوفُ لا يُخدَم شعارُه للعامّة — ويراه المدير */
    await partners.update(p.id, { active: false }, ownerId)
    expect((await inject('GET', view.partner.logoUrl)).statusCode).toBe(404)
    expect((await inject('GET', `/api/admin/partners/${p.id}/logo`, boss)).statusCode).toBe(200)
    /* وما ليس صورةً لا يُطلب رابطُه أصلا */
    expect((await inject('POST', `/api/admin/partners/${p.id}/logo`, boss, { mime: 'image/svg+xml', sizeBytes: 100 })).statusCode).toBe(422)
  })

  it('وقائمة من أكد بريده، وملفها', async () => {
    const p = await partner('claims')
    await claim('claims', `claims-${STAMP}@hu.edu.jo`)
    const rows = (await inject('GET', `/api/admin/partners/${p.id}/claims`, boss)).json()
    expect(rows).toHaveLength(1)
    expect(rows[0]).toMatchObject({ email: `claims-${STAMP}@hu.edu.jo`, code: expect.stringMatching(/^WG-/), courses: 0 })
    const x = await inject('GET', `/api/admin/partners/${p.id}/claims.xlsx`, boss)
    expect(x.statusCode).toBe(200)
    expect(x.headers['content-type']).toMatch(/spreadsheetml/)
  })

  it('ودورات صفحته باختيار المدير، بأثره', async () => {
    const p = await partner('choice')
    const [a, b] = [await cohort(100), await cohort(100)]
    const res = await inject('PUT', `/api/admin/partners/${p.id}/courses`, boss, { courseIds: [a.courseId] })
    expect(res.statusCode).toBe(200)
    const ids = (await partners.view('choice')).openCourses.map((c) => c.courseId)
    expect(ids).toContain(a.courseId)
    expect(ids).not.toContain(b.courseId)
    expect(await prisma.auditEvent.count({ where: { action: 'coupon.grant_courses', entityId: p.id, actorId: ownerId } })).toBe(1)
  })
})

describe('⑥ الحملات الأربع كما كانت، والجامعة الهاشمية، والمتابعة', () => {
  it('⚠️ لا شريك في الحملات الأربع، وصفحاتها كما كانت', async () => {
    expect(GRANT_SLUGS.some((s) => s.startsWith('partner-'))).toBe(false)
    expect(grantPagePath(MEMBER_GRANT_SLUG)).toBe('/grant')
    expect(grantPagePath(partnerCampaignSlug('hu'))).toBe('/grant/p/hu')
    /* وصفُّ الحملة يُنشأ وحدَه كما كان — والشريكُ لا يُنشأ بالسؤال عنه */
    expect((await new GrantService(prisma, MEMBER_GRANT_SLUG).campaign()).kind).toBe('campaign')
    await expect(new GrantService(prisma, partnerCampaignSlug('ghost')).campaign()).rejects.toMatchObject({ code: 'not_found' })
    expect(await prisma.grantCampaign.count({ where: { slug: partnerCampaignSlug('ghost') } })).toBe(0)
  })

  it('⚠️ الجامعة الهاشمية مرة واحدة، موقوفة، بنطاقها ونسبتها، ودوراتها موجودة', async () => {
    expect(await applyPartnerLaunch(prisma)).toBe(true)
    const hu = await prisma.grantCampaign.findUniqueOrThrow({ where: { slug: partnerCampaignSlug('hu') } })
    expect(hu).toMatchObject({
      kind: 'partner', nameAr: HU_PARTNER.nameAr, partnerNameEn: HU_PARTNER.nameEn, emailDomains: ['hu.edu.jo'],
      percentOff: 75, maxCourses: 4, maxCodes: null, closesAt: null, active: false,
    })
    const known = new Set((await prisma.course.findMany({ where: { id: { in: hu.courseIds } }, select: { id: true } })).map((c) => c.id))
    expect(hu.courseIds.length).toBeGreaterThan(0)
    expect(hu.courseIds.every((id) => known.has(id))).toBe(true)
    expect(await prisma.auditEvent.count({ where: { action: 'coupon.partner_create', entityId: hu.id, actorId: null, reason: HU_LAUNCH_REASON } })).toBe(1)
    expect(await applyPartnerLaunch(prisma)).toBe(false)
    /* ومن حذفه بعدُ لا يعود */
    await prisma.grantCampaign.delete({ where: { id: hu.id } })
    expect(await applyPartnerLaunch(prisma)).toBe(false)
  })

  it('⚠️ من أكد بريده ولم يشتر تفتح له حالة تسمي الشريك', async () => {
    await partner('follow')
    const out = await claim('follow', `follow-${STAMP}@hu.edu.jo`)
    await prisma.lead.update({ where: { id: out.ref }, data: { createdAt: new Date(Date.now() - 2 * 3_600_000) } })
    await openGrantFollowups(prisma)
    const kase = await prisma.advisorCase.findFirstOrThrow({ where: { leadId: out.ref }, include: { followUps: true } })
    expect(kase.nextAction).toContain('جامعة follow')
    expect(kase.followUps[0].channel).toBe('email')
  })
})
