/* الغيابُ يُسجَّل غيابا — وماذا يقع للطلب بعده.

   ═══ ولمَ بالقاعدة لا بقراءة الدالّة ═══

   الدعوى ليست «أنّ في الدالّة كتابةَ نتيجة» — بل **أنّ الطلبَ يعود إلى
   حيث كان، فيحجز صاحبُه من جديد**. وذاك سلسلةٌ لا سطر: نتيجةٌ تُكتب، ثمّ
   يُسأل: أبقي له موعدٌ قائم؟ ثمّ تُقرأ حالتُه السابقةُ من السجلّ، ثمّ
   يُنقَل إليها إن سمحت الخريطة. وكلُّ حلقةٍ منها تُقاس هنا بصفوفٍ تُقرأ.

   ═══ وأربعةُ أبوابٍ للامتناع ═══

   موعدٌ آخرُ قائمٌ يمنع العودة، وحالةٌ تجاوزت الحجزَ لا تُردّ إلى الوراء،
   وحالةٌ سابقةٌ لا تسمح بها خريطةُ الانتقالات تُترك كما هي. والأوّلان
   مفحوصان بصفوفٍ تُقرأ، والثالثُ **لا يقع اليوم** — وذلك نفسُه مفحوص:
   كلُّ حالةٍ تبلغ «حُدّد موعدُه» يُسمح بالعودة إليها. فالشرطُ في الشيفرة
   يقف لليوم الذي تتغيّر فيه الخريطة، ولا يُدّعى أنّ فحصا يحرسه.

   ⚠️ ولا يخرج بريدٌ إلى المتقدّم بالغياب: تذكيرُه يدويٌّ بقرار صاحب المنصّة.
   وعودتُه إلى حالةٍ تقبل الحجز هي ما يُعيده إلى ملخّص الصباح وإلى مرشّح
   «لم يحجز موعدا» — فيصله التذكيرُ بيدٍ تضغط، كغيره.

   ═══ ومتابعةُ الغياب — بيدٍ تضغط كذلك (٢٣ سبتمبر ٢٠٢٦) ═══

   صار للغياب بابٌ ثانٍ يُفتح بيد: رسالةُ اطمئنانٍ تُختار من اثنتَين ويُعدَّل
   متنُها. والمفحوصُ هنا **أثرُها في القاعدة**: ①تُبقي الطلبَ حيث هو فيحجز
   من جديد، و②تنقله إلى قائمة الانتظار — فلا يبقى الموقعُ يدعوه وقد شكرناه.
   وأمّا نصُّها ومن يُتابَع فحكمُهما في وحدةٍ نقيّةٍ يُنقَض هناك:
   `src/tests/trainer/no-show-followup.test.ts`. */

import { beforeAll, describe, expect, it } from 'vitest'
import type { PrismaClient } from '@prisma/client'
import { setupTestDb, testPrisma } from '../helpers/db'
import { AuthService } from '../../services/auth.service'
import { ALLOWED_TRANSITIONS, TRAINER_STATUSES, TrainerApplicationService } from '../../services/trainer-application.service'
import { TrainerReviewService } from '../../services/trainer-review.service'
import { NO_SHOW } from '../../../src/application/trainer/interview-outcome'

let prisma: PrismaClient
let auth: AuthService
let apps: TrainerApplicationService
let review: TrainerReviewService
let adminId = ''

const S = Date.now().toString(36).slice(-5)
const inDays = (n: number) => new Date(Date.now() + n * 86_400_000)

const base = {
  phoneCountryCode: '+962', phone: '771050000', country: 'الأردن', timezone: 'Asia/Amman',
  jobTitle: 'مدرّبُ مهارات', specialties: ['التسويق الرقمي'],
  domainYears: '8-12' as const, trainingYears: 'formal_teaching',
  bio: 'خبرةٌ ميدانيّة', trainingLanguages: ['العربية'], deliveryMode: 'both' as const,
  motivation: 'درّبتُ فرقا حقيقيّةً في بيئات عملٍ عربيّة، وأعرف الفرقَ بين من يعرف المادّة ومن يستطيع تعليمها. سأعطي كلَّ متعلّمٍ مهمّةً من واقع عمله في كلّ وحدة، وأراجع مخرجاته بنفسي وأكتب له ما ينقصه تحديدا لا تقييما عاما.',
  privacyConsent: true as const,
  password: 'Trainer#12345',
}

