/* «البريد الجماعي» — قوائمُ تُرفع وحملاتٌ تُرسل (٢٢ نوفمبر ٢٠٢٦). والعلّةُ في رأس
   `server/services/bulk-mail/bulk-mail.service.ts`.

   ① **الملفُّ يُقرأ** — CSV وExcel: عمودُ البريد برأسه أو بما فيه، والاسمُ اختياريّ، وغيرُ الصالح والمكرّرُ يُعدّان ولا يُحفظان.
   ② **والقائمةُ تُحفظ صفوفُها** وتُسمّى وتُحذف، وقوائمُ الموقع بلا من مُحيت بياناتُه.
   ③ **والتجربةُ تصل المرسلَ وحدَه.**
   ④ **والإرسالُ يكتب من تصله بالضبط**: بلا من ألغى اشتراكَه ولا المكرّر، برابطَي الإلغاء ومرجعٍ واحد، ودفعاتٍ لا أمرا واحدا،
      وبالعدد الذي رآه المرسلُ وإلّا لا شيء، ومرّةً واحدة.
   ⑤ **والإيقافُ يلغي ما لم يخرج**، والعاملُ لا يرسله بعده.
   ⑥ **والعاجلُ لا يقف خلف الحملة**، وحدُّ الثانية لا يحرق محاولة.
   ⑦ **وكلُّه بصلاحيّة الكوبونات، بأثرٍ يسمّي من فعل.**
   ⑧ **ومن مُرسِلٍ على نطاقٍ فرعيّ** يُكتب في الحملة ساعةَ تُرسل، ولا رجوعَ إلى نطاق الحساب إن رُدّ — ورسائلُ الحساب لا تمرّه.
   ⑨ **وعلى مراحل**: كلُّ يومٍ بموعده، والعاملُ لا يأخذ يوما قبل وقته، والإيقافُ يلغي ما لم يحن. */

import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import type { PrismaClient } from '@prisma/client'
import type { FastifyInstance } from 'fastify'
import ExcelJS from 'exceljs'
import { setupTestDb, testPrisma } from '../helpers/db'
import { AuthService } from '../../services/auth.service'
import { buildApp } from '../../http/app'
import { SESSION_COOKIE } from '../../http/auth-plugin'
import { csvRows, parseMailFile } from '../../services/bulk-mail/parse'
import { finalizeCampaigns, sendCampaign, sendTest, type TestSender } from '../../services/bulk-mail/bulk-mail.service'
import { drainBulkMail } from '../../services/bulk-mail/drain'
import { drainOutbox, enqueueMail, enqueueMails, type OutboxSender } from '../../services/outbox.service'
import { RESEND_RATE_LIMIT_AR } from '../../services/mail'
import { UNSUBSCRIBE_ONE_CLICK, UNSUBSCRIBE_PAGE } from '../../services/mail-optout.service'
import { BULK_MAIL_PURPOSE, DEFAULT_BULK_SENDER } from '../../../src/application/marketing/bulk-mail'
import { listCampaigns } from '../../services/bulk-mail/bulk-mail.service'
import { BULK_SENDER_KEY } from '../../services/bulk-mail/sender'
import { UNVERIFIED_DOMAIN_AR } from '../../services/mail'
import { phoneTail as phoneTailOf } from '../../../src/application/advisor/phone-tail'

let prisma: PrismaClient
let app: FastifyInstance
let boss = ''
let learner = ''
let bossId = ''
const S = Date.now()
const BOSS_EMAIL = `bulk-owner-${S}@test.local`

const csv = (s: string) => Buffer.from(s, 'utf8')
const mail = (n: number | string) => `bulk-${S}-${n}@test.local`

async function xlsx(rows: unknown[][]): Promise<Buffer> {
  const wb = new ExcelJS.Workbook()
  const ws = wb.addWorksheet('الأعضاء')
  for (const r of rows) ws.addRow(r)
  return Buffer.from(await wb.xlsx.writeBuffer())
}

const http = (method: 'GET' | 'POST' | 'PUT' | 'DELETE', url: string, opts: { body?: unknown; raw?: Buffer; who?: string } = {}) =>
  app.inject({
    method, url,
    headers: { cookie: opts.who ?? boss, ...(opts.raw ? { 'content-type': 'application/octet-stream' } : {}) },
    ...(opts.raw ? { payload: opts.raw } : opts.body !== undefined ? { payload: opts.body as object } : {}),
  })

async function upload(file: Buffer, name: string): Promise<string> {
  const res = await http('POST', `/api/admin/bulk-mail/lists?name=${encodeURIComponent(name)}&file=x.csv`, { raw: file })
  expect(res.statusCode, res.body).toBe(201)
  return (res.json() as { id: string }).id
}

async function campaign(audience: string, extra: Record<string, unknown> = {}): Promise<string> {
  const res = await http('POST', '/api/admin/bulk-mail/campaigns', {
    body: { subject: 'خصم الشتاء', body: 'أهلا بك.\n\nالتفاصيل في https://wajeez.academy/winter', buttonLabel: 'سجل الآن', buttonUrl: 'https://wajeez.academy/go', audience, ...extra },
  })
  expect(res.statusCode, res.body).toBe(201)
  return (res.json() as { id: string }).id
}

const queuedOf = (batchId: string) => prisma.outboxMail.findMany({ where: { batchId }, orderBy: { to: 'asc' } })

