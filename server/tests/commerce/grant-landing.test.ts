/* صفحةُ «منحة أعضاء وجيز» على الخادم (٢٠ أكتوبر ٢٠٢٦) — والعلّةُ في رأس `grant-landing.service.ts`.

   ① **النموذجُ يعطي الكودَ فورا** — عميلٌ محتملٌ بوسوم الحملة، وكودُه في الردّ وفي بريده.
   ② **ومن عبّأه ثانيةً لا يُعرض له الكود** — يُرسَل إلى البريد المحفوظ ويُقال أين، بلا عميلٍ ثانٍ ولا كودٍ ثانٍ.
   ③ **والمنحةُ المغلقةُ لا تُسقط العميل** — يُحفظ ويُقال السبب.
   ④ **وما لا يُقبل يُردّ** — رقمٌ ليس رقما، ومجالٌ من غير القائمة.
   ⑤ **والمساراتُ للزائر بلا أجور المدرّبين** — وما لا يُشترى منها لا يُعرض.
   ⑥ **و«تواصل مع مستشار» حالةٌ واحدة** تُسند — وبمرجعٍ صحيحٍ وحدَه.
   ⑦ **والوسومُ تُنظَّف** — ما ليس وسما يُترك.
   ⑧ **ونتائجُ الحملة بالقناة والدفعة** — والشراءُ يُنسب إلى قناة صاحب الكود ولو اشترى به غيرُه. */

import { beforeAll, describe, expect, it } from 'vitest'
import type { PrismaClient } from '@prisma/client'
import { setupTestDb, testPrisma } from '../helpers/db'
import { AuthService } from '../../services/auth.service'
import { GrantService } from '../../services/grant.service'
import { GrantPathwayService } from '../../services/grant-pathway.service'
import { GrantLandingService, grantResults, maskEmail } from '../../services/grant-landing.service'
import { CommerceService } from '../../services/commerce.service'
import { approvedPlanBy } from '../helpers/approved-trainer'

let prisma: PrismaClient
let grants: GrantService
let paths: GrantPathwayService
let landing: GrantLandingService
let ownerId = ''
let profileId = ''
let pool: string[] = []
let seq = 0
const STAMP = Date.now()
const DAY = 86_400_000

const nextCourse = () => {
  const id = pool.shift()
  if (!id) throw new Error('نفدت الدوراتُ المنشورة')
  return id
}
async function cohort(courseId: string, over: Record<string, unknown> = {}) {
  const c = await prisma.cohort.create({
    data: {
      plans: { create: approvedPlanBy(profileId) },
      courseId, title: `شعبة صفحة المنحة ${++seq}`, status: 'open', registrationOpen: true, financialReady: true,
      price: 150, currency: 'USD', capacity: 20, startsAt: new Date(Date.now() + 30 * DAY), ...over,
    } as never,
  })
  await prisma.cohortTrainer.create({ data: { cohortId: c.id, profileId, role: 'lead', assignedBy: ownerId } })
  return c
}
const person = (over: Partial<{ fullName: string; phone: string; email: string; workField: string; channel: string; wave: string }> = {}) => ({
  fullName: `عضو وجيز ${++seq}`, phone: `0791${String(500000 + seq)}`, email: `member-${seq}-${STAMP}@test.local`,
  workField: 'الموارد البشرية', ...over,
})

beforeAll(async () => {
  await setupTestDb()
  prisma = await testPrisma()
  const auth = new AuthService(prisma)
  grants = new GrantService(prisma)
  paths = new GrantPathwayService(prisma)
  landing = new GrantLandingService(prisma)
  ownerId = (await auth.register(`gl-owner-${STAMP}@test.local`, 'Owner#12345', 'صاحب المنصة')).userId
  const advisor = (await auth.register(`gl-adv-${STAMP}@test.local`, 'Advisor#12345', 'مستشار الحملة')).userId
  await auth.setRoles(advisor, ['advisor'])
  const user = await prisma.user.create({ data: { email: `gl-tr-${STAMP}@wajeez.test`, displayName: 'مدرب', passwordHash: 'x' } })
  const app = await prisma.trainerApplication.create({ data: { reference: `WJ-TR-GL-${STAMP}`, fullName: 'مدرب', email: user.email, status: 'active' } })
  profileId = (await prisma.trainerProfile.create({ data: { userId: user.id, applicationId: app.id } })).id
  await prisma.trainerCompensationRule.create({ data: { profileId, type: 'per_seat', rate: 50, effectiveFrom: new Date(Date.now() - DAY) } })
  pool = (await prisma.course.findMany({ where: { status: 'published' }, select: { id: true }, orderBy: { id: 'desc' } })).map((c) => c.id)
  await grants.update({ active: true, percentOff: 60, maxCodes: null, maxCourses: 4, closesAt: null }, ownerId)
}, 240_000)

