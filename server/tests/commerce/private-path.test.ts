/* «مسارٌ خاصّ» باسم المتعلّم — `/go/<رمز>` (٥ نوفمبر ٢٠٢٦). والعلّةُ في `private-path.service.ts` و`buy-link.service.ts`.

   ① **يُولَّد من «جهز رابط شراء» بصلاحيّاته** — رابطٌ قصيرٌ من ثمانية أحرف، وأثرُ توليده يقول من ولمن ومتى ورمزَه.
   ② **والصفحةُ باسمه الأوّل وحدَه** — دوراتُه مرقّمةً بأسبابها، ولا بريدَ ولا هاتفَ ولا اسمَ عائلة في جوابها.
   ③ **والسعرُ سعرُ الدفع** — من المعاينة نفسِها، وآخرُ يومٍ للمنحة.
   ④ **وما يردّه الدفعُ يُقال لمن يولّده** — كودٌ لا يسع عددَ الدورات يُردّ قبل أن يُرسل.
   ⑤ **والتعديلُ رابطٌ جديد** — والقديمُ يحوّل إليه.
   ⑥ **والرمزُ لا يُخمَّن** — المجهولُ جوابُه «غير صحيح»، ومن جرّب عشرةً خاطئةً يُوقف.
   ⑦ **والفتحاتُ تُعدّ** — الإنسانُ لا الزاحف.
   ⑧ **والنسبةُ باقية** — الطلبُ من رابطه يُنسب إلى مولّده، ورابطُ حملة واتساب يُقال «حملة واتساب». */

import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import type { FastifyInstance } from 'fastify'
import type { PrismaClient } from '@prisma/client'
import { setupTestDb, testPrisma } from '../helpers/db'
import { makeAdvisor } from '../helpers/advisor'
import { approvedTrainerPlan } from '../helpers/approved-trainer'
import { AuthService } from '../../services/auth.service'
import { CommerceService } from '../../services/commerce.service'
import { GrantService } from '../../services/grant.service'
import { BuyLinkService } from '../../services/buy-link.service'
import { PrivatePathService, type PrivatePathView } from '../../services/private-path.service'
import { buildApp } from '../../http/app'
import { orderViaAr } from '../../../src/application/commerce/buy-link-campaign'
import { grantClosesAt } from '../../../src/application/commerce/grant'

let prisma: PrismaClient
let auth: AuthService
let commerce: CommerceService
let links: BuyLinkService
let paths: PrivatePathService
let members: GrantService
let app: FastifyInstance
let superId = ''
let pool: string[] = []
let seq = 0
const STAMP = Date.now()
const SUPER = () => ({ userId: superId, roles: ['super_admin'] })
const HUMAN = { ip: '10.9.0.1', userAgent: 'Mozilla/5.0 (iPhone)' }

const nextCourse = () => {
  const id = pool.shift()
  if (!id) throw new Error('نفدت الدوراتُ المنشورة')
  return id
}
async function user(tag: string, name = `${tag} ${seq}`) {
  return (await auth.register(`pp-${tag}-${++seq}-${STAMP}@test.local`, 'Learner#12345', name)).userId
}
async function cohort(price = 100) {
  return prisma.cohort.create({
    data: {
      plans: { create: await approvedTrainerPlan(prisma) }, courseId: nextCourse(), title: `شعبة المسار ${++seq}`,
      status: 'open', registrationOpen: true, financialReady: true, price, currency: 'USD', capacity: 20,
      startsAt: new Date(Date.now() + 30 * 86_400_000),
    } as never,
  })
}
/** متعلّمٌ له نموذجُ منحةٍ بكودها — ببريدٍ وهاتفٍ لا يجوز أن يظهرا في صفحته */
async function learnerWithGrant() {
  const clientId = await user('client', 'صهيب عبد الله الخطيب')
  const lead = await prisma.lead.create({
    data: { fullName: 'صهيب عبد الله الخطيب', phone: `0797${String(700000 + seq)}`, email: `pp-lead-${seq}-${STAMP}@test.local`, userId: clientId },
  })
  const { code } = await members.issue({ leadId: lead.id })
  return { clientId, leadId: lead.id, code, phone: lead.phone, email: lead.email! }
}
const codeOf = (goPath: string) => goPath.split('/').pop()!
const view = async (code: string, who = HUMAN) => (await paths.view(code, who)) as PrivatePathView

