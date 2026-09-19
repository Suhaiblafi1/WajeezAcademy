/* ملخّصُ الصباح: من أتمّ طلبَه ولم يحجز — ولمن يخرج ومتى يمتنع.

   ═══ ولمَ بالقاعدة لا بقراءة الوظيفة ═══

   الدعوى هنا ليست «أنّ في الوظيفة نداءَ إرسال» — بل **من يصله ومن لا
   يصله، ومتى تمتنع**. وخمسةُ أبوابٍ للامتناع كلُّها تُقاس بصفوفٍ تُقرأ:
   غيرُ الصباح، وقناةٌ غيرُ موصولة، ولا متأخّرَ اليوم، وملخّصٌ خرج اليومَ
   مرّة، ومن لا يراجع الطلبات.

   ═══ والبابُ السادس هو الذي كُتب لأجله هذا الملفّ ═══

   قرارُ صاحب المنصّة أنّ تذكيرَ المتقدّم **يدويّ**. ووظيفةٌ تعمل بلا رقيبٍ
   كلَّ ساعةٍ وتقرأ عناوينَ المتقدّمين هي أقربُ موضعٍ في المنصّة إلى نقضِ
   ذلك القرار: سطرٌ واحدٌ يُضاف يوما — «ولنُرسل إليه أيضا» — فيصير التذكيرُ
   آليّا بلا أن يُنقَض فحصٌ واحد.

   ولذلك يُقاس هنا **صمتُ صندوق المتقدّم** نفسُه: لا صفَّ إشعارٍ لحسابه،
   ولا صفَّ بريدٍ خارجٍ إلى عنوانه، بعد كلّ دورةٍ في هذا الملفّ.

   والوقتُ يُحقَن (`now`) ولا يُنتظَر: فحصٌ ينتظر الصباحَ ليس فحصا.

   ⚠️ ولا يخرج بريدٌ حقيقيٌّ رغم وصلِ القناة: بوّابةُ `MAIL_LIVE` تردّ
   الإرسالَ في غير الإنتاج، فتُقرأ الرسالةُ `failed`. وهو ما يُقاس عليه
   أصلا: **الصفُّ يُكتب وإن سقط المزوّد** — وهو أثرُ «خرج ملخّصُ اليوم»،
   فلا يُطرَق بابُ الموظّف ساعةً بعد ساعة. */

import { beforeAll, describe, expect, it } from 'vitest'
import type { PrismaClient } from '@prisma/client'
import { setupTestDb, testPrisma } from '../helpers/db'
import { AuthService } from '../../services/auth.service'
import { TrainerApplicationService } from '../../services/trainer-application.service'
import { digestUnbookedApplicants } from '../../worker/jobs'

const DIGEST_KEY = 'admin.trainer_unbooked'
/** السابعةُ والنصف صباحا بتوقيت عمّان (+٣) */
const MORNING = new Date('2026-09-19T04:30:00Z')
/** الثانيةُ ظهرا بتوقيتها */
const AFTERNOON = new Date('2026-09-19T11:00:00Z')
const daysBefore = (n: number) => new Date(MORNING.getTime() - n * 86_400_000)

let prisma: PrismaClient
let auth: AuthService
let apps: TrainerApplicationService
let reviewerId = ''
let outsiderId = ''
let lateApp = { id: '', reference: '', userId: '', email: '' }

const base = {
  phoneCountryCode: '+962', phone: '771050000', country: 'الأردن', timezone: 'Asia/Amman',
  jobTitle: 'مدرّبُ بيانات', specialties: ['التسويق الرقمي'],
  domainYears: '8-12' as const, trainingYears: 'formal_teaching',
  bio: 'خبرةٌ ميدانيّة', trainingLanguages: ['العربية'], deliveryMode: 'both' as const,
  motivation: 'درّبتُ فرقا حقيقيّةً في بيئات عملٍ عربيّة، وأعرف الفرقَ بين من يعرف المادّة ومن يستطيع تعليمها. سأعطي كلَّ متعلّمٍ مهمّةً من واقع عمله في كلّ وحدة، وأراجع مخرجاته بنفسي وأكتب له ما ينقصه تحديدا لا تقييما عاما.',
  privacyConsent: true as const,
  password: 'Trainer#12345',
}

