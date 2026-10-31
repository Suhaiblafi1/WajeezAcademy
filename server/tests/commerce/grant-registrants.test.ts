/* من عبّأ نموذج المنحة — مصدرُه ورسائلُه ومواعيدُه، وExcel، والحذف، ورسالةٌ يكتبها المدير (٣١ أكتوبر ٢٠٢٦).
   والعلّةُ في رأس `server/services/grant-registrants.service.ts`.

   ① **النموذجُ يحفظ زيارتيه منظّفتين**: متى فتح صفحةَ المنحة ومن أين، وأوّلَ زيارةٍ للموقع — وما لا يُفحص يُترك.
   ② **والقائمةُ تقول مصدرَه وما وصله وما هو آتٍ له**: بريدُ الكود بحاله، وتذكيرا ما قبل الانتهاء بموعدَيهما — ويسقط
      منهما ما أُرسل، ولا يُعدّ لمن اشترى.
   ③ **وExcel** بأوراقه الثلاث: الأشخاصُ بمصدرهم ووقت فتحهم، والرسائلُ، والإحصاءات.
   ④ **ورسالةٌ يكتبها المدير** لمن يختارهم: باسم كلٍّ، بمرجع دفعةٍ واحد، وأثرٍ يسمّي من أرسل. ولا تُكتب لغير من في المنحة.
   ⑤ **والحذفُ بخيار الكود**: يُمحى الاسمُ والرقمُ والبريدُ وتُغلق حالتُه ويخرج من القائمة — والكودُ يُبطَل أو يبقى بما اختار.
   ⑥ **وكلُّه بصلاحيّة الكوبونات.** */

import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import type { PrismaClient } from '@prisma/client'
import type { FastifyInstance } from 'fastify'
import ExcelJS from 'exceljs'
import { setupTestDb, testPrisma } from '../helpers/db'
import { AuthService } from '../../services/auth.service'
import { GrantService } from '../../services/grant.service'
import { GrantLandingService } from '../../services/grant-landing.service'
import { GRANT_REMINDERS } from '../../services/grant-followup.service'
import { ERASED_NAME_AR } from '../../services/guest-erasure.service'
import { REMOVED_TEXT_AR } from '../../services/grant-registrants.service'
import { buildApp } from '../../http/app'
import { SESSION_COOKIE } from '../../http/auth-plugin'

let prisma: PrismaClient
let app: FastifyInstance
let landing: GrantLandingService
let boss = ''
let learner = ''
let ownerId = ''
let seq = 0
const STAMP = Date.now()
const DAY = 86_400_000
let closesAt: Date

interface Row {
  id: string; fullName: string; email: string | null; state: string; code: string | null; codeActive: boolean | null
  pageOpenedAt: string | null; firstSeenAt: string | null; landingPath: string | null
  source: { group: string; labelAr: string; detailAr: string | null }
  mails: { purpose: string | null; purposeAr: string; status: string; subject: string }[]
  upcoming: { kind: string; at: string; labelAr: string }[]
}

async function person(source?: unknown) {
  seq += 1
  const email = `gr-${seq}-${STAMP}@test.local`
  const out = await landing.apply({ fullName: `زائر ${seq}`, phone: `0793${String(500000 + seq)}`, email, workField: 'الهندسة', source: source as never })
  return { ref: out.ref, code: out.grant!.code!, email }
}
const list = async () => {
  const res = await app.inject({ method: 'GET', url: '/api/admin/member-grant/registrants', headers: { cookie: boss } })
  expect(res.statusCode).toBe(200)
  return res.json() as { mailOn: boolean; rows: Row[] }
}
const rowOf = async (id: string) => (await list()).rows.find((r) => r.id === id)

