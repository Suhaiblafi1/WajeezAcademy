/* متابعةُ المؤجَّل حين يحلّ موعدُه — على قاعدةٍ حقيقيّة (٦ أكتوبر ٢٠٢٦).

   القرارُ وعلّتُه في `src/application/trainer/deferral.ts`، والعملُ في
   `server/services/trainer-deferral.service.ts`. وما يُحرَس هنا:

   ① **يُسأل من حلّ موعدُه، مرّةً واحدة** — ولا يُسأل من لم يحلّ موعدُه ولا من خرج
      من التأجيل. ويُكتب الأثرُ، ويُذكَّر الفريقُ في الجرس والبريد.
   ② **وفتحُ الرابط لا يُجيب** — `GET` يقرأ ولا يقلب حالة.
   ③ **والجوابُ يقلب الحالةَ بوجهته** — «ما زلتُ مهتمّا» إلى المراجعة، و«لم أعد» سحبٌ
      بسببه — ويُمحى الرمزُ فلا يُجاب مرّتين، ويُذكَّر الفريق.
   ④ **ولا جوابَ خارجَ الجوابين** — يُردّ قبل أن يمسّ شيئا.

   والرمزُ لا يُحفظ إلّا هاشُه، فلا يُقرأ من القاعدة: يُكتب هنا هاشُ رمزٍ معلوم. */

import { createHash } from 'node:crypto'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import type { FastifyInstance } from 'fastify'
import type { PrismaClient } from '@prisma/client'
import { setupTestDb, testPrisma } from '../helpers/db'
import { buildApp } from '../../http/app'
import { AuthService } from '../../services/auth.service'
import { TrainerApplicationService } from '../../services/trainer-application.service'
import { TrainerReviewService } from '../../services/trainer-review.service'
import { DEFERRAL_STAFF_KEY, TrainerDeferralService } from '../../services/trainer-deferral.service'
import { DEFERRED } from '../../../src/application/trainer/deferral'

let prisma: PrismaClient
let app: FastifyInstance
let auth: AuthService
let apps: TrainerApplicationService
let review: TrainerReviewService
let deferral: TrainerDeferralService
let adminId: string

const DAY = 86_400_000
const sha256 = (s: string) => createHash('sha256').update(s).digest('hex')

const base = {
  phoneCountryCode: '+962', phone: '771070000', country: 'الأردن', timezone: 'Asia/Amman',
  jobTitle: 'مدرّبة بيانات', specialties: ['البيانات'],
  domainYears: '8-12' as const, trainingYears: 'formal_teaching',
  bio: 'خبرةٌ ميدانيّة', trainingLanguages: ['العربية'], deliveryMode: 'both' as const,
  motivation: 'درّبتُ فرقا حقيقيّةً في بيئات عملٍ عربيّة، وأعرف الفرقَ بين من يعرف المادّة ومن يستطيع تعليمها. سأعطي كلَّ متعلّمٍ مهمّةً من واقع عمله في كلّ وحدة، وأراجع مخرجاته بنفسي وأكتب له ما ينقصه تحديدا لا تقييما عاما.',
  privacyConsent: true as const,
  password: 'Trainer#12345',
}

async function deferredApplicant(email: string, fullName: string) {
  const res = await apps.submitPhase1({ ...base, email, fullName })
  const row = await prisma.trainerApplication.findUniqueOrThrow({ where: { reference: res.reference } })
  await apps.completePhase2(res.reference, res.candidateToken, {
    previousCourses: [], teachableCourseIds: [], availability: { seasons: ['nov_jan'] },
    demoConsent: true, contact: { channel: 'email' },
  })
  await prisma.trainerApplication.update({ where: { id: row.id }, data: { emailVerifiedAt: new Date() } })
  await review.decide(row.id, adminId, 'defer')
  return { id: row.id, reference: res.reference }
}

/** يحلّ موعدُه الآن — بتقديمه يومين */
const makeDue = (id: string) =>
  prisma.trainerApplication.update({ where: { id }, data: { deferredFollowUpAt: new Date(Date.now() - 2 * DAY) } })