beforeAll(async () => {
  await setupTestDb()
  prisma = await testPrisma()
  auth = new AuthService(prisma)
  commerce = new CommerceService(prisma)
  links = new BuyLinkService(prisma)
  paths = new PrivatePathService(prisma)
  members = new GrantService(prisma)
  superId = await user('super')
  await auth.setRoles(superId, ['super_admin'])
  await members.update({ active: true, percentOff: 60, maxCourses: 2, maxCodes: null, closesAt: new Date(grantClosesAt('2098-12-31')) }, superId)
  pool = (await prisma.course.findMany({ where: { status: 'published' }, select: { id: true }, orderBy: { id: 'desc' } })).map((c) => c.id)
  app = await buildApp(prisma)
}, 240_000)
afterAll(async () => { await app?.close() })

describe('① يولد من «جهز رابط شراء» بصلاحياته', () => {
  it('⚠️ رابط قصير من ثمانية أحرف — والأثر يقول من ولمن ورمزه', async () => {
    const l = await learnerWithGrant()
    const [a, b] = [await cohort(), await cohort()]
    const out = await links.generate(SUPER(), { leadId: l.leadId }, {
      courseId: a.courseId, cohortId: a.id, adds: [{ courseId: b.courseId, cohortId: b.id }], code: l.code,
      reasons: { [a.courseId]: 'تبني أساس التحليل' },
    })
    expect(out.goPath).toMatch(/^\/go\/[A-Z0-9]{8}$/)
    expect(out.goUrl?.endsWith(out.goPath!)).toBe(true)
    const ev = await prisma.auditEvent.findFirstOrThrow({ where: { action: 'buy_link.generate', meta: { path: ['goCode'], equals: codeOf(out.goPath!) } } })
    expect(ev.actorId, 'لا يقول الأثر من ولد').toBe(superId)
    expect((ev.meta as { learner: { leadId: string } }).learner.leadId).toBe(l.leadId)
  })

  it('⚠️ والمستشار لحالة غيره يرد', async () => {
    const adv = (await user('adv'))
    await makeAdvisor(prisma, auth, adv)
    const l = await learnerWithGrant()
    const c = await prisma.advisorCase.create({ data: { clientId: l.clientId, leadId: l.leadId, status: 'contacted' } })
    const a = await cohort()
    await expect(links.generate({ userId: adv, roles: ['advisor'] }, { caseId: c.id }, { courseId: a.courseId, cohortId: a.id }))
      .rejects.toMatchObject({ code: 'not_assigned' })
  })
})

describe('② الصفحة باسمه الأول وحده', () => {
  it('⚠️ «مسار صهيب» بدوراته مرقمة وأسبابها — ولا بريد ولا هاتف ولا اسم عائلة', async () => {
    const l = await learnerWithGrant()
    const [a, b] = [await cohort(), await cohort()]
    const out = await links.generate(SUPER(), { leadId: l.leadId }, {
      courseId: a.courseId, cohortId: a.id, adds: [{ courseId: b.courseId, cohortId: b.id }], code: l.code,
      reasons: { [a.courseId]: '  تبني   أساس التحليل  ', [b.courseId]: '' },
    })
    const v = await view(codeOf(out.goPath!))
    expect(v.firstName).toBe('صهيب')
    expect(v.courses.map((c) => [c.n, c.cohortId, c.reasonAr])).toEqual([[1, a.id, 'تبني أساس التحليل'], [2, b.id, null]])
    const json = JSON.stringify(v)
    for (const secret of [l.email, l.phone, 'الخطيب', 'عبد الله']) expect(json, `ظهر في الصفحة: ${secret}`).not.toContain(secret)
  })

  it('⚠️ ومجال عمله ومستواه من نموذجه للعنوان — ولو ولد الرابط قبل أن يكتبهما', async () => {
    const l = await learnerWithGrant()
    const a = await cohort()
    const out = await links.generate(SUPER(), { leadId: l.leadId }, { courseId: a.courseId, cohortId: a.id, code: l.code })
    const code = codeOf(out.goPath!)
    expect((await view(code)).profile).toEqual({ workField: null, careerLevel: null })
    await prisma.lead.update({ where: { id: l.leadId }, data: { workField: 'الإدارة والقيادة', careerLevel: 'مدير' } })
    expect((await view(code)).profile).toEqual({ workField: 'الإدارة والقيادة', careerLevel: 'مدير' })
    /* ونموذجٌ محيت بياناتُه لا يُقرأ */
    await prisma.lead.update({ where: { id: l.leadId }, data: { erasedAt: new Date() } })
    expect((await view(code)).profile).toEqual({ workField: null, careerLevel: null })
  })
})

