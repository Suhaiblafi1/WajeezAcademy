/* ملفُّ المتقدّم حين يحجز مقابلته — من الحدث إلى صندوق بريد اللجنة.

   وما يُحرس هنا خمسةٌ ينكسر كلٌّ منها صامتا:

   ١) الملفُّ يُبنى من الطلب كما كتبه صاحبُه — فإن سقط حقلٌ لم يشتكِ أحد،
      وتبقى اللجنةُ تقرأ ملفّا ناقصا ولا تعرف أنّه ناقص.
   ٢) وما يكتبه المتقدّم يدخل HTML: اسمٌ فيه `<` يكسر الصفحةَ أو يحقن وسما.
   ٣) والحالةُ تُعرض بالعربيّة لا بمفتاحها (`interview_scheduled`).
   ٤) والسيرةُ تُرفَق ملفًّا منفصلا — وهي أوّلُ ما يطلبه المُقابِل.
   ٥) ولا يُرسَل الملفُّ مرّتين: Calendly يعيد التسليمَ حتّى يرى ٢٠٠. */

import { createHmac } from 'node:crypto'
import { beforeAll, describe, expect, it } from 'vitest'
import type { FastifyInstance } from 'fastify'
import type { PrismaClient } from '@prisma/client'
import { buildApp } from '../../http/app'
import { buildDossierHtml, sendInterviewDossier, type DossierApplication } from '../../services/trainer-dossier.service'
import { setupTestDb, testPrisma } from '../helpers/db'

const SECRET = 'calendly-dossier-secret'
const REFERENCE = 'WJ-TR-2026-00077'
const EMAIL = 'dossier-applicant@test.local'
const INVITEE_URI = 'https://api.calendly.com/scheduled_events/e-77/invitees/i-77'
const START = '2026-10-04T12:00:00.000Z'

let prisma: PrismaClient
let app: FastifyInstance
let applicationId = ''

const post = (event: string) => {
  const raw = JSON.stringify({
    event,
    payload: {
      uri: INVITEE_URI,
      email: EMAIL,
      tracking: { utm_source: 'wajeezacademy', utm_medium: 'trainer_application', utm_content: REFERENCE },
      scheduled_event: { uri: 'https://api.calendly.com/scheduled_events/e-77', start_time: START },
    },
  })
  const timestamp = Math.floor(Date.now() / 1000).toString()
  const signature = createHmac('sha256', SECRET).update(`${timestamp}.${raw}`).digest('hex')
  return app.inject({
    method: 'POST',
    url: '/api/webhooks/calendly',
    headers: { 'content-type': 'application/json', 'calendly-webhook-signature': `t=${timestamp},v1=${signature}` },
    payload: raw,
  })
}

const dossierAudits = () => prisma.auditEvent.findMany({
  where: { action: 'trainer.interview.dossier_sent', entityId: applicationId },
})

beforeAll(async () => {
  process.env.CALENDLY_WEBHOOK_SIGNING_KEY = SECRET
  await setupTestDb()
  prisma = await testPrisma()
  const applicant = await prisma.user.create({
    data: { email: EMAIL, displayName: 'متقدّمُ الملفّ', passwordHash: 'test-only' },
  })
  const application = await prisma.trainerApplication.create({
    data: {
      reference: REFERENCE,
      userId: applicant.id,
      email: EMAIL,
      fullName: 'سلمى المهندس',
      status: 'shortlisted',
      emailVerifiedAt: new Date(),
      country: 'الأردن',
      timezone: 'Asia/Amman',
      phoneCountryCode: '+962',
      phone: '791234567',
      domainYears: '8-12',
      bio: 'خبيرةُ سلامةٍ صناعيّة <b>منذ</b> عشر سنوات',
      availability: { days: ['السبت'], periods: ['evening'], hoursPerWeek: 8, seasons: ['nov_jan'] },
      demoConsent: true,
      contactChannel: 'whatsapp',
    },
  })
  applicationId = application.id
  await prisma.trainerApplicationDocument.create({
    data: {
      applicationId,
      kind: 'cv',
      storageKey: 'dossier-test-cv-key-0123456789',
      originalName: 'salma-cv.pdf',
      mime: 'application/pdf',
      sizeBytes: 11,
      content: Buffer.from('%PDF-1.4 fake'),
    },
  })
  app = await buildApp(prisma)
}, 240_000)