/** متقدّمٌ أتمّ طلبَه قبل كذا يوما من الصباح المحقون */
async function applicantCompletedDaysAgo(email: string, fullName: string, days: number) {
  const res = await apps.submitPhase1({ ...base, email, fullName })
  await apps.completePhase2(res.reference, res.candidateToken, {
    previousCourses: [], teachableCourseIds: [], availability: { seasons: ['nov_jan'] },
    demoConsent: true, contact: { channel: 'email' },
  })
  /* القاعدةُ تكتب لحظةَ الإتمام بالساعة الحقيقيّة — وتُرجَع بيدٍ إلى ما قبل
     الصباح المحقون، وإلّا قُرئ الطلبُ آتيا من المستقبل فلا يتأخّر أبدا. */
  const row = await prisma.trainerApplication.update({
    where: { reference: res.reference },
    data: { phase2CompletedAt: daysBefore(days), emailVerifiedAt: new Date() },
    select: { id: true, reference: true, userId: true, email: true, status: true },
  })
  expect(row.status, 'نقطةُ البداية ليست «مقدَّم» — الفحصُ لا يقيس ما يدّعيه').toBe('submitted')
  expect(row.userId, 'المتقدّمُ بلا حساب — فلا يُقاس صمتُ صندوقه').toBeTruthy()
  return { id: row.id, reference: row.reference, userId: row.userId as string, email: row.email }
}

const digestsOf = (userId: string) =>
  prisma.notification.findMany({
    where: { userId, templateKey: DIGEST_KEY },
    select: { channel: true, audience: true, title: true, body: true },
  })

const clearDigests = () => prisma.notification.deleteMany({ where: { templateKey: DIGEST_KEY } })

/** وصلُ قناة البريد أو فصلُها — والإرسالُ يسقط على كلّ حالٍ ببوّابة `MAIL_LIVE` */
const emailChannel = (enabled: boolean) =>
  prisma.integrationSetting.upsert({
    where: { provider: 'email' },
    update: { enabled, config: { apiKey: 'test-key', fromEmail: 'no-reply@test.local' } },
    create: { provider: 'email', enabled, config: { apiKey: 'test-key', fromEmail: 'no-reply@test.local' } },
  })

/** صمتُ صندوق المتقدّم — يُسأل بعد كلّ دورة، لا مرّةً في آخر الملفّ */
async function applicantUntouched(): Promise<void> {
  expect(
    await prisma.notification.count({ where: { userId: lateApp.userId } }),
    'وصل المتقدّمَ إشعارٌ من ملخّصٍ للإدارة — والتذكيرُ يدويٌّ بقرار صاحب المنصّة',
  ).toBe(0)
  expect(
    await prisma.outboxMail.count({ where: { to: lateApp.email } }),
    'كُتب بريدٌ خارجٌ إلى عنوان المتقدّم',
  ).toBe(0)
}

beforeAll(async () => {
  await setupTestDb()
  prisma = await testPrisma()
  auth = new AuthService(prisma)
  apps = new TrainerApplicationService(prisma)
  await emailChannel(true)

  const reviewer = await auth.register('digest-reviewer@test.local', 'Admin#12345', 'المديرُ الأكاديميّ')
  reviewerId = reviewer.userId
  await auth.setRoles(reviewerId, ['academic_manager'])

  const outsider = await auth.register('digest-support@test.local', 'Admin#12345', 'موظّفُ الدعم')
  outsiderId = outsider.userId
  await auth.setRoles(outsiderId, ['support'])

  lateApp = await applicantCompletedDaysAgo('digest-late@test.local', 'هالةُ المدرّبة', 6)
}, 240_000)

