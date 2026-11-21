/* ═══ دورةُ صاحب المنصّة الخاصّة — من الصفحة إلى بريد التأكيد (١٩ نوفمبر ٢٠٢٦) ═══

   ما يُحرَس هنا، وكلٌّ منه قرارٌ قاله صاحبُ المنصّة:
   ① **التسجيلُ من الصفحة**: الرقمُ بمفتاح الدولة، وصورةُ الحوالة صورةٌ أو PDF بالبايتات، وتسجيلٌ ثانٍ يحدّث الأوّل.
   ② **اللوحةُ له وحدَه**: «فقط أنا suhaib@wajeez.co» — لا مديرَ نظامٍ آخر، ولا بريدُه بلا رتبة.
   ③ **بريدُ التأكيد**: من Gmail صاحبها، فيه رابطُ Zoom شعبته وروابطُ Claude Code وملفُّ الدورة، ودعوةٌ مدعوُّها
      المتعلّمُ وحدَه — و«لا تضع لوقو وجيز.. ولا تُدرج أحدا ثانيا من أكاديميّة وجيز».
   ④ **التحميلُ**: Excel للمسجّلين، كلِّهم أو شعبةٍ وحدَها.
   ⑧ **التذكيرُ**: من حجز ولم يدفع يصله بريدٌ بعد يوم، و«آخر فرصة» بعد ثلاثة — ولا أثرَ في سجلّ الأكاديميّة.
   ⑨ **Stripe**: دفعُ البطاقة يؤكّد الحجزَ ويرسل بريدَ Zoom وحدَه — بتوقيعٍ إلزاميّ، ومرّةً واحدة. */

import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import type { FastifyInstance } from 'fastify'
import type { PrismaClient } from '@prisma/client'
import ExcelJS from 'exceljs'
import { setupTestDb, testPrisma } from '../helpers/db'
import { AuthService } from '../../services/auth.service'
import { buildApp } from '../../http/app'
import {
  PRIVATE_SENDER_EMAIL, setPrivateMailSenderForTests, type GmailConfig, type PrivateMail,
} from '../../services/private-course/mailer'
import { AI_JOBS, AI_JOBS_SLUG, CLAUDE_LINKS, seatsLabel, seatsLeft } from '../../../src/application/private-course/ai-jobs'
import { dueReminder, runPrivateCourseReminders } from '../../services/private-course/reminders'
import { createHmac } from 'node:crypto'
import { runJob } from '../../worker/jobs'

let prisma: PrismaClient
let auth: AuthService
let app: FastifyInstance
let ownerToken = ''
let otherAdminToken = ''
let ownerEmailNoRankToken = ''
const sent: { config: GmailConfig; mail: PrivateMail }[] = []
let ip = 0

const PNG = Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), Buffer.alloc(64, 7)])
const HTML_AS_PNG = Buffer.from('<html><script>alert(1)</script></html>')

async function session(email: string, roles: string[]): Promise<string> {
  const { userId } = await auth.register(email, 'Owner#12345', 'حساب اختبار')
  for (const roleId of roles) await prisma.userRole.create({ data: { userId, roleId } })
  return (await auth.login(email, 'Owner#12345')).token
}

function register(over: Record<string, unknown> = {}, proof: Buffer = PNG) {
  ip += 1
  return app.inject({
    method: 'POST',
    url: `/api/v1/public/private-courses/${AI_JOBS_SLUG}/registrations`,
    remoteAddress: `10.77.0.${ip}`,
    payload: {
      fullName: 'سارة أحمد',
      email: `learner-${ip}@test.local`,
      phoneCountry: 'JO',
      phone: '0791234567',
      sectionKey: 'evening',
      proof: { name: 'cliq.png', base64: proof.toString('base64') },
      ...over,
    },
  })
}

const asOwner = (method: 'GET' | 'POST' | 'PATCH' | 'PUT' | 'DELETE', url: string, payload?: unknown) =>
  app.inject({ method, url, payload: payload as never, cookies: { wajeez_session: ownerToken } })

beforeAll(async () => {
  await setupTestDb()
  prisma = await testPrisma()
  auth = new AuthService(prisma)
  app = await buildApp(prisma)
  ownerToken = await session('Suhaib@wajeez.co', ['super_admin'])
  otherAdminToken = await session('another-admin@test.local', ['super_admin'])
  setPrivateMailSenderForTests(async (config, mail) => { sent.push({ config, mail }) })
}, 240_000)

afterAll(async () => {
  setPrivateMailSenderForTests(null)
  await app?.close()
})

describe('① التسجيل من الصفحة', () => {
  it('يحفظ الرقم بمفتاح الدولة ويبقى التسجيل قيد المراجعة', async () => {
    const res = await register({ email: 'Sara@Test.local' })
    expect(res.statusCode, res.body).toBe(201)
    const row = await prisma.privateRegistration.findUniqueOrThrow({
      where: { courseSlug_email: { courseSlug: AI_JOBS_SLUG, email: 'sara@test.local' } },
    })
    expect(row.phone).toBe('+962791234567')
    expect(row.status).toBe('pending')
    expect(row.proofMime).toBe('image/png')
  })

  it('يقبل الرقم ملصوقا بمفتاحه وبأرقام هندية', async () => {
    const res = await register({ phoneCountry: 'SA', phone: '+٩٦٦ ٥١٢ ٣٤٥ ٦٧٨' })
    expect(res.statusCode, res.body).toBe(201)
    const row = await prisma.privateRegistration.findFirstOrThrow({ where: { phoneCountry: 'SA' } })
    expect(row.phone).toBe('+966512345678')
  })

  it('يرد رقما ناقصا ويقول طوله', async () => {
    const res = await register({ phone: '7912345' })
    expect(res.statusCode).toBe(400)
    expect(res.json().error.message_ar).toContain('9')
  })

  it('يرد صفحة HTML سميت صورة', async () => {
    const res = await register({}, HTML_AS_PNG)
    expect(res.statusCode).toBe(415)
    expect(await prisma.privateRegistration.count({ where: { proofName: 'cliq.png', email: `learner-${ip}@test.local` } })).toBe(0)
  })

  it('يرد حقل الفخ المملوء', async () => {
    const res = await register({ website: 'http://spam.example' })
    expect(res.statusCode).toBe(400)
  })

  it('تسجيل ثان بالبريد نفسه يحدث الأول ولا يضيف صفا', async () => {
    await register({ email: 'twice@test.local', sectionKey: 'morning' })
    const again = await register({ email: 'twice@test.local', sectionKey: 'evening' })
    expect(again.statusCode, again.body).toBe(201)
    expect(again.json().updated).toBe(true)
    const rows = await prisma.privateRegistration.findMany({ where: { email: 'twice@test.local' } })
    expect(rows).toHaveLength(1)
    expect(rows[0].sectionKey).toBe('evening')
  })

  it('والتسجيل المغلق يرد', async () => {
    await prisma.privateCourse.update({ where: { slug: AI_JOBS_SLUG }, data: { open: false } })
    const res = await register()
    expect(res.statusCode).toBe(409)
    await prisma.privateCourse.update({ where: { slug: AI_JOBS_SLUG }, data: { open: true } })
  })
})

