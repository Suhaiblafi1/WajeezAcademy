/* «فحص الهامش» لأيّ منحة — يُختار فوق جدوله (١٦ نوفمبر ٢٠٢٦). والعلّةُ في رأس `server/services/grant-margins.service.ts`.

   قرارُ صاحب المنصّة، وهو في صفحة بلاك فرايدي: «أريد فوق هذا الجدول أن أختار المنحةَ التي أرى جدولَها، خاصّةً للمؤثّرين
   والشركاء.. ولا حاجةَ للجدول الذي وضعتَه في رأس الصفحة».

   ① **الخياراتُ: المنحُ بترتيبها، ثمّ كلُّ مؤثّرٍ نشط، ثمّ كلُّ شريك** — والموقوفُ من المؤثّرين لا خيارَ له.
   ② **وعمولةُ المؤثّر في «منحة مؤثرين وجيز» وحدَها** — أعلى عمولةٍ لمؤثّرٍ نشط. و«بلاك فرايدي» بلا عمولة: هي ما رآه صاحبُ
      المنصّة في صفحتها بعمود «للمؤثر» — في البابين، بابِ الاختيار وبابِ صفحتها.
   ③ **والمؤثّرُ بخصمه وعمولته هو، والشريكُ بنسبته وحصّته** — وأرقامُ الجدول أرقامُ `GrantService.margins` نفسِه بها.
   ④ **ونسبةٌ تُمرَّر تُجرَّب مكانَ نسبة الخيار** — ومفتاحٌ لا خيارَ له ٤٠٤، والبابُ بصلاحيّة إعدادات المنحة. */

import { beforeAll, describe, expect, it } from 'vitest'
import type { PrismaClient } from '@prisma/client'
import type { FastifyInstance } from 'fastify'
import { setupTestDb, testPrisma } from '../helpers/db'
import { AuthService } from '../../services/auth.service'
import { GrantService } from '../../services/grant.service'
import { influencerMarginKey, marginOptions, marginsFor, type MarginOption } from '../../services/grant-margins.service'
import { approvedPlanBy } from '../helpers/approved-trainer'
import { buildApp } from '../../http/app'
import { SESSION_COOKIE } from '../../http/auth-plugin'
import {
  BLACK_FRIDAY_GRANT_SLUG, INFLUENCER_GRANT_SLUG, MEMBER_GRANT_SLUG, OPEN_GRANT_SLUG,
} from '../../../src/application/commerce/grant'

let prisma: PrismaClient
let app: FastifyInstance
let auth: AuthService
let ownerId = ''
let bossCookie = ''
let supportCookie = ''
const STAMP = Date.now()
let seq = 0
const DAY = 86_400_000

