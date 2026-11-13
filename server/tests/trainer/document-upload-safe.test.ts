/* وثيقةُ المتقدّم لا تُجري شيئا في جلسة مراجعها (١٣ نوفمبر ٢٠٢٦، قرارُ صاحب المنصّة «PDF + images only»).

   كان القسمُ الأوّلُ من «انضم كمدرّب» — بلا حساب — يقبل أيَّ صيغةٍ يعلنها الرافع، ومسارُ القراءة يخدمها بنوعها
   `inline` من نطاق المنصّة، والسياسةُ تسمح بالسكربت المضمَّن. فمن رفع صفحةَ HTML سمّاها سيرتَه جرى ما فيها في جلسة
   المراجع حين يفتحها. وجُرّب: `text/html` و`<script>` خُدما كما رُفعا. فصار:
   ① التسجيلُ يقبل PDF وثلاثَ صورٍ لا غير، ② والرفعُ يسأل البايتات، ③ والقراءةُ لا تفتح في الصفحة إلّا ما لا يُجري شيئا. */

import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import type { PrismaClient } from '@prisma/client'
import type { FastifyInstance } from 'fastify'
import { setupTestDb, testPrisma } from '../helpers/db'
import { buildApp } from '../../http/app'
import { TrainerApplicationService } from '../../services/trainer-application.service'
import { putObject } from '../../services/object-store'
import { newStorageKey } from '../../services/storage.service'

let prisma: PrismaClient
let app: FastifyInstance
let svc: TrainerApplicationService
let reference = ''
let candidateToken = ''
const STAMP = Date.now()
const HTML = Buffer.from('<html><script>fetch("/api/auth/me")</script></html>')
const PDF = Buffer.from('%PDF-1.4\n1 0 obj << >> endobj\ntrailer << >>\n%%EOF\n')

const register = (mime: string, sizeBytes: number) => app.inject({
  method: 'POST', url: `/api/v1/trainer-applications/${reference}/documents`,
  payload: { candidateToken, kind: 'cv', originalName: 'cv.pdf', mime, sizeBytes },
})
const upload = (uploadUrl: string, body: Buffer) =>
  app.inject({ method: 'PUT', url: uploadUrl, headers: { 'content-type': 'application/octet-stream' }, payload: body })
const read = async (storageKey: string) => {
  const doc = await prisma.trainerApplicationDocument.findFirstOrThrow({ where: { storageKey } })
  return app.inject({ method: 'GET', url: svc.signedDocumentUrls([doc])[storageKey] })
}

beforeAll(async () => {
  await setupTestDb()
  prisma = await testPrisma()
  app = await buildApp(prisma)
  svc = new TrainerApplicationService(prisma)
  const out = await svc.submitPhase1({
    fullName: 'متقدم للتدريب', email: `dus-${STAMP}@test.local`, password: 'Applicant#12345',
    specialties: ['الموارد البشرية'], domainYears: '4-7', trainingYears: '1-3', trainingLanguages: ['ar'], deliveryMode: 'remote',
    motivation: 'أريد أن أنقل خبرتي في الموارد البشرية إلى المتعلمين بأمثلة من عملي اليومي في التوظيف وتقييم الأداء.',
    privacyConsent: true,
  })
  reference = out.reference
  candidateToken = out.candidateToken
}, 240_000)

afterAll(async () => { await app.close() })

describe('وثائق المتقدم', () => {
  it('⚠️ صفحة HTML لا تسجل وثيقة', async () => {
    const res = await register('text/html', HTML.length)
    expect(res.statusCode, 'سجلت صفحة HTML وثيقة').toBe(415)
    expect(res.json().error.code).toBe('bad_mime')
  })

  it('⚠️ ومن سماها PDF ورفع HTML: يرد الرفع ولا يخزن', async () => {
    const reg = await register('application/pdf', HTML.length)
    expect(reg.statusCode).toBe(201)
    const res = await upload(reg.json().uploadUrl, HTML)
    expect(res.statusCode, 'قبل HTML باسم PDF').toBe(415)
    expect((await read(reg.json().storageKey)).statusCode, 'خزن ما رد').toBe(404)
  })

  it('وPDF حقيقي يرفع ويفتح في المتصفح كما كان', async () => {
    const reg = await register('application/pdf', PDF.length)
    expect((await upload(reg.json().uploadUrl, PDF)).statusCode).toBe(200)
    const res = await read(reg.json().storageKey)
    expect(res.statusCode).toBe(200)
    expect(res.headers['content-type']).toBe('application/pdf')
    expect(String(res.headers['content-disposition'])).toMatch(/^inline;/)
  })

  it('⚠️ وما خزن قبل الحارس بنوع HTML ينزل ملفا ولا يفتح صفحة', async () => {
    const application = await prisma.trainerApplication.findFirstOrThrow({ where: { reference } })
    const storageKey = newStorageKey()
    await prisma.trainerApplicationDocument.create({
      data: { applicationId: application.id, kind: 'cv', storageKey, originalName: 'old.html', mime: 'text/html', sizeBytes: HTML.length },
    })
    await putObject(storageKey, HTML, { mime: 'text/html', originalName: 'old.html' })
    const res = await read(storageKey)
    expect(res.statusCode).toBe(200)
    expect(res.headers['content-type'], 'خدم HTML صفحة من نطاق المنصة').toBe('application/octet-stream')
    expect(String(res.headers['content-disposition'])).toMatch(/^attachment;/)
  })
})