describe('② اللوحة لصاحبها وحده', () => {
  const url = `/api/v1/private/courses/${AI_JOBS_SLUG}`

  it('بلا جلسة: ٤٠١', async () => {
    expect((await app.inject({ method: 'GET', url })).statusCode).toBe(401)
  })

  it('⚠️ مدير نظام آخر لا يراها — ٤٠٤ لا ٤٠٣', async () => {
    const res = await app.inject({ method: 'GET', url, cookies: { wajeez_session: otherAdminToken } })
    expect(res.statusCode).toBe(404)
  })

  it('⚠️ وبريده بلا رتبة مدير النظام لا يكفي', async () => {
    /* حسابٌ ثانٍ بالبريد نفسِه لا يُنشأ — فالرتبةُ تُنزع من حسابه ثمّ تعاد */
    const owner = await prisma.user.findFirstOrThrow({ where: { email: 'suhaib@wajeez.co' } })
    await prisma.userRole.deleteMany({ where: { userId: owner.id, roleId: 'super_admin' } })
    ownerEmailNoRankToken = (await auth.login('suhaib@wajeez.co', 'Owner#12345')).token
    const res = await app.inject({ method: 'GET', url, cookies: { wajeez_session: ownerEmailNoRankToken } })
    expect(res.statusCode).toBe(404)
    await prisma.userRole.create({ data: { userId: owner.id, roleId: 'super_admin' } })
    ownerToken = (await auth.login('suhaib@wajeez.co', 'Owner#12345')).token
  })

  it('وصاحبها يراها ومعها المسجلون', async () => {
    const res = await asOwner('GET', url)
    expect(res.statusCode, res.body).toBe(200)
    const body = res.json()
    expect(body.registrations.length).toBeGreaterThan(0)
    expect(body.course.sections.map((s: { key: string }) => s.key)).toEqual(['morning', 'evening'])
  })

  it('وصورة الحوالة تفتح له ولا تفتح لغيره', async () => {
    const r = await prisma.privateRegistration.findFirstOrThrow({ where: { email: 'sara@test.local' } })
    const mine = await asOwner('GET', `/api/v1/private/registrations/${r.id}/proof`)
    expect(mine.statusCode).toBe(200)
    expect(mine.headers['content-type']).toContain('image/png')
    expect(Buffer.from(mine.rawPayload).equals(PNG)).toBe(true)
    const other = await app.inject({ method: 'GET', url: `/api/v1/private/registrations/${r.id}/proof`, cookies: { wajeez_session: otherAdminToken } })
    expect(other.statusCode).toBe(404)
  })
})

describe('③ بريد التأكيد', () => {
  const ZOOM = 'https://us06web.zoom.us/j/81234567890?pwd=abc'

  it('بلا Gmail مضبوط: يتأكد التسجيل ويكتب سبب تعذر البريد', async () => {
    const r = await prisma.privateRegistration.findFirstOrThrow({ where: { email: 'twice@test.local' } })
    const res = await asOwner('POST', `/api/v1/private/registrations/${r.id}/confirm`, { sendMail: true })
    expect(res.statusCode, res.body).toBe(200)
    expect(res.json().mail.ok).toBe(false)
    const row = await prisma.privateRegistration.findUniqueOrThrow({ where: { id: r.id } })
    expect(row.status).toBe('confirmed')
    expect(row.mailError).toContain('Gmail')
    expect(sent).toHaveLength(0)
  })

  it('كلمة مرور التطبيق تحفظ مختومة ولا تعاد إلا مقنعة', async () => {
    const res = await asOwner('PUT', '/api/v1/private/mail', { appPassword: 'abcd efgh ijkl mnop' })
    expect(res.statusCode, res.body).toBe(200)
    expect(res.json()).toMatchObject({ ready: true, user: PRIVATE_SENDER_EMAIL, passwordTail: '••••mnop' })
    expect(res.body).not.toContain('abcdefghijklmnop')
    const row = await prisma.integrationSetting.findUniqueOrThrow({ where: { provider: 'private_gmail' } })
    expect(JSON.stringify(row.config)).not.toContain('abcdefghijklmnop')
  })

  it('يرفض رابطا ليس من Zoom', async () => {
    const res = await asOwner('PATCH', `/api/v1/private/courses/${AI_JOBS_SLUG}`, { zoom: { evening: { url: 'https://evil.example/j/1' } } })
    expect(res.statusCode).toBe(400)
  })

  it('⚠️ التأكيد يرسل من Gmail صاحبها: رابط Zoom شعبته وروابط Claude Code وملف الدورة — وبلا وجيز', async () => {
    await asOwner('PATCH', `/api/v1/private/courses/${AI_JOBS_SLUG}`, { zoom: { evening: { url: ZOOM, passcode: '445566' } } })
    const r = await prisma.privateRegistration.findFirstOrThrow({ where: { email: 'sara@test.local' } })
    const res = await asOwner('POST', `/api/v1/private/registrations/${r.id}/confirm`, { sendMail: true })
    expect(res.statusCode, res.body).toBe(200)
    expect(res.json().mail).toEqual({ ok: true })

    const { config, mail } = sent.at(-1)!
    expect(config.user).toBe(PRIVATE_SENDER_EMAIL)
    expect(config.appPassword).toBe('abcdefghijklmnop')
    expect(mail.to).toBe('sara@test.local')
    expect(mail.html).toContain(ZOOM.replace(/&/g, '&amp;'))
    expect(mail.html).toContain('445566')
    expect(mail.html).toContain(CLAUDE_LINKS.download)
    expect(mail.html).toContain(CLAUDE_LINKS.pricing)
    expect(mail.text).toContain(ZOOM)
    expect(mail.html).toContain('الشعبة المسائية')

    /* ملفُّ الدورة مرفقٌ — المنشورُ المضمَّن ما لم يُرفع غيرُه */
    expect(mail.attachments?.map((a) => a.contentType)).toEqual(['application/pdf'])
    expect(mail.attachments![0].content.subarray(0, 5).toString('ascii')).toBe('%PDF-')

    /* والدعوةُ: المدعوُّ المتعلّمُ وحدَه، والمنظِّمُ بريدُ صاحب الدورة */
    const ics = mail.ics!
    const attendees = ics.replace(/\r\n /g, '').split('\r\n').filter((l) => l.startsWith('ATTENDEE'))
    expect(attendees).toHaveLength(1)
    expect(attendees[0]).toContain('mailto:sara@test.local')
    expect(ics).toContain(`mailto:${PRIVATE_SENDER_EMAIL}`)
    expect(ics).toContain('DTSTART:20261205T150000Z')

    /* ولا اسمَ للأكاديميّة في شيءٍ منها */
    const everything = [mail.subject, mail.html, mail.text, ics, ...(mail.attachments ?? []).map((a) => a.filename)].join('\n')
    expect(everything).not.toMatch(/wajeez/i)
    expect(everything).not.toContain('وجيز')

    const row = await prisma.privateRegistration.findUniqueOrThrow({ where: { id: r.id } })
    expect(row.mailSentAt).not.toBeNull()
    expect(row.mailZoomUrl).toBe(ZOOM)
  })

  it('تغيير رابط Zoom يظهر من لم يصله الرابط الجديد — والإرسال من جديد يصلحه', async () => {
    const NEW = 'https://us06web.zoom.us/j/89999999999'
    await asOwner('PATCH', `/api/v1/private/courses/${AI_JOBS_SLUG}`, { zoom: { evening: { url: NEW } } })
    const before = (await asOwner('GET', `/api/v1/private/courses/${AI_JOBS_SLUG}`)).json()
    const sara = before.registrations.find((x: { email: string }) => x.email === 'sara@test.local')
    expect(sara.zoomMissing).toBe(true)
    const res = await asOwner('POST', `/api/v1/private/registrations/${sara.id}/send`)
    expect(res.json().registration.zoomMissing).toBe(false)
    expect(sent.at(-1)!.mail.html).toContain(NEW)
  })

  it('ورفع ملف آخر للدورة يرفق بدل الأصلي', async () => {
    const pdf = Buffer.from('%PDF-1.4\n% test file\n')
    const up = await app.inject({
      method: 'PUT', url: `/api/v1/private/courses/${AI_JOBS_SLUG}/file?name=${encodeURIComponent('دليل الدورة.pdf')}`,
      payload: pdf, headers: { 'content-type': 'application/octet-stream' }, cookies: { wajeez_session: ownerToken },
    })
    expect(up.statusCode, up.body).toBe(200)
    expect(up.json().course.file).toEqual({ name: 'دليل الدورة.pdf', custom: true })
    const sara = await prisma.privateRegistration.findFirstOrThrow({ where: { email: 'sara@test.local' } })
    await asOwner('POST', `/api/v1/private/registrations/${sara.id}/send`)
    const att = sent.at(-1)!.mail.attachments![0]
    expect(att.filename).toBe('دليل الدورة.pdf')
    expect(att.content.equals(pdf)).toBe(true)
  })

  it('والرفض لا يرسل شيئا', async () => {
    const res = await register({ email: 'reject-me@test.local' })
    expect(res.statusCode).toBe(201)
    const r = await prisma.privateRegistration.findFirstOrThrow({ where: { email: 'reject-me@test.local' } })
    const before = sent.length
    const out = await asOwner('POST', `/api/v1/private/registrations/${r.id}/reject`)
    expect(out.json().registration.status).toBe('rejected')
    expect(sent.length).toBe(before)
  })
})

