/* «جهّز رابط شراء» — الصلاحيّاتُ والأثرُ والعمولة (٥ نوفمبر ٢٠٢٦، المرحلة الثانية). والعلّةُ في `buy-link.service.ts`.

   ① **السوبر أدمن لأيّ متعلّم** — ودورٌ إداريٌّ آخر يُردّ ولو ملك صفحاتِ المنح.
   ② **المستشارُ لحالاته المسندة الآن وحدَها** — والمرفوعُ إسنادُها وحالةُ غيره تُردّان.
   ③ **ولا يضع المستشارُ إلّا كودَ متعلّمه** — لا كوبونا آخر، ولا رابطَ حملة واتساب.
   ④ **والدوراتُ والشعبُ تُصدَّق** — دورةٌ لا وجودَ لها أو شعبةٌ من غير دورتها تُردّ.
   ⑤ **وكلُّ توليدٍ أثر** — من ولّد، ولمن، وأيُّ الدورات والكود، ومتى.
   ⑥ **والرمزُ موقَّع** — المزوَّرُ يُهمَل، والصحيحُ يُكتب في أثر الطلب.
   ⑦ **والعمولةُ «Hybrid»** — رابطُ المستشار والشراءُ بلا رابطٍ يُحسبان كاليوم، ورابطُ السوبر أدمن وحملةُ واتساب لا. */

import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import type { FastifyInstance } from 'fastify'
import type { PrismaClient } from '@prisma/client'
import { setupTestDb, testPrisma } from '../helpers/db'
import { makeAdvisor } from '../helpers/advisor'
import { approvedTrainerPlan } from '../helpers/approved-trainer'
import { AuthService } from '../../services/auth.service'
import { CommerceService } from '../../services/commerce.service'
import { GrantService } from '../../services/grant.service'
import { attributedRevenue } from '../../services/advisor.service'
import { BuyLinkService, verifyBuyLinkToken } from '../../services/buy-link.service'
import { parseBuildLink } from '../../../src/application/commerce/build-link'
import { buildApp } from '../../http/app'
import { MEMBER_GRANT_SLUG } from '../../../src/application/commerce/grant'

let prisma: PrismaClient
let auth: AuthService
let commerce: CommerceService
let links: BuyLinkService
let members: GrantService
let app: FastifyInstance
let superId = ''
let pool: string[] = []
let seq = 0
const STAMP = Date.now()
const SUPER = () => ({ userId: superId, roles: ['super_admin'] })

const nextCourse = () => {
  const id = pool.shift()
  if (!id) throw new Error('نفدت الدوراتُ المنشورة')
  return id
}
async function user(tag: string) {
  return (await auth.register(`bl-${tag}-${++seq}-${STAMP}@test.local`, 'Learner#12345', `${tag} ${seq}`)).userId
}
async function cohort(price = 100, courseId = nextCourse()) {
  return prisma.cohort.create({
    data: {
      plans: { create: await approvedTrainerPlan(prisma) }, courseId, title: `شعبة ${++seq}`,
      status: 'open', registrationOpen: true, financialReady: true, price, currency: 'USD', capacity: 20,
      startsAt: new Date(Date.now() + 30 * 86_400_000),
    } as never,
  })
}
async function advisor() {
  const id = await user('adv')
  await makeAdvisor(prisma, auth, id)
  return { userId: id, roles: ['advisor'] }
}
/** حالةٌ لعميلٍ له نموذجُ منحةٍ وكودُها، مسندةٌ لمستشار */
async function caseWithGrant(advisorId: string) {
  const clientId = await user('client')
  const lead = await prisma.lead.create({ data: { fullName: `عميل ${seq}`, phone: `0796${String(600000 + seq)}`, userId: clientId } })
  const { code } = await members.issue({ leadId: lead.id })
  const c = await prisma.advisorCase.create({ data: { clientId, leadId: lead.id, status: 'contacted' } })
  await prisma.advisorAssignment.create({ data: { caseId: c.id, advisorId, assignedAt: new Date(Date.now() - 86_400_000) } })
  return { caseId: c.id, clientId, leadId: lead.id, code }
}
const tokenOf = (path: string) => new URLSearchParams(path.slice(path.indexOf('?'))).get('bl')
async function pay(userId: string, cohortIds: string[], opts: { code?: string; touch?: object; token?: string | null } = {}) {
  const out = await commerce.checkout(userId, cohortIds, opts.code, undefined, (opts.touch ?? null) as never, opts.token ?? null)
  await commerce.payOrder(out.orderId, userId, `bl-${out.orderId}`)
  return out
}

