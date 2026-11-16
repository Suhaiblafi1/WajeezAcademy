/* «الهامش في كل المنح» (١٦ نوفمبر ٢٠٢٦) — والعلّةُ في رأس `src/application/commerce/grant-margins.ts`.

   قرارُ صاحب المنصّة: «وامنحني معرفة الهامش لكل نوع من المنح».

   ① **الحملاتُ الأربعُ بترتيبها ثمّ الشركاء** — كلٌّ بنسبتها المحفوظة، والعمولةُ صفرٌ إلّا في حملتَي المؤثّرين: أعلى عمولةٍ
      لمؤثّرٍ نشط، والموقوفُ لا يرفعها.
   ② **وأرقامُ كلّ حملةٍ أرقامُ «فحص الهامش» نفسِه** بنسبتها وعمولتها — كم شعبة، وكم تخسر، وكم بلا أجر مقعد، والمتوسّطُ والأدنى.
   ③ **ولكلّ مؤثّرٍ نشطٍ صفُّه تحت حملتَي المؤثّرين** — بخصمه هو وعمولته هو، وفارغُ الخصم نسبةُ الحملة. والموقوفُ لا صفَّ له.
   ④ **وبابُه بصلاحيّة إعدادات المنحة** — يردّ من لا يملكها. */

import { beforeAll, describe, expect, it } from 'vitest'
import type { PrismaClient } from '@prisma/client'
import type { FastifyInstance } from 'fastify'
import { setupTestDb, testPrisma } from '../helpers/db'
import { AuthService } from '../../services/auth.service'
import { GrantService } from '../../services/grant.service'
import { grantMarginsSummary, type CampaignMarginRow } from '../../services/grant-margins.service'
import { approvedPlanBy } from '../helpers/approved-trainer'
import { buildApp } from '../../http/app'
import { SESSION_COOKIE } from '../../http/auth-plugin'
import {
  BLACK_FRIDAY_GRANT_SLUG, INFLUENCER_GRANT_SLUG, MEMBER_GRANT_SLUG, OPEN_GRANT_SLUG, type GrantSlug,
} from '../../../src/application/commerce/grant'
import type { MarginStats } from '../../../src/application/commerce/grant-margins'

let prisma: PrismaClient
let app: FastifyInstance
let auth: AuthService
let ownerId = ''
let bossCookie = ''
let supportCookie = ''
const STAMP = Date.now()
let seq = 0
const DAY = 86_400_000

/** أرقامُ «فحص الهامش» نفسِه بنسبةٍ وعمولة — تُعدّ هنا من صفوفه يدا، لا بدالّة التلخيص التي يُحرس بها اللوح */
async function expected(pct: number, commission: number) {
  const rows = (await new GrantService(prisma).margins(pct, commission)).rows
  const usd = rows.filter((r) => r.margin !== null && r.currency === 'USD').map((r) => r.margin!)
  return {
    cohorts: rows.length,
    losing: rows.filter((r) => r.margin !== null && r.margin < 0).length,
    noCost: rows.filter((r) => r.margin === null).length,
    otherCurrency: rows.filter((r) => r.margin !== null && r.currency !== 'USD').length,
    avg: usd.length ? Math.round((usd.reduce((sum, m) => sum + m, 0) / usd.length) * 100) / 100 : null,
    min: usd.length ? Math.min(...usd) : null,
  }
}
const bySlug = (rows: CampaignMarginRow[], slug: string) => rows.find((r) => r.slug === slug)!
/** أرقامُ الصفّ وحدَها — كما يقولها «فحص الهامش» */
const statsOf = (x: MarginStats) => ({ cohorts: x.cohorts, losing: x.losing, noCost: x.noCost, otherCurrency: x.otherCurrency, avg: x.avg, min: x.min })

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
  await prisma.grantCampaign.create({ data: { slug: `partner-gms${STAMP % 10000}`, nameAr: 'جامعة الاختبار', kind: 'partner', percentOff: 75, active: true } })
}, 240_000)

describe('① الحملات الأربع ثم الشركاء', () => {
  /* و«بلاك فرايدي وجيز» لم تعد حملةَ مؤثّرين (١٦ نوفمبر ٢٠٢٦، `grant-merge.service.ts`): لا عمولةَ فيها ولا صفوفَ مؤثّرين */
  it('⚠️ كل منها بنسبتها، والعمولة صفر إلا في منحة المؤثرين: أعلى عمولة لمؤثر نشط', async () => {
    const { currency, campaigns } = await grantMarginsSummary(prisma)
    expect(currency).toBe('USD')
    const four: GrantSlug[] = [MEMBER_GRANT_SLUG, OPEN_GRANT_SLUG, INFLUENCER_GRANT_SLUG, BLACK_FRIDAY_GRANT_SLUG]
    expect(campaigns.slice(0, 4).map((c) => c.slug)).toEqual(four)
    expect(campaigns.slice(0, 4).map((c) => c.nameAr)).toEqual(['منحة وجيز', 'منحة وجيز العامة', 'منحة مؤثرين وجيز', 'بلاك فرايدي وجيز'])
    for (const slug of four) expect(bySlug(campaigns, slug).percentOff).toBe((await new GrantService(prisma, slug).settings()).percentOff)
    expect(bySlug(campaigns, MEMBER_GRANT_SLUG)).toMatchObject({ commissionPercent: 0, topCommission: false })
    expect(bySlug(campaigns, OPEN_GRANT_SLUG)).toMatchObject({ commissionPercent: 0, topCommission: false })
    expect(bySlug(campaigns, BLACK_FRIDAY_GRANT_SLUG), 'عمولة في بلاك فرايدي').toMatchObject({ commissionPercent: 0, topCommission: false })
    expect(bySlug(campaigns, INFLUENCER_GRANT_SLUG), 'الموقوف رفع عمولة الحملة أو لم تكن الأعلى').toMatchObject({ commissionPercent: 20, topCommission: true })
    const partner = campaigns.find((c) => c.slug === `partner-gms${STAMP % 10000}`)
    expect(partner, 'غاب الشريك').toMatchObject({ group: 'partner', nameAr: 'جامعة الاختبار', percentOff: 75, commissionPercent: 0 })
  })
})

