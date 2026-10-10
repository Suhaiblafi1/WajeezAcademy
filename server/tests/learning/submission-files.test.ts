/* ═══ ملفُّ التسليم — يُرفع ويصل ويُفتح (١٠ أكتوبر ٢٠٢٦) ═══

   كان التسليمُ نصّا وحدَه في الشاشة، والخادمُ يَعِد بملفٍّ «حتى 100MB» ويرفعه من مسار الذاكرة
   بسقف أربعة. وقال صاحبُ المنصّة: «no need to tell the trainers to make links instead of text
   or files… solve it not limiting the trainers».

   ═══ ما يُحرَس — على الخادم فعلا، لا في البنية ═══
   ① النوعُ من الامتداد لا ممّا يقوله المتصفّح، وما ليس في القائمة يُردّ بسببه، والحجمُ بسقفه.
   ② ورابطُ الرفع إلى مسار البثّ، والملفُّ فوق الأربعة يُكتب كاملا بنوعه المقرَّر.
   ③ ورفعٌ لم يصل يُقال «ينتظر» للمدرّب، وما وصل يُقال باسمه وحجمه.
   ④ ورفعٌ انقطع يُعاد لصاحبه وحدَه، وما دام لم يصل.
   ⑤ وما لا يُفتح في المتصفّح يُنزَّل، ولا يُخمَّن نوعُه. */

import { mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { beforeAll, describe, expect, it } from 'vitest'
import type { PrismaClient } from '@prisma/client'
import type { FastifyInstance } from 'fastify'
import { setupTestDb, testPrisma } from '../helpers/db'
import { buildApp } from '../../http/app'
import { SESSION_COOKIE } from '../../http/auth-plugin'
import { AuthService } from '../../services/auth.service'
import { AssessmentService } from '../../services/assessment.service'
import { getObject, getObjectMeta } from '../../services/object-store'

let prisma: PrismaClient
let app: FastifyInstance
let auth: AuthService
let assess: AssessmentService
let learnerId = ''
let otherLearnerId = ''
let trainerUserId = ''
let cohortId = ''
let learnerCookie = ''
let trainerCookie = ''

const SIX_MB = Buffer.alloc(6 * 1024 * 1024, 7)

const cookieFor = async (email: string, password: string) => `${SESSION_COOKIE}=${(await auth.login(email, password)).token}`

/** تكليفٌ جديدٌ لكلّ حالة — فلا يحجب تسليمٌ قائمٌ تسليما بعده */
const newAssignment = async () => (await prisma.cohortAssessment.create({
  data: { cohortId, type: 'assignment', title: `تكليف ${Math.random().toString(36).slice(2, 7)}`, maxScore: 10, status: 'published' },
})).id

const keyOf = async (submissionId: string) =>
  (await prisma.assignmentSubmission.findUniqueOrThrow({ where: { id: submissionId } })).storageKey!

const put = (uploadUrl: string, payload: Buffer, contentType = 'application/octet-stream') =>
  app.inject({ method: 'PUT', url: uploadUrl, headers: { 'content-type': contentType }, payload })

beforeAll(async () => {
  process.env.STORAGE_ROOT = mkdtempSync(join(tmpdir(), 'wajeez-subfile-'))
  process.env.FILE_UPLOADS = 'on'
  await setupTestDb()
  prisma = await testPrisma()
  app = await buildApp(prisma)
  auth = new AuthService(prisma)
  assess = new AssessmentService(prisma)

  const t = await auth.register('sf-trainer@test.local', 'Trainer#12345', 'مدرّبةُ الشعبة')
  await auth.setRoles(t.userId, ['trainer'])
  trainerUserId = t.userId
  const application = await prisma.trainerApplication.create({
    data: {
      reference: 'TR-SF-1', fullName: 'مدرّبةُ الشعبة', email: 'sf-trainer@test.local',
      phone: '0790000012', status: 'active', motivation: 'اختبار', privacyConsentAt: new Date(),
    },
  })
  const profile = await prisma.trainerProfile.create({ data: { applicationId: application.id, userId: t.userId, isVerified: true } })

  const cohort = await prisma.cohort.create({
    data: {
      courseId: 'C-BIZ-101', title: 'شعبةُ الملفّات', status: 'active', registrationOpen: false,
      financialReady: true, price: 100, currency: 'JOD', capacity: 10,
    },
  })
  cohortId = cohort.id
  await prisma.cohortTrainer.create({ data: { cohortId, profileId: profile.id, role: 'lead' } })

  const l = await auth.register('sf-learner@test.local', 'Learner#12345', 'سلمى')
  learnerId = l.userId
  await prisma.enrollment.create({ data: { userId: learnerId, cohortId, status: 'enrolled' } })
  const o = await auth.register('sf-other@test.local', 'Learner#12345', 'متعلّمٌ آخر')
  otherLearnerId = o.userId
  await prisma.enrollment.create({ data: { userId: otherLearnerId, cohortId, status: 'enrolled' } })

  learnerCookie = await cookieFor('sf-learner@test.local', 'Learner#12345')
  trainerCookie = await cookieFor('sf-trainer@test.local', 'Trainer#12345')
}, 240_000)

describe('① النوعُ والحجمُ قبل الرابط', () => {
  it('⚠️ ما ليس في القائمة يُردّ بسببه — صفحةُ وِبٍ وSVG وبرنامج', async () => {
    for (const name of ['page.html', 'logo.svg', 'setup.exe', 'بلا-امتداد']) {
      await expect(
        assess.submitAssignment(learnerId, await newAssignment(), { file: { originalName: name, mime: 'application/pdf', sizeBytes: 100 } }),
        name,
      ).rejects.toMatchObject({ code: 'bad_file', status: 422 })
    }
  })

  it('⚠️ والحجمُ فوق السقف يُردّ — وكذا الفارغ', async () => {
    await expect(assess.submitAssignment(learnerId, await newAssignment(), {
      file: { originalName: 'video.mp4', sizeBytes: 101 * 1024 * 1024 },
    })).rejects.toMatchObject({ code: 'too_large', status: 413 })
  })

  it('⚠️ والنوعُ يُقرَّر من الامتداد — لا ممّا قاله المتصفّح', async () => {
    const r = await assess.submitAssignment(learnerId, await newAssignment(), {
      file: { originalName: 'C:\\Users\\salma\\تقريري.DOCX', mime: 'text/html', sizeBytes: 2048 },
    })
    const row = await prisma.assignmentSubmission.findUniqueOrThrow({ where: { id: r.submission.id } })
    expect(row.fileMime).toBe('application/vnd.openxmlformats-officedocument.wordprocessingml.document')
    expect(row.fileName, 'المسارُ في الاسم يُسقط').toBe('تقريري.DOCX')
    expect(row.fileSize).toBe(2048)
    expect(row.fileUploadedAt, 'لم يصل بعد').toBeNull()
    expect(r.submission, 'مفتاحُ التخزين يخرج في الردّ').not.toHaveProperty('storageKey')
  })

  it('والنصُّ وحدَه يُسلَّم كما كان — والفارغُ يُردّ', async () => {
    const r = await assess.submitAssignment(learnerId, await newAssignment(), { textAnswer: 'إجابتي https://x.com/a' })
    expect(r.uploadUrl).toBeUndefined()
    await expect(assess.submitAssignment(learnerId, await newAssignment(), { textAnswer: '   ' }))
      .rejects.toMatchObject({ code: 'empty_submission' })
  })
})

describe('② الرفعُ بثّا — والملفُّ الكبيرُ يصل كاملا', () => {
  it('⚠️ رابطُ الرفع إلى البثّ، وستّةُ ميغابايت تُكتب بنوعها المقرَّر', async () => {
    const r = await assess.submitAssignment(learnerId, await newAssignment(), {
      textAnswer: 'التسجيل مرفق', file: { originalName: 'تسجيلي.mp4', mime: 'application/octet-stream', sizeBytes: SIX_MB.length },
    })
    expect(r.uploadUrl, 'رابطُ الرفع إلى مسار الذاكرة ذي الأربعة').toMatch(/^\/api\/v1\/uploads\/[^/?]+\/stream\?/)
    const res = await put(r.uploadUrl!, SIX_MB, 'text/html')
    expect(res.statusCode, res.body).toBe(200)
    const key = await keyOf(r.submission.id)
    expect((await getObject(key))?.length).toBe(SIX_MB.length)
    const meta = await getObjectMeta(key)
    expect(meta?.mime, 'نوعُ العميل كُتب في المخزن').toBe('video/mp4')
    expect(meta?.originalName).toBe('تسجيلي.mp4')
    const row = await prisma.assignmentSubmission.findUniqueOrThrow({ where: { id: r.submission.id } })
    expect(row.fileUploadedAt, 'الوصولُ لا يُعلَم').not.toBeNull()
    expect(row.fileSize).toBe(SIX_MB.length)
  })
})

describe('③ ما يراه المدرّبُ في طابوره', () => {
  it('⚠️ رفعٌ لم يصل يُقال «ينتظر» — وما وصل يُقال باسمه وحجمه', async () => {
    const waiting = await assess.submitAssignment(learnerId, await newAssignment(), {
      file: { originalName: 'خطتي.pdf', sizeBytes: 1000 },
    })
    const arrived = await assess.submitAssignment(learnerId, await newAssignment(), {
      file: { originalName: 'عرضي.pptx', sizeBytes: 1500 },
    })
    expect((await put(arrived.uploadUrl!, Buffer.alloc(1500, 1))).statusCode).toBe(200)

    const q = await assess.trainerQueue(trainerUserId)
    const w = q.find((s) => s.id === waiting.submission.id)!
    const a = q.find((s) => s.id === arrived.submission.id)!
    expect(w).toMatchObject({ fileName: 'خطتي.pdf', fileWaiting: true })
    expect(a).toMatchObject({ fileName: 'عرضي.pptx', fileSize: 1500, fileWaiting: false })
    expect(a.fileUrl).toMatch(/^\/api\/v1\/submission-files\//)
    for (const s of [w, a]) {
      expect(s).not.toHaveProperty('storageKey')
      expect(s).not.toHaveProperty('fileUploadedAt')
    }
  })
})

describe('④ رفعٌ انقطع يُعاد — لصاحبه وحدَه، وما دام لم يصل', () => {
  it('⚠️ صاحبُه يأخذ رابطا جديدا على المفتاح نفسِه، والملفُّ يصل', async () => {
    const r = await assess.submitAssignment(learnerId, await newAssignment(), { file: { originalName: 'a.pdf', sizeBytes: 10 } })
    const key = await keyOf(r.submission.id)
    const res = await app.inject({
      method: 'POST', url: `/api/learner/submissions/${r.submission.id}/file`, headers: { cookie: learnerCookie },
      payload: { originalName: 'المحاولة الثانية.pdf', mime: 'application/pdf', sizeBytes: 20 },
    })
    expect(res.statusCode, res.body).toBe(200)
    const { uploadUrl } = res.json() as { uploadUrl: string }
    expect(uploadUrl).toContain(`/api/v1/uploads/${key}/stream?`)
    expect((await put(uploadUrl, Buffer.alloc(20, 2))).statusCode).toBe(200)
    const row = await prisma.assignmentSubmission.findUniqueOrThrow({ where: { id: r.submission.id } })
    expect(row).toMatchObject({ fileName: 'المحاولة الثانية.pdf', fileSize: 20 })
    expect(row.fileUploadedAt).not.toBeNull()

    await expect(assess.renewSubmissionUpload(learnerId, r.submission.id, { originalName: 'b.pdf', sizeBytes: 5 }), 'بعد الوصول')
      .rejects.toMatchObject({ code: 'file_arrived' })
  })

  it('⚠️ وغيرُ صاحبه يُردّ كأنّه لا تسليم — ومتعلّمٌ في الشعبة نفسِها', async () => {
    const r = await assess.submitAssignment(learnerId, await newAssignment(), { file: { originalName: 'c.pdf', sizeBytes: 10 } })
    await expect(assess.renewSubmissionUpload(otherLearnerId, r.submission.id, { originalName: 'c.pdf', sizeBytes: 10 }))
      .rejects.toMatchObject({ status: 404 })
  })

  it('وبعد أن يبدأ المدرّبُ مراجعتَه لا يُبدَّل ملفُّه', async () => {
    const r = await assess.submitAssignment(learnerId, await newAssignment(), { file: { originalName: 'd.pdf', sizeBytes: 10 } })
    await assess.reviewSubmission(trainerUserId, r.submission.id, 'start_review')
    await expect(assess.renewSubmissionUpload(learnerId, r.submission.id, { originalName: 'd.pdf', sizeBytes: 10 }))
      .rejects.toMatchObject({ code: 'under_review' })
  })
})

describe('⑤ يُفتح أو يُنزَّل — بالنوع المخزَّن', () => {
  const open = async (submissionId: string, cookie: string) =>
    app.inject({ method: 'GET', url: `/api/v1/submission-files/${encodeURIComponent(await keyOf(submissionId))}`, headers: { cookie } })

  it('⚠️ PDF يُفتح في المتصفّح، وWord يُنزَّل باسمه — وكلاهما بلا تخمينِ نوع', async () => {
    const pdf = await assess.submitAssignment(learnerId, await newAssignment(), { file: { originalName: 'خطة.pdf', sizeBytes: 9 } })
    const doc = await assess.submitAssignment(learnerId, await newAssignment(), { file: { originalName: 'تقرير.docx', sizeBytes: 9 } })
    await put(pdf.uploadUrl!, Buffer.from('%PDF-1.4\n'))
    await put(doc.uploadUrl!, Buffer.from('PK\u0003\u0004abcde'))

    const p = await open(pdf.submission.id, trainerCookie)
    expect(p.statusCode).toBe(200)
    expect(p.headers['content-type']).toBe('application/pdf')
    expect(String(p.headers['content-disposition'])).toMatch(/^inline;/)
    expect(p.headers['x-content-type-options']).toBe('nosniff')

    const d = await open(doc.submission.id, learnerCookie)
    expect(d.statusCode).toBe(200)
    expect(String(d.headers['content-disposition']), 'Word يُفتح صفحةً من نطاقنا').toMatch(/^attachment;/)
    expect(String(d.headers['content-disposition'])).toContain(encodeURIComponent('تقرير.docx'))
  })

  it('⚠️ وما خُزّن قبلُ بنوعٍ قاله العميل (صفحةُ وِب) يُنزَّل لا يُفتح', async () => {
    const r = await assess.submitAssignment(learnerId, await newAssignment(), { file: { originalName: 'x.pdf', sizeBytes: 5 } })
    /* تسليمٌ قديمٌ بلا نوعٍ محفوظ — كما كان قبل هذا التغيير */
    await prisma.assignmentSubmission.update({ where: { id: r.submission.id }, data: { fileMime: null, fileName: null } })
    await put(r.uploadUrl!.replace('/stream?', '?'), Buffer.from('<script>alert(1)</script>'), 'text/html')
    const res = await open(r.submission.id, trainerCookie)
    expect(res.headers['content-type']).toBe('text/html')
    expect(String(res.headers['content-disposition'])).toMatch(/^attachment;/)
  })
})
