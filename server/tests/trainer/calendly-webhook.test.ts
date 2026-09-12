/* مزامنةُ Calendly من طرفها إلى طرفها.

   الحارسُ هنا عبر المسار لا الخدمة وحدَها: التوقيعُ على الجسم الخام، ثمّ
   مطابقةُ رقم الطلب بالبريد، ثمّ وقتُ الموعد الحقيقيّ، وعدمُ تكرار التسليم،
   ثمّ الإلغاء وعودةُ الطلب إلى حالته السابقة. */

import { createHmac } from 'node:crypto'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import type { FastifyInstance } from 'fastify'
import type { PrismaClient } from '@prisma/client'
import { buildApp } from '../../http/app'
import { TrainerApplicationService } from '../../services/trainer-application.service'
import { TrainerReviewService } from '../../services/trainer-review.service'
import { saveCalendlyConfig } from '../../services/integrations.service'
import { setupTestDb, testPrisma } from '../helpers/db'

const SECRET = 'calendly-hook-secret-for-tests'
const REFERENCE = 'WJ-TR-2026-00001'
const EMAIL = 'calendly-trainer@test.local'
const INVITEE_URI = 'https://api.calendly.com/scheduled_events/event-1/invitees/invitee-1'
const START = '2026-09-20T09:30:00.000Z'

let prisma: PrismaClient
let app: FastifyInstance
let applicationId = ''
let userId = ''

const post = (event: string, payload: Record<string, unknown>, secret = SECRET) => {
  const raw = JSON.stringify({ event, payload })
  const timestamp = Math.floor(Date.now() / 1000).toString()
  const signature = createHmac('sha256', secret).update(`${timestamp}.${raw}`).digest('hex')
  return app.inject({
    method: 'POST',
    url: '/api/webhooks/calendly',
    headers: {
      'content-type': 'application/json',
      'calendly-webhook-signature': `t=${timestamp},v1=${signature}`,
    },
    payload: raw,
  })
}

const payload = () => ({
  uri: INVITEE_URI,
  email: EMAIL,
  tracking: {
    utm_source: 'wajeezacademy',
    utm_medium: 'trainer_application',
    utm_content: REFERENCE,
  },
  scheduled_event: {
    uri: 'https://api.calendly.com/scheduled_events/event-1',
    start_time: START,
  },
})

beforeAll(async () => {
  process.env.CALENDLY_WEBHOOK_SIGNING_KEY = SECRET
  await setupTestDb()
  prisma = await testPrisma()
  const user = await prisma.user.create({
    data: { email: EMAIL, displayName: 'مدرّب Calendly', passwordHash: 'test-only' },
  })
  userId = user.id
  const application = await prisma.trainerApplication.create({
    data: {
      reference: REFERENCE,
      userId,
      email: EMAIL,
      fullName: 'مدرّب Calendly',
      status: 'shortlisted',
      emailVerifiedAt: new Date(),
    },
  })
  applicationId = application.id
  app = await buildApp(prisma)
}, 240_000)

describe('حدثُ الحجز الموقّع', () => {
  it('يكتب الوقتَ الحقيقيَّ ويغيّر الحالةَ ويظهر لصاحب الطلب', async () => {
    const response = await post('invitee.created', payload())
    expect(response.statusCode, response.body).toBe(200)
    expect(response.json()).toEqual({ recorded: true })

    const interview = await prisma.trainerInterview.findUnique({ where: { externalId: INVITEE_URI } })
    expect(interview?.scheduledAt.toISOString()).toBe(START)
    expect(interview?.provider).toBe('calendly')
    expect(interview?.canceledAt).toBeNull()
    const application = await prisma.trainerApplication.findUniqueOrThrow({ where: { id: applicationId } })
    expect(application.status).toBe('interview_scheduled')

    const mine = await new TrainerApplicationService(prisma).myApplication(userId)
    expect(mine.interviews).toHaveLength(1)
    expect(mine.interviews[0].scheduledAt.toISOString()).toBe(START)
  })

  it('وإعادةُ الحدث لا تنشئ مقابلةً ثانية', async () => {
    const response = await post('invitee.created', payload())
    expect(response.statusCode).toBe(200)
    expect(response.json()).toEqual({ duplicate: true })
    expect(await prisma.trainerInterview.count({ where: { externalId: INVITEE_URI } })).toBe(1)
  })

  /* ⚠️ أُضيف في ١٢ سبتمبر ٢٠٢٦ — التجاهلُ الصامتُ يجعل أوّلَ ضبطٍ خاطئ لغزا

     حدثٌ موقّعٌ لا يُطابق طلبا كان يُردّ `{ignored:true}` بلا سبب: سجلُّ
     Calendly يقول «سُلِّم ٢٠٠»، ووجيز بلا موعد، ولا شيءَ يقول لماذا. وأرجحُ
     أسبابه بريدٌ غيّره المدعوّ في نموذج Calendly عن بريد طلبه. فالسببُ
     يُسمَّى ويُكتب في السجلّ. */
  it('وحدثٌ ببريدٍ لا يطابق الطلبَ يُتجاهَل بسببٍ مسمّى لا بصمت', async () => {
    const response = await post('invitee.created', {
      ...payload(),
      uri: `${INVITEE_URI}-other-email`,
      email: 'someone-else@test.local',
    })
    expect(response.statusCode).toBe(200)
    expect(response.json()).toEqual({ ignored: true, reason: 'no_application' })
  })

  it('وحدثٌ بلا رقم طلبٍ يُسمّى سببُه كذلك', async () => {
    const base = payload()
    /* بلا `tracking` ولا سؤالٍ مخصّص — لا مصدرَ لرقم الطلب البتّة */
    const response = await post('invitee.created', {
      uri: `${INVITEE_URI}-no-ref`,
      email: base.email,
      scheduled_event: base.scheduled_event,
    })
    expect(response.statusCode).toBe(200)
    expect(response.json()).toEqual({ ignored: true, reason: 'no_reference' })
  })

  it('والتوقيعُ الخاطئ مرفوضٌ بلا كتابة', async () => {
    const response = await post('invitee.created', { ...payload(), uri: `${INVITEE_URI}-forged` }, 'wrong-secret')
    expect(response.statusCode).toBe(401)
    expect(await prisma.trainerInterview.count()).toBe(1)
  })
})