describe('بناءُ صفحة الملفّ', () => {
  it('تحمل ما سيقرؤه المُقابِل — ولا مفتاحَ نظامٍ في وجهه', async () => {
    const row = await prisma.trainerApplication.findUniqueOrThrow({
      where: { id: applicationId },
      include: { specialties: true, documents: true },
    })
    const html = buildDossierHtml(row as unknown as DossierApplication, {
      scheduledAt: new Date(START),
      courseTitles: ['السلامة في المصانع'],
    })

    expect(html, 'اسمُ المتقدّم غائب').toContain('سلمى المهندس')
    expect(html, 'رقمُ الطلب غائب').toContain(REFERENCE)
    expect(html, 'دورةُ الكتالوج غائبة').toContain('السلامة في المصانع')
    expect(html, 'السيرةُ لا تُذكر باسم ملفّها').toContain('salma-cv.pdf')
    expect(html, 'الموسمُ يُعرض بمفتاحه لا باسمه').not.toContain('nov_jan')
    /* الحالةُ بالعربيّة: «interview_scheduled» في وجه المُقابِل سجلُّ مبرمج */
    expect(html, 'الحالةُ تُعرض بمفتاحها').not.toContain('shortlisted')
    expect(html, 'الحالةُ بلا اسمٍ عربيّ').toContain('اختيار أولي')
    /* والموعدُ منسوبٌ إلى منطقةٍ صراحةً — وإلّا قُرئ بثلاث ساعاتٍ خطأ */
    expect(html, 'الموعدُ بلا منطقةٍ زمنيّة').toContain('بتوقيت Asia/Amman')
  })

  it('وما يكتبه المتقدّم نصٌّ لا وسم', async () => {
    const row = await prisma.trainerApplication.findUniqueOrThrow({
      where: { id: applicationId },
      include: { specialties: true, documents: true },
    })
    const html = buildDossierHtml(
      { ...(row as unknown as DossierApplication), fullName: '<script>alert(1)</script>' },
      { scheduledAt: new Date(START), courseTitles: [] },
    )
    expect(html, 'وسمٌ من يدِ المتقدّم دخل الصفحة').not.toContain('<script>alert(1)</script>')
    expect(html, 'النصُّ لم يُهرَّب بل حُذف').toContain('&lt;script&gt;')
    /* وما كتبه في نبذته يبقى نصّا كذلك */
    expect(html, 'وسمُ النبذة دخل الصفحة').not.toContain('<b>منذ</b>')
  })
})

describe('الإرسالُ عند الحجز', () => {
  it('بلا مستلمٍ لا يُرسَل شيء — ولا يُرمى خطأ', async () => {
    const res = await sendInterviewDossier(prisma, applicationId, new Date(START))
    expect(res.status, 'أرسل الملفَّ ولا أحدَ في اللجنة').toBe('no_recipients')
    expect(await dossierAudits(), 'أثرٌ سُجّل بلا إرسال').toHaveLength(0)
  })

  it('وحين تُحجز المقابلةُ يصل الملفُّ إلى أصحاب الأدوار — مرّةً واحدة', async () => {
    const reviewer = await prisma.user.create({
      data: {
        email: 'reviewer-dossier@test.local',
        displayName: 'مراجعةٌ أكاديميّة',
        passwordHash: 'test-only',
        status: 'active',
        roles: { create: { roleId: 'academic_manager' } },
      },
    })
    expect(reviewer.id).toBeTruthy()

    const first = await post('invitee.created')
    expect(first.statusCode, first.body).toBe(200)
    expect(first.json()).toEqual({ recorded: true })

    const audits = await dossierAudits()
    expect(audits, 'لم يُرسَل الملفُّ عند الحجز').toHaveLength(1)
    const meta = audits[0].meta as Record<string, unknown>
    expect(meta.recipients, 'لم يبلغ المراجعَ شيء').toBe(1)
    /* والسيرةُ مرفقةٌ منفصلةً — وهي أوّلُ ما يطلبه المُقابِل */
    expect(meta.withCv, 'السيرةُ لم تُرفَق').toBe(true)
    /* والبريدُ غيرُ مفعّلٍ في الاختبار: الحالةُ تُسجَّل ولا تُبتلع */
    expect(meta.delivery, 'حالةُ التسليم لم تُسجَّل').toBe('not_configured')
    /* والملفُّ PDF إمّا مرفقٌ وإمّا سببُ غيابه مكتوب — ولا صمتَ بينهما.
       ولا يُشترط وجودُه: عدّاءُ CI قد يكون بلا متصفّح، والرسالةُ تخرج
       حينئذٍ بسيرته وبسطرٍ يقول لماذا نقصت. */
    expect(typeof meta.withPdf, 'لم يُسجَّل أَرُفق الملفُّ أم لا').toBe('boolean')
    if (meta.withPdf !== true) expect(meta.pdfError, 'غاب الملفُّ بلا سببٍ مكتوب').toBeTruthy()

    /* وإعادةُ التسليم لا تُرسل ثانيةً: Calendly يعيد حتّى يرى ٢٠٠ */
    const again = await post('invitee.created')
    expect(again.json()).toEqual({ duplicate: true })
    expect(await dossierAudits(), 'وصل الملفُّ مرّتين إلى اللجنة').toHaveLength(1)
  }, 120_000)
})
