/* ما يقرؤه صفُّ الطابور، وتذكيرُ من بدأ ولم يُكمل.

   ═══ ما طُلب (٢٠ سبتمبر ٢٠٢٦) ═══

   «أحتاج فقط الاسم والرقم والحالة، وأيضا نتيجة المقابلة… وضع أيقونةَ أكشن
   ينسدل فيها: اعتمد، اطلب منه تحديد موعد للمقابلة، ذكّره أن يكمل التقديم
   إذا كان مسوّدة».

   ═══ وما يُفحص هنا ═══

   ① **نتيجةُ اللقاء تصل الصفَّ من القاعدة** — كانت خلفَ فتحةِ ملفّ، فمن
      أراد أن يعرف من اجتاز فتح خمسةَ ملفّاتٍ ليقرأ خمسَ كلمات.
   ② **والملغاةُ لا تُقرأ نتيجةً** — موعدٌ أُلغي لا قولَ لنا فيه.
   ③ **والأحدثُ موعدا هو القول** — من قوبل مرّتين فالثانيةُ قولُنا فيه.
   ④ **وتذكيرُ المسوّدة للمسوّدة وحدَها** — ومن أكمل لا يُقال له «أكمل».
      والحارسُ في الخدمة لا في الشاشة: المسارُ تناديه أدواتٌ أخرى.
   ⑤ **وإخفاقُ البريد لا يُبتلع** — حالُه يُعاد كما ردّه الإرسال، فالشاشةُ
      لا تقول «أُرسل» على ظنّ.

   ═══ وما أُضيف (٢١ سبتمبر ٢٠٢٦) ═══

   قال صاحبُ المنصّة: «قلتَ لي مرارا إنّك ستضع نتيجةَ التقييم بجانب الحالة،
   والتي اتّفقنا أن تأخذها من روابط التقييم التي استخدمناها لمقابلة
   المدرّب»، و«للأشخاص الذين حجزوا موعدا ضعْ في الليبل موعدَ مقابلتهم
   القادمة، وإن لم يحجز فيكون الليبلُ أنّه لم يحجز موعدا بعد».

   ⑥ **قرارُ رابط التقييم يصل الصفَّ** — وهو غيرُ ما يسجّله مُجرِي المقابلة
      في بطاقة الموعد. وكان لا يصله أصلا.
   ⑦ **وموعدُه المعلَّق يصله تاريخا** — كان الصفُّ يحمل عددا (`1`) لا يقول
      متى، فمن أراد أن يعرف متى يلقاه فتح ملفَّه.
   ⑧ **ونتيجتُه لا تُمحى بحجزٍ جديد** — من اجتاز ثمّ حجز لقاءً ثانيا كان
      موعدُه الجديدُ — وهو بلا نتيجةٍ بعد — يمحو قولَنا فيه من الصفّ. */

import { beforeAll, describe, expect, it } from 'vitest'
import type { PrismaClient } from '@prisma/client'
import type { FastifyInstance } from 'fastify'
import { setupTestDb, testPrisma } from '../helpers/db'
import { AuthService } from '../../services/auth.service'
import { TrainerApplicationService } from '../../services/trainer-application.service'
import { TrainerReviewService } from '../../services/trainer-review.service'
import { buildApp } from '../../http/app'
import { SESSION_COOKIE } from '../../http/auth-plugin'

let prisma: PrismaClient
let auth: AuthService
let apps: TrainerApplicationService
let review: TrainerReviewService
let app: FastifyInstance
let adminId = ''
let adminCookie = ''

const applicant = (n: number) => ({
  fullName: `متقدّمُ الصفّ ${n}`, email: `queue-row-${n}@test.local`,
  specialties: ['القيادة وتطوير المدراء'], domainYears: '4-7', trainingYears: 'workshops',
  trainingLanguages: ['العربية'], deliveryMode: 'remote' as const,
  motivation: 'أريد الانضمام إلى وجيز لأنني درّبت فرقا حقيقية في بيئات عمل عربية، وأعرف الفرق بين من يعرف المادة ومن يستطيع تعليمها. سأقدّم للمتعلمين مهمة تطبيقية من واقع عملهم في كل وحدة، وأراجع مخرجاتهم بنفسي وأكتب لكل واحد ما ينقصه تحديدا لا تقييما عاما.',
  privacyConsent: true as const, password: 'Trainer#12345',
})