describe('④ التحميل', () => {
  it('Excel فيه ورقة للكل وورقة لكل شعبة', async () => {
    const res = await asOwner('GET', `/api/v1/private/courses/${AI_JOBS_SLUG}/export.xlsx`)
    expect(res.statusCode).toBe(200)
    const wb = new ExcelJS.Workbook()
    await wb.xlsx.load(res.rawPayload as never)
    expect(wb.worksheets.map((w) => w.name)).toEqual(['الكل', 'الشعبة الصباحية', 'الشعبة المسائية'])
    const all = wb.getWorksheet('الكل')!
    const names = all.getColumn(2).values.filter(Boolean)
    expect(names).toContain('sara@test.local')
  })

  it('وشعبة وحدها بمؤكديها', async () => {
    const res = await asOwner('GET', `/api/v1/private/courses/${AI_JOBS_SLUG}/export.xlsx?section=evening&status=confirmed`)
    const wb = new ExcelJS.Workbook()
    await wb.xlsx.load(res.rawPayload as never)
    expect(wb.worksheets.map((w) => w.name)).toEqual(['الشعبة المسائية'])
    const emails = wb.worksheets[0].getColumn(2).values.filter((v) => typeof v === 'string' && v.includes('@'))
    expect(emails.sort()).toEqual(['sara@test.local', 'twice@test.local'])
  })

  it('ولا يحمله غيره', async () => {
    const res = await app.inject({ method: 'GET', url: `/api/v1/private/courses/${AI_JOBS_SLUG}/export.xlsx`, cookies: { wajeez_session: otherAdminToken } })
    expect(res.statusCode).toBe(404)
  })
})

/* ═══ ⑤ احجز أوّلا وادفع بعد — ومن أين جاء (٢٠ نوفمبر ٢٠٢٦) ═══
   قرارُ صاحب المنصّة «ابدأ بالأوّل»: الحجزُ بلا صورة حوالة، ورابطُ دفعٍ باسمه يرفع منه متى حوّل،
   ولوحتُه ترى «بانتظار الدفع» ومصدرَ كلّ حجز. */