beforeAll(async () => {
  await setupTestDb()
  prisma = await testPrisma()
  app = await buildApp(prisma)
  await app.ready()
  auth = new AuthService(prisma)
  const sessionFor = async (tag: string, role: string) => {
    const email = `gms-${tag}-${STAMP}@test.local`
    const u = await auth.register(email, 'Margins#12345', tag)
    await auth.setRoles(u.userId, [role])
    return { userId: u.userId, cookie: `${SESSION_COOKIE}=${(await auth.login(email, 'Margins#12345')).token}` }
  }
  const boss = await sessionFor('boss', 'super_admin')
  ownerId = boss.userId
  bossCookie = boss.cookie
  supportCookie = (await sessionFor('support', 'support')).cookie

  /* شعبتان بمدرّبٍ واحد: بأجر مقعدٍ ٤٠ من مئة — تخسر بالخصم الكبير — وبأجرٍ ثابتٍ للشعبة لا يُحكم عليها */
  const user = await prisma.user.create({ data: { email: `gms-tr-${STAMP}@wajeez.test`, displayName: 'مدرب الهامش', passwordHash: 'x' } })
  const application = await prisma.trainerApplication.create({
    data: { reference: `WJ-TR-GMS-${STAMP}`, fullName: 'مدرب الهامش', email: user.email, status: 'active' },
  })
  const profileId = (await prisma.trainerProfile.create({ data: { userId: user.id, applicationId: application.id } })).id
  const courses = (await prisma.course.findMany({ where: { status: 'published' }, select: { id: true }, take: 2 })).map((c) => c.id)
  for (const [courseId, type, rate] of [[courses[0], 'per_seat', 40], [courses[1], 'fixed_per_cohort', 500]] as const) {
    const c = await prisma.cohort.create({
      data: {
        plans: { create: approvedPlanBy(profileId) }, courseId, title: `شعبة الهامش ${++seq}`,
        status: 'open', registrationOpen: true, financialReady: true,
        price: 100, currency: 'USD', capacity: 20, startsAt: new Date(Date.now() + 30 * DAY),
      } as never,
    })
    await prisma.cohortTrainer.create({ data: { cohortId: c.id, profileId, role: 'lead', assignedBy: ownerId } })
    await prisma.trainerCompensationRule.create({ data: { profileId, type, rate, cohortId: c.id, effectiveFrom: new Date(Date.now() - DAY) } })
  }

  /* مؤثّرون: بخصمٍ له وعمولةٍ أعلى، وبلا خصمٍ بعمولةٍ أدنى، وموقوفٌ بأعلى عمولةٍ — لا يرفع عمولةَ الحملة */
  await prisma.influencer.createMany({
    data: [
      { nameAr: 'مؤثر بخصمه', code: 'GMSOWN', percentOff: 80, commissionPercent: 20, active: true },
      { nameAr: 'مؤثر بنسبتها', code: 'GMSPLAIN', commissionPercent: 10, active: true },
      { nameAr: 'مؤثر موقوف', code: 'GMSOFF', commissionPercent: 50, active: false },
    ],
  })
  await prisma.grantCampaign.create({ data: { slug: `partner-gms${STAMP % 10000}`, nameAr: 'جامعة الاختبار', kind: 'partner', percentOff: 75, partnerSharePercent: 50, active: true } })
}, 240_000)

const PARTNER = `partner-gms${STAMP % 10000}`
const opt = (all: MarginOption[], key: string) => all.find((o) => o.key === key)!
const byCode = async (code: string) => (await prisma.influencer.findUniqueOrThrow({ where: { code } })).id

describe('① المنح ثم المؤثرون ثم الشركاء', () => {
  it('⚠️ المنح الأربع بترتيبها ونسبها، ثم كل مؤثر نشط، ثم كل شريك — والموقوف لا خيار له', async () => {
    const all = await marginOptions(prisma)
    const groups = all.map((o) => o.group)
    expect(groups.slice(0, 4)).toEqual(['campaign', 'campaign', 'campaign', 'campaign'])
    expect(groups.lastIndexOf('campaign'), 'المنح بعد غيرها').toBeLessThan(groups.indexOf('influencer'))
    expect(groups.lastIndexOf('influencer'), 'المؤثرون بعد الشركاء').toBeLessThan(groups.indexOf('partner'))
    expect(all.slice(0, 4).map((o) => o.key)).toEqual([MEMBER_GRANT_SLUG, OPEN_GRANT_SLUG, BLACK_FRIDAY_GRANT_SLUG, INFLUENCER_GRANT_SLUG])
    for (const o of all.slice(0, 4)) expect(o.percentOff).toBe((await new GrantService(prisma, o.slug).settings()).percentOff)
    const codes = all.filter((o) => o.group === 'influencer').map((o) => o.code)
    expect(codes).toEqual(expect.arrayContaining(['GMSOWN', 'GMSPLAIN', 'SUHAIB']))
    expect(codes, 'خيار لمؤثر موقوف').not.toContain('GMSOFF')
    expect(opt(all, PARTNER), 'غاب الشريك').toMatchObject({ group: 'partner', nameAr: 'جامعة الاختبار', percentOff: 75, sharePercent: 50 })
  })
})