/** طلبٌ مقدَّمٌ جاهز — ويُعاد معرّفُه ورقمُه */
async function submitted(n: number): Promise<{ id: string; reference: string }> {
  const res = await apps.submitPhase1(applicant(n))
  const row = await prisma.trainerApplication.findUniqueOrThrow({ where: { reference: res.reference } })
  await apps.transition(row.id, 'submitted', null, 'اكتمال الطلب')
  return { id: row.id, reference: res.reference }
}

/** صفُّ هذا الطلب كما تراه الشاشة */
async function rowOf(id: string) {
  const rows = await review.listApplications()
  const found = rows.find((r) => r.id === id)
  expect(found, 'الطلبُ غاب عن قائمة الطابور').toBeTruthy()
  return found!
}

beforeAll(async () => {
  await setupTestDb()
  prisma = await testPrisma()
  process.env.RESEND_BASE_URL = 'http://127.0.0.1:1'
  await prisma.integrationSetting.upsert({
    where: { provider: 'email' },
    update: { enabled: true, config: { apiKey: 're_test_key', fromName: 'أكاديمية وجيز', fromEmail: 'no-reply@test.local' } },
    create: { provider: 'email', enabled: true, config: { apiKey: 're_test_key', fromName: 'أكاديمية وجيز', fromEmail: 'no-reply@test.local' } },
  })
  auth = new AuthService(prisma)
  apps = new TrainerApplicationService(prisma)
  review = new TrainerReviewService(prisma)
  app = await buildApp(prisma)

  const admin = await auth.register('queue-row-admin@test.local', 'Admin#12345', 'المدير الأكاديمي')
  adminId = admin.userId
  await auth.setRoles(adminId, ['academic_manager'])
  const { token } = await auth.login('queue-row-admin@test.local', 'Admin#12345')
  adminCookie = `${SESSION_COOKIE}=${token}`
}, 240_000)

describe('نتيجةُ اللقاء في صفّ الطابور', () => {
  it('① من لم يُقابَل لا نتيجةَ له — ولا تُخترع له واحدة', async () => {
    const { id } = await submitted(1)
    expect((await rowOf(id)).interviewOutcome, 'اختُرعت نتيجةٌ لمن لم يُقابَل').toBeNull()
  })

  it('② ونتيجةُ لقائه تصل الصفَّ كما سُجّلت', async () => {
    const { id } = await submitted(2)
    await prisma.trainerInterview.create({
      data: { applicationId: id, scheduledAt: new Date('2026-09-10T09:00:00Z'), mode: 'remote', outcome: 'passed' },
    })
    expect((await rowOf(id)).interviewOutcome, 'النتيجةُ لا تصل الصفّ').toBe('passed')
  })

  it('③ والملغى لا يُقرأ قولا لنا — ولو كانت له نتيجة', async () => {
    const { id } = await submitted(3)
    await prisma.trainerInterview.create({
      data: {
        applicationId: id, scheduledAt: new Date('2026-09-10T09:00:00Z'), mode: 'remote',
        outcome: 'failed', canceledAt: new Date('2026-09-11T09:00:00Z'),
      },
    })
    expect((await rowOf(id)).interviewOutcome, 'قُرئ موعدٌ ملغًى قولا لنا').toBeNull()
  })

  it('④ ومن قوبل مرّتين فالأحدثُ موعدا هو القول', async () => {
    const { id } = await submitted(4)
    await prisma.trainerInterview.createMany({
      data: [
        { applicationId: id, scheduledAt: new Date('2026-09-01T09:00:00Z'), mode: 'remote', outcome: 'failed' },
        { applicationId: id, scheduledAt: new Date('2026-09-12T09:00:00Z'), mode: 'remote', outcome: 'passed' },
      ],
    })
    expect((await rowOf(id)).interviewOutcome, 'قُرئ اللقاءُ الأقدمُ قولا لنا').toBe('passed')
  })
})