beforeAll(async () => {
  await setupTestDb()
  prisma = await testPrisma()
  app = await buildApp(prisma)
  const auth = new AuthService(prisma)
  landing = new GrantLandingService(prisma)
  const owner = await auth.register(`gr-owner-${STAMP}@test.local`, 'Owner#123456', 'صاحب المنصة')
  ownerId = owner.userId
  await auth.setRoles(ownerId, ['super_admin'])
  boss = `${SESSION_COOKIE}=${(await auth.login(`gr-owner-${STAMP}@test.local`, 'Owner#123456')).token}`
  await auth.register(`gr-learner-${STAMP}@test.local`, 'Learner#123456', 'متعلم')
  learner = `${SESSION_COOKIE}=${(await auth.login(`gr-learner-${STAMP}@test.local`, 'Learner#123456')).token}`
  closesAt = new Date(Date.now() + 10 * DAY)
  await new GrantService(prisma).update({ active: true, percentOff: 60, maxCodes: null, maxCourses: 4, closesAt }, ownerId)
}, 240_000)

afterAll(async () => { await app?.close() })

describe('① النموذج يحفظ زيارتيه منظفتين', () => {
  it('⚠️ من الباب العام: متى فتح الصفحة ومن أين، وأول زيارة — وما لا يفحص يترك', async () => {
    const opened = new Date(Date.now() - 7 * 60_000).toISOString()
    const res = await app.inject({
      method: 'POST', url: '/api/public/grant',
      payload: {
        fullName: 'زائرة من فيسبوك', phone: `0794${String(100000 + (STAMP % 800000))}`, email: `gr-http-${STAMP}@test.local`, workField: 'الهندسة',
        channel: null, wave: null, website: '',
        source: {
          page: { utmSource: 'Facebook', utmMedium: 'cpc', landingPath: '/grant?ch=x', at: opened, evil: '<script>' },
          first: { referrerHost: 'www.Google.com', at: '2026-10-01T10:00:00.000Z', refCode: 'bad code with spaces' },
        },
      },
    })
    expect(res.statusCode).toBe(201)
    const lead = await prisma.lead.findUniqueOrThrow({ where: { id: (res.json() as { ref: string }).ref } })
    expect(lead.pageTouch).toEqual({ utmSource: 'facebook', utmMedium: 'cpc', landingPath: '/grant', at: opened })
    expect(lead.firstTouch).toEqual({ referrerHost: 'google.com', at: '2026-10-01T10:00:00.000Z' })
    expect(lead.pageOpenedAt?.toISOString()).toBe(opened)
    const row = (await rowOf(lead.id))!
    expect(row.source).toMatchObject({ group: 'platform', labelAr: 'فيسبوك (إعلان)' })
    expect(row.source.detailAr).toContain('أول زيارة 2026-10-01 من بحث جوجل')
    expect(row.pageOpenedAt).toBe(opened)
  })

  it('⚠️ ومن عبأ بلا زيارة محفوظة يبقى بلا وقت فتح، ومصدره غير معروف', async () => {
    const p = await person()
    const row = (await rowOf(p.ref))!
    expect(row.pageOpenedAt).toBeNull()
    expect(row.source.group).toBe('unknown')
  })
})

describe('② القائمة تقول ما وصله وما هو آت له', () => {
  it('⚠️ بريد الكود بحاله، وتذكيرا ما قبل الانتهاء بموعديهما — ويسقط ما أرسل', async () => {
    const p = await person({ page: { at: new Date().toISOString() } })
    let row = (await rowOf(p.ref))!
    expect(row.mails).toHaveLength(1)
    expect(row.mails[0]).toMatchObject({ purpose: 'grant.code', purposeAr: 'كود المنحة', status: 'queued' })
    expect(row.upcoming.map((u) => u.at)).toEqual(GRANT_REMINDERS.map((s) => new Date(closesAt.getTime() - s.beforeMs).toISOString()))
    expect(row.upcoming.map((u) => u.labelAr)).toEqual(['تذكير: بقيت ثلاثة أيام', 'تذكير: اليوم آخر يوم'])

    await prisma.auditEvent.create({ data: { action: 'coupon.grant_reminder', entityType: 'lead', entityId: p.ref, meta: { stage: '3d' } } })
    row = (await rowOf(p.ref))!
    expect(row.upcoming.map((u) => u.labelAr)).toEqual(['تذكير: اليوم آخر يوم'])
  })

  it('⚠️ ولا موعد لتذكير فات وقته', async () => {
    const p = await person()
    expect((await rowOf(p.ref))!.upcoming).toHaveLength(2)
    await new GrantService(prisma).update({ closesAt: new Date(Date.now() + 3_600_000) }, ownerId)
    try {
      /* بقيت ساعة: التذكيران فاتا — لا موعدَ آتٍ */
      expect((await rowOf(p.ref))!.upcoming).toEqual([])
    } finally {
      await new GrantService(prisma).update({ closesAt }, ownerId)
    }
  })
})