beforeAll(async () => {
  await setupTestDb()
  prisma = await testPrisma()
  app = await buildApp(prisma)
  const auth = new AuthService(prisma)
  const owner = await auth.register(BOSS_EMAIL, 'Owner#123456', 'سهيب اللافي')
  bossId = owner.userId
  await auth.setRoles(bossId, ['super_admin'])
  boss = `${SESSION_COOKIE}=${(await auth.login(BOSS_EMAIL, 'Owner#123456')).token}`
  await auth.register(`bulk-learner-${S}@test.local`, 'Learner#123456', 'متعلم')
  learner = `${SESSION_COOKIE}=${(await auth.login(`bulk-learner-${S}@test.local`, 'Learner#123456')).token}`
}, 240_000)

afterAll(async () => { await app?.close() })

describe('① الملف يقرأ: CSV وExcel', () => {
  it('⚠️ CSV برأس عربي: عمود البريد والاسم، وغير الصالح والمكرر يعدان، والصف الفارغ لا يعد', async () => {
    const out = await parseMailFile(csv([
      '﻿الاسم الكامل,رقم الهاتف,البريد الإلكتروني',
      'سارة أحمد,0790000000,Sara@Example.com',
      'عبد الله خالد,0790000001, sara@example.com ',
      '"علي, محمد",0790000002,not-an-email',
      ',,',
      'منى,0790000003,<mona@example.org>',
    ].join('\r\n')))
    expect(out.emailColumn).toBe('البريد الإلكتروني')
    expect(out.nameColumn).toBe('الاسم الكامل')
    expect(out.totalRows, 'الصف الفارغ عد').toBe(4)
    expect(out.entries).toEqual([{ email: 'sara@example.com', name: 'سارة أحمد' }, { email: 'mona@example.org', name: 'منى' }])
    expect(out.invalid).toBe(1)
    expect(out.duplicates, 'المكرر بحروف مختلفة لم يعرف').toBe(1)
    expect(out.invalidSamples).toEqual([{ row: 4, value: 'not-an-email' }])
  })

  it('⚠️ وبلا رأس يدل: أول عمود أكثره بريد — والفاصلة المنقوطة تقرأ', async () => {
    const out = await parseMailFile(csv('1;a@x.com;أحمد\n2;b@x.com;ليلى\n3;c@x.com;\n'))
    expect(out.entries.map((e) => e.email)).toEqual(['a@x.com', 'b@x.com', 'c@x.com'])
    expect(out.totalRows).toBe(3)
    expect(out.nameColumn, 'لا رأس فلا عمود اسم يعرف').toBeNull()
    expect(csvRows('"x ""y""",z\n')).toEqual([['x "y"', 'z']])
  })

  it('⚠️ وExcel: رأس إنجليزي، وبريد في رابط mailto، والاسم الأول مقدم على الكامل', async () => {
    const out = await parseMailFile(await xlsx([
      ['Full Name', 'First Name', 'Email Address'],
      ['Sara Ahmad', 'Sara', { text: 'sara@x.com', hyperlink: 'mailto:sara@x.com' }],
      ['Omar Ali', 'Omar', 'OMAR@x.com'],
      ['Bad', 'Bad', 'bad@'],
      ['Dup', 'Dup', 'omar@x.com'],
    ]))
    expect(out.emailColumn).toBe('Email Address')
    expect(out.nameColumn).toBe('First Name')
    expect(out.entries).toEqual([{ email: 'sara@x.com', name: 'Sara' }, { email: 'omar@x.com', name: 'Omar' }])
    expect([out.totalRows, out.invalid, out.duplicates]).toEqual([4, 1, 1])
  })

  it('⚠️ وما لا عمود بريد فيه يقال، وExcel القديم يقال اسمه', async () => {
    await expect(parseMailFile(csv('a,b\n1,2\n'))).rejects.toMatchObject({ code: 'no_email_column' })
    await expect(parseMailFile(Buffer.from([0xd0, 0xcf, 0x11, 0xe0, 0, 0]))).rejects.toMatchObject({ code: 'old_excel' })
  })
})

