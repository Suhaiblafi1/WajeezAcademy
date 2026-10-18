/* «اترك رقمك ويتواصل معك مستشار» — آخرَ التشخيص، لمن لا حساب له (١٨ أكتوبر ٢٠٢٦).

   قرارُ صاحب المنصّة: سؤالٌ اختياريٌّ في آخر التشخيص، ببريدٍ أو واتساب. والعلّةُ في
   `src/application/advisor/guest-contact.ts`، وحدودُه في `AdvisorService#requestContactAsGuest`.

   والمقيس:
   ① **طلبُه حالةٌ في طابور «بلا مستشار»** — بعميلٍ محتملٍ ونتيجتِه ونصِّ ما وافق عليه.
   ② **ولا حالةَ بلا سبيلٍ إليه** — ولا رقمٌ ليس رقما.
   ③ **ولا حالتان لصاحبٍ واحد** — والعائدُ يُكتب في سيرة حالته، ولا يُمسّ عميلُها.
   ④ **ولا يُربط بحسابٍ ببريدٍ مكتوب** — البريدُ هنا لم يُثبَت.
   ⑤ **والنتيجةُ تُعين ولا تشترط** — ما جاء أكبرَ من حدّه يسقط وحدَه ويبقى الطلب.
   ⑥ **وعلى السلك: الفخُّ والسقف** — بابٌ عامٌّ بلا مصادقة. */

import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import type { PrismaClient } from '@prisma/client'
import type { FastifyInstance } from 'fastify'
import { setupTestDb, testPrisma } from '../helpers/db'
import { AuthService } from '../../services/auth.service'
import { AdvisorService } from '../../services/advisor.service'
import { buildApp } from '../../http/app'
import { GUEST_CONTACT_CONSENT_AR, GUEST_SNAPSHOT_MAX_CHARS } from '../../../src/application/advisor/guest-contact'

let prisma: PrismaClient
let auth: AuthService
let advisors: AdvisorService
let app: FastifyInstance

const SNAPSHOT = { top: { id: 'PW-FND-003', name: 'مسار القيادة' }, confidenceBand: 'medium', reasons: ['هدفك قيادي'] }

const caseOfPhone = (phone: string) =>
  prisma.advisorCase.findMany({ where: { lead: { phone } }, include: { lead: true, assignments: true, contactEvents: true } })

beforeAll(async () => {
  await setupTestDb()
  prisma = await testPrisma()
  auth = new AuthService(prisma)
  advisors = new AdvisorService(prisma)
  app = await buildApp(prisma)
  await app.ready()
}, 240_000)

afterAll(async () => {
  await app?.close()
})

describe('① طلبُه حالةٌ في طابور «بلا مستشار»', () => {
  it('⚠️ عميلٌ محتمل بنتيجته ونصِّ موافقته، وحالةٌ بلا إسناد', async () => {
    await advisors.requestContactAsGuest(
      { fullName: 'زائر التشخيص', phone: '+962 79 111 2233', email: 'Guest.One@Test.Local', snapshot: SNAPSHOT },
      '10.0.0.1',
    )
    const [kase] = await caseOfPhone('+962791112233')
    expect(kase, 'لم تُفتح حالة').toBeDefined()
    expect(kase!.lead).toMatchObject({
      fullName: 'زائر التشخيص', email: 'guest.one@test.local', source: 'diagnostic', consentAr: GUEST_CONTACT_CONSENT_AR,
    })
    expect(kase!.diagnosticSnapshot).toMatchObject({ confidenceBand: 'medium' })
    expect(kase!.status).toBe('new')
    expect(kase!.assignments, 'أُسندت وحدَها — والإسنادُ لإداريّ').toHaveLength(0)

    const queue = await advisors.listUnassigned()
    expect(queue.some((c) => c.id === kase!.id), 'لم تقع في طابور «حالات بلا مستشار»').toBe(true)

    const audit = await prisma.auditEvent.findFirst({ where: { action: 'advisor.case.guest_request', entityId: kase!.id } })
    expect(audit?.ip).toBe('10.0.0.1')
  })

  it('والرقمُ وحدَه يكفي — بأرقامٍ عربيّة و`00` مكان `+`', async () => {
    await advisors.requestContactAsGuest({ fullName: 'زائر بالواتساب', phone: '٠٠٩٦٦ ٥٥ ١٢٣ ٤٥٦٧' })
    const [kase] = await caseOfPhone('+966551234567')
    expect(kase?.lead?.email ?? null).toBeNull()
    expect(kase?.diagnosticSnapshot ?? null, 'نتيجةٌ اختُلقت لمن لم يرسلها').toBeNull()
  })
})

describe('② ولا حالةَ بلا سبيلٍ إليه', () => {
  it('⚠️ لا بريدَ ولا رقم — يُردّ', async () => {
    await expect(advisors.requestContactAsGuest({ fullName: 'بلا قناة' })).rejects.toMatchObject({ code: 'no_contact' })
  })

  it('⚠️ وما ليس رقما يُردّ ولا يُحفظ كما هو', async () => {
    await expect(advisors.requestContactAsGuest({ fullName: 'رقم خاطئ', phone: 'اتصل بي' }))
      .rejects.toMatchObject({ code: 'bad_phone' })
    expect(await prisma.lead.count({ where: { fullName: 'رقم خاطئ' } })).toBe(0)
  })

  it('والاسمُ حرفان على الأقلّ', async () => {
    await expect(advisors.requestContactAsGuest({ fullName: ' ا ', phone: '0791234567' }))
      .rejects.toMatchObject({ code: 'bad_name' })
  })
})