beforeAll(async () => {
  await setupTestDb()
  prisma = await testPrisma()
  auth = new AuthService(prisma)
  commerce = new CommerceService(prisma)
  links = new BuyLinkService(prisma)
  members = new GrantService(prisma)
  superId = await user('super')
  await auth.setRoles(superId, ['super_admin'])
  await members.update({ active: true, percentOff: 60, maxCourses: 4, maxCodes: null, closesAt: null }, superId)
  pool = (await prisma.course.findMany({ where: { status: 'published' }, select: { id: true }, orderBy: { id: 'asc' } })).map((c) => c.id)
  app = await buildApp(prisma)
}, 240_000)

afterAll(async () => { await app?.close() })

describe('① السوبر أدمن لأي متعلم — ولا دور إداري آخر', () => {
  it('⚠️ يولد لصف المنحة بكوده، والرابط يقرأ دوراته وكوده', async () => {
    const lead = await prisma.lead.create({ data: { fullName: `مسجل ${STAMP}`, phone: '0795000001' } })
    const { code } = await members.issue({ leadId: lead.id })
    expect(await links.prepare(SUPER(), { leadId: lead.id })).toMatchObject({ kind: 'admin', code, canChooseCode: true, canWhatsapp: true })
    const [a, b] = [await cohort(170), await cohort(100)]
    const { path } = await links.generate(SUPER(), { leadId: lead.id }, { courseId: a.courseId, cohortId: a.id, adds: [{ courseId: b.courseId, cohortId: b.id }], code })
    const parsed = parseBuildLink(path.slice(path.indexOf('?')), a.courseId)
    expect(parsed.adds).toEqual([{ courseId: b.courseId, cohortId: b.id }])
    expect(parsed.code).toBe(code)
    expect(verifyBuyLinkToken(tokenOf(path))?.kind).toBe('admin')
  })

  it('⚠️ مدير أكاديمي يملك صفحات المنح يرد', async () => {
    const lead = await prisma.lead.create({ data: { fullName: 'مسجل ٢', phone: '0795000002' } })
    const manager = { userId: await user('mgr'), roles: ['academic_manager', 'operations_manager', 'finance'] }
    await expect(links.prepare(manager, { leadId: lead.id })).rejects.toMatchObject({ code: 'forbidden' })
    const a = await cohort()
    await expect(links.generate(manager, { leadId: lead.id }, { courseId: a.courseId })).rejects.toMatchObject({ code: 'forbidden' })
  })
})

describe('② المستشار لحالاته المسندة الآن وحدها', () => {
  it('⚠️ حالته: يفتح بكود متعلمه — وحالة غيره ومرفوعة الإسناد ترد', async () => {
    const [adv, other] = [await advisor(), await advisor()]
    const mine = await caseWithGrant(adv.userId)
    expect(await links.prepare(adv, { caseId: mine.caseId })).toMatchObject({ kind: 'advisor', code: mine.code, canChooseCode: false, canWhatsapp: false })
    const theirs = await caseWithGrant(other.userId)
    await expect(links.prepare(adv, { caseId: theirs.caseId })).rejects.toMatchObject({ code: 'not_assigned' })
    await prisma.advisorAssignment.updateMany({ where: { caseId: mine.caseId }, data: { unassignedAt: new Date() } })
    await expect(links.prepare(adv, { caseId: mine.caseId })).rejects.toMatchObject({ code: 'not_assigned' })
  })

  it('⚠️ ولا يصل المستشار صفوف المنح بمعرف النموذج', async () => {
    const adv = await advisor()
    const mine = await caseWithGrant(adv.userId)
    await expect(links.prepare(adv, { leadId: mine.leadId })).rejects.toMatchObject({ code: 'forbidden' })
  })
})