describe('② القائمة تحفظ صفوفها، وقوائم الموقع بلا من محيت بياناته', () => {
  it('⚠️ المعاينة تعد من ألغى الاشتراك، والحفظ يحفظ الصالح مرة، والاسم يتغير والحذف يحذف صفوفها', async () => {
    await prisma.mailOptOut.create({ data: { email: mail('off') } })
    const file = csv(`email,name\n${mail(1)},سارة\n${mail('off')},ملغى\n${mail(1)},مكرر\nbad,سيء\n`)
    const pre = await http('POST', '/api/admin/bulk-mail/lists/preview', { raw: file })
    expect(pre.statusCode, pre.body).toBe(200)
    expect(pre.json()).toMatchObject({ totalRows: 4, valid: 2, invalid: 1, duplicates: 1, optedOut: 1 })

    const id = await upload(file, 'أعضاء التطبيق')
    expect(await prisma.mailListEntry.count({ where: { listId: id } })).toBe(2)
    const aud = (await http('GET', '/api/admin/bulk-mail/audiences')).json() as { lists: { key: string; nameAr: string; count: number }[] }
    expect(aud.lists.find((l) => l.key === `list:${id}`)).toMatchObject({ nameAr: 'أعضاء التطبيق', count: 2 })

    expect((await http('PUT', `/api/admin/bulk-mail/lists/${id}`, { body: { name: 'أعضاء وجيز' } })).statusCode).toBe(200)
    expect((await prisma.mailList.findUniqueOrThrow({ where: { id } })).name).toBe('أعضاء وجيز')
    expect((await http('DELETE', `/api/admin/bulk-mail/lists/${id}`)).statusCode).toBe(200)
    expect(await prisma.mailListEntry.count({ where: { listId: id } }), 'بقيت صفوف القائمة بعد حذفها').toBe(0)

    const acts = await prisma.auditEvent.findMany({ where: { entityId: id }, select: { action: true, actorId: true } })
    expect(acts.map((a) => a.action).sort()).toEqual(['bulk_mail.list_delete', 'bulk_mail.list_rename', 'bulk_mail.list_upload'])
    expect(acts.every((a) => a.actorId === bossId)).toBe(true)
  })

  it('⚠️ ليدات الحملة: كل من له بريد مرة واحدة، ومن محيت بياناته لا يدخل', async () => {
    const slug = `bulk-camp-${S}`
    await prisma.lead.createMany({
      data: [
        { fullName: 'ليلى سمير', email: mail('lead-a'), source: 'campaign', campaign: slug },
        { fullName: 'ليلى مكررة', email: mail('lead-a').toUpperCase(), source: 'campaign', campaign: slug },
        { fullName: 'محذوف', email: mail('lead-gone'), source: 'campaign', campaign: slug, erasedAt: new Date() },
        { fullName: 'بلا بريد', email: null, source: 'campaign', campaign: slug },
      ],
    })
    const aud = (await http('GET', '/api/admin/bulk-mail/audiences')).json() as { website: { key: string; count: number }[] }
    expect(aud.website.find((w) => w.key === `leads:campaign:${slug}`)?.count).toBe(1)
    expect(aud.website[0].key).toBe('leads:all')

    const id = await campaign(`leads:campaign:${slug}`)
    const check = (await http('GET', `/api/admin/bulk-mail/campaigns/${id}/check`)).json() as { recipients: number; duplicate: number }
    expect(check).toMatchObject({ recipients: 1, duplicate: 1 })
    const sent = (await http('POST', `/api/admin/bulk-mail/campaigns/${id}/send`, { body: { confirmCount: 1 } })).json() as { batchId: string }
    const rows = await queuedOf(sent.batchId)
    expect(rows.map((r) => r.to)).toEqual([mail('lead-a')])
    expect(rows[0].text, 'لم يحي باسمه الأول').toContain('مرحبا ليلى،')
  })
})

describe('③ التجربة تصل المرسل وحده', () => {
  it('⚠️ رسالة واحدة إلى بريده، بعنوان «تجربة»، ولا شيء في الطابور', async () => {
    const calls: { to: string; subject: string; unsub: string; from: string }[] = []
    const send: TestSender = async (to, subject, _t, _h, unsub, from) => { calls.push({ to, subject, unsub, from: from.email }); return { status: 'sent' } }
    const before = await prisma.outboxMail.count()
    const out = await sendTest(prisma, { subject: 'خصم', body: 'نص' }, bossId, undefined, send)
    expect(out).toMatchObject({ to: BOSS_EMAIL, status: 'sent' })
    expect(calls).toHaveLength(1)
    expect(calls[0]).toMatchObject({ to: BOSS_EMAIL, subject: '[تجربة] خصم', from: DEFAULT_BULK_SENDER.email })
    expect(calls[0].unsub).toContain(UNSUBSCRIBE_ONE_CLICK)
    expect(await prisma.outboxMail.count(), 'كتبت التجربة في الطابور').toBe(before)
    expect(await prisma.auditEvent.count({ where: { action: 'bulk_mail.test', actorId: bossId } })).toBe(1)

    /* ومن الباب: إلى بريد المرسل لا إلى غيره */
    const res = await http('POST', '/api/admin/bulk-mail/test', { body: { subject: 'خصم', body: 'نص' } })
    expect(res.statusCode, res.body).toBe(200)
    expect((res.json() as { to: string }).to).toBe(BOSS_EMAIL)
  })
})