/** متقدّمٌ بلغ «قائمةً قصيرة» — وهي الحالُ التي يُحجَز منها الموعد */
async function shortlisted(tag: string) {
  const email = `no-show-${tag}-${S}@test.local`
  const res = await apps.submitPhase1({ ...base, email, fullName: `متقدّمُ ${tag}` })
  await apps.completePhase2(res.reference, res.candidateToken, {
    previousCourses: [], teachableCourseIds: [], availability: { seasons: ['nov_jan'] },
    demoConsent: true, contact: { channel: 'email' },
  })
  const row = await prisma.trainerApplication.findUniqueOrThrow({
    where: { reference: res.reference }, select: { id: true, reference: true },
  })
  await apps.transition(row.id, 'under_review', adminId, 'فرزٌ أوّليّ')
  await apps.transition(row.id, 'shortlisted', adminId, 'قائمةٌ قصيرة')
  return { ...row, email }
}

const statusOf = async (id: string) =>
  (await prisma.trainerApplication.findUniqueOrThrow({ where: { id }, select: { status: true } })).status

async function book(applicationId: string, days: number) {
  const interview = await review.scheduleInterview(applicationId, adminId, { scheduledAt: inDays(days) })
  expect(await statusOf(applicationId), 'الحجزُ لم ينقل الطلبَ — الفحصُ لا يقيس ما يدّعيه').toBe('interview_scheduled')
  return interview
}

beforeAll(async () => {
  await setupTestDb()
  prisma = await testPrisma()
  auth = new AuthService(prisma)
  apps = new TrainerApplicationService(prisma)
  review = new TrainerReviewService(prisma)
  const admin = await auth.register(`no-show-admin-${S}@test.local`, 'Admin#12345', 'المديرُ الأكاديميّ')
  adminId = admin.userId
  await auth.setRoles(adminId, ['academic_manager'])
}, 240_000)