/** رمزٌ معلومٌ لطلبٍ سُئل — يُكتب هاشُه كما يكتبه `askDue` */
const withToken = async (id: string, token: string) => {
  await prisma.trainerApplication.update({ where: { id }, data: { deferredInterestAskedAt: new Date(), deferredInterestTokenHash: sha256(token) } })
  return token
}

const staffNotes = (applicationId: string) => prisma.notification.findMany({
  where: { userId: adminId, templateKey: DEFERRAL_STAFF_KEY },
  select: { channel: true, data: true, title: true },
}).then((rows) => rows.filter((r) => (r.data as { applicationId?: string } | null)?.applicationId === applicationId))

beforeAll(async () => {
  await setupTestDb()
  prisma = await testPrisma()
  app = await buildApp(prisma)
  auth = new AuthService(prisma)
  apps = new TrainerApplicationService(prisma)
  review = new TrainerReviewService(prisma)
  deferral = new TrainerDeferralService(prisma)
  const admin = await auth.register('admin-deferfollow@test.local', 'Admin#12345', 'المديرة الأكاديميّة')
  adminId = admin.userId
  await auth.setRoles(adminId, ['academic_manager'])
}, 180_000)

afterAll(async () => { await app?.close() })

describe('① يُسأل من حلّ موعدُه — مرّةً واحدة', () => {
  it('لا يُسأل من لم يحلّ موعدُه', async () => {
    const a = await deferredApplicant('df-1@test.local', 'منى المدرّبة')
    await deferral.askDue()
    const row = await prisma.trainerApplication.findUniqueOrThrow({ where: { id: a.id } })
    expect(row.deferredInterestAskedAt).toBeNull()
  })

  it('ويُسأل حين يحلّ — ويُكتب الأثر، ويُذكَّر الفريقُ في الجرس والبريد — ثمّ لا يُسأل ثانيةً', async () => {
    const a = await deferredApplicant('df-2@test.local', 'دانة المدرّبة')
    await makeDue(a.id)
    const first = await deferral.askDue()
    expect(first.asked).toBeGreaterThanOrEqual(1)

    const row = await prisma.trainerApplication.findUniqueOrThrow({ where: { id: a.id } })
    expect(row.deferredInterestAskedAt, 'لم يُكتب «سُئل»').not.toBeNull()
    expect(row.deferredInterestTokenHash, 'لا رمزَ لجوابه').not.toBeNull()
    expect(row.status, 'السؤالُ قلب الحالة').toBe(DEFERRED)
    expect(await prisma.auditEvent.count({ where: { action: 'trainer.deferral.ask', entityId: a.id } })).toBe(1)
    const notes = await staffNotes(a.id)
    expect(new Set(notes.map((n) => n.channel)), 'لم يُذكَّر الفريقُ في الجرس والبريد').toEqual(new Set(['in_app', 'email']))

    await deferral.askDue()
    expect(await prisma.auditEvent.count({ where: { action: 'trainer.deferral.ask', entityId: a.id } }), 'سُئل مرّتين').toBe(1)
  })

  it('ولا يُسأل من خرج من التأجيل ولو حلّ يومُه', async () => {
    const a = await deferredApplicant('df-3@test.local', 'رنا المدرّبة')
    await makeDue(a.id)
    await review.decide(a.id, adminId, 'move_to_review')
    await deferral.askDue()
    expect(await prisma.auditEvent.count({ where: { action: 'trainer.deferral.ask', entityId: a.id } })).toBe(0)
  })
  /* والحالةُ وحدَها تكفي — لا محوُ الموعد وحدَه: صفٌّ بقي له يومٌ وقد تغيّرت حالتُه
     بغير `transition` (ترحيلٌ أو يدٌ في القاعدة) لا يُسأل صاحبُه عن طلبٍ لم يعد مؤجَّلا */
  it('ولا من تغيّرت حالتُه وبقي له يوم — الحالةُ تُسأل لا الموعدُ وحدَه', async () => {
    const a = await deferredApplicant('df-8@test.local', 'جنى المدرّبة')
    await makeDue(a.id)
    await prisma.trainerApplication.update({ where: { id: a.id }, data: { status: 'under_review' } })
    await deferral.askDue()
    expect(await prisma.auditEvent.count({ where: { action: 'trainer.deferral.ask', entityId: a.id } })).toBe(0)
  })
})