describe('④ الإرسال يكتب من تصله بالضبط', () => {
  it('⚠️ بلا من ألغى، برابطي الإلغاء ومرجع واحد وغرض الحملة، وتحية باسمه أو «مرحبا،»', async () => {
    await prisma.mailOptOut.create({ data: { email: mail('off2') } })
    const listId = await upload(csv(`Email,First Name\n${mail('s1')},سارة\n${mail('off2')},ملغى\n${mail('s2')},\n${mail('s1')},مكرر\nxx,سيء\n`), 'تجربة')
    const id = await campaign(`list:${listId}`)
    const check = (await http('GET', `/api/admin/bulk-mail/campaigns/${id}/check`)).json() as Record<string, number | string>
    expect(check).toMatchObject({ recipients: 2, optedOut: 1, invalid: 1, duplicate: 1, audienceAr: 'تجربة' })

    const res = await http('POST', `/api/admin/bulk-mail/campaigns/${id}/send`, { body: { confirmCount: 2 } })
    expect(res.statusCode, res.body).toBe(200)
    const { batchId, queued } = res.json() as { batchId: string; queued: number }
    expect(queued).toBe(2)
    const rows = await queuedOf(batchId)
    expect(rows.map((r) => r.to), 'وصل من ألغى أو المكرر').toEqual([mail('s1'), mail('s2')])
    for (const r of rows) {
      expect(r.purpose).toBe(BULK_MAIL_PURPOSE)
      expect(r.status).toBe('queued')
      expect(r.unsubscribeUrl, 'بلا رأس الإلغاء بنقرة').toContain(UNSUBSCRIBE_ONE_CLICK)
      expect(r.html, 'بلا رابط الإلغاء في التذييل').toContain(UNSUBSCRIBE_PAGE)
      expect(r.html).toContain('https://wajeez.academy/go')
      expect(r.html, 'الرابط في النص لا يضغط').toContain('href="https://wajeez.academy/winter"')
    }
    expect(rows[0].text).toContain('مرحبا سارة،')
    expect(rows[1].text).toContain('مرحبا،')
    const c = await prisma.mailCampaign.findUniqueOrThrow({ where: { id } })
    expect(c).toMatchObject({ status: 'sending', queuedCount: 2, skippedOptOut: 1, skippedInvalid: 1, skippedDuplicate: 1, audienceAr: 'تجربة', sentBy: bossId })
    const audit = await prisma.auditEvent.findFirstOrThrow({ where: { action: 'bulk_mail.send', entityId: id } })
    expect(audit.actorId).toBe(bossId)

    /* ومرّةً واحدة: ضغطةٌ ثانيةٌ لا تكتبها مرّتين */
    const again = await http('POST', `/api/admin/bulk-mail/campaigns/${id}/send`, { body: { confirmCount: 2 } })
    expect(again.statusCode).toBe(409)
    expect(await prisma.outboxMail.count({ where: { purpose: BULK_MAIL_PURPOSE, to: mail('s1') } }), 'كتبت مرتين').toBe(1)
  })

  it('⚠️ والعدد الذي رآه هو ما يرسل — وإلا لا شيء يكتب', async () => {
    const listId = await upload(csv(`email\n${mail('c1')}\n${mail('c2')}\n`), 'عدد')
    const id = await campaign(`list:${listId}`)
    const res = await http('POST', `/api/admin/bulk-mail/campaigns/${id}/send`, { body: { confirmCount: 3 } })
    expect(res.statusCode).toBe(409)
    expect((res.json() as { error: { message_ar: string } }).error.message_ar).toContain('تصل الآن 2')
    expect((await prisma.mailCampaign.findUniqueOrThrow({ where: { id } })).status).toBe('draft')
    expect(await prisma.outboxMail.count({ where: { to: { in: [mail('c1'), mail('c2')] } } })).toBe(0)
  })

  it('⚠️ وألفان وخمسمئة تكتب دفعات من خمسمئة — لا أمرا واحدا', async () => {
    const lines = Array.from({ length: 2_500 }, (_, i) => mail(`big-${i}`))
    const listId = await upload(csv(`email\n${lines.join('\n')}\n`), 'كبيرة')
    const id = await campaign(`list:${listId}`)
    const sizes: number[] = []
    const out = await sendCampaign(prisma, id, 2_500, bossId, undefined, {
      enqueue: (entries) => { sizes.push(entries.length); return enqueueMails(prisma, entries) },
    })
    expect(out.queued).toBe(2_500)
    expect(sizes, 'كتبت في أمر واحد').toEqual([500, 500, 500, 500, 500])
    const rows = await prisma.outboxMail.findMany({ where: { batchId: out.batchId }, select: { to: true } })
    expect(new Set(rows.map((r) => r.to)).size, 'تكرر بريد في الدفعة').toBe(2_500)
  }, 120_000)
})

describe('⑤ الإيقاف يلغي ما لم يخرج', () => {
  it('⚠️ ما في الطابور يحذف ويعد، وما خرج يبقى، والعامل لا يرسل بعده', async () => {
    const listId = await upload(csv(`email\n${mail('p1')}\n${mail('p2')}\n${mail('p3')}\n`), 'إيقاف')
    const id = await campaign(`list:${listId}`)
    const { batchId } = await sendCampaign(prisma, id, 3, bossId)
    await prisma.outboxMail.updateMany({ where: { batchId, to: mail('p1') }, data: { status: 'sent', sentAt: new Date() } })

    const res = await http('POST', `/api/admin/bulk-mail/campaigns/${id}/stop`)
    expect(res.statusCode, res.body).toBe(200)
    expect(res.json()).toMatchObject({ cancelled: 2, sent: 1 })
    expect((await queuedOf(batchId)).map((r) => r.status)).toEqual(['sent'])
    expect(await prisma.mailCampaign.findUniqueOrThrow({ where: { id } })).toMatchObject({ status: 'stopped', cancelledCount: 2, sentCount: 1, stoppedBy: bossId })
    expect(await prisma.auditEvent.count({ where: { action: 'bulk_mail.stop', entityId: id, actorId: bossId } })).toBe(1)
    expect((await http('POST', `/api/admin/bulk-mail/campaigns/${id}/stop`)).statusCode, 'أوقفت مرتين').toBe(409)
  })

  it('⚠️ ودفعة جلبها العامل قبل الإيقاف لا ترسل بعده', async () => {
    const listId = await upload(csv(`email\n${mail('q1')}\n${mail('q2')}\n`), 'إيقاف وسط')
    const id = await campaign(`list:${listId}`)
    const { batchId } = await sendCampaign(prisma, id, 2, bossId)
    await prisma.outboxMail.updateMany({ where: { purpose: BULK_MAIL_PURPOSE, status: 'queued', NOT: { batchId } }, data: { status: 'failed' } })
    const sentTo: string[] = []
    const send: OutboxSender = async (to) => { sentTo.push(to); return { status: 'sent' } }
    let first = true
    /* الإيقافُ يقع بين جلب الدفعة وأوّل رسالة */
    const pace = async () => { if (first) { first = false; await prisma.outboxMail.deleteMany({ where: { batchId, status: 'queued' } }) } }
    await drainBulkMail(prisma, { limit: 10, pace, send })
    expect(sentTo, 'أرسل ما أوقف').toEqual([])
  })
})