describe('تسجيلُ الغياب', () => {
  it('يُكتب في صفّ الموعد، ويعيد الطلبَ إلى ما كان قبل الحجز', async () => {
    const app = await shortlisted('back')
    const interview = await book(app.id, 2)

    const out = await review.recordInterviewOutcome(interview.id, adminId, NO_SHOW)
    expect(out.outcome).toBe(NO_SHOW)
    expect(out.revertedTo, 'لم يُقل في الجواب إلى أين عاد').toBe('shortlisted')
    /* ولا يُخمَّن المبدأُ: يُقرأ من السجلّ — ولذلك عاد إلى «قائمةٍ قصيرة»
       لا إلى «مقدَّم»، وهي الحالُ التي حُجز منها. */
    expect(await statusOf(app.id)).toBe('shortlisted')

    const [event] = await prisma.auditEvent.findMany({
      where: { entityId: app.id, action: 'trainer.interview.outcome' },
      orderBy: { createdAt: 'desc' }, take: 1,
    })
    expect((event?.meta as { outcome?: string; revertedTo?: string })?.outcome).toBe(NO_SHOW)
    expect(
      (event?.meta as { revertedTo?: string })?.revertedTo,
      'الأثرُ لا يقول أنّ الحالةَ رُدّت — فيُقرأ بعد شهرٍ غيابا بلا مآل',
    ).toBe('shortlisted')
  })

  it('ويعود صاحبُه إلى من يُذكَّر بالحجز — وقبله كان يُردّ «حجز فعلا»', async () => {
    const app = await shortlisted('remind')
    const interview = await book(app.id, 3)

    /* قبل الغياب: له موعدٌ قائم، فالتذكيرُ يُردّ */
    await expect(review.remindToBookInterview(app.id, adminId)).rejects.toMatchObject({ code: 'already_booked' })

    await review.recordInterviewOutcome(interview.id, adminId, NO_SHOW)
    /* وبعده: لا موعدَ له، والحالةُ تقبل الحجز — فيُذكَّر كمن لم يحجز قطّ */
    const sent = await review.remindToBookInterview(app.id, adminId)
    expect(sent.emailDelivery, 'لم يُحاوَل الإرسالُ أصلا').toBeTruthy()

    /* والطابورُ لا يعدّه محجوزا — الشارةُ والمرشّحُ يقرآن هذا العدد */
    const rows = await review.listApplications()
    const mine = rows.find((r) => r.id === app.id) as { interviewsCount: number } | undefined
    expect(mine?.interviewsCount, 'يُعَدّ له موعدٌ قائمٌ وهو لم يحضره').toBe(0)
  })

  it('ولا يُعيد الطلبَ تسجيلُ نتيجةٍ أخرى — «ناجح» ليس غيابا', async () => {
    const app = await shortlisted('passed')
    const interview = await book(app.id, 1)

    const out = await review.recordInterviewOutcome(interview.id, adminId, 'passed')
    expect(out.revertedTo).toBeNull()
    expect(await statusOf(app.id), 'أُعيد الطلبُ بنتيجةٍ ليست غيابا').toBe('interview_scheduled')
  })

  it('وسببُ العودة يقول ما وقع — وتُقاس العودةُ بالأثر لا باسم النتيجة', async () => {
    const app = await shortlisted('stale')
    const interview = await book(app.id, 2)
    /* موعدٌ أُلغي ولم تُردّ معه الحالة — يقع في صفوفٍ سبقت مسارَ الإلغاء.
       ثمّ تُسجَّل نتيجةٌ متأخّرة: لا موعدَ قائمٌ بعدها، فيعود الطلب. */
    await prisma.trainerInterview.update({ where: { id: interview.id }, data: { canceledAt: new Date() } })

    const out = await review.recordInterviewOutcome(interview.id, adminId, 'failed')
    expect(out.revertedTo, 'لم يعد الطلبُ وقد صار بلا موعدٍ قائم').toBe('shortlisted')

    const [hist] = await prisma.trainerStatusHistory.findMany({
      where: { applicationId: app.id, toStatus: 'shortlisted' }, orderBy: { createdAt: 'desc' }, take: 1,
    })
    expect(
      hist?.note,
      'كُتب «لم يحضر» في السجلّ عن نتيجةٍ ليست غيابا — والسببُ يُقرأ بعد شهر',
    ).toBe('لم يبقَ للطلب موعدٌ قائم')
  })

  it('وبابُ العودة مفتوحٌ لكلّ من دخل — وبه يستقيم ردُّ الطلب', () => {
    /* الشرطُ في `revertWhenNoLiveInterview` يقبل العودةَ إن سمحت الخريطة.
       وهو لا يمنع أحدا اليوم لأنّ كلَّ حالةٍ تبلغ «حُدّد موعدُه» مسموحٌ
       بالعودة إليها — ولو انكسر هذا لَبقي طلبٌ واقفا بعد غيابٍ بلا خبر. */
    const canBook = TRAINER_STATUSES.filter((s) => ALLOWED_TRANSITIONS[s].includes('interview_scheduled'))
    expect(canBook.length, 'لا حالةَ تبلغ الحجزَ — تعطّلت قراءةُ الخريطة').toBeGreaterThan(1)
    for (const from of canBook) {
      expect(
        ALLOWED_TRANSITIONS.interview_scheduled,
        `من «${from}» يُحجَز ولا يُعاد إليها — فمن غاب يقف بلا مآل`,
      ).toContain(from)
    }
  })

  it('ولا يُردّ طلبٌ تجاوز الحجزَ — نتيجةٌ متأخّرةٌ لا تجرّه إلى الوراء', async () => {
    const app = await shortlisted('moved')
    const interview = await book(app.id, 1)
    /* مضى إلى «طُلب ديمو» بعد لقائه، ثمّ سُجّلت النتيجةُ متأخّرة */
    await apps.transition(app.id, 'demo_requested', adminId, 'طُلب ديمو بعد اللقاء')

    const out = await review.recordInterviewOutcome(interview.id, adminId, NO_SHOW)
    expect(out.revertedTo, 'جُرّ الطلبُ إلى ما قبل الحجز وقد تجاوزه').toBeNull()
    expect(await statusOf(app.id)).toBe('demo_requested')
  })

  it('ولا يُعاد ما دام له موعدٌ آخرُ قائم', async () => {
    const app = await shortlisted('two')
    const first = await book(app.id, 2)
    /* موعدٌ ثانٍ أُضيف بيدٍ — والحالةُ واحدةٌ لا تتكرّر */
    await prisma.trainerInterview.create({
      data: { applicationId: app.id, scheduledAt: inDays(9), mode: 'remote' },
    })

    const out = await review.recordInterviewOutcome(first.id, adminId, NO_SHOW)
    expect(out.revertedTo, 'أُعيد الطلبُ وله موعدٌ قائمٌ بعد').toBeNull()
    expect(await statusOf(app.id)).toBe('interview_scheduled')
  })

  it('وصفحةُ المتقدّم لا تعرض موعدا لم يحضره', async () => {
    const app = await shortlisted('applicant')
    const interview = await book(app.id, 4)

    const before = await apps.getPublicStatus(app.email)
    expect(before.hasInterview, 'لا موعدَ له قبل الغياب — الفحصُ لا يقيس ما يدّعيه').toBe(true)

    await review.recordInterviewOutcome(interview.id, adminId, NO_SHOW)
    const after = await apps.getPublicStatus(app.email)
    expect(
      after.hasInterview,
      'تعرض صفحتُه موعدا مضى ولم يحضره — فيقرأ أنّ له لقاءً وهو مدعوٌّ إلى حجزٍ جديد',
    ).toBe(false)
  })
})