describe('③ Excel', () => {
  it('⚠️ أوراقه الثلاث: الأشخاص بمصدرهم ووقت فتحهم، والرسائل، والإحصاءات', async () => {
    const p = await person({ page: { channel: 'email', wave: '3', at: new Date(Date.now() - 60_000).toISOString() } })
    await prisma.lead.update({ where: { id: p.ref }, data: { channel: 'email', wave: '3' } })
    const res = await app.inject({ method: 'GET', url: '/api/admin/member-grant/registrants.xlsx', headers: { cookie: boss } })
    expect(res.statusCode).toBe(200)
    expect(res.headers['content-type']).toContain('spreadsheetml')
    expect(String(res.headers['content-disposition'])).toContain("filename*=UTF-8''")
    const wb = new ExcelJS.Workbook()
    await wb.xlsx.load(res.rawPayload as unknown as ArrayBuffer)
    expect(wb.worksheets.map((w) => w.name)).toEqual(['من عبأ النموذج', 'الرسائل', 'الإحصاءات'])
    const people = wb.getWorksheet('من عبأ النموذج')!
    const header = (people.getRow(1).values as unknown[]).slice(1)
    const at = (name: string) => header.indexOf(name) + 1
    let found: ExcelJS.Row | null = null
    people.eachRow((r) => { if (r.getCell(at('البريد')).value === p.email) found = r })
    expect(found).not.toBeNull()
    const r = found! as ExcelJS.Row
    expect(r.getCell(at('المصدر')).value).toBe('رسائل الأكاديمية')
    expect(r.getCell(at('تفصيل المصدر')).value).toBe('رسائل الأكاديمية · البريد')
    expect(String(r.getCell(at('فتح صفحة المنحة')).value)).toMatch(/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}$/)
    expect(r.getCell(at('الرسائل المرسلة')).value).toBe(1)
    let mailRows = 0
    wb.getWorksheet('الرسائل')!.eachRow((row) => { if (row.getCell(2).value === p.email) mailRows += 1 })
    /* بريدُ الكود، وتذكيران مجدولان */
    expect(mailRows).toBe(3)
  })
})

describe('④ رسالة يكتبها المدير', () => {
  it('⚠️ لمن يختارهم باسم كل منهم، بمرجع دفعة واحد وأثر يسمي من أرسل — وتظهر في رسائله', async () => {
    const a = await person()
    const b = await person()
    const res = await app.inject({
      method: 'POST', url: '/api/admin/member-grant/registrants/mail', headers: { cookie: boss },
      payload: { ids: [a.ref, b.ref, '00000000-0000-4000-8000-000000000000'], subject: 'لقاء تعريفي غدا', body: 'ندعوك إلى لقاء تعريفي.\n\nالرابط يصلك صباحا.' },
    })
    expect(res.statusCode).toBe(200)
    const out = res.json() as { sent: number; noEmail: number; batchId: string }
    expect(out).toMatchObject({ sent: 2, noEmail: 0 })
    const mails = await prisma.outboxMail.findMany({ where: { batchId: out.batchId } })
    expect(mails.map((m) => m.to).sort()).toEqual([a.email, b.email].sort())
    expect(mails.every((m) => m.purpose === 'grant.message' && m.subject === 'لقاء تعريفي غدا')).toBe(true)
    const toA = mails.find((m) => m.to === a.email)!
    expect(toA.text).toContain(`مرحبا زائر ${seq - 1}،`)
    expect(toA.html).toContain('الرابط يصلك صباحا.')
    const audit = await prisma.auditEvent.findFirstOrThrow({ where: { action: 'coupon.grant_message', entityId: out.batchId } })
    expect(audit).toMatchObject({ actorId: ownerId, entityType: 'mail_batch' })
    expect((await rowOf(a.ref))!.mails.map((m) => m.purposeAr)).toEqual(['كود المنحة', 'رسالة منك'])
  })

  it('⚠️ ولواحد: أثره في ملفه هو. وبلا عنوان يرد', async () => {
    const a = await person()
    const one = await app.inject({
      method: 'POST', url: '/api/admin/member-grant/registrants/mail', headers: { cookie: boss },
      payload: { ids: [a.ref], subject: 'سؤال', body: 'هل وصلك الكود؟' },
    })
    expect(one.statusCode).toBe(200)
    expect(await prisma.auditEvent.count({ where: { action: 'coupon.grant_message', entityType: 'lead', entityId: a.ref } })).toBe(1)
    const empty = await app.inject({
      method: 'POST', url: '/api/admin/member-grant/registrants/mail', headers: { cookie: boss },
      payload: { ids: [a.ref], subject: '  ', body: 'x' },
    })
    expect(empty.statusCode).toBe(422)
  })
})