describe('⑥ العاجل لا يقف خلف الحملة، وحد الثانية لا يحرق محاولة', () => {
  it('⚠️ باب الطابور العام لا يأخذ رسائل الحملة — ورسالة كتبت بعدها تخرج قبلها', async () => {
    const listId = await upload(csv(`email\n${mail('o1')}\n${mail('o2')}\n`), 'أولوية')
    const id = await campaign(`list:${listId}`)
    const { batchId } = await sendCampaign(prisma, id, 2, bossId)
    await enqueueMail(prisma, { to: mail('urgent'), subject: 'رمز الدخول', text: 'x', purpose: 'auth.code' })
    const sentTo: string[] = []
    const send: OutboxSender = async (to) => { sentTo.push(to); return { status: 'sent' } }
    await drainOutbox(prisma, { limit: 50, gapMs: 0, send })
    expect(sentTo, 'لم يخرج العاجل').toContain(mail('urgent'))
    expect(sentTo.filter((t) => t === mail('o1') || t === mail('o2')), 'أخذ الطابور العام رسائل الحملة').toEqual([])
    expect((await queuedOf(batchId)).every((r) => r.status === 'queued')).toBe(true)
  })

  it('⚠️ وباب الحملة يرسلها برأس الإلغاء، ويمحو متنها، وينهي الحملة بأرقامها', async () => {
    await prisma.outboxMail.updateMany({ where: { purpose: BULK_MAIL_PURPOSE, status: 'queued' }, data: { status: 'failed' } })
    const listId = await upload(csv(`email\n${mail('d1')}\n${mail('d2')}\n`), 'تفريغ')
    const id = await campaign(`list:${listId}`)
    const { batchId } = await sendCampaign(prisma, id, 2, bossId)
    const got: { to: string; unsub?: string }[] = []
    const send: OutboxSender = async (to, _s, _t, _h, _i, unsub) => { got.push({ to, unsub }); return { status: 'sent' } }
    const run = await drainBulkMail(prisma, { limit: 10, send })
    expect(run.sent).toBe(2)
    expect(got.map((g) => g.to).sort()).toEqual([mail('d1'), mail('d2')])
    expect(got.every((g) => g.unsub?.includes(UNSUBSCRIBE_ONE_CLICK))).toBe(true)
    expect((await queuedOf(batchId)).every((r) => r.status === 'sent' && r.html === null)).toBe(true)
    expect(await finalizeCampaigns(prisma)).toContain(id)
    expect(await prisma.mailCampaign.findUniqueOrThrow({ where: { id } })).toMatchObject({ status: 'sent', sentCount: 2, failedCount: 0 })
  })

  it('⚠️ ورد حد الثانية يبقي الرسالة بلا محاولة محروقة، ويقف', async () => {
    await prisma.outboxMail.updateMany({ where: { purpose: BULK_MAIL_PURPOSE, status: 'queued' }, data: { status: 'failed' } })
    const listId = await upload(csv(`email\n${mail('r1')}\n${mail('r2')}\n`), 'حد')
    const id = await campaign(`list:${listId}`)
    const { batchId } = await sendCampaign(prisma, id, 2, bossId)
    let calls = 0
    const send: OutboxSender = async () => { calls += 1; return { status: 'failed', error: RESEND_RATE_LIMIT_AR } }
    const run = await drainBulkMail(prisma, { limit: 10, send })
    expect(run.rateLimited).toBe(true)
    expect(calls, 'لم يقف بعد الرد').toBe(1)
    expect((await queuedOf(batchId)).map((r) => [r.status, r.attempts])).toEqual([['queued', 0], ['queued', 0]])
  })
})

describe('⑦ بصلاحية الكوبونات', () => {
  it('⚠️ المتعلم يرد ٤٠٣ عن كل باب، ومن بلا جلسة ٤٠١', async () => {
    const urls: ['GET' | 'POST', string][] = [
      ['GET', '/api/admin/bulk-mail/campaigns'], ['GET', '/api/admin/bulk-mail/audiences'],
      ['POST', '/api/admin/bulk-mail/campaigns'], ['POST', '/api/admin/bulk-mail/test'],
      ['POST', '/api/admin/bulk-mail/lists/preview'],
    ]
    for (const [m, u] of urls) {
      expect((await http(m, u, { who: learner, body: {} })).statusCode, u).toBe(403)
      expect((await http(m, u, { who: '', body: {} })).statusCode, u).toBe(401)
    }
  })
})