describe('③ لا يضع المستشار إلا كود متعلمه', () => {
  it('⚠️ كوبون آخر يرد، ورابط واتساب يرد، وكوده أو بلا كود يمر', async () => {
    const adv = await advisor()
    const c = await caseWithGrant(adv.userId)
    const a = await cohort()
    await prisma.coupon.create({ data: { code: `BIG${STAMP}`, percentOff: 90, active: true } })
    await expect(links.generate(adv, { caseId: c.caseId }, { courseId: a.courseId, code: `BIG${STAMP}` })).rejects.toMatchObject({ code: 'code_not_allowed' })
    await expect(links.generate(adv, { caseId: c.caseId }, { courseId: a.courseId, whatsapp: true })).rejects.toMatchObject({ code: 'forbidden' })
    expect((await links.generate(adv, { caseId: c.caseId }, { courseId: a.courseId, code: c.code })).path).toContain(`code=${c.code}`)
    expect((await links.generate(adv, { caseId: c.caseId }, { courseId: a.courseId })).path).not.toContain('code=')
    expect(await prisma.coupon.count({ where: { code: { startsWith: 'ADV-' }, restrictedToUserId: c.clientId } }), 'أنشأت الأداة كودا').toBe(0)
  })
})

describe('④ الدورات والشعب تصدق', () => {
  it('⚠️ دورة لا وجود لها، وشعبة من غير دورتها، وأكثر من خمس — ترد', async () => {
    const a = await cohort()
    const b = await cohort()
    await expect(links.generate(SUPER(), { leadId: (await prisma.lead.create({ data: { fullName: 'س', phone: '0795000003' } })).id }, { courseId: 'C-NOPE-999' }))
      .rejects.toMatchObject({ code: 'bad_course' })
    const lead = (await prisma.lead.create({ data: { fullName: 'ص', phone: '0795000004' } })).id
    await expect(links.generate(SUPER(), { leadId: lead }, { courseId: a.courseId, cohortId: b.id })).rejects.toMatchObject({ code: 'bad_cohort' })
    const six = pool.slice(0, 6).map((courseId) => ({ courseId, cohortId: null }))
    await expect(links.generate(SUPER(), { leadId: lead }, { courseId: a.courseId, adds: six })).rejects.toMatchObject({ code: 'too_many' })
  })
})

describe('⑤ كل توليد أثر', () => {
  it('⚠️ من ولد، ولمن، وأي الدورات والكود، ومتى', async () => {
    const adv = await advisor()
    const c = await caseWithGrant(adv.userId)
    const a = await cohort()
    const { linkId } = await links.generate(adv, { caseId: c.caseId }, { courseId: a.courseId, cohortId: a.id, code: c.code })
    const ev = await prisma.auditEvent.findFirstOrThrow({ where: { action: 'buy_link.generate', meta: { path: ['linkId'], equals: linkId } } })
    expect(ev).toMatchObject({ actorId: adv.userId, entityType: 'advisor_case', entityId: c.caseId })
    expect(ev.meta).toMatchObject({ kind: 'advisor', code: c.code, courses: [{ courseId: a.courseId, cohortId: a.id }], learner: { userId: c.clientId } })
    expect(ev.createdAt).toBeInstanceOf(Date)
  })
})

describe('⑥ الرمز موقع', () => {
  it('⚠️ المزور يهمل، والصحيح يكتب في أثر الطلب', async () => {
    const lead = (await prisma.lead.create({ data: { fullName: 'ط', phone: '0795000005' } })).id
    const a = await cohort()
    const { path, linkId } = await links.generate(SUPER(), { leadId: lead }, { courseId: a.courseId })
    const token = tokenOf(path)!
    const forged = token.replace('.admin.', '.advisor.')
    expect(verifyBuyLinkToken(forged)).toBeNull()
    expect(verifyBuyLinkToken(`${token.slice(0, -2)}xx`)).toBeNull()
    const buyer = await user('buyer')
    const bad = await commerce.checkout(buyer, [a.id], undefined, undefined, null, forged)
    expect((await prisma.auditEvent.findFirstOrThrow({ where: { action: 'order.checkout', entityId: bad.orderId } })).meta).not.toHaveProperty('buyLink')
    await commerce.cancelOrder(bad.orderId, buyer)
    const good = await commerce.checkout(buyer, [a.id], undefined, undefined, null, token)
    expect((await prisma.auditEvent.findFirstOrThrow({ where: { action: 'order.checkout', entityId: good.orderId } })).meta)
      .toMatchObject({ buyLink: { id: linkId, kind: 'admin', by: superId } })
  })
})