describe('① النموذج يعطي الكود فورا', () => {
  it('⚠️ عميل بوسوم الحملة، وكوده في الرد وفي بريده', async () => {
    const p = person({ channel: 'whatsapp', wave: '1' })
    const out = await landing.apply(p)
    expect(out.grant?.code).toMatch(/^WG-/)
    expect(out.grant?.sentTo).toBeNull()
    const lead = await prisma.lead.findUniqueOrThrow({ where: { id: out.ref } })
    expect(lead).toMatchObject({ source: 'campaign', campaign: 'wajeez-members', channel: 'whatsapp', wave: '1', workField: 'الموارد البشرية', email: p.email })
    expect(lead.consentAr).toContain('كود المنحة')
    const mail = await prisma.outboxMail.findFirst({ where: { to: p.email, purpose: 'grant.code' }, orderBy: { createdAt: 'desc' } })
    expect(mail?.text, 'لم يصل الكود بريده').toContain(out.grant!.code!)
  })
})

describe('② ومن عبأه ثانية لا يعرض له الكود', () => {
  it('⚠️ يرسل إلى البريد المحفوظ ويقال أين — بلا عميل ثان ولا كود ثان', async () => {
    const p = person()
    const first = await landing.apply(p)
    const other = `stranger-${STAMP}@test.local`
    const again = await landing.apply({ ...p, email: other })
    expect(again.ref).toBe(first.ref)
    expect(again.grant?.code, 'عرض كود صاحب الرقم لمن كتب رقمه').toBeNull()
    expect(again.grant?.sentTo).toBe(maskEmail(p.email))
    expect(await prisma.lead.count({ where: { phone: p.phone } })).toBe(1)
    expect(await prisma.grantCode.count({ where: { leadId: first.ref } })).toBe(1)
    expect(await prisma.outboxMail.count({ where: { to: p.email, purpose: 'grant.code' } }), 'لم يرسل ثانية إلى صاحبه').toBe(2)
    expect(await prisma.outboxMail.count({ where: { to: other } }), 'أرسل الكود إلى بريد غريب').toBe(0)
  })
})

describe('③ والمنحة المغلقة لا تسقط العميل', () => {
  it('⚠️ يحفظ ويقال السبب', async () => {
    await grants.update({ active: false }, ownerId)
    try {
      const p = person()
      const out = await landing.apply(p)
      expect(out.grant).toBeNull()
      expect(out.reasonAr).toBe('المنحة مغلقة الآن')
      expect(await prisma.lead.count({ where: { email: p.email, campaign: 'wajeez-members' } })).toBe(1)
    } finally {
      await grants.update({ active: true }, ownerId)
    }
  })
})

describe('④ وما لا يقبل يرد', () => {
  it('⚠️ رقم ليس رقما، ومجال من غير القائمة', async () => {
    await expect(landing.apply(person({ phone: 'abc' }))).rejects.toMatchObject({ code: 'bad_phone' })
    await expect(landing.apply(person({ workField: 'مجال مختلق' }))).rejects.toMatchObject({ code: 'bad_field' })
  })
})