describe('⑧ مرسل الحملات على نطاق فرعي', () => {
  const clearBulk = () => prisma.outboxMail.updateMany({ where: { purpose: BULK_MAIL_PURPOSE, status: 'queued' }, data: { status: 'failed' } })

  it('⚠️ الافتراض نطاق الأخبار، ويكتب في الحملة، وتغييره بعدها لا يمس حملة في طريقها', async () => {
    await prisma.systemSetting.deleteMany({ where: { key: BULK_SENDER_KEY } })
    await clearBulk()
    const listId = await upload(csv(`email\n${mail('f1')}\n`), 'مرسل')
    const id = await campaign(`list:${listId}`)
    await sendCampaign(prisma, id, 1, bossId)
    expect(await prisma.mailCampaign.findUniqueOrThrow({ where: { id } })).toMatchObject({ fromEmail: DEFAULT_BULK_SENDER.email, fromName: DEFAULT_BULK_SENDER.name })

    const res = await http('PUT', '/api/admin/bulk-mail/sender', { body: { name: 'وجيز', email: 'hello@mail.wajeezacademy.com' } })
    expect(res.statusCode, res.body).toBe(200)
    expect(await prisma.auditEvent.count({ where: { action: 'bulk_mail.sender', actorId: bossId } })).toBe(1)
    expect((await http('PUT', '/api/admin/bulk-mail/sender', { body: { name: 'وجيز', email: 'not-mail' } })).statusCode).toBe(400)

    const froms: (string | undefined)[] = []
    const send: OutboxSender = async (_to, _s, _t, _h, _i, _u, from) => { froms.push(from?.email); return { status: 'sent' } }
    await drainBulkMail(prisma, { limit: 10, send })
    expect(froms, 'غير المرسل حملة في طريقها').toEqual([DEFAULT_BULK_SENDER.email])
    await prisma.systemSetting.deleteMany({ where: { key: BULK_SENDER_KEY } })
  })

  it('⚠️ ونطاق غير موثق يسقط برسالته حتى حد المحاولات — بلا رجوع إلى نطاق الحساب', async () => {
    await clearBulk()
    const listId = await upload(csv(`email\n${mail('v1')}\n`), 'غير موثق')
    const id = await campaign(`list:${listId}`)
    const { batchId } = await sendCampaign(prisma, id, 1, bossId)
    const froms: (string | undefined)[] = []
    const send: OutboxSender = async (_to, _s, _t, _h, _i, _u, from) => {
      froms.push(from?.email)
      return { status: 'failed', error: `${UNVERIFIED_DOMAIN_AR}: The news.wajeezacademy.com domain is not verified` }
    }
    for (let i = 0; i < 4; i += 1) await drainBulkMail(prisma, { limit: 10, send })
    expect(froms, 'رجع إلى مرسل آخر أو أعاد بعد الحد').toEqual([DEFAULT_BULK_SENDER.email, DEFAULT_BULK_SENDER.email, DEFAULT_BULK_SENDER.email])
    const [row] = await queuedOf(batchId)
    expect(row.status).toBe('failed')
    expect(row.lastError).toContain(UNVERIFIED_DOMAIN_AR)
  })

  it('⚠️ ورسائل الحساب لا تمر بمرسل الحملات', async () => {
    await enqueueMail(prisma, { to: mail('acct'), subject: 'إيصال', text: 'x', purpose: 'order.receipt' })
    const froms: unknown[] = []
    const send: OutboxSender = async (to, _s, _t, _h, _i, _u, from) => { if (to === mail('acct')) froms.push(from); return { status: 'sent' } }
    await drainOutbox(prisma, { limit: 50, gapMs: 0, send })
    expect(froms, 'خرج إيصال الحساب من مرسل الحملات').toEqual([undefined])
  })
})

describe('⑨ الإرسال على مراحل', () => {
  it('⚠️ كل يوم بموعده، والعامل لا يأخذ يوما قبل وقته، والشاشة تعد كل مرحلة، والإيقاف يلغي ما لم يحن', async () => {
    await prisma.outboxMail.updateMany({ where: { purpose: BULK_MAIL_PURPOSE, status: 'queued' }, data: { status: 'failed' } })
    const lines = Array.from({ length: 7 }, (_, i) => mail(`st-${i}`))
    const listId = await upload(csv(`email\n${lines.join('\n')}\n`), 'مراحل')
    const id = await campaign(`list:${listId}`)
    const t0 = new Date()
    const DAY = 86_400_000
    const res = await http('POST', `/api/admin/bulk-mail/campaigns/${id}/send`, { body: { confirmCount: 7, stages: [2, 3] } })
    expect(res.statusCode, res.body).toBe(200)
    const { batchId, stages } = res.json() as { batchId: string; stages: number[] }
    expect(stages).toEqual([2, 3, 2])
    const rows = await prisma.outboxMail.findMany({ where: { batchId }, select: { notBefore: true } })
    const byDay = [0, 0, 0]
    for (const r of rows) byDay[r.notBefore === null ? 0 : Math.round((r.notBefore.getTime() - t0.getTime()) / DAY)] += 1
    expect(byDay, 'مواعيد المراحل').toEqual([2, 3, 2])

    const sentTo: string[] = []
    const send: OutboxSender = async (to) => { sentTo.push(to); return { status: 'sent' } }
    await drainBulkMail(prisma, { limit: 50, send, now: new Date(t0.getTime() + 60_000) })
    expect(sentTo, 'أخذ العامل يوما قبل وقته').toHaveLength(2)
    await drainBulkMail(prisma, { limit: 50, send, now: new Date(t0.getTime() + DAY + 60_000) })
    expect(sentTo).toHaveLength(5)

    const view = (await listCampaigns(prisma)).campaigns.find((c) => c.id === id)!
    expect(view.status).toBe('sending')
    expect(view.stages.map((st) => [st.count, st.sent, st.waiting])).toEqual([[2, 2, 0], [3, 3, 0], [2, 0, 2]])

    const stop = (await http('POST', `/api/admin/bulk-mail/campaigns/${id}/stop`)).json() as { cancelled: number; sent: number }
    expect(stop).toEqual({ cancelled: 2, sent: 5, failed: 0 })
  })

  it('⚠️ وعدد مرحلة ليس رقما صحيحا موجبا يرد', async () => {
    const listId = await upload(csv(`email\n${mail('bad-st')}\n`), 'مراحل خطأ')
    const id = await campaign(`list:${listId}`)
    expect((await http('POST', `/api/admin/bulk-mail/campaigns/${id}/send`, { body: { confirmCount: 1, stages: [0] } })).statusCode).toBe(422)
    expect((await prisma.mailCampaign.findUniqueOrThrow({ where: { id } })).status).toBe('draft')
  })
})