describe('⑤ الحجز أولا والدفع بعد', () => {
  const reserve = (email: string, over: Record<string, unknown> = {}) => {
    ip += 1
    return app.inject({
      method: 'POST',
      url: `/api/v1/public/private-courses/${AI_JOBS_SLUG}/registrations`,
      remoteAddress: `10.78.0.${ip}`,
      payload: { fullName: 'ليلى حسن', email, phoneCountry: 'AE', phone: '0501234567', sectionKey: 'morning', ...over },
    })
  }
  const payUrl = (token: string) => `/api/v1/public/private-courses/${AI_JOBS_SLUG}/pay/${token}`

  it('⚠️ يحجز بلا صورة حوالة ويعيد رابط دفعه — ويحفظ مصدره', async () => {
    const res = await reserve('layla@test.local', { source: 'Instagram · story · bf1' })
    expect(res.statusCode, res.body).toBe(201)
    const body = res.json()
    expect(body.hasProof).toBe(false)
    expect(body.payToken).toMatch(/^[A-Za-z0-9_-]{16,}$/)
    const row = await prisma.privateRegistration.findUniqueOrThrow({ where: { payToken: body.payToken } })
    expect(row.proofKey).toBeNull()
    expect(row.status).toBe('pending')
    expect(row.source).toBe('Instagram · story · bf1')
  })

  it('ورابط الدفع يقول الاسم الأول والشعبة — لا البريد ولا الرقم', async () => {
    const row = await prisma.privateRegistration.findFirstOrThrow({ where: { email: 'layla@test.local' } })
    const res = await app.inject({ method: 'GET', url: payUrl(row.payToken) })
    expect(res.statusCode).toBe(200)
    expect(res.json()).toMatchObject({ firstName: 'ليلى', sectionTitle: 'الشعبة الصباحية', status: 'pending', hasProof: false })
    expect(res.body).not.toContain('layla@test.local')
    expect(res.body).not.toContain('501234567')
  })

  it('⚠️ ورابط لا وجود له ٤٠٤', async () => {
    expect((await app.inject({ method: 'GET', url: payUrl('x'.repeat(32)) })).statusCode).toBe(404)
    expect((await app.inject({ method: 'GET', url: payUrl('../../etc') })).statusCode).toBe(404)
  })

  it('⚠️ والرفع من الرابط يحفظ الصورة — وHTML المسمى صورة يرد', async () => {
    const row = await prisma.privateRegistration.findFirstOrThrow({ where: { email: 'layla@test.local' } })
    const bad = await app.inject({ method: 'POST', url: payUrl(row.payToken), payload: { proof: { name: 'x.png', base64: HTML_AS_PNG.toString('base64') } } })
    expect(bad.statusCode).toBe(415)
    const ok = await app.inject({
      method: 'POST', url: payUrl(row.payToken),
      payload: { proof: { name: 'cliq.png', base64: PNG.toString('base64') }, note: 'باسم أخي' },
    })
    expect(ok.statusCode, ok.body).toBe(200)
    expect(ok.json()).toMatchObject({ hasProof: true, status: 'pending' })
    const after = await prisma.privateRegistration.findUniqueOrThrow({ where: { id: row.id } })
    expect(after.proofMime).toBe('image/png')
    expect(after.proofUploadedAt).not.toBeNull()
    expect(after.note).toBe('باسم أخي')
  })

  it('وحجز ثان بالبريد نفسه يبقي رابطه وحوالته ومصدره الأول', async () => {
    const before = await prisma.privateRegistration.findFirstOrThrow({ where: { email: 'layla@test.local' } })
    const res = await reserve('layla@test.local', { sectionKey: 'evening' })
    expect(res.json().payToken).toBe(before.payToken)
    const after = await prisma.privateRegistration.findUniqueOrThrow({ where: { id: before.id } })
    expect(after.proofKey).toBe(before.proofKey)
    expect(after.source).toBe('Instagram · story · bf1')
    expect(after.sectionKey).toBe('evening')
  })

  it('واللوحة ترى من لم يدفع ورابطه ومصدره، وExcel فيه الحوالة والمصدر', async () => {
    await reserve('nopay@test.local')
    const o = (await asOwner('GET', `/api/v1/private/courses/${AI_JOBS_SLUG}`)).json()
    const nopay = o.registrations.find((x: { email: string }) => x.email === 'nopay@test.local')
    expect(nopay.proof).toBeNull()
    expect(nopay.payToken).toBeTruthy()
    expect(nopay.source).toBeNull()
    const x = await asOwner('GET', `/api/v1/private/courses/${AI_JOBS_SLUG}/export.xlsx`)
    const wb = new ExcelJS.Workbook()
    await wb.xlsx.load(x.rawPayload as never)
    const all = wb.getWorksheet('الكل')!
    const header = (all.getRow(1).values as unknown[]).filter(Boolean)
    expect(header).toContain('المصدر')
    const col = (name: string) => (all.getRow(1).values as unknown[]).indexOf(name)
    const rowOf = (email: string) => all.getRows(2, all.rowCount - 1)!.find((r) => r.getCell(2).value === email)!
    expect(rowOf('nopay@test.local').getCell(col('الحوالة')).value).toBe('لم يرفعها بعد')
    expect(rowOf('nopay@test.local').getCell(col('المصدر')).value).toBe('مباشر')
    expect(rowOf('layla@test.local').getCell(col('المصدر')).value).toBe('Instagram · story · bf1')
  })

  it('ومن تأكد لا يرفع من الرابط', async () => {
    const row = await prisma.privateRegistration.findFirstOrThrow({ where: { email: 'sara@test.local' } })
    const res = await app.inject({ method: 'POST', url: payUrl(row.payToken), payload: { proof: { name: 'p.png', base64: PNG.toString('base64') } } })
    expect(res.statusCode).toBe(409)
  })
})

/* ═══ ⑥ الدفع بالبطاقة لمن هو خارج الأردن (٢١ نوفمبر ٢٠٢٦) ═══
   CliQ لا يعمل إلّا داخل الأردن. فصاحبُ الدورة يلصق رابطَ صفحة دفعٍ من مزوّده، فيظهر للحاجز خيارُ «بطاقة» —
   ولمن رقمُه خارجَ الأردن أوّلا. ولا إيصالَ يُرفع لها: «لو دفع يصل له التأكيد مباشرة، لا حاجة ليثبته» — فيُكتب
   أنّه ذهب إليها، ويطابقه صاحبُ الدورة في Stripe برقم مرجعه. والصورةُ المرفوعةُ حوالةُ CliQ دائما. */