describe('⑤ والمسارات للزائر بلا أجور المدربين', () => {
  it('⚠️ لا أجر ولا هامش في الرد — وما لا يشترى لا يعرض، والموقوف لا يعرض', async () => {
    const [a, b, c] = [nextCourse(), nextCourse(), nextCourse()]
    await cohort(a)
    const cb = await cohort(b)
    await cohort(c)
    const shown = await paths.save(null, { titleAr: 'مسار للزائر', courseIds: [a, b] }, ownerId)
    const hidden = await paths.save(null, { titleAr: 'مسار موقوف', courseIds: [c], active: false }, ownerId)
    const dead = await paths.save(null, { titleAr: 'مسار أغلقت شعبه', courseIds: [b] }, ownerId)
    await prisma.cohort.update({ where: { id: cb.id }, data: { registrationOpen: false } })

    const v = await landing.view()
    const json = JSON.stringify(v)
    expect(json, 'خرج أجر المدرب إلى الزائر').not.toMatch(/seatCost|margin|ruleRate|ruleType/)
    const row = v.pathways.find((p) => p.id === shown.id)!
    expect(row.courses.map((x) => x.courseId)).toEqual([a])
    expect(row.listTotal).toBe(150)
    expect(row.grantTotal).toBe(60)
    expect(v.pathways.some((p) => p.id === hidden.id), 'عرض مسارا موقوفا').toBe(false)
    expect(v.pathways.some((p) => p.id === dead.id), 'عرض مسارا لا يشترى منه شيء').toBe(false)
    expect(v.openCourses.some((x) => x.courseId === c)).toBe(true)
  })
})

describe('⑥ وتواصل مع مستشار حالة واحدة', () => {
  it('⚠️ تسند تلقائيا — والثانية لا تنشئ حالة، والمرجع الخاطئ يرد', async () => {
    const out = await landing.apply(person())
    await landing.askAdvisor(out.ref, 'أريد أن أعرف أي مسار يناسبني')
    await landing.askAdvisor(out.ref)
    const cases = await prisma.advisorCase.findMany({ where: { leadId: out.ref }, include: { assignments: true, contactEvents: true } })
    expect(cases).toHaveLength(1)
    expect(cases[0].assignments.some((x) => x.unassignedAt === null), 'لم تسند').toBe(true)
    expect(cases[0].contactEvents[0]?.summary).toContain('أي مسار يناسبني')
    await expect(landing.askAdvisor('00000000-0000-4000-8000-000000000000')).rejects.toMatchObject({ code: 'not_found' })
  })
})

describe('⑦ والوسوم تنظف', () => {
  it('ما ليس وسما يترك', async () => {
    const out = await landing.apply(person({ channel: 'WhatsApp', wave: '<script>' }))
    const lead = await prisma.lead.findUniqueOrThrow({ where: { id: out.ref } })
    expect(lead.channel).toBe('whatsapp')
    expect(lead.wave).toBeNull()
  })
})

describe('⑧ ونتائج الحملة بالقناة والدفعة', () => {
  it('⚠️ من عبأ ومن أخذ كودا ومن اشترى وبكم — والمهدى يحسب لقناة صاحب الكود', async () => {
    const ch = `t${STAMP % 1_000_000_000}`
    const a = await landing.apply(person({ channel: ch, wave: '1', workField: 'الهندسة' }))
    const b = await landing.apply(person({ channel: ch, wave: '1', workField: 'الهندسة' }))
    await landing.apply(person({ channel: ch, wave: '2' }))
    /* صديقٌ اشترى بكود الأوّل */
    const friend = (await new AuthService(prisma).register(`gl-friend-${STAMP}@test.local`, 'Friend#12345', 'صديق')).userId
    const commerce = new CommerceService(prisma)
    const c = await cohort(nextCourse())
    const out = await commerce.checkout(friend, [c.id], a.grant!.code!)
    await commerce.payOrder(out.orderId, friend, `gl-${out.orderId}`)
    /* وآخرُ فتح طلبا بكود الثاني ولم يدفع — لا يُعدّ شراءً */
    const idle = (await new AuthService(prisma).register(`gl-idle-${STAMP}@test.local`, 'Idle#12345', 'لم يدفع')).userId
    await commerce.checkout(idle, [(await cohort(nextCourse())).id], b.grant!.code!)

    const r = await grantResults(prisma)
    const w1 = r.rows.find((x) => x.channel === ch && x.wave === '1')!
    expect(w1).toMatchObject({ leads: 2, codes: 2, bought: 1, revenue: 60 })
    expect(r.rows.find((x) => x.channel === ch && x.wave === '2')).toMatchObject({ leads: 1, codes: 1, bought: 0, revenue: 0 })
    expect(r.fields.find((f) => f.workField === 'الهندسة')!.leads).toBeGreaterThanOrEqual(2)
    expect(r.totals.leads).toBeGreaterThanOrEqual(3)
  })
})