/* ═══ ⑩ النطاقُ المكتوبُ خطأً يسقط، ومن وصلته حملةٌ قريبا يُتخطّى إن اختير (٢٣ نوفمبر ٢٠٢٦) ═══
   قرارُ صاحب المنصّة: «make an option to the admin that checks wrong emails or duplicated» ثمّ «yes» للاثنين. */
describe('⑩ النطاق الخطأ والمرسل إليهم قريبا', () => {
  it('⚠️ gmial.com وgmail.con وhotmial.com تصحح إلى صوابها — لا تسقط، وتعد في المعاينة', async () => {
    const parsed = await parseMailFile(csv(`email\nok-${S}@gmail.com\nfix-${S}@gmial.com\nfix2-${S}@gmail.con\nfix3-${S}@hotmial.com\nok-${S}@gmial.com\n`))
    expect(parsed.entries.map((e) => e.email), 'لم يصحح أو سقط').toEqual([`ok-${S}@gmail.com`, `fix-${S}@gmail.com`, `fix2-${S}@gmail.com`, `fix3-${S}@hotmail.com`])
    expect(parsed.invalid, 'أسقط المخطوء بدل تصحيحه').toBe(0)
    /* والمصحَّحُ إلى عنوانٍ موجودٍ في القائمة مكرّرٌ لا يُرسَل مرّتين */
    expect(parsed.duplicates).toBe(1)
    expect(parsed.corrected).toBe(3)
    const preview = (await http('POST', '/api/admin/bulk-mail/lists/preview', { raw: csv(`email\nx-${S}@gmial.com\n`) })).json() as { corrected: number; valid: number }
    expect(preview).toMatchObject({ corrected: 1, valid: 1 })
  })

  it('⚠️ من وصلته حملة في آخر 7 أيام لا يصل إن اختير — ويعد في التأكيد، ويصل إن لم يختر', async () => {
    const listId = await upload(csv(`email\n${mail('r1')}\n${mail('r2')}\n${mail('r3')}\n`), 'قريبا')
    const first = await campaign(`list:${listId}`)
    /* حملةٌ أولى إلى r1 وحده — بطابورها نفسِه */
    const one = await upload(csv(`email\n${mail('r1')}\n`), 'واحد')
    const pre = await campaign(`list:${one}`)
    expect((await http('POST', `/api/admin/bulk-mail/campaigns/${pre}/send`, { body: { confirmCount: 1 } })).statusCode).toBe(200)

    const plain = (await http('GET', `/api/admin/bulk-mail/campaigns/${first}/check`)).json() as { recipients: number; recent: number }
    expect(plain, 'تخطى بلا اختيار').toMatchObject({ recipients: 3, recent: 0 })
    const skip = (await http('GET', `/api/admin/bulk-mail/campaigns/${first}/check?skipRecentDays=7`)).json() as { recipients: number; recent: number }
    expect(skip, 'لم يتخط من وصلته').toMatchObject({ recipients: 2, recent: 1 })
    expect((await http('GET', `/api/admin/bulk-mail/campaigns/${first}/check?skipRecentDays=5`)).statusCode, 'قبل عدد أيام غير معروض').toBe(422)

    const res = await http('POST', `/api/admin/bulk-mail/campaigns/${first}/send`, { body: { confirmCount: 2, skipRecentDays: 7 } })
    expect(res.statusCode, res.body).toBe(200)
    const rows = await queuedOf((res.json() as { batchId: string }).batchId)
    expect(rows.map((r) => r.to).sort(), 'وصله مرتين').toEqual([mail('r2'), mail('r3')])
  })

  it('⚠️ وما خرج قبل المدة لا يحسب — حملة قبل 10 أيام لا تمنع مع 7', async () => {
    const listId = await upload(csv(`email\n${mail('old1')}\n`), 'قديمة')
    const id = await campaign(`list:${listId}`)
    await prisma.outboxMail.create({
      data: { to: mail('old1'), subject: 'قديم', purpose: BULK_MAIL_PURPOSE, status: 'sent', createdAt: new Date(Date.now() - 10 * 86_400_000), sentAt: new Date(Date.now() - 10 * 86_400_000) },
    })
    const c7 = (await http('GET', `/api/admin/bulk-mail/campaigns/${id}/check?skipRecentDays=7`)).json() as { recipients: number }
    expect(c7.recipients, 'منع بحملة أقدم من المدة').toBe(1)
    const c14 = (await http('GET', `/api/admin/bulk-mail/campaigns/${id}/check?skipRecentDays=14`)).json() as { recipients: number }
    expect(c14.recipients, 'لم يمنع بحملة داخل المدة').toBe(0)
  })
})

