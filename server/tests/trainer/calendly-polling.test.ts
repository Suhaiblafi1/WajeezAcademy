/* المزامنةُ بالسؤال الدوريّ — بديلُ المستقبِل حين لا خطّةَ مدفوعة.

   ═══ العطبُ الذي كُتبت له ═══

   اشتراكُ webhook خلفَ خطّةٍ مدفوعةٍ لا يملكها حسابُ الأكاديميّة، فمن حجز
   مقابلتَه لم يظهر حجزُه في طابور المراجعة أصلا — انقطاعٌ تامٌّ لا تأخّر.

   ولا شبكةَ هنا: `fetch` مُلتقَط، فيُقرأ ما كان سيُرسَل ويُردّ ما كانت
   Calendly سترُدّه. والحارسُ على **الأثر في القاعدة** لا على ورودِ نصّ. */

import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import type { PrismaClient } from '@prisma/client'
import { JOBS, syncCalendlyInterviews } from '../../worker/jobs'
import { maskedIntegrationsView, saveCalendlyConfig, getCalendlyConfig } from '../../services/integrations.service'
import { setupTestDb, testPrisma } from '../helpers/db'

const TOKEN = 'calendly-pat-for-tests-0000'
const REFERENCE = 'WJ-TR-2026-00042'
const EMAIL = 'calendly-poll@test.local'
const EVENT_URI = 'https://api.calendly.com/scheduled_events/poll-event-1'
const INVITEE_URI = `${EVENT_URI}/invitees/poll-invitee-1`
const START = '2026-09-25T11:00:00.000Z'
const ORG = 'https://api.calendly.com/organizations/org-1'

let prisma: PrismaClient
let applicationId = ''
let adminId = ''

/* ما طُلب من Calendly في هذه الدورة — به يُقاس أنّ المعروفَ لا يُسأل عنه */
let asked: string[] = []
let eventStatus: 'active' | 'canceled' = 'active'
let inviteeCanceled = false
let failWith = 0

const invitee = () => ({
  uri: INVITEE_URI,
  email: EMAIL,
  status: inviteeCanceled ? 'canceled' : 'active',
  canceled_at: inviteeCanceled ? '2026-09-21T08:00:00.000Z' : null,
  tracking: {
    utm_source: 'wajeezacademy',
    utm_medium: 'trainer_application',
    utm_content: REFERENCE,
  },
})

beforeAll(async () => {
  delete process.env.CALENDLY_PAT
  delete process.env.CALENDLY_WEBHOOK_SIGNING_KEY
  await setupTestDb()
  prisma = await testPrisma()
  const user = await prisma.user.create({
    data: { email: EMAIL, displayName: 'مدرّبُ السؤال الدوريّ', passwordHash: 'test-only' },
  })
  const admin = await prisma.user.create({
    data: { email: 'poll-admin@test.local', displayName: 'مديرُ الإعدادات', passwordHash: 'test-only' },
  })
  adminId = admin.id
  const application = await prisma.trainerApplication.create({
    data: {
      reference: REFERENCE,
      userId: user.id,
      email: EMAIL,
      fullName: 'مدرّبُ السؤال الدوريّ',
      status: 'shortlisted',
      emailVerifiedAt: new Date(),
    },
  })
  applicationId = application.id
}, 240_000)

beforeEach(() => {
  asked = []
  globalThis.fetch = (async (url: string) => {
    const u = String(url)
    asked.push(u)
    if (failWith) {
      return { ok: false, status: failWith, text: async () => 'no' }
    }
    if (u.includes('/users/me')) {
      return {
        ok: true, status: 200,
        text: async () => JSON.stringify({ resource: { current_organization: ORG, name: 'وجيز', email: EMAIL } }),
      }
    }
    if (u.includes('/scheduled_events?')) {
      return {
        ok: true, status: 200,
        text: async () => JSON.stringify({
          collection: [{ uri: EVENT_URI, start_time: START, status: eventStatus }],
        }),
      }
    }
    return { ok: true, status: 200, text: async () => JSON.stringify({ collection: [invitee()] }) }
  }) as unknown as typeof fetch
})

afterAll(async () => { await prisma.$disconnect() })

describe('مفعَّلٌ بلا رمزٍ محفوظ: لا سؤالَ يُرسل', () => {
  it('لا نداءَ شبكةٍ البتّة — ولا يُقال إنّ شيئا زِيد', async () => {
    /* ═══ ولماذا `enabled: true` هنا صراحةً ═══

       كُتب الحارسُ أوّلا بلا صفٍّ في القاعدة، فمرّ وهو لا يفحص شيئا:
       `enabled` كانت false فرجعت الدالّةُ عندها، ولو حُذف فحصُ الرمز كلَّه
       لبقي أخضر. وهذه هي الحالةُ المقصودة فعلا — من فعّل التكاملَ ثمّ نسي
       الرمز، فيُسأل Calendly برمزٍ فارغٍ كلَّ خمس دقائقَ إلى الأبد. */
    await saveCalendlyConfig(prisma, adminId, { enabled: true })
    const result = await syncCalendlyInterviews(prisma, new Date('2026-09-20T10:00:00.000Z'))
    expect(result.done).toBe(0)
    expect(result.failed).toBe(0)
    expect(asked, 'سُئلت Calendly بلا رمزٍ محفوظ').toEqual([])
  })
})