describe('حدثُ الإلغاء الموقّع', () => {
  it('يلغي الموعدَ ويعيد الطلبَ إلى حالته السابقة ويعيد بابَ الحجز', async () => {
    const response = await post('invitee.canceled', payload())
    expect(response.statusCode, response.body).toBe(200)
    expect(response.json()).toEqual({ canceled: true })

    const interview = await prisma.trainerInterview.findUniqueOrThrow({ where: { externalId: INVITEE_URI } })
    expect(interview.canceledAt).not.toBeNull()
    const application = await prisma.trainerApplication.findUniqueOrThrow({ where: { id: applicationId } })
    expect(application.status).toBe('shortlisted')
    const mine = await new TrainerApplicationService(prisma).myApplication(userId)
    expect(mine.interviews).toEqual([])
  })

  /* ⚠️ أُضيف في ١٢ سبتمبر ٢٠٢٦ — الطابورُ كان يعدّ الملغاةَ مقابلةً أُجريت

     صفحةُ حالة المتقدّم كانت تصفّي `canceledAt: null`، وطابورُ الإدارة لا
     يصفّي: `_count.interviews` يعدّ الصفَّ الملغى، فتقول ترويسةُ الطابور
     «أُجريت مقابلتُه» لمن ألغى موعدَه قبل أن يجلس إليه أحد — وذاك رقمٌ
     يُقرأ قرارا. فالعدُّ على الأحياء وحدَهم. */
  it('ولا يُعَدّ الموعدُ الملغى مقابلةً في طابور الإدارة', async () => {
    const rows = await new TrainerReviewService(prisma).listApplications()
    const row = rows.find((r) => r.reference === REFERENCE)
    expect(row, 'الطلبُ غائبٌ عن الطابور').toBeDefined()
    expect(row?.interviewsCount, 'عُدَّت الملغاةُ مقابلةً أُجريت').toBe(0)
  })
})

/* ⚠️ أُضيف في ١٢ سبتمبر ٢٠٢٦ — المفتاحُ من الشاشة لا من الخادم

   كان المستقبِلُ يقرأ `process.env.CALENDLY_WEBHOOK_SIGNING_KEY` وحدَه، فضبطُ
   Calendly يقتضي SSH وتحريرَ `deploy/.env.production` وإعادةَ نشر — وسائرُ
   تكاملات المنصّة (Zoom والدفع والبريد) تُضبط من شاشةٍ واحدة. فصار يقرأ
   إعدادَ التكامل من القاعدة، والبيئةُ غشاءٌ يغلبه حين تُضبط.

   وهذا الحارسُ يمشي الطريقَ الجديدَ كلَّه: بلا متغيّرِ بيئةٍ البتّة، ومفتاحٌ
   محفوظٌ كما تحفظه الشاشةُ — يُقبل الحدثُ ويُكتب الموعد. ويُثبَّت الغشاءُ
   كذلك: متغيّرُ البيئة يغلب المحفوظَ حين يعودان معا. */
describe('مفتاحُ التوقيع من شاشة التكاملات', () => {
  const DB_KEY = 'calendly-key-saved-from-the-admin-screen'

  afterAll(() => { process.env.CALENDLY_WEBHOOK_SIGNING_KEY = SECRET })

  it('يُقبل الحدثُ بمفتاحٍ محفوظٍ في القاعدة بلا متغيّرِ بيئة', async () => {
    delete process.env.CALENDLY_WEBHOOK_SIGNING_KEY
    await saveCalendlyConfig(prisma, userId, { enabled: true, signingKey: DB_KEY })

    const response = await post('invitee.created', {
      ...payload(), uri: `${INVITEE_URI}-from-screen`,
    }, DB_KEY)
    expect(response.statusCode, response.body).toBe(200)
    expect(response.json()).toEqual({ recorded: true })
  })

  it('ومتغيّرُ البيئة يغلب المحفوظَ حين يجتمعان', async () => {
    process.env.CALENDLY_WEBHOOK_SIGNING_KEY = SECRET
    /* موقَّعٌ بمفتاح القاعدة والبيئةُ مضبوطةٌ بغيره — تغلب البيئةُ فيُردّ */
    const response = await post('invitee.created', {
      ...payload(), uri: `${INVITEE_URI}-env-wins`,
    }, DB_KEY)
    expect(response.statusCode).toBe(401)
  })
})