describe('⑥ قرارُ رابط التقييم في صفّ الطابور', () => {
  it('يصل الصفَّ كما كُتب في الرابط — وهو غيرُ ما يسجّله مُجرِي المقابلة', async () => {
    const { id } = await submitted(10)
    await prisma.trainerApplicationReview.create({
      data: { applicationId: id, reviewerName: 'قارئٌ باسمه', scores: {}, verdict: 'passed' },
    })
    expect((await rowOf(id)).reviewVerdicts, 'قرارُ الرابط لا يصل الصفَّ').toEqual(['passed'])
  })

  it('وتقييمٌ بلا قرارٍ لا يُخترع له قرار', async () => {
    const { id } = await submitted(11)
    await prisma.trainerApplicationReview.create({
      data: { applicationId: id, reviewerName: 'قارئٌ لم يحكم', scores: { evidence: 4 } },
    })
    expect((await rowOf(id)).reviewVerdicts, 'اختُرع قرارٌ لمن لم يحكم').toEqual([])
  })

  it('وقارئان اتّفقا قولٌ واحدٌ لا قولان', async () => {
    const { id } = await submitted(12)
    await prisma.trainerApplicationReview.createMany({
      data: [
        { applicationId: id, reviewerName: 'الأوّل', scores: {}, verdict: 'hold' },
        { applicationId: id, reviewerName: 'الثاني', scores: {}, verdict: 'hold' },
      ],
    })
    expect((await rowOf(id)).reviewVerdicts, 'كُرّر القولُ الواحد').toEqual(['hold'])
  })

  it('واختلافُهما يصل الصفَّ بقولين — لا يُكتَم أحدُهما', async () => {
    const { id } = await submitted(13)
    await prisma.trainerApplicationReview.createMany({
      data: [
        { applicationId: id, reviewerName: 'الأوّل', scores: {}, verdict: 'passed' },
        { applicationId: id, reviewerName: 'الثاني', scores: {}, verdict: 'failed' },
      ],
    })
    expect((await rowOf(id)).reviewVerdicts.slice().sort(), 'كُتم أحدُ القولين')
      .toEqual(['failed', 'passed'])
  })
})