describe('⑥ الدفع بالبطاقة', () => {
  const STRIPE = 'https://buy.stripe.com/test_abc123'
  const payUrl = (token: string) => `/api/v1/public/private-courses/${AI_JOBS_SLUG}/pay/${token}`

  it('بلا رابط: لا خيار بطاقة في الصفحة ولا في رابط الدفع', async () => {
    const state = (await app.inject({ method: 'GET', url: `/api/v1/public/private-courses/${AI_JOBS_SLUG}` })).json()
    expect(state.card).toBe(false)
    const row = await prisma.privateRegistration.findFirstOrThrow({ where: { email: 'nopay@test.local' } })
    expect((await app.inject({ method: 'GET', url: payUrl(row.payToken) })).json().cardUrl).toBeNull()
  })

  it('⚠️ يرد رابطا ليس https', async () => {
    const res = await asOwner('PATCH', `/api/v1/private/courses/${AI_JOBS_SLUG}`, { cardUrl: 'http://paypal.me/someone' })
    expect(res.statusCode).toBe(400)
  })

  it('⚠️ برابط Stripe: يظهر الخيار، ويحمل رقم مرجع الحاجز، ومن رقمه خارج الأردن يقال له', async () => {
    const res = await asOwner('PATCH', `/api/v1/private/courses/${AI_JOBS_SLUG}`, { cardUrl: STRIPE })
    expect(res.statusCode, res.body).toBe(200)
    expect(res.json().course.cardUrl).toBe(STRIPE)
    expect((await app.inject({ method: 'GET', url: `/api/v1/public/private-courses/${AI_JOBS_SLUG}` })).json().card).toBe(true)

    const uae = await prisma.privateRegistration.findFirstOrThrow({ where: { email: 'nopay@test.local' } })
    const info = (await app.inject({ method: 'GET', url: payUrl(uae.payToken) })).json()
    expect(info.abroad).toBe(true)
    const link = new URL(info.cardUrl)
    expect(link.origin + link.pathname).toBe(STRIPE)
    expect(link.searchParams.get('client_reference_id')).toBe(uae.id.slice(0, 8).toUpperCase())
    expect(info.cardUrl).not.toContain('nopay@test.local')

    const jo = await prisma.privateRegistration.findFirstOrThrow({ where: { phoneCountry: 'JO' } })
    expect((await app.inject({ method: 'GET', url: payUrl(jo.payToken) })).json().abroad).toBe(false)
  })

  it('⚠️ ضغط «ادفع بالبطاقة» يكتب أنه اختارها بلا إيصال — في رابطه واللوحة وExcel', async () => {
    const row = await prisma.privateRegistration.findFirstOrThrow({ where: { email: 'nopay@test.local' } })
    const res = await app.inject({ method: 'POST', url: `${payUrl(row.payToken)}/card` })
    expect(res.statusCode, res.body).toBe(200)
    expect(res.json()).toMatchObject({ cardChosen: true, hasProof: false, status: 'pending' })
    expect((await app.inject({ method: 'GET', url: payUrl(row.payToken) })).json().cardChosen).toBe(true)
    expect((await prisma.privateRegistration.findUniqueOrThrow({ where: { id: row.id } })).payMethod).toBe('card')
    const o = (await asOwner('GET', `/api/v1/private/courses/${AI_JOBS_SLUG}`)).json()
    const mine = o.registrations.find((x: { email: string }) => x.email === 'nopay@test.local')
    expect(mine.payMethod).toBe('card')
    expect(mine.proof).toBeNull()
    const x = await asOwner('GET', `/api/v1/private/courses/${AI_JOBS_SLUG}/export.xlsx`)
    const wb = new ExcelJS.Workbook()
    await wb.xlsx.load(x.rawPayload as never)
    const all = wb.getWorksheet('الكل')!
    const col = (all.getRow(1).values as unknown[]).indexOf('طريقة الدفع')
    const cell = all.getRows(2, all.rowCount - 1)!.find((r) => r.getCell(2).value === 'nopay@test.local')!.getCell(col).value
    expect(cell).toBe('بطاقة')
  })

  it('⚠️ والصورة المرفوعة حوالة CliQ دائما — ولو قال الطلب «بطاقة»، وضغط البطاقة بعدها لا يغيرها', async () => {
    const row = await prisma.privateRegistration.findFirstOrThrow({ where: { email: 'nopay@test.local' } })
    const up = await app.inject({
      method: 'POST', url: payUrl(row.payToken),
      payload: { proof: { name: 'receipt.png', base64: PNG.toString('base64') }, payMethod: 'card' },
    })
    expect(up.statusCode, up.body).toBe(200)
    expect(up.json()).toMatchObject({ hasProof: true, cardChosen: false })
    expect((await prisma.privateRegistration.findUniqueOrThrow({ where: { id: row.id } })).payMethod).toBe('cliq')
    const again = await app.inject({ method: 'POST', url: `${payUrl(row.payToken)}/card` })
    expect(again.statusCode, again.body).toBe(200)
    expect((await prisma.privateRegistration.findUniqueOrThrow({ where: { id: row.id } })).payMethod).toBe('cliq')
  })

  it('والإفراغ يخفي الخيار — وضغط البطاقة بعده لا يكتب شيئا', async () => {
    await asOwner('PATCH', `/api/v1/private/courses/${AI_JOBS_SLUG}`, { cardUrl: '' })
    expect((await app.inject({ method: 'GET', url: `/api/v1/public/private-courses/${AI_JOBS_SLUG}` })).json().card).toBe(false)
    const row = await prisma.privateRegistration.findFirstOrThrow({ where: { email: 'layla@test.local' } })
    const res = await app.inject({ method: 'POST', url: `${payUrl(row.payToken)}/card` })
    expect(res.statusCode, res.body).toBe(200)
    expect((await prisma.privateRegistration.findUniqueOrThrow({ where: { id: row.id } })).payMethod).toBe(row.payMethod)
  })
})

/* ═══ ⑦ النموذج مع صورة الحوالة — «اعمل فورم التسجيل مع رفع صورة الحوالة» (٢١ نوفمبر ٢٠٢٦) ═══ */
describe('⑦ التسجيل وصورة الحوالة معا', () => {
  it('⚠️ يحفظ الصورة مع التسجيل حوالة CliQ — ولا يحتاج خطوة ثانية', async () => {
    ip += 1
    const res = await app.inject({
      method: 'POST', url: `/api/v1/public/private-courses/${AI_JOBS_SLUG}/registrations`, remoteAddress: `10.79.0.${ip}`,
      payload: {
        fullName: 'رنا عادل', email: 'rana@test.local', phoneCountry: 'QA', phone: '33123456', sectionKey: 'morning',
        proof: { name: 'receipt.png', base64: PNG.toString('base64') }, payMethod: 'card',
      },
    })
    expect(res.statusCode, res.body).toBe(201)
    expect(res.json().hasProof).toBe(true)
    const row = await prisma.privateRegistration.findFirstOrThrow({ where: { email: 'rana@test.local' } })
    /* البطاقةُ لا إيصالَ لها — فما رُفع حوالةٌ ولو قال الطلبُ «بطاقة» */
    expect(row.payMethod).toBe('cliq')
    expect(row.proofUploadedAt).not.toBeNull()
  })

  it('وبلا طريقة مذكورة فهي CliQ', async () => {
    const row = await prisma.privateRegistration.findFirstOrThrow({ where: { email: 'sara@test.local' } })
    expect(row.payMethod).toBe('cliq')
  })
})

/* ═══ ⑧ تذكيرُ من حجز ولم يدفع (٢١ نوفمبر ٢٠٢٦) ═══
   «if they haven't paid, remind them next day as reminder, after three days last chance». والأوقاتُ كلُّها ثابتةٌ
   قبل الدورة (٥ ديسمبر) لا من ساعة الجهاز — فلا يسقط الحارسُ يومَ يمرّ تاريخها. */