describe('② أرقام كل حملة أرقام فحص الهامش نفسه', () => {
  it('⚠️ كم شعبة وكم تخسر وكم بلا أجر مقعد، والمتوسط والأدنى — بنسبتها وعمولتها', async () => {
    const { campaigns } = await grantMarginsSummary(prisma)
    for (const c of campaigns) {
      expect(statsOf(c), c.nameAr).toEqual(await expected(c.percentOff, c.commissionPercent))
    }
    const inf = bySlug(campaigns, INFLUENCER_GRANT_SLUG)
    expect(inf.noCost, 'الأجر الثابت للشعبة حكم عليه').toBeGreaterThanOrEqual(1)
    /* مقعدٌ بمئة وأجرُه ٤٠: بخصم ٤٥ وعمولة ٢٠ يبقى ٥٥ − ٤٠ − ٢٠ = −٥ */
    expect(inf.losing, 'لم تعد الخاسرة').toBeGreaterThanOrEqual(1)
    expect(inf.min!).toBeLessThanOrEqual(-5)
  })
})

describe('③ لكل مؤثر نشط صفه بخصمه وعمولته', () => {
  it('⚠️ تحت منحة المؤثرين وحدها — بخصمه هو أو نسبة الحملة، وعمولته هو، والموقوف لا صف له', async () => {
    const { campaigns } = await grantMarginsSummary(prisma)
    expect(bySlug(campaigns, MEMBER_GRANT_SLUG).influencers).toBeUndefined()
    expect(bySlug(campaigns, BLACK_FRIDAY_GRANT_SLUG).influencers, 'صفوف مؤثرين تحت بلاك فرايدي').toBeUndefined()
    for (const slug of [INFLUENCER_GRANT_SLUG]) {
      const c = bySlug(campaigns, slug)
      const codes = c.influencers!.map((x) => x.code)
      expect(codes, 'صف لمؤثر موقوف').not.toContain('GMSOFF')
      expect(codes).toEqual(expect.arrayContaining(['GMSOWN', 'GMSPLAIN', 'SUHAIB']))

      const own = c.influencers!.find((x) => x.code === 'GMSOWN')!
      expect(own).toMatchObject({ percentOff: 80, ownPercent: true, commissionPercent: 20 })
      expect(statsOf(own), 'صف المؤثر بغير خصمه وعمولته').toEqual(await expected(80, 20))
      /* مقعدٌ بمئة وأجرُه ٤٠: بخصمه ٨٠ وعمولته ٢٠ يبقى ٢٠ − ٤٠ − ٢٠ = −٤٠ */
      expect(own.min!).toBeLessThanOrEqual(-40)

      const plain = c.influencers!.find((x) => x.code === 'GMSPLAIN')!
      expect(plain).toMatchObject({ percentOff: c.percentOff, ownPercent: false, commissionPercent: 10 })
      expect(statsOf(plain)).toEqual(await expected(c.percentOff, 10))
    }
    /* ورابطُ صاحب المنصّة: سبعون بلا عمولة — أرقامُه هو لا أعلى عمولة */
    const suhaib = bySlug(campaigns, INFLUENCER_GRANT_SLUG).influencers!.find((x) => x.code === 'SUHAIB')!
    expect(suhaib).toMatchObject({ percentOff: 70, ownPercent: true, commissionPercent: 0 })
    expect(statsOf(suhaib)).toEqual(await expected(70, 0))
  })
})

describe('④ بابه بصلاحية إعدادات المنحة', () => {
  it('⚠️ للمدير، ويرد من لا يملك الكوبونات', async () => {
    const ok = await app.inject({ method: 'GET', url: '/api/admin/grants/margins-summary', headers: { cookie: bossCookie } })
    expect(ok.statusCode, ok.body).toBe(200)
    expect((ok.json() as { campaigns: unknown[] }).campaigns.length).toBeGreaterThanOrEqual(4)
    const no = await app.inject({ method: 'GET', url: '/api/admin/grants/margins-summary', headers: { cookie: supportCookie } })
    expect(no.statusCode).toBe(403)
    expect((await app.inject({ method: 'GET', url: '/api/admin/grants/margins-summary' })).statusCode).toBe(401)
  })
})