/* ═══ ⑪ من قال «غير مهتم» لا تصله حملة — حالةُ مستشارٍ أو «توقف» على واتساب (٢٣ نوفمبر ٢٠٢٦) ═══
   قرارُ صاحب المنصّة: «أريد أن نستثني أيَّ شخصٍ قال على الواتساب إنّه غيرُ مهتمّ أو شيءٌ يدلّ أنّه غيرُ مهتمّ». */
describe('⑪ غير المهتم لا تصله حملة', () => {
  it('⚠️ حالة مستشار «غير مهتم» وتوقف واتساب يسقطان من القائمة المرفوعة — ويعدان في التأكيد، والباقي يصل', async () => {
    const tail = String(S).slice(-9)
    const nope = await prisma.lead.create({ data: { fullName: 'غير مهتم', email: mail('ni1'), phone: `+9627${tail.slice(-8)}` } })
    await prisma.advisorCase.create({ data: { leadId: nope.id, status: 'not_interested' } })
    const stop = await prisma.lead.create({ data: { fullName: 'أوقف واتساب', email: mail('ni2'), phone: `07${tail.slice(-8)}` } })
    await prisma.whatsAppOptOut.create({ data: { tail: phoneTailOf(stop.phone!)!, phone: stop.phone! } })

    const listId = await upload(csv(`email\n${mail('ni1')}\n${mail('ni2')}\n${mail('ni3')}\n`), 'مهتم')
    const id = await campaign(`list:${listId}`)
    const check = (await http('GET', `/api/admin/bulk-mail/campaigns/${id}/check`)).json() as { recipients: number; notInterested: number }
    expect(check, 'وصل من قال غير مهتم').toMatchObject({ recipients: 1, notInterested: 2 })
    const res = await http('POST', `/api/admin/bulk-mail/campaigns/${id}/send`, { body: { confirmCount: 1 } })
    expect(res.statusCode, res.body).toBe(200)
    expect((await queuedOf((res.json() as { batchId: string }).batchId)).map((r) => r.to)).toEqual([mail('ni3')])
  })
})

/* ═══ ⑫ لا يتكرّر الشخص: من في المنصّة ومن في قائمةٍ أخرى يُتخطّى بخياره (٢٣ نوفمبر ٢٠٢٦) ═══
   قرارُ صاحب المنصّة: «تخطَّ من هو موجودٌ بالمنصّة أو موجودٌ بقائمةٍ أخرى لكي لا يتكرّر الشخصُ نفسُه». فالمنصّةُ حسابٌ أو
   نموذجٌ عُبّئ (عميلٌ محتمل غيرُ ممحوّ)، والقائمةُ الأخرى أيُّ قائمةٍ مرفوعةٍ غيرُ هذه. والخياران في التأكيد، وبغيرهما يصلون. */
describe('⑫ تخطي من في المنصة ومن في قائمة أخرى', () => {
  it('⚠️ الخياران يسقطان صاحب الحساب والعميل المحتمل ومن في قائمة سابقة — ويعدانهم، وبدونهما يصلون', async () => {
    await prisma.user.create({ data: { email: mail('pl1').toUpperCase(), displayName: 'له حساب', passwordHash: 'x' } })
    await prisma.lead.create({ data: { fullName: 'عبأ نموذجا', email: mail('pl2') } })
    await prisma.lead.create({ data: { fullName: 'ممحو', email: mail('pl5'), erasedAt: new Date() } })
    await upload(csv(`email\n${mail('pl3')}\n`), 'سابقة')

    const listId = await upload(csv(`email\n${mail('pl1')}\n${mail('pl2')}\n${mail('pl3')}\n${mail('pl4')}\n${mail('pl5')}\n`), 'لا تكرار')
    const id = await campaign(`list:${listId}`)
    type C = { recipients: number; onPlatform?: number; inOtherLists?: number; uploadedList?: boolean }
    const on = (await http('GET', `/api/admin/bulk-mail/campaigns/${id}/check?skipPlatform=1&skipOtherLists=1`)).json() as C
    expect(on, 'وصل من في المنصة أو في قائمة أخرى').toMatchObject({ recipients: 2, onPlatform: 2, inOtherLists: 1, uploadedList: true })
    const off = (await http('GET', `/api/admin/bulk-mail/campaigns/${id}/check?skipPlatform=0&skipOtherLists=0`)).json() as C
    expect(off.recipients, 'أسقطوا بلا خيار').toBe(5)

    const res = await http('POST', `/api/admin/bulk-mail/campaigns/${id}/send`, { body: { confirmCount: 2, skipPlatform: true, skipOtherLists: true } })
    expect(res.statusCode, res.body).toBe(200)
    expect((await queuedOf((res.json() as { batchId: string }).batchId)).map((r) => r.to)).toEqual([mail('pl4'), mail('pl5')])
  })
})