describe('⑦ العمولة Hybrid', () => {
  it('⚠️ رابط المستشار وبلا رابط يحسبان، ورابط السوبر أدمن وحملة واتساب لا', async () => {
    const adv = await advisor()
    const c = await caseWithGrant(adv.userId)
    const fromAdvisor = await cohort(100)
    const own = await links.generate(adv, { caseId: c.caseId }, { courseId: fromAdvisor.courseId, cohortId: fromAdvisor.id })
    await pay(c.clientId, [fromAdvisor.id], { token: tokenOf(own.path) })
    expect(await attributedRevenue(prisma, adv.userId), 'رابط المستشار').toBe(100)

    const plain = await cohort(50)
    await pay(c.clientId, [plain.id])
    expect(await attributedRevenue(prisma, adv.userId), 'بلا رابط كاليوم').toBe(150)

    const fromAdmin = await cohort(70)
    const adminLink = await links.generate(SUPER(), { leadId: c.leadId }, { courseId: fromAdmin.courseId, cohortId: fromAdmin.id })
    await pay(c.clientId, [fromAdmin.id], { token: tokenOf(adminLink.path) })
    expect(await attributedRevenue(prisma, adv.userId), 'حسب رابط السوبر أدمن').toBe(150)

    const fromWhatsapp = await cohort(30)
    await pay(c.clientId, [fromWhatsapp.id], { touch: { utmSource: 'whatsapp', utmCampaign: 'wajeez-sales', at: new Date().toISOString() } })
    expect(await attributedRevenue(prisma, adv.userId), 'حسب حملة واتساب').toBe(150)
  })
})

describe('المسارات', () => {
  it('⚠️ بلا جلسة ترد', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/admin/buy-links/lead/00000000-0000-4000-8000-000000000000' })
    expect(res.statusCode).toBe(401)
    const adv = await app.inject({ method: 'POST', url: '/api/advisor/cases/00000000-0000-4000-8000-000000000000/buy-link', payload: { courseId: 'C-X' } })
    expect(adv.statusCode).toBe(401)
  })
})

describe('⑧ صفحة المنحة تقول من أين جاء الشراء', () => {
  it('⚠️ حملة واتساب، ورابط الإدارة، وبلا رابط لا يسمى', async () => {
    const { registrantsFull } = await import('../../services/grant-registrants.service')
    const buyer = async (tag: string) => {
      const userId = await user(tag)
      const email = (await prisma.user.findUniqueOrThrow({ where: { id: userId } })).email
      const lead = await prisma.lead.create({ data: { fullName: `${tag} ${STAMP}`, phone: `0794${String(700000 + ++seq)}`, email, campaign: MEMBER_GRANT_SLUG } })
      const { code } = await members.issue({ leadId: lead.id })
      return { userId, leadId: lead.id, code }
    }
    const wa = await buyer('wa')
    await pay(wa.userId, [(await cohort(100)).id], { code: wa.code, touch: { utmSource: 'whatsapp', utmCampaign: 'wajeez-sales', at: new Date().toISOString() } })
    const adm = await buyer('adm')
    const c = await cohort(100)
    const link = await links.generate(SUPER(), { leadId: adm.leadId }, { courseId: c.courseId, cohortId: c.id, code: adm.code })
    await pay(adm.userId, [c.id], { code: adm.code, token: tokenOf(link.path) })
    const plain = await buyer('plain')
    await pay(plain.userId, [(await cohort(100)).id], { code: plain.code })

    const { rows } = await registrantsFull(prisma)
    const row = (id: string) => rows.find((r) => r.id === id)!
    expect(row(wa.leadId)).toMatchObject({ state: 'bought', boughtVia: ['حملة واتساب'] })
    expect(row(adm.leadId).boughtVia).toEqual(['رابط من الإدارة'])
    expect(row(plain.leadId)).toMatchObject({ state: 'bought', boughtVia: [] })
  })
})