describe('③ ولا حالتان لصاحبٍ واحد', () => {
  it('⚠️ أعاد الطلبَ برقمه — حالتُه نفسُها، وعودتُه في سيرتها', async () => {
    await advisors.requestContactAsGuest({ fullName: 'زائر عائد', phone: '0790000001' })
    await advisors.requestContactAsGuest({ fullName: 'زائر عائد', phone: '079 000 0001', email: 'back@test.local' })
    const cases = await caseOfPhone('0790000001')
    expect(cases, 'فُتحت له حالةٌ ثانية').toHaveLength(1)
    expect(cases[0]!.contactEvents).toHaveLength(1)
    expect(cases[0]!.contactEvents[0]!.summary).toContain('back@test.local')
  })

  it('⚠️ ومن عرف بريدَ غيره لا يبدّل به رقمَ ذاك في حالته', async () => {
    await advisors.requestContactAsGuest({ fullName: 'صاحب البريد', email: 'owner@test.local', phone: '0790000002' })
    await advisors.requestContactAsGuest({ fullName: 'منتحل', email: 'owner@test.local', phone: '0790000099' })
    const [kase] = await caseOfPhone('0790000002')
    expect(kase!.lead!.fullName).toBe('صاحب البريد')
    expect(await prisma.lead.count({ where: { phone: '0790000099' } }), 'رقمُ المنتحل صار عميلا').toBe(0)
  })

  it('والحالةُ المغلقةُ لا تمنع طلبا جديدا', async () => {
    await advisors.requestContactAsGuest({ fullName: 'زائر قديم', phone: '0790000003' })
    const [old] = await caseOfPhone('0790000003')
    await prisma.advisorCase.update({ where: { id: old!.id }, data: { status: 'closed' } })
    await advisors.requestContactAsGuest({ fullName: 'زائر قديم', phone: '0790000003' })
    expect(await caseOfPhone('0790000003')).toHaveLength(2)
  })
})

describe('④ ولا يُربط بحسابٍ ببريدٍ مكتوب', () => {
  it('⚠️ بريدُ حسابٍ قائم — الحالةُ بلا صاحب حساب', async () => {
    const { userId } = await auth.register('has-account@test.local', 'Learner#12345', 'صاحب حساب')
    await advisors.requestContactAsGuest({ fullName: 'من كتب بريدا', email: 'has-account@test.local', phone: '0790000004' })
    const [kase] = await caseOfPhone('0790000004')
    expect(kase!.clientId, 'رُبطت الحالةُ بحسابٍ لم يُثبت أحدٌ أنّه له').toBeNull()
    expect(kase!.lead!.userId).toBeNull()
    expect(await prisma.advisorCase.count({ where: { clientId: userId } })).toBe(0)
  })
})

describe('⑤ والنتيجةُ تُعين ولا تشترط', () => {
  it('⚠️ أكبرُ من حدّها — تسقط وحدَها ويبقى الطلب', async () => {
    const huge = { pad: 'x'.repeat(GUEST_SNAPSHOT_MAX_CHARS) }
    await advisors.requestContactAsGuest({ fullName: 'نتيجة ضخمة', phone: '0790000005', snapshot: huge })
    const [kase] = await caseOfPhone('0790000005')
    expect(kase, 'رُدّ الطلبُ كلُّه بسبب نتيجته').toBeDefined()
    expect(kase!.diagnosticSnapshot ?? null).toBeNull()
  })

  it('وما ليس كائنا لا يُحفظ نتيجةً', async () => {
    await advisors.requestContactAsGuest({ fullName: 'نتيجة مصفوفة', phone: '0790000006', snapshot: [1, 2, 3] })
    const [kase] = await caseOfPhone('0790000006')
    expect(kase!.diagnosticSnapshot ?? null).toBeNull()
  })
})

describe('⑥ وعلى السلك: الفخُّ والسقف', () => {
  const post = (payload: Record<string, unknown>) =>
    app.inject({ method: 'POST', url: '/api/public/advisor-contact', payload, remoteAddress: '10.9.9.9' })

  it('⚠️ يُقبل بلا حساب ويعيد نصَّ الموافقة — والفخُّ يُردّ — والرابعُ في ربع ساعةٍ يُردّ', async () => {
    const trap = await post({ fullName: 'آلي', phone: '0790000007', website: 'http://spam.example' })
    expect(trap.statusCode).toBe(400)
    expect(await prisma.lead.count({ where: { phone: '0790000007' } })).toBe(0)

    const badEmail = await post({ fullName: 'بريد خاطئ', email: 'ليس-بريدا' })
    expect(badEmail.statusCode, 'بريدٌ ليس بريدا قُبل').toBe(422)

    const ok = await post({ fullName: 'زائر السلك', phone: '0790000008', snapshot: SNAPSHOT })
    expect(ok.statusCode).toBe(201)
    expect(ok.json()).toEqual({ ok: true, consentAr: GUEST_CONTACT_CONSENT_AR })
    expect(await caseOfPhone('0790000008')).toHaveLength(1)

    const flood = await post({ fullName: 'طابور مختلق', phone: '0790000009' })
    expect(flood.statusCode, 'لا سقفَ على بابٍ عامٍّ يفتح حالاتٍ يقرؤها إنسان').toBe(429)
  })
})