describe('② وفتحُ الرابط لا يُجيب', () => {
  it('GET يقرأ الاسمَ الأوّلَ والرقمَ والخيارين — ولا يقلب الحالة', async () => {
    const a = await deferredApplicant('df-4@test.local', 'هند سعيد')
    const token = await withToken(a.id, 'known-token-df4-xxxxxxxxxxxxxxxxxxxx')
    const res = await app.inject({ method: 'GET', url: `/api/trainer-interest/${token}` })
    expect(res.statusCode).toBe(200)
    const body = res.json() as { firstName: string; reference: string; choices: unknown[] }
    expect(body.firstName).toBe('هند')
    expect(body.reference).toBe(a.reference)
    expect(body.choices).toHaveLength(2)
    const row = await prisma.trainerApplication.findUniqueOrThrow({ where: { id: a.id } })
    expect(row.status, 'فتحُ الرابط أجاب').toBe(DEFERRED)
  })
})

describe('③ والجوابُ يقلب الحالةَ بوجهته — مرّةً واحدة', () => {
  it('«ما زلتُ مهتمّا» — إلى المراجعة، ويُمحى الرمز، ويُذكَّر الفريق، ولا يُجاب ثانيةً', async () => {
    const a = await deferredApplicant('df-5@test.local', 'سلمى المدرّبة')
    const token = await withToken(a.id, 'known-token-df5-xxxxxxxxxxxxxxxxxxxx')
    const res = await app.inject({ method: 'POST', url: `/api/trainer-interest/${token}`, payload: { answer: 'interested' } })
    expect(res.statusCode).toBe(200)

    const row = await prisma.trainerApplication.findUniqueOrThrow({ where: { id: a.id } })
    expect(row.status).toBe('under_review')
    expect(row.deferredInterestTokenHash, 'بقي الرمزُ يُجاب به').toBeNull()
    expect(row.deferredFollowUpAt).toBeNull()
    expect(await prisma.trainerStatusHistory.count({ where: { applicationId: a.id, fromStatus: DEFERRED, toStatus: 'under_review' } })).toBe(1)
    expect(await prisma.auditEvent.count({ where: { action: 'trainer.deferral.answer', entityId: a.id } })).toBe(1)
    expect((await staffNotes(a.id)).length, 'لم يُذكَّر الفريقُ بالجواب').toBeGreaterThanOrEqual(2)

    const again = await app.inject({ method: 'POST', url: `/api/trainer-interest/${token}`, payload: { answer: 'not_interested' } })
    expect(again.statusCode, 'أُجيب مرّتين').toBe(404)
    expect((await prisma.trainerApplication.findUniqueOrThrow({ where: { id: a.id } })).status).toBe('under_review')
  })

  it('«لم أعد مهتمّا» — سحبٌ بسببه', async () => {
    const a = await deferredApplicant('df-6@test.local', 'عبير المدرّبة')
    const token = await withToken(a.id, 'known-token-df6-xxxxxxxxxxxxxxxxxxxx')
    const res = await app.inject({ method: 'POST', url: `/api/trainer-interest/${token}`, payload: { answer: 'not_interested' } })
    expect(res.statusCode).toBe(200)
    const row = await prisma.trainerApplication.findUniqueOrThrow({ where: { id: a.id } })
    expect(row.status).toBe('withdrawn')
    expect(row.withdrawReason).toMatch(/لم يعد مهتمّا/)
  })
})

describe('④ ولا جوابَ خارجَ الجوابين', () => {
  it('يُردّ قبل أن يمسّ شيئا', async () => {
    const a = await deferredApplicant('df-7@test.local', 'لمى المدرّبة')
    const token = await withToken(a.id, 'known-token-df7-xxxxxxxxxxxxxxxxxxxx')
    const res = await app.inject({ method: 'POST', url: `/api/trainer-interest/${token}`, payload: { answer: 'approve' } })
    expect(res.statusCode).toBeGreaterThanOrEqual(400)
    expect(res.statusCode).toBeLessThan(500)
    expect((await prisma.trainerApplication.findUniqueOrThrow({ where: { id: a.id } })).status).toBe(DEFERRED)
  })
})
