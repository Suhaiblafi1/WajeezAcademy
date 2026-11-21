/* ═══ دورةُ صاحب المنصّة الخاصّة — من الصفحة إلى بريد التأكيد (١٩ نوفمبر ٢٠٢٦) ═══

   ما يُحرَس هنا، وكلٌّ منه قرارٌ قاله صاحبُ المنصّة:
   ① **التسجيلُ من الصفحة**: الرقمُ بمفتاح الدولة، وصورةُ الحوالة صورةٌ أو PDF بالبايتات، وتسجيلٌ ثانٍ يحدّث الأوّل.
   ② **اللوحةُ له وحدَه**: «فقط أنا suhaib@wajeez.co» — لا مديرَ نظامٍ آخر، ولا بريدُه بلا رتبة.
   ③ **بريدُ التأكيد**: من Gmail صاحبها، فيه رابطُ Zoom شعبته وروابطُ Claude Code وملفُّ الدورة، ودعوةٌ مدعوُّها
      المتعلّمُ وحدَه — و«لا تضع لوقو وجيز.. ولا تُدرج أحدا ثانيا من أكاديميّة وجيز».
   ④ **التحميلُ**: Excel للمسجّلين، كلِّهم أو شعبةٍ وحدَها. */

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
import { AI_JOBS_SLUG, CLAUDE_LINKS } from '../../../src/application/private-course/ai-jobs'

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
   ولمن رقمُه خارجَ الأردن أوّلا — ويرفع الإيصالَ بعدها، ويُكتب كيف دفع. */
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

  it('⚠️ والإيصال المرفوع بالبطاقة يكتب طريقته — في اللوحة وExcel', async () => {
    const row = await prisma.privateRegistration.findFirstOrThrow({ where: { email: 'nopay@test.local' } })
    const up = await app.inject({
      method: 'POST', url: payUrl(row.payToken),
      payload: { proof: { name: 'receipt.png', base64: PNG.toString('base64') }, payMethod: 'card' },
    })
    expect(up.statusCode, up.body).toBe(200)
    expect((await prisma.privateRegistration.findUniqueOrThrow({ where: { id: row.id } })).payMethod).toBe('card')
    const o = (await asOwner('GET', `/api/v1/private/courses/${AI_JOBS_SLUG}`)).json()
    expect(o.registrations.find((x: { email: string }) => x.email === 'nopay@test.local').payMethod).toBe('card')
    const x = await asOwner('GET', `/api/v1/private/courses/${AI_JOBS_SLUG}/export.xlsx`)
    const wb = new ExcelJS.Workbook()
    await wb.xlsx.load(x.rawPayload as never)
    const all = wb.getWorksheet('الكل')!
    const col = (all.getRow(1).values as unknown[]).indexOf('طريقة الدفع')
    const cell = all.getRows(2, all.rowCount - 1)!.find((r) => r.getCell(2).value === 'nopay@test.local')!.getCell(col).value
    expect(cell).toBe('بطاقة')
  })

  it('وطريقة غير معروفة ترد، والإفراغ يخفي الخيار', async () => {
    const row = await prisma.privateRegistration.findFirstOrThrow({ where: { email: 'layla@test.local' } })
    const bad = await app.inject({
      method: 'POST', url: payUrl(row.payToken),
      payload: { proof: { name: 'r.png', base64: PNG.toString('base64') }, payMethod: 'bitcoin' },
    })
    expect(bad.statusCode).toBe(422)
    await asOwner('PATCH', `/api/v1/private/courses/${AI_JOBS_SLUG}`, { cardUrl: '' })
    expect((await app.inject({ method: 'GET', url: `/api/v1/public/private-courses/${AI_JOBS_SLUG}` })).json().card).toBe(false)
  })
})