describe('⑧ تذكير من لم يدفع', () => {
  const DAY = 86_400_000
  const HOUR = 3_600_000
  /* ظهرُ عمّان (09:00Z) قبل الدورة بعشرة أيام */
  const NOON = new Date('2026-11-25T09:00:00.000Z')
  const at = (ms: number) => new Date(NOON.getTime() + ms)
  let n = 0

  async function reserved(createdAt: Date, data: Record<string, unknown> = {}) {
    n += 1
    return prisma.privateRegistration.create({
      data: {
        courseSlug: AI_JOBS_SLUG, sectionKey: 'morning', fullName: 'هند سالم', email: `remind-${n}@test.local`,
        phone: '+971501234567', phoneCountry: 'AE', payToken: `remind${n}`.padEnd(24, 'x'), createdAt, ...data,
      },
    })
  }
  const mailsTo = (email: string) => sent.filter((x) => x.mail.to === email).map((x) => x.mail)
  const row = (id: string) => prisma.privateRegistration.findUniqueOrThrow({ where: { id } })

  it('⚠️ بعد يوم: تذكير واحد برابط دفعه وCliQ — بلا وجيز، ولا يتكرر', async () => {
    const r = await reserved(at(-1.5 * DAY))
    const early = await reserved(at(-20 * HOUR))
    await runPrivateCourseReminders(prisma, NOON)
    const [mail, ...more] = mailsTo(r.email)
    expect(more).toHaveLength(0)
    expect(mail.subject).toBe('مقعدك محجوز — أكمل الدفع لتأكيده')
    expect(mail.html).toContain(`/ai-jobs/pay/${r.payToken}`)
    expect(mail.text).toContain(`/ai-jobs/pay/${r.payToken}`)
    expect(mail.text).toContain(AI_JOBS.cliqAlias)
    expect(mail.html, 'اسم الأكاديمية في بريد خاص').not.toMatch(/وجيز|wajeez/i)
    expect(mail.html, 'وعد بإلغاء لا نفعله').not.toMatch(/نلغي|سيلغى/)
    expect(mail.html).not.toContain('دفعت بالبطاقة؟')
    expect((await row(r.id)).remindedAt).toEqual(NOON)
    expect(mailsTo(early.email), 'ذكر قبل يوم').toHaveLength(0)

    await runPrivateCourseReminders(prisma, at(HOUR))
    expect(mailsTo(r.email), 'تكرر التذكير').toHaveLength(1)
  })

  it('⚠️ بعد ثلاثة أيام: «آخر فرصة» بمقاعد شعبته — وبعد يوم من التذكير على الأقل', async () => {
    const r = await reserved(at(-2.5 * DAY), { remindedAt: at(-1.4 * DAY) })
    const justReminded = await reserved(at(DAY - 3.2 * DAY), { remindedAt: at(DAY - 2 * HOUR) })
    await runPrivateCourseReminders(prisma, at(DAY))
    const [mail, ...more] = mailsTo(r.email)
    expect(more).toHaveLength(0)
    expect(mail.subject).toBe('آخر فرصة لتأكيد مقعدك')
    expect(mail.html).toContain(seatsLabel(seatsLeft('morning', at(DAY).getTime())))
    expect(mail.html).toContain(`/ai-jobs/pay/${r.payToken}`)
    expect((await row(r.id)).lastChanceAt).toEqual(at(DAY))
    expect(mailsTo(justReminded.email), 'آخر فرصة بعد التذكير بساعتين').toHaveLength(0)
    expect((await row(justReminded.id)).lastChanceAt).toBeNull()
  })

  it('⚠️ ومن فاته اليوم الأول حتى بلغ الثالث تصله «آخر فرصة» وحدها', async () => {
    const r = await reserved(at(-4 * DAY))
    await runPrivateCourseReminders(prisma, NOON)
    expect(mailsTo(r.email).map((m) => m.subject)).toEqual(['آخر فرصة لتأكيد مقعدك'])
    expect((await row(r.id)).remindedAt).toBeNull()
  })

  it('⚠️ لا تذكير لمن رفع الحوالة أو تأكد أو رفض — ولا ليلا ولا بعد بدء شعبته', async () => {
    const quiet = await Promise.all([
      reserved(at(-1.5 * DAY), { proofKey: 'private/x.png' }),
      reserved(at(-1.5 * DAY), { status: 'confirmed' }),
      reserved(at(-1.5 * DAY), { status: 'rejected' }),
    ])
    await runPrivateCourseReminders(prisma, NOON)
    for (const q of quiet) expect(mailsTo(q.email), q.email).toHaveLength(0)

    const night = await reserved(at(-1.5 * DAY + 12 * HOUR))
    const out = await runPrivateCourseReminders(prisma, at(12 * HOUR))
    expect(out.summaryAr).toBe('خارج ساعات الإرسال')
    expect(mailsTo(night.email)).toHaveLength(0)

    const late = await reserved(new Date('2026-12-03T09:00:00.000Z'))
    await runPrivateCourseReminders(prisma, new Date('2026-12-05T09:00:00.000Z'))
    expect(mailsTo(late.email), 'تذكير بعد بدء الشعبة').toHaveLength(0)
  })

  it('⚠️ ومن ضغط «ادفع بالبطاقة» يقال له لا يفعل شيئا إن دفع', async () => {
    const r = await reserved(at(-1.2 * DAY), { payMethod: 'card' })
    await runPrivateCourseReminders(prisma, NOON)
    const [mail] = mailsTo(r.email)
    expect(mail.html).toContain('دفعت بالبطاقة؟ لا تحتاج لفعل شيء')
    expect(mail.text).toContain('دفعت بالبطاقة؟ لا تحتاج لفعل شيء')
  })

  it('⚠️ بلا Gmail لا محاولة ولا خطأ يكتب — ثم يلحق حين يضبط', async () => {
    const r = await reserved(at(-1.1 * DAY))
    await asOwner('PUT', '/api/v1/private/mail', { appPassword: '' })
    const out = await runPrivateCourseReminders(prisma, NOON)
    expect(out.summaryAr).toMatch(/بانتظار ضبط Gmail/)
    expect(mailsTo(r.email)).toHaveLength(0)
    expect((await row(r.id)).reminderError).toBeNull()
    await asOwner('PUT', '/api/v1/private/mail', { appPassword: 'abcd efgh ijkl mnop' })
    await runPrivateCourseReminders(prisma, at(HOUR))
    expect(mailsTo(r.email)).toHaveLength(1)
  })

  it('⚠️ إخفاق Gmail يكتب الخطأ ويوقف الدورة ويعاد بعدها — ورفض المستلم لا يعاد', async () => {
    const a = await reserved(at(-10 * DAY))
    const b = await reserved(at(-9 * DAY))
    let calls = 0
    setPrivateMailSenderForTests(async () => { calls += 1; throw Object.assign(new Error('auth'), { code: 'EAUTH' }) })
    const out = await runPrivateCourseReminders(prisma, NOON)
    expect(calls, 'استمر يحاول بعد رفض الدخول').toBe(1)
    expect(out.failed).toBe(1)
    expect(await row(a.id)).toMatchObject({ reminderError: 'رفض Gmail الدخول — تأكد من البريد وكلمة مرور التطبيق', lastChanceAt: null })

    setPrivateMailSenderForTests(async (config, mail) => {
      if (mail.to === b.email) throw Object.assign(new Error('no such user'), { responseCode: 550 })
      sent.push({ config, mail })
    })
    await runPrivateCourseReminders(prisma, at(HOUR))
    expect(await row(a.id)).toMatchObject({ reminderError: null, lastChanceAt: at(HOUR) })
    expect(mailsTo(a.email)).toHaveLength(1)
    expect(await row(b.id), 'رفض المستلم يعاد كل ساعة').toMatchObject({ reminderError: 'رفض Gmail عنوان المستلم', lastChanceAt: at(HOUR) })
    setPrivateMailSenderForTests(async (config, mail) => { sent.push({ config, mail }) })
  })

  it('⚠️ وظيفة في العامل — ولا أثر في سجل الأكاديمية', async () => {
    const r = await reserved(at(-1.3 * DAY))
    const out = await runJob(prisma, 'private_course_reminders', at(2 * HOUR))
    expect(out.done).toBeGreaterThanOrEqual(1)
    expect(mailsTo(r.email)).toHaveLength(1)
    expect(await prisma.auditEvent.count({ where: { action: 'worker.private_course_reminders' } }), 'أثر في سجل الأكاديمية').toBe(0)
  })

  it('واللوحة تقول ما وصله', async () => {
    const o = (await asOwner('GET', `/api/v1/private/courses/${AI_JOBS_SLUG}`)).json()
    const first = o.registrations.find((x: { email: string }) => x.email === 'remind-1@test.local')
    expect(first.remindedAt).toBe(NOON.toISOString())
    expect(first.lastChanceAt).toBeNull()
  })
})