describe('③ والسعر سعر الدفع', () => {
  it('⚠️ قبل المنحة وقيمتها وما يدفعه — كالمعاينة — وآخر يوم للمنحة', async () => {
    const l = await learnerWithGrant()
    const [a, b] = [await cohort(100), await cohort(150)]
    const out = await links.generate(SUPER(), { leadId: l.leadId }, {
      courseId: a.courseId, cohortId: a.id, adds: [{ courseId: b.courseId, cohortId: b.id }], code: l.code,
    })
    const v = await view(codeOf(out.goPath!))
    const q = await commerce.preview(null, [a.id, b.id], l.code)
    expect(v.price).toMatchObject({ before: 250, total: q.total, currency: 'USD' })
    expect(v.price!.total).toBe(100)
    expect(v.price!.before - v.price!.grant).toBe(v.price!.total)
    expect(v.lastDay).toBe('2098-12-31')
    expect(v.couponCode).toBe(l.code)
  })
})

describe('④ وما يرده الدفع يقال لمن يولده', () => {
  it('⚠️ كود منحة لدورتين ومساره ثلاث — يرد قبل أن يرسل', async () => {
    const l = await learnerWithGrant()
    const [a, b, c] = [await cohort(), await cohort(), await cohort()]
    await expect(links.generate(SUPER(), { leadId: l.leadId }, {
      courseId: a.courseId, cohortId: a.id, adds: [{ courseId: b.courseId, cohortId: b.id }, { courseId: c.courseId, cohortId: c.id }], code: l.code,
    })).rejects.toMatchObject({ code: 'path_code' })
  })
})

describe('⑤ والتعديل رابط جديد', () => {
  it('⚠️ القديم يحول إلى الأحدث — ولو عدل مرتين', async () => {
    const l = await learnerWithGrant()
    const [a, b] = [await cohort(), await cohort()]
    const gen = (ids: { courseId: string; id: string }[]) => links.generate(SUPER(), { leadId: l.leadId }, {
      courseId: ids[0].courseId, cohortId: ids[0].id, adds: ids.slice(1).map((x) => ({ courseId: x.courseId, cohortId: x.id })), code: l.code,
    })
    const first = codeOf((await gen([a])).goPath!)
    const second = codeOf((await gen([a, b])).goPath!)
    const third = codeOf((await gen([b])).goPath!)
    expect(await paths.view(first, HUMAN)).toEqual({ movedTo: third })
    expect(await paths.view(second, HUMAN)).toEqual({ movedTo: third })
    expect((await view(third)).courses.map((c) => c.cohortId)).toEqual([b.id])
  })
})

describe('⑥ والرمز لا يخمن', () => {
  it('⚠️ المجهول «غير صحيح» — ومن جرب عشرة خاطئة يوقف', async () => {
    await expect(paths.view('ABCDEFGH', HUMAN)).rejects.toMatchObject({ code: 'not_found' })
    await expect(paths.view('../etc', HUMAN)).rejects.toMatchObject({ code: 'not_found' })
    const statuses: number[] = []
    for (let i = 0; i < 12; i++) {
      const res = await app.inject({ method: 'GET', url: `/api/public/go/ZZZZZZ${String(i).padStart(2, '2')}`, remoteAddress: '10.77.0.9' })
      statuses.push(res.statusCode)
    }
    expect(statuses.slice(0, 10).every((s) => s === 404), 'لم يقل غير صحيح').toBe(true)
    expect(statuses.slice(10), 'لم يوقف من جرب كثيرا').toEqual([429, 429])
  })
})

describe('⑦ والفتحات تعد', () => {
  it('⚠️ الإنسان يعد والزاحف لا', async () => {
    const l = await learnerWithGrant()
    const a = await cohort()
    const code = codeOf((await links.generate(SUPER(), { leadId: l.leadId }, { courseId: a.courseId, cohortId: a.id, code: l.code })).goPath!)
    await view(code, { ip: '10.9.1.1', userAgent: 'WhatsApp/2.23' })
    await view(code)
    const link = await prisma.shortLink.findUniqueOrThrow({ where: { code }, select: { id: true } })
    expect(await prisma.shortLinkOpen.count({ where: { linkId: link.id } })).toBe(1)
  })
})

describe('⑧ والنسبة باقية', () => {
  it('⚠️ الطلب من رابطه ينسب إلى مولده — ورابط حملة واتساب «حملة واتساب»', async () => {
    const l = await learnerWithGrant()
    const a = await cohort()
    const out = await links.generate(SUPER(), { leadId: l.leadId }, { courseId: a.courseId, cohortId: a.id, code: l.code, whatsapp: true })
    const v = await view(codeOf(out.goPath!))
    const order = await commerce.checkout(l.clientId, [a.id], v.couponCode ?? undefined, undefined, null, v.buyLinkToken)
    const ev = await prisma.auditEvent.findFirstOrThrow({ where: { action: 'order.checkout', entityId: order.orderId } })
    expect((ev.meta as { buyLink?: { kind: string; by: string } }).buyLink).toMatchObject({ kind: 'admin', by: superId })
    expect(orderViaAr(ev.meta), 'ضاع أنه من حملة واتساب').toBe('حملة واتساب')
  })
})