describe('ملخّصُ من لم يحجز', () => {
  it('يخرج صباحا إلى من يراجع الطلبات — ولا يصل المتقدّمَ منه شيء', async () => {
    const out = await digestUnbookedApplicants(prisma, MORNING)
    expect(out.summaryAr).toContain('لم يحجز')

    const [mail, ...extra] = await digestsOf(reviewerId)
    expect(mail, 'لم يصل المراجعَ ملخّص').toBeDefined()
    expect(extra, 'أكثرُ من ملخّصٍ في دورةٍ واحدة').toEqual([])
    expect(mail.channel, 'خرج جرسا في المنصّة لا بريدا — وغرضُه أن يبلغَه قبل أن يفتحها').toBe('email')
    expect(mail.audience, 'وصل بوّابةَ المتعلّم لا بوّابةَ الموظّف').toBe('staff')
    expect(mail.body, 'لا يُسمّي من وقف — فلا يُعرف من السطر وحدَه').toContain(lateApp.reference)
    expect(mail.body).toContain('هالةُ المدرّبة')

    /* ومن لا يراجع الطلبات لا يصله: الدعمُ يقرأ تذاكرَه لا طابورَ المدرّبين */
    expect(await digestsOf(outsiderId), 'وصل الملخّصُ من لا يعمل فيه').toEqual([])
    await applicantUntouched()
  })

  it('ولا يخرج مرّتين في اليوم — والأثرُ نفسُه هو المانع', async () => {
    const out = await digestUnbookedApplicants(prisma, new Date(MORNING.getTime() + 90 * 60_000))
    expect(out.summaryAr, 'لم يُعلن الامتناعَ في خبره').toContain('سبق اليومَ')
    expect(await digestsOf(reviewerId), 'خرج ملخّصٌ ثانٍ في اليوم نفسِه').toHaveLength(1)
    await applicantUntouched()
  })

  it('ولا يخرج في غير نافذة الصباح', async () => {
    /* تُمحى آثارُ اليوم أوّلا، وإلّا لم يُعرف أمنَعَته الساعةُ أم سَبقُه */
    await clearDigests()
    const out = await digestUnbookedApplicants(prisma, AFTERNOON)
    expect(out.summaryAr).toContain('ليس وقتَ الملخّص')
    expect(await digestsOf(reviewerId), 'خرج الملخّصُ ظهرا').toEqual([])
    await applicantUntouched()
  })

  it('ومن حجز موعدَه لا يُذكر فيه، ومن ألغى يُذكر', async () => {
    const booked = await applicantCompletedDaysAgo('digest-booked@test.local', 'زيدٌ الحاجز', 9)
    const interview = await prisma.trainerInterview.create({
      data: { applicationId: booked.id, scheduledAt: new Date(MORNING.getTime() + 86_400_000) },
    })

    await clearDigests()
    const withBooking = await digestUnbookedApplicants(prisma, MORNING)
    const [first] = await digestsOf(reviewerId)
    expect(first?.body, 'ذُكر في الملخّص من له موعدٌ قائم').not.toContain(booked.reference)
    expect(first?.body, 'سقط من لم يحجز من الملخّص').toContain(lateApp.reference)
    expect(withBooking.summaryAr).toContain('متقدّمٌ واحد')

    /* والملغى لا يُحسب موعدا — ومن ألغى أحوجُ الناس إلى التذكير */
    await prisma.trainerInterview.update({ where: { id: interview.id }, data: { canceledAt: new Date() } })
    await clearDigests()
    await digestUnbookedApplicants(prisma, MORNING)
    const [second] = await digestsOf(reviewerId)
    expect(second?.body, 'لم يعد من ألغى موعدَه إلى الملخّص').toContain(booked.reference)
    await applicantUntouched()
  })

  it('ولا يُكتب صفٌّ وقناةُ البريد مفصولة — فلا يُحرق صفٌّ بمحاولةٍ لا مزوّدَ لها', async () => {
    await emailChannel(false)
    await clearDigests()
    const out = await digestUnbookedApplicants(prisma, MORNING)
    expect(out.summaryAr).toContain('قناةُ البريد غيرُ موصولة')
    expect(await digestsOf(reviewerId)).toEqual([])
    await applicantUntouched()
    await emailChannel(true)
  })

  it('ولا يخرج فارغا — صباحٌ لا متأخّرَ فيه لا رسالةَ له', async () => {
    /* يُحجز لكلّ من في الطابور، فلا يبقى متأخّر */
    const open = await prisma.trainerApplication.findMany({
      where: { status: { in: ['submitted', 'under_review', 'information_requested', 'shortlisted'] } },
      select: { id: true },
    })
    for (const app of open) {
      await prisma.trainerInterview.create({
        data: { applicationId: app.id, scheduledAt: new Date(MORNING.getTime() + 86_400_000) },
      })
    }

    await clearDigests()
    const out = await digestUnbookedApplicants(prisma, MORNING)
    expect(out.summaryAr).toContain('لا متقدّمَ تأخّر')
    expect(out.done + out.failed, 'عملت الوظيفةُ ولا أحدَ ينتظر').toBe(0)
    expect(await digestsOf(reviewerId)).toEqual([])
    await applicantUntouched()
  })
})