/* ═══ متابعةُ من لم يحضر — ما يقع في القاعدة بعد الضغط ═══

   والمقيسُ هنا ما لا تقوله دالّةٌ خالصة: حالةُ الطلب بعد الإرسال، وأثرٌ
   يُكتب بمعرّف الموعد فيمنع رسالةً ثانيةً على الغياب نفسِه، وردُّ من لم
   يُسجَّل له غيابٌ أصلا. */
describe('متابعةُ الغياب', () => {
  const BODY = 'أتمنّى أن تكون بخير. لاحظنا أنّك لم تتمكّن من حضور الموعد، ونأمل أن يكون المانعُ خيرا.'

  it('⚠️ ①«نحبّ أن نلتقيه» تُبقي الطلبَ حيث هو — فيحجز موعدا آخر', async () => {
    const app = await shortlisted('fu-invite')
    const interview = await book(app.id, 2)
    await review.recordInterviewOutcome(interview.id, adminId, NO_SHOW)
    expect(await statusOf(app.id), 'نقطةُ البداية ليست «قائمةً قصيرة»').toBe('shortlisted')

    const out = await review.followUpNoShow(app.id, adminId, { variant: 'invite_again', bodyAr: BODY })
    /* والبريدُ لا يخرج في الاختبار (بوّابةُ `mail-gate`) — فالمقيسُ أنّ حالَه
       يُعاد ويُكتب، لا أنّه وصل. */
    expect(out.emailDelivery).toBeTruthy()
    expect(out.movedTo, 'الدعوةُ نقلت حالةَ من ندعوه').toBeNull()
    expect(await statusOf(app.id), 'نُقل طلبُه وهو مدعوٌّ إلى موعدٍ آخر').toBe('shortlisted')

    const [event] = await prisma.auditEvent.findMany({
      where: { entityId: app.id, action: 'trainer.no_show.followup' },
      orderBy: { createdAt: 'desc' }, take: 1,
    })
    expect(event, 'تُوبع بلا أثر').toBeTruthy()
    expect(event.actorId).toBe(adminId)
    const meta = event.meta as { interviewId?: string; variant?: string; bodyAr?: string }
    expect(meta.interviewId, 'الأثرُ لا يقول على أيّ غيابٍ وقعت').toBe(interview.id)
    expect(meta.variant).toBe('invite_again')
    /* والمتنُ في الأثر كما خرج: «ماذا قلنا له؟» يُسأل بعد شهرٍ ولا يُجاب بمفتاح */
    expect(meta.bodyAr, 'المتنُ المُرسَلُ لا يُكتب في الأثر').toBe(BODY)
  })

  it('⚠️ و②«اطمئنانٌ وشكر» تنقله إلى قائمة الانتظار — فلا يُدعى وقد شُكر', async () => {
    const app = await shortlisted('fu-thanks')
    const interview = await book(app.id, 3)
    await review.recordInterviewOutcome(interview.id, adminId, NO_SHOW)

    const out = await review.followUpNoShow(app.id, adminId, { variant: 'thanks', bodyAr: BODY })
    expect(out.movedTo).toBe('waitlisted')
    expect(await statusOf(app.id), 'بقي في حالةٍ تقبل الحجز بعد رسالةِ شكر').toBe('waitlisted')
    /* وسببُ النقل مكتوبٌ في السجلّ — فمن قرأه بعد شهرٍ عرف لمَ نُقل */
    const [moved] = await prisma.trainerStatusHistory.findMany({
      where: { applicationId: app.id, toStatus: 'waitlisted' },
      orderBy: { createdAt: 'desc' }, take: 1,
    })
    expect(moved?.note, 'نُقل بلا سببٍ مكتوب').toMatch(/لم يحضر/)
  })

  it('⚠️ ولا يُتابَع غيابٌ مرّتين — ورسالةٌ ثانيةٌ عليه تُقرأ آليّة', async () => {
    const app = await shortlisted('fu-twice')
    const interview = await book(app.id, 4)
    await review.recordInterviewOutcome(interview.id, adminId, NO_SHOW)
    await review.followUpNoShow(app.id, adminId, { variant: 'invite_again', bodyAr: BODY })

    await expect(review.followUpNoShow(app.id, adminId, { variant: 'invite_again', bodyAr: BODY }))
      .rejects.toMatchObject({ code: 'already_followed_up' })
    const n = await prisma.auditEvent.count({
      where: { entityId: app.id, action: 'trainer.no_show.followup' },
    })
    expect(n, 'كُتب أثرٌ ثانٍ لرسالةٍ لم تُرسَل').toBe(1)
  })

  it('⚠️ ولا يُتابَع من لم يُسجَّل له غياب', async () => {
    const app = await shortlisted('fu-present')
    const interview = await book(app.id, 5)
    await review.recordInterviewOutcome(interview.id, adminId, 'passed')

    await expect(review.followUpNoShow(app.id, adminId, { variant: 'thanks', bodyAr: BODY }))
      .rejects.toMatchObject({ code: 'no_absence' })
  })

  it('⚠️ ولا مَن بُتَّ في طلبه — فالدعوةُ أملٌ كاذبٌ والنقلُ نقضٌ لقرار', async () => {
    const app = await shortlisted('fu-decided')
    const interview = await book(app.id, 6)
    await review.recordInterviewOutcome(interview.id, adminId, NO_SHOW)
    await review.decide(app.id, adminId, 'reject', 'سببٌ داخليٌّ لا يُرسَل')

    await expect(review.followUpNoShow(app.id, adminId, { variant: 'invite_again', bodyAr: BODY }))
      .rejects.toMatchObject({ code: 'not_followable' })
  })

  it('ومتنٌ فارغٌ يُردّ — لا رسالةٌ بعنوانٍ بلا متن', async () => {
    const app = await shortlisted('fu-empty')
    const interview = await book(app.id, 7)
    await review.recordInterviewOutcome(interview.id, adminId, NO_SHOW)

    await expect(review.followUpNoShow(app.id, adminId, { variant: 'thanks', bodyAr: '   ' }))
      .rejects.toMatchObject({ code: 'body_out_of_range' })
    await expect(review.followUpNoShow(app.id, adminId, { variant: 'لا.أعرفها', bodyAr: BODY }))
      .rejects.toMatchObject({ code: 'unknown_variant' })
  })
})