describe('② العمولة في منحة المؤثرين وحدها — وبلاك فرايدي بلا عمولة', () => {
  it('⚠️ أعلى عمولة لمؤثر نشط في منحة المؤثرين، وصفر في غيرها', async () => {
    const all = await marginOptions(prisma)
    expect(opt(all, INFLUENCER_GRANT_SLUG), 'الموقوف رفع العمولة أو لم تكن الأعلى').toMatchObject({ commissionPercent: 20 })
    for (const slug of [MEMBER_GRANT_SLUG, OPEN_GRANT_SLUG, BLACK_FRIDAY_GRANT_SLUG]) expect(opt(all, slug).commissionPercent, slug).toBe(0)
  })

  it('⚠️ وباب صفحة بلاك فرايدي نفسه بلا عمولة — ومنحة المؤثرين بعمولتها', async () => {
    const bf = await app.inject({ method: 'GET', url: '/api/admin/black-friday-grant/margins', headers: { cookie: bossCookie } })
    expect(bf.statusCode, bf.body).toBe(200)
    const body = bf.json() as { commissionPercent: number; rows: { commission: number }[] }
    expect(body.commissionPercent, 'عمولة مؤثر في هامش بلاك فرايدي').toBe(0)
    expect(body.rows.every((r) => r.commission === 0)).toBe(true)
    const inf = await app.inject({ method: 'GET', url: '/api/admin/influencer-grant/margins', headers: { cookie: bossCookie } })
    expect((inf.json() as { commissionPercent: number }).commissionPercent).toBe(20)
  })
})

describe('③ المؤثر بخصمه وعمولته، والشريك بنسبته وحصته', () => {
  it('⚠️ أرقام الجدول أرقام فحص الهامش نفسه بها', async () => {
    const own = (await marginsFor(prisma, influencerMarginKey(await byCode('GMSOWN'))))!
    expect(own.option).toMatchObject({ group: 'influencer', code: 'GMSOWN', percentOff: 80, commissionPercent: 20 })
    expect(own.rows).toEqual((await new GrantService(prisma, INFLUENCER_GRANT_SLUG).margins(80, 20)).rows)
    /* مقعدٌ بمئة وأجرُه ٤٠: بخصمه ٨٠ وعمولته ٢٠ يبقى ٢٠ − ٤٠ − ٢٠ = −٤٠ */
    expect(own.rows.some((r) => r.margin === -40), 'لم تظهر خسارة المؤثر بخصمه').toBe(true)

    const plain = (await marginsFor(prisma, influencerMarginKey(await byCode('GMSPLAIN'))))!
    const infPct = (await new GrantService(prisma, INFLUENCER_GRANT_SLUG).settings()).percentOff
    expect(plain.option).toMatchObject({ percentOff: infPct, commissionPercent: 10 })
    expect(plain.rows).toEqual((await new GrantService(prisma, INFLUENCER_GRANT_SLUG).margins(infPct, 10)).rows)

    const partner = (await marginsFor(prisma, PARTNER))!
    expect(partner).toMatchObject({ percentOff: 75, commissionPercent: 0, sharePercent: 50 })
    /* مقعدٌ بمئة بعد ٧٥٪ خمسةٌ وعشرون، نصفُها للشريك، وأجرُه ٤٠: ٢٥ − ١٢٫٥ − ٤٠ = −٢٧٫٥ */
    expect(partner.rows.some((r) => r.partnerShare === 12.5 && r.margin === -27.5), 'لم تطرح حصة الشريك').toBe(true)
  })
})

describe('④ نسبة تجرب، ومفتاح مجهول، والصلاحية', () => {
  it('⚠️ النسبة الممررة تغلب نسبة الخيار — ومجهول ٤٠٤ — وللمدير وحده', async () => {
    const tried = (await marginsFor(prisma, BLACK_FRIDAY_GRANT_SLUG, 33))!
    expect(tried.percentOff).toBe(33)
    expect(await marginsFor(prisma, 'no-such-grant')).toBeNull()

    const ok = await app.inject({ method: 'GET', url: `/api/admin/grants/margins?key=${PARTNER}&percentOff=60`, headers: { cookie: bossCookie } })
    expect(ok.statusCode, ok.body).toBe(200)
    expect(ok.json()).toMatchObject({ percentOff: 60, sharePercent: 50 })
    const list = await app.inject({ method: 'GET', url: '/api/admin/grants/margin-options', headers: { cookie: bossCookie } })
    expect((list.json() as { options: unknown[] }).options.length).toBeGreaterThanOrEqual(5)
    const unknown = await app.inject({ method: 'GET', url: '/api/admin/grants/margins?key=no-such-grant', headers: { cookie: bossCookie } })
    expect(unknown.statusCode).toBe(404)
    for (const url of ['/api/admin/grants/margin-options', `/api/admin/grants/margins?key=${PARTNER}`]) {
      expect((await app.inject({ method: 'GET', url, headers: { cookie: supportCookie } })).statusCode).toBe(403)
      expect((await app.inject({ method: 'GET', url })).statusCode).toBe(401)
    }
  })
})