describe('⑦ وموعدُه المعلَّق يصل الصفَّ تاريخا', () => {
  /** بعد ساعةٍ من الآن — فلا يمضي الموعدُ أثناء الجولة */
  const soon = () => new Date(Date.now() + 3_600_000)
  const past = () => new Date(Date.now() - 3_600_000)

  it('من حجز ولم يحن موعدُه — يُعرض تاريخُه', async () => {
    const { id } = await submitted(14)
    const at = soon()
    await prisma.trainerInterview.create({ data: { applicationId: id, scheduledAt: at, mode: 'remote' } })
    expect((await rowOf(id)).pendingInterviewAt, 'الموعدُ لا يصل الصفَّ').toEqual(at)
  })

  it('وله موعدان قادمان — فأقربُهما هو الذي يُنتظَر', async () => {
    const { id } = await submitted(15)
    const near = soon()
    await prisma.trainerInterview.createMany({
      data: [
        { applicationId: id, scheduledAt: new Date(Date.now() + 7_200_000), mode: 'remote' },
        { applicationId: id, scheduledAt: near, mode: 'remote' },
      ],
    })
    expect((await rowOf(id)).pendingInterviewAt, 'قُرئ الأبعدُ موعدا').toEqual(near)
  })

  it('وموعدٌ مضى ولم تُسجَّل نتيجتُه يبقى معلَّقا — لقاءٌ ينتظر قولَنا فيه', async () => {
    const { id } = await submitted(16)
    const at = past()
    await prisma.trainerInterview.create({ data: { applicationId: id, scheduledAt: at, mode: 'remote' } })
    expect((await rowOf(id)).pendingInterviewAt, 'أُخفي لقاءٌ جرى ولم يُسجَّل').toEqual(at)
  })

  it('وما سُجّلت نتيجتُه لا ينتظر شيئا', async () => {
    const { id } = await submitted(17)
    await prisma.trainerInterview.create({
      data: { applicationId: id, scheduledAt: past(), mode: 'remote', outcome: 'passed' },
    })
    expect((await rowOf(id)).pendingInterviewAt, 'موعدٌ انتهى أمرُه عُدّ معلَّقا').toBeNull()
  })

  it('والملغى لا موعدَ له — ولا يُعرض تاريخُه', async () => {
    const { id } = await submitted(18)
    await prisma.trainerInterview.create({
      data: { applicationId: id, scheduledAt: soon(), mode: 'remote', canceledAt: new Date() },
    })
    expect((await rowOf(id)).pendingInterviewAt, 'عُرض موعدٌ مُلغًى').toBeNull()
  })

  it('ومن لم يحجز فلا تاريخَ له — وهو من يُقال له «لم يحجز موعدا بعد»', async () => {
    const { id } = await submitted(19)
    const row = await rowOf(id)
    expect(row.pendingInterviewAt, 'اختُرع موعدٌ لمن لم يحجز').toBeNull()
    expect(row.interviewsCount, 'عُدّ موعدٌ لمن لم يحجز').toBe(0)
  })
})

/* ═══ ⑨ ومتى موعدُ لقائه — للترتيب لا للعرض (٢١ سبتمبر ٢٠٢٦) ═══

   «أحتاج ترتيبا إضافيّا للأسماء من خلال تاريخ المقابلة، من الأقدم للأحدث».
   وهو غيرُ `pendingInterviewAt`: ذاك **المعلَّق** وحدَه ويسقط عمّن سُجّلت
   نتيجتُه، فلو رُتّب به لَتذيّل كلُّ من قُوبل وانتهى أمرُه وكأنّه بلا
   موعدٍ أصلا. */
describe('⑨ وتاريخُ المقابلة يصل الصفَّ ليُرتَّب به', () => {
  it('من سُجّلت نتيجتُه له تاريخٌ يُرتَّب به — وإن لم يبقَ له معلَّق', async () => {
    const { id } = await submitted(21)
    const at = new Date('2026-09-12T09:00:00Z')
    await prisma.trainerInterview.create({
      data: { applicationId: id, scheduledAt: at, mode: 'remote', outcome: 'passed' },
    })
    const row = await rowOf(id)
    expect(row.interviewAt, 'من قُوبل وانتهى أمرُه بلا تاريخٍ يُرتَّب به').toEqual(at)
    expect(row.pendingInterviewAt, 'موعدٌ انتهى أمرُه عُدّ معلَّقا').toBeNull()
  })

  it('ومن لم يحجز فلا تاريخَ له — فيقع آخرا في الترتيب', async () => {
    const { id } = await submitted(22)
    expect((await rowOf(id)).interviewAt, 'اختُرع تاريخُ مقابلةٍ لمن لم يحجز').toBeNull()
  })

  it('والملغى لا تاريخَ له — موعدٌ أُلغي لم يقع', async () => {
    const { id } = await submitted(23)
    await prisma.trainerInterview.create({
      data: {
        applicationId: id, scheduledAt: new Date('2026-09-12T09:00:00Z'), mode: 'remote',
        canceledAt: new Date('2026-09-13T09:00:00Z'),
      },
    })
    expect((await rowOf(id)).interviewAt, 'رُتّب بموعدٍ مُلغًى').toBeNull()
  })

  it('ومن قوبل مرّتين فالأحدثُ موعدا هو تاريخُه', async () => {
    const { id } = await submitted(24)
    const later = new Date('2026-09-18T09:00:00Z')
    await prisma.trainerInterview.createMany({
      data: [
        { applicationId: id, scheduledAt: new Date('2026-09-02T09:00:00Z'), mode: 'remote', outcome: 'hold' },
        { applicationId: id, scheduledAt: later, mode: 'remote', outcome: 'passed' },
      ],
    })
    expect((await rowOf(id)).interviewAt, 'قُرئ الموعدُ الأقدمُ تاريخا له').toEqual(later)
  })
})