describe('⑤ الحذف بخيار الكود', () => {
  it('⚠️ يمحى ويخرج من القائمة، وتغلق حالته، ويبطل كوده إن اختار ذلك', async () => {
    const p = await person({ page: { referrerHost: 'google.com', at: new Date().toISOString() } })
    await landing.askAdvisor(p.ref, 'اتصلوا بي')
    const res = await app.inject({
      method: 'DELETE', url: `/api/admin/member-grant/registrants/${p.ref}`, headers: { cookie: boss }, payload: { disableCode: true },
    })
    expect(res.statusCode).toBe(200)
    expect(res.json()).toEqual({ ok: true, codeDisabled: true })
    const lead = await prisma.lead.findUniqueOrThrow({ where: { id: p.ref } })
    expect(lead).toMatchObject({ fullName: ERASED_NAME_AR, email: null, phone: null, pageTouch: null, firstTouch: null })
    expect(lead.erasedAt).not.toBeNull()
    expect(await rowOf(p.ref)).toBeUndefined()
    const kase = await prisma.advisorCase.findFirstOrThrow({ where: { leadId: p.ref }, include: { contactEvents: true } })
    expect(kase.status).toBe('closed')
    expect(kase.contactEvents.every((e) => e.summary === REMOVED_TEXT_AR)).toBe(true)
    expect((await prisma.coupon.findUniqueOrThrow({ where: { code: p.code } })).active).toBe(false)
    const audit = await prisma.auditEvent.findFirstOrThrow({ where: { action: 'coupon.grant_registrant_removed', entityId: p.ref } })
    expect(audit.actorId).toBe(ownerId)
    /* ومحذوفٌ لا يُحذف ثانية */
    const again = await app.inject({
      method: 'DELETE', url: `/api/admin/member-grant/registrants/${p.ref}`, headers: { cookie: boss }, payload: { disableCode: true },
    })
    expect(again.statusCode).toBe(404)
  })

  it('⚠️ ويبقى كوده يعمل إن اختار الإبقاء', async () => {
    const p = await person()
    const res = await app.inject({
      method: 'DELETE', url: `/api/admin/member-grant/registrants/${p.ref}`, headers: { cookie: boss }, payload: { disableCode: false },
    })
    expect(res.json()).toEqual({ ok: true, codeDisabled: false })
    expect((await prisma.coupon.findUniqueOrThrow({ where: { code: p.code } })).active).toBe(true)
  })
})

describe('⑥ بصلاحية الكوبونات', () => {
  it('⚠️ المتعلم يرد عن القائمة وExcel والرسالة والحذف', async () => {
    const p = await person()
    for (const req of [
      { method: 'GET' as const, url: '/api/admin/member-grant/registrants' },
      { method: 'GET' as const, url: '/api/admin/member-grant/registrants.xlsx' },
      { method: 'POST' as const, url: '/api/admin/member-grant/registrants/mail', payload: { ids: [p.ref], subject: 'x', body: 'y' } },
      { method: 'DELETE' as const, url: `/api/admin/member-grant/registrants/${p.ref}`, payload: { disableCode: true } },
    ]) {
      const res = await app.inject({ ...req, headers: { cookie: learner } })
      expect(res.statusCode, req.url).toBe(403)
    }
    expect((await prisma.lead.findUniqueOrThrow({ where: { id: p.ref } })).erasedAt).toBeNull()
  })
})
