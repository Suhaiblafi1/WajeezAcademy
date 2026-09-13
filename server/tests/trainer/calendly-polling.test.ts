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
import { SystemHealthService } from '../../services/system-health.service'
import { TrainerApplicationService } from '../../services/trainer-application.service'
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
/* يُبدَّلان في حارس «الحجزُ الذي لا يُطابَق» — والباقي على الأصل */
let eventUri = EVENT_URI
let inviteeEmail = EMAIL
let inviteeCanceled = false
let failWith = 0
/* حسابٌ لا موعدَ فيه — صورةُ الرمزِ على حسابٍ غيرِ المضيف */
let noEvents = false

const RESCHEDULE_URL = 'https://calendly.com/reschedulings/poll-invitee-1'

const invitee = () => ({
  uri: `${eventUri}/invitees/poll-invitee-1`,
  email: inviteeEmail,
  reschedule_url: RESCHEDULE_URL,
  cancel_url: 'https://calendly.com/cancellations/poll-invitee-1',
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
          collection: noEvents ? [] : [{ uri: eventUri, start_time: START, status: eventStatus }],
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
    /* ═══ رابطُ التعديل يُحفظ ولا يُرمى ═══

       يصل مع المدعوّ في كلّ دورة، ولا يُشتقّ من شيءٍ عندنا: يحمل معرِّفَ
       المدعوّ لا معرِّفَ الحدث. فإن لم يُحفظ حين وصل لزم نداءُ Calendly من
       جديدٍ كلّما فتح متقدّمٌ صفحةَ متابعته (١٣ سبتمبر ٢٠٢٦). */
    expect(interview?.rescheduleUrl, 'رابطُ التعديل وصل ولم يُحفظ').toBe(RESCHEDULE_URL)
    expect(interview?.cancelUrl).toContain('cancellations')
    const application = await prisma.trainerApplication.findUniqueOrThrow({ where: { id: applicationId } })
    expect(application.status).toBe('interview_scheduled')
  })

  it('⚠️ وصاحبُ الطلب يقرأ رابطَ تعديله في المتابعة العامّة — لا في بريده وحدَه', async () => {
    /* من يفتح صفحةَ المتابعة إنّما فتحها لأنّه لم يجد رسالةَ Calendly. فلو
       بقي الرابطُ في القاعدة ولم يخرج إلى الواجهة لم يُغنِ عنه شيئا. */
    const svc = new TrainerApplicationService(prisma)
    const status = await svc.getPublicStatus(EMAIL, REFERENCE)
    expect(status.hasInterview).toBe(true)
    expect(status.interviewRescheduleUrl, 'الرابطُ محفوظٌ ولا يصل صاحبَه').toBe(RESCHEDULE_URL)
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

describe('الحجزُ الذي لا يُطابَق يُقال سببُه ويُعَدّ', () => {
  it('⚠️ بريدٌ مختلفٌ عند الحجز: يُسمّى السببُ في الخبر، ويُعَدّ فيُكتب الأثر', async () => {
    /* ═══ العطبُ الذي كُتب له ═══

       حجزٌ حقيقيٌّ لم يصل الطابور، ولم يكن في السجلّ ما يُشخَّص به: الخبرُ
       يقول عددَ المواعيد ولا يقول لماذا تُجووزت. وأسوأُ منه أنّ `runJob` لا
       تكتب أثرا إلّا إن كان `done` أو `failed` فوق الصفر — فحجزٌ متجاوَزٌ
       كان يُنتج صفرَين، فلا سطرَ أصلا والمشغّلُ يرى صمتا (١٣ سبتمبر ٢٠٢٦). */
    eventStatus = 'active'
    inviteeCanceled = false
    eventUri = 'https://api.calendly.com/scheduled_events/poll-event-2'
    inviteeEmail = 'someone-else@test.local'

    const result = await syncCalendlyInterviews(prisma, new Date('2026-09-23T09:00:00.000Z'))

    expect(result.done, 'لا شيءَ يُطابَق فلا شيءَ يُحدَّث').toBe(0)
    /* يُعَدّ إخفاقا ليُكتب الأثر — وهو إخفاقٌ فعلا: موعدٌ حجزه إنسانٌ ولم
       يبلغ طابورَ المراجعة. */
    expect(result.failed, 'المتجاوَزُ لا يُعَدّ — فلا أثرَ يُكتب ولا خبرَ يُقرأ').toBe(1)
    expect(result.summaryAr, 'الخبرُ لا يقول سببَ التجاوز').toContain('لا يطابقان طلبا')
  })
})

describe('نبضُ الدورة يُقرأ في صحّة النظام — فالصمتُ لا يُقرأ سلامة', () => {
  /* ═══ العطبُ الذي كُتب له ═══

     `runJob` لا تكتب أثرا إلّا إن عمِلت الدورةُ شيئا أو سقط لها شيء. ورمزٌ
     صحيحٌ على حسابٍ **غيرِ المضيف** يردّ صفرَ مواعيدَ بلا خطأ: صفرٌ عُمل
     وصفرٌ سقط، فلا سطرَ في السجلّ ولا خبرَ في شاشة. تعمل الوظيفةُ كلَّ خمس
     دقائقَ على حسابٍ فارغ، والمشغّلُ يرى هدوءا فيحسبه سلامة — وهو بعينه ما
     ضاع فيه تشخيصُ حجزٍ حقيقيٍّ (١٣ سبتمبر ٢٠٢٦).

     فصارت الدورةُ تكتب نبضَها فوق سابقه في صفّ التكامل، وصحّةُ النظام تقرؤه.
     والحارسُ على **البند في اللقطة** — مفتاحِه ومستواه ومعناه — لا على ورودِ
     نصٍّ في ملفّ. */
  const health = () => new SystemHealthService(prisma)

  const row = async (now: Date) => {
    const snap = await health().snapshot(now)
    const found = snap.groups.flatMap((g) => g.items).find((i) => i.key === 'calendly_sync')
    expect(found, 'لا بندَ لمزامنة Calendly في صحّة النظام').toBeDefined()
    return found!
  }

  it('دورةٌ تجاوزت حجزا: يُقال العددُ والمتجاوَزُ، ويُدَلُّ على موضع العمل', async () => {
    /* الحالُ الموروثةُ من الحارس قبله: موعدٌ ببريدٍ لا يطابق طلبا */
    const result = await syncCalendlyInterviews(prisma, new Date('2026-09-24T08:00:00.000Z'))
    expect(result.done).toBe(0)

    const item = await row(new Date('2026-09-24T08:01:00.000Z'))
    expect(item.level, 'حجزٌ تُجووز يُقرأ سلامةً').toBe('attention')
    expect(item.valueAr, 'لا يقول إنّ حجزا تُجووز').toContain('تُجووز')
    expect(item.href, 'لا يدلّ على موضع العمل').toBe('/admin/integrations')
  })

  it('⚠️ ودورةٌ قرأت صفرَ مواعيدَ تُقال — وهي الصورةُ الوحيدةُ لرمزٍ على حسابٍ غيرِ المضيف', async () => {
    noEvents = true
    const result = await syncCalendlyInterviews(prisma, new Date('2026-09-24T09:00:00.000Z'))
    noEvents = false
    /* صفرٌ عُمل وصفرٌ سقط: لا أثرَ يُكتب، فلا شيءَ في `/admin/audit` البتّة */
    expect(result.done).toBe(0)
    expect(result.failed).toBe(0)

    const item = await row(new Date('2026-09-24T09:01:00.000Z'))
    expect(item.level, 'الصفرُ يُقرأ سلامةً — وهو الصمتُ الذي ضاع فيه التشخيص').toBe('attention')
    expect(item.valueAr, 'لا يقول كم موعدا قُرئ').toContain('قرأت 0 موعدا')
    expect(item.meaningAr, 'لا يُسمّي احتمالَ الرمزِ على حسابٍ آخر').toContain('حساب')
  })

  it('وانقطاعُ النبض يُقرأ عطبا في العامل لا صمتا من Calendly', async () => {
    /* النبضُ الأخيرُ كُتب في التاسعة، ويُقرأ بعد أربعين دقيقة: ثمانِ دوراتٍ
       لم تقع. والفرقُ بينهما عمليٌّ — تُراجَع خدمةُ العامل لا الرمز. */
    const item = await row(new Date('2026-09-24T09:40:00.000Z'))
    expect(item.level).toBe('broken')
    expect(item.meaningAr, 'لا يفرّق بين عاملٍ متوقّفٍ وتكاملٍ صامت').toContain('العاملَ الخلفيَّ')
  })

  it('ودورةٌ ساقطةٌ تبقى مقروءةً في الشاشة لا في السجلّ وحدَه', async () => {
    failWith = 401
    await syncCalendlyInterviews(prisma, new Date('2026-09-25T09:00:00.000Z'))
    failWith = 0

    const item = await row(new Date('2026-09-25T09:01:00.000Z'))
    expect(item.level).toBe('broken')
    expect(item.valueAr, 'لا يقول رمزَ الردّ').toContain('401')
  })

  it('ونبضُ الدورة لا يمحو الرمزَ المحفوظ — فهو يُدمج ولا يُعيد الكتابة', async () => {
    /* الكتابةُ على `config` نفسِه، ولو كُتب النبضُ بديلا عن الإعداد لمُحي
       الرمزُ في أوّل دورة، فتوقّف المزامنةُ بنفسِ ما جاء يراقبها. */
    expect((await getCalendlyConfig(prisma)).token).toBe(TOKEN)
  })
})