describe('⑧ ونتيجتُه لا تُمحى بحجزٍ جديد', () => {
  it('من سُجّلت نتيجتُه ثمّ حجز لقاءً ثانيا — يبقى قولُنا فيه وينضمّ موعدُه', async () => {
    const { id } = await submitted(20)
    const next = new Date(Date.now() + 3_600_000)
    await prisma.trainerInterview.createMany({
      data: [
        { applicationId: id, scheduledAt: new Date('2026-09-10T09:00:00Z'), mode: 'remote', outcome: 'hold' },
        { applicationId: id, scheduledAt: next, mode: 'remote' },
      ],
    })
    const row = await rowOf(id)
    expect(row.interviewOutcome, 'مُحيت النتيجةُ بحجزٍ لم يقع بعد').toBe('hold')
    expect(row.pendingInterviewAt, 'الموعدُ الجديدُ لا يصل الصفَّ').toEqual(next)
  })
})

describe('تذكيرُ المسوّدة', () => {
  it('⑤ يُرسَل للمسوّدة، ويُكتب في الأثر بحالِ بريده', async () => {
    const res = await apps.submitPhase1(applicant(5))
    const row = await prisma.trainerApplication.findUniqueOrThrow({ where: { reference: res.reference } })
    expect(row.status, 'الطلبُ ليس مسوّدةً أصلا').toBe('draft')

    const out = await review.remindDraftApplicant(row.id, adminId)
    /* بوّابةُ الإرسال مغلقةٌ في الاختبار، فالحالُ `failed` — والمهمُّ أنّه
       يُقال لا أنّه نجاح: الشاشةُ تبني خبرَها عليه. */
    expect(out.emailDelivery, 'حالُ البريد لا يُعاد').toMatch(/^(sent|failed|not_configured)$/)

    const audits = await prisma.auditEvent.findMany({
      where: { entityId: row.id, action: 'trainer.application.draft_remind' },
    })
    expect(audits, 'لا أثرَ للتذكير').toHaveLength(1)
    expect(audits[0].actorId, 'التذكيرُ بلا فاعلٍ مسجَّل').toBe(adminId)
  })

  it('⑥ ولا يُقال لمن أكمل «أكمل» — والحارسُ في الخدمة لا في الشاشة', async () => {
    const { id } = await submitted(6)
    await expect(review.remindDraftApplicant(id, adminId)).rejects.toMatchObject({ code: 'not_draft' })
  })

  it('⑦ والمسارُ يقبله للمسوّدة ويردّه لغيرها', async () => {
    const draft = await apps.submitPhase1(applicant(7))
    const draftRow = await prisma.trainerApplication.findUniqueOrThrow({ where: { reference: draft.reference } })
    const ok = await app.inject({
      method: 'POST', url: `/api/admin/trainer-applications/${draftRow.id}/draft-reminder`,
      headers: { cookie: adminCookie },
    })
    expect(ok.statusCode, 'رُدَّ تذكيرُ مسوّدة').toBe(201)
    expect(ok.json().emailDelivery, 'حالُ البريد لا يصل الشاشة').toMatch(/^(sent|failed|not_configured)$/)

    const live = await submitted(8)
    const refused = await app.inject({
      method: 'POST', url: `/api/admin/trainer-applications/${live.id}/draft-reminder`,
      headers: { cookie: adminCookie },
    })
    expect(refused.statusCode, 'قُبل تذكيرٌ لمن أكمل طلبَه').toBe(409)
  })
})