/* ═══ ⑨ Stripe يؤكد دفع البطاقة وحده (٢١ نوفمبر ٢٠٢٦) ═══
   «نعم اربط Stripe ليتأكّد تلقائيّا». والخبرُ موقَّعٌ بصيغة Stripe، والمطابقةُ برقم المرجع في رابط البطاقة ثمّ بالبريد. */
describe('⑨ Stripe يؤكد دفع البطاقة', () => {
  const SECRET = 'whsec_testSecretForPrivateCourse123'
  const HOOK = `/api/v1/public/private-courses/${AI_JOBS_SLUG}/stripe-webhook`
  let k = 0
  const sign = (body: string, secret = SECRET, t = Math.floor(Date.now() / 1000)) =>
    `t=${t},v1=${createHmac('sha256', secret).update(`${t}.${body}`).digest('hex')}`
  const event = (session: Record<string, unknown>, type = 'checkout.session.completed') => JSON.stringify({
    id: `evt_${++k}`, type,
    data: { object: { object: 'checkout.session', id: `cs_test_${k}`, payment_status: 'paid', amount_total: 2000, currency: 'usd', payment_intent: `pi_test_${k}`, ...session } },
  })
  const post = (body: string, signature = sign(body)) => app.inject({
    method: 'POST', url: HOOK, payload: body, headers: { 'content-type': 'application/json', 'stripe-signature': signature },
  })
  const pending = (email: string, data: Record<string, unknown> = {}) => prisma.privateRegistration.create({
    data: {
      courseSlug: AI_JOBS_SLUG, sectionKey: 'evening', fullName: 'مازن خليل', email, phone: '+966501234567', phoneCountry: 'SA',
      payToken: `stripe-${email}`.replace(/[^A-Za-z0-9_-]/g, '-').padEnd(24, 'x'), ...data,
    },
  })
  const ref = (id: string) => id.slice(0, 8).toUpperCase()

  it('⚠️ بلا مفتاح يرد 503 فيعيده Stripe — ولا يتأكد شيء', async () => {
    const r = await pending('stripe-early@test.local')
    const body = event({ client_reference_id: ref(r.id) })
    expect((await post(body)).statusCode).toBe(503)
    expect((await prisma.privateRegistration.findUniqueOrThrow({ where: { id: r.id } })).status).toBe('pending')
  })

  it('⚠️ المفتاح له وحده، ويحفظ مختوما ولا يعاد إلا مقنعا — ويرد ما ليس whsec_', async () => {
    const other = await app.inject({ method: 'PUT', url: '/api/v1/private/stripe', payload: { webhookSecret: SECRET }, cookies: { wajeez_session: otherAdminToken } })
    expect(other.statusCode).toBe(404)
    expect((await asOwner('PUT', '/api/v1/private/stripe', { webhookSecret: 'sk_live_nope' })).statusCode).toBe(400)
    const res = await asOwner('PUT', '/api/v1/private/stripe', { webhookSecret: SECRET })
    expect(res.statusCode, res.body).toBe(200)
    expect(res.json()).toMatchObject({ ready: true, source: 'db', secretTail: '••••e123' })
    expect(res.body).not.toContain(SECRET)
    const row = await prisma.integrationSetting.findUniqueOrThrow({ where: { provider: 'private_stripe' } })
    expect(JSON.stringify(row.config), 'المفتاح مكتوب بنصه في القاعدة').not.toContain('testSecretForPrivateCourse')
    expect((await asOwner('GET', `/api/v1/private/courses/${AI_JOBS_SLUG}`)).json().stripe.ready).toBe(true)
  })

  it('⚠️ توقيع خاطئ أو قديم أو بغير صيغة Stripe يرد بـ400 — ولا يتأكد أحد', async () => {
    const r = await prisma.privateRegistration.findFirstOrThrow({ where: { email: 'stripe-early@test.local' } })
    const body = event({ client_reference_id: ref(r.id) })
    expect((await post(body, sign(body, 'whsec_someoneElsesSecret0000'))).statusCode).toBe(400)
    expect((await post(body, sign(body, SECRET, Math.floor(Date.now() / 1000) - 3600))).statusCode).toBe(400)
    expect((await post(body, createHmac('sha256', SECRET).update(body).digest('hex'))).statusCode).toBe(400)
    expect((await post(body, '')).statusCode).toBe(400)
    expect((await prisma.privateRegistration.findUniqueOrThrow({ where: { id: r.id } })).status).toBe('pending')
  })

  it('⚠️ دفع بالمرجع يؤكد الحجز ويرسل بريد Zoom — مرة واحدة ولو أعيد الخبر، بلا أثر في سجل الأكاديمية', async () => {
    const r = await prisma.privateRegistration.findFirstOrThrow({ where: { email: 'stripe-early@test.local' } })
    const audits = await prisma.auditEvent.count()
    const body = event({ client_reference_id: ref(r.id), customer_details: { email: 'someone-else@test.local' } })
    const res = await post(body)
    expect(res.statusCode, res.body).toBe(200)
    expect(res.json()).toMatchObject({ action: 'confirmed', reference: ref(r.id) })
    const row = await prisma.privateRegistration.findUniqueOrThrow({ where: { id: r.id } })
    expect(row).toMatchObject({ status: 'confirmed', payMethod: 'card', cardAmount: 2000, cardCurrency: 'USD' })
    expect(row.cardPaidAt).not.toBeNull()
    expect(row.mailSentAt, 'تأكد بلا بريد').not.toBeNull()
    const mails = sent.filter((x) => x.mail.to === 'stripe-early@test.local')
    expect(mails).toHaveLength(1)
    expect(mails[0].mail.subject).toContain('تم تأكيد تسجيلك')
    expect(await prisma.auditEvent.count(), 'أثر في سجل الأكاديمية').toBe(audits)

    const again = await post(body)
    expect(again.json().action).toBe('duplicate')
    expect(sent.filter((x) => x.mail.to === 'stripe-early@test.local'), 'بريدان لخبر معاد').toHaveLength(1)
    expect((await app.inject({ method: 'GET', url: `/api/v1/public/private-courses/${AI_JOBS_SLUG}/pay/${r.payToken}` })).json().status).toBe('confirmed')
  })

  it('⚠️ بلا مرجع: يطابق البريد إن كان المبلغ سعر الدورة — وإلا يحفظ في قائمة ما لم يطابق', async () => {
    const byMail = await pending('stripe-mail@test.local')
    const ok = await post(event({ customer_details: { email: 'Stripe-Mail@test.local' } }))
    expect(ok.json()).toMatchObject({ action: 'confirmed', reference: ref(byMail.id) })

    const cheap = await pending('stripe-cheap@test.local')
    const body = event({ customer_details: { email: 'stripe-cheap@test.local' }, amount_total: 500 })
    expect((await post(body)).json().action).toBe('unmatched')
    expect((await prisma.privateRegistration.findUniqueOrThrow({ where: { id: cheap.id } })).cardPaidAt, 'بريد وحده بمبلغ آخر').toBeNull()
    const list = (await asOwner('GET', `/api/v1/private/courses/${AI_JOBS_SLUG}`)).json().stripe.unmatched
    expect(list[0]).toMatchObject({ email: 'stripe-cheap@test.local', amount: 500, currency: 'USD', reason: 'no_match' })
  })

  it('⚠️ مبلغ أقل من السعر بالمرجع: يكتب ويبقى للمراجعة — ولا يذكر بعدها', async () => {
    const r = await pending('stripe-held@test.local', { createdAt: new Date('2026-11-23T09:00:00.000Z') })
    const res = await post(event({ client_reference_id: ref(r.id), amount_total: 1000 }))
    expect(res.json().action).toBe('held')
    const row = await prisma.privateRegistration.findUniqueOrThrow({ where: { id: r.id } })
    expect(row.status).toBe('pending')
    expect(row.cardAmount).toBe(1000)
    expect(dueReminder(row, new Date('2026-11-25T09:00:00.000Z')), 'ذكر من دفع').toBeNull()
    const o = (await asOwner('GET', `/api/v1/private/courses/${AI_JOBS_SLUG}`)).json()
    expect(o.registrations.find((x: { email: string }) => x.email === 'stripe-held@test.local')).toMatchObject({ cardAmount: 1000, cardCurrency: 'USD' })
  })

  it('⚠️ دفعة ثانية لحجز مدفوع تظهر في القائمة — وترفع منها بعد المطابقة', async () => {
    const r = await prisma.privateRegistration.findFirstOrThrow({ where: { email: 'stripe-early@test.local' } })
    const body = event({ client_reference_id: ref(r.id) })
    expect((await post(body)).json().action).toBe('second')
    const sessionId = (JSON.parse(body) as { data: { object: { id: string } } }).data.object.id
    let list = (await asOwner('GET', `/api/v1/private/courses/${AI_JOBS_SLUG}`)).json().stripe.unmatched
    expect(list.find((u: { sessionId: string }) => u.sessionId === sessionId)).toMatchObject({ reason: 'second', reference: ref(r.id) })
    list = (await asOwner('DELETE', `/api/v1/private/stripe/unmatched/${sessionId}`)).json().unmatched
    expect(list.find((u: { sessionId: string }) => u.sessionId === sessionId)).toBeUndefined()
    expect(sent.filter((x) => x.mail.to === 'stripe-early@test.local'), 'بريد ثان للدفعة الثانية').toHaveLength(1)
  })

  it('وما لم يقبض أو ليس دفعا لا يفعل شيئا — ويكتب أن الخبر وصل', async () => {
    const r = await pending('stripe-async@test.local')
    expect((await post(event({ client_reference_id: ref(r.id), payment_status: 'unpaid' }))).json().action).toBe('unpaid')
    expect((await post(event({}, 'payment_intent.created'))).json().action).toBe('ignored')
    expect((await prisma.privateRegistration.findUniqueOrThrow({ where: { id: r.id } })).status).toBe('pending')
    const st = (await asOwner('GET', `/api/v1/private/courses/${AI_JOBS_SLUG}`)).json().stripe
    expect(st.lastEventType).toBe('payment_intent.created')
    expect(st.lastEventAt).not.toBeNull()
    /* والمتأخّرُ قبضُه يصل بخبرٍ ثانٍ فيتأكّد */
    const later = await post(event({ client_reference_id: ref(r.id) }, 'checkout.session.async_payment_succeeded'))
    expect(later.json().action).toBe('confirmed')
  })

  it('وصفحة الدفع تقول إن البطاقة تتأكد وحدها حين يربط — والفصل يعيدها باليد', async () => {
    await asOwner('PATCH', `/api/v1/private/courses/${AI_JOBS_SLUG}`, { cardUrl: 'https://buy.stripe.com/test_abc123' })
    const r = await pending('stripe-view@test.local')
    const url = `/api/v1/public/private-courses/${AI_JOBS_SLUG}/pay/${r.payToken}`
    expect((await app.inject({ method: 'GET', url })).json().cardAuto).toBe(true)
    expect((await asOwner('PUT', '/api/v1/private/stripe', { webhookSecret: '' })).json().ready).toBe(false)
    expect((await app.inject({ method: 'GET', url })).json().cardAuto).toBe(false)
    expect((await post(event({ client_reference_id: ref(r.id) }))).statusCode).toBe(503)
  })
})