describe('الرمزُ يُخزَّن ويُقنَّع', () => {
  it('يُحفظ فيُقرأ، ولا يعود إلى الشاشة إلّا مقنَّعا', async () => {
    await saveCalendlyConfig(prisma, adminId, { enabled: true, token: TOKEN })
    expect((await getCalendlyConfig(prisma)).token).toBe(TOKEN)

    const view = await maskedIntegrationsView(prisma)
    expect(view.calendly.hasToken).toBe(true)
    expect(view.calendly.polling).toBe(true)
    /* المقنَّعُ لا يحمل الرمزَ ولا طرفا منه يكفي لانتحاله */
    expect(view.calendly.token).not.toBe(TOKEN)
    expect(view.calendly.token).toContain('••••')
  })

  it('وقيمةٌ مقنَّعةٌ عادت من الشاشة لا تمحو المحفوظ', async () => {
    const view = await maskedIntegrationsView(prisma)
    await saveCalendlyConfig(prisma, adminId, { enabled: true, token: view.calendly.token })
    expect((await getCalendlyConfig(prisma)).token).toBe(TOKEN)
  })
})

describe('الحجزُ المقروءُ يصير مقابلةً', () => {
  it('يكتب الموعدَ الحقيقيَّ ويغيّر حالةَ الطلب', async () => {
    const result = await syncCalendlyInterviews(prisma, new Date('2026-09-20T10:00:00.000Z'))
    expect(result.done).toBe(1)
    expect(result.failed).toBe(0)

    const interview = await prisma.trainerInterview.findUnique({ where: { externalId: INVITEE_URI } })
    expect(interview?.scheduledAt.toISOString()).toBe(START)
    expect(interview?.provider).toBe('calendly')
    expect(interview?.canceledAt).toBeNull()
    const application = await prisma.trainerApplication.findUniqueOrThrow({ where: { id: applicationId } })
    expect(application.status).toBe('interview_scheduled')
  })

  it('وإعادةُ الدورة لا تُنشئ ثانيةً ولا تسأل عن مدعوّي موعدٍ تُعرف حالتُه', async () => {
    const result = await syncCalendlyInterviews(prisma, new Date('2026-09-20T10:05:00.000Z'))
    expect(result.done).toBe(0)
    expect(await prisma.trainerInterview.count({ where: { externalId: INVITEE_URI } })).toBe(1)
    /* الاستقرارُ سؤالان: الحسابُ والمواعيد. ولو سُئل عن المدعوّين كلَّ دورةٍ
       لصار عددُ النداءات بعدد المواعيد كلَّ خمس دقائق بلا فائدة. */
    expect(asked.some((u) => u.includes('/invitees')), 'سُئل عن مدعوّي موعدٍ معروف').toBe(false)
  })
})

describe('الإلغاءُ المقروءُ يُلغي المقابلة', () => {
  it('يكتب وقتَ الإلغاء ويعيد الطلبَ إلى ما كان', async () => {
    eventStatus = 'canceled'
    inviteeCanceled = true
    const result = await syncCalendlyInterviews(prisma, new Date('2026-09-21T09:00:00.000Z'))
    expect(result.done).toBe(1)

    const interview = await prisma.trainerInterview.findUnique({ where: { externalId: INVITEE_URI } })
    expect(interview?.canceledAt).not.toBeNull()
    const application = await prisma.trainerApplication.findUniqueOrThrow({ where: { id: applicationId } })
    expect(application.status).toBe('shortlisted')
  })
})

describe('الرمزُ المنتهي يُقال ولا يُرمى', () => {
  it('دورةٌ ساقطةٌ تُخبر برمز الردّ ولا توقف العاملَ', async () => {
    failWith = 401
    const result = await syncCalendlyInterviews(prisma, new Date('2026-09-22T09:00:00.000Z'))
    failWith = 0
    /* لا استثناءَ يخرج: العاملُ يمضي إلى بقيّة وظائفه. والسقوطُ محسوبٌ
       ومقولٌ — لا صمتَ يُخفي رمزا انتهى منذ أسبوع. */
    expect(result.failed).toBe(1)
    expect(result.done).toBe(0)
    expect(result.summaryAr).toContain('401')
  })
})

describe('الوظيفةُ مسجَّلةٌ في دورة العامل', () => {
  it('وإلّا لم تُنادَ في الإنتاج قطّ مهما صحّ منطقُها', () => {
    /* الحارسُ على **التسجيل** لا على وجود الدالّة: دالّةٌ صحيحةٌ لا يناديها
       أحدٌ هي الحالةُ التي كان فيها هذا العطبُ أصلا. */
    const job = JOBS.find((j) => j.key === 'calendly_interview_sync')
    expect(job, 'غيرُ مسجَّلةٍ في JOBS').toBeDefined()
    expect(job!.run).toBe(syncCalendlyInterviews)
    /* ودورتُها لا تطول: حجزٌ لا يظهر قبل ساعةٍ يُربك المراجعةَ والمتقدّمَ معا */
    expect(job!.everyMs).toBeLessThanOrEqual(10 * 60_000)
  })
})
