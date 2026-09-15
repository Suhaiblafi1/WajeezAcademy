/* رابطٌ أُلصق بلقاءٍ قائمٍ يبلغ من يحضره (ي-٤).

   ═══ العطبُ الذي كُتب له ═══

   `addSessionWithMeeting` يولد الجلسةَ ورابطَها معا فيُخبر عنهما برسالةٍ
   واحدة. أمّا **الإلصاقُ على لقاءٍ أُعلن من قبلُ بلا رابط** — وهو ما تفعله
   طريقا الإدارة (`/zoom` و`/zoom/create`) — فكان يقع صامتا تماما: يُفتح
   بابُ الغرفة ولا يعلم به من يحضرها.

   ولم تكن في المنصّة كلِّها رسالةُ «صار للقاء رابط»: تذكيرا اليومِ والساعةِ
   يقولان «رابطُ الانضمام في صفحة الجلسة» ولا يحملانه، ولا يقعان إلّا قبل
   الموعد — فمن جدوَل حضورَه على «لا رابطَ بعد» لا يعلم أنّه صار موجودا.

   ═══ ولمَ بالقاعدة لا بالنصّ ═══

   حارسُ ي-٣ البنيويُّ يثبت أنّ في المعالِج نداءَ إرسال، ولا يعرف **من**
   يبلغه ولا كم. وهنا الجوهرُ في ذلك بعينه: أيبلغ المتعلّمَ والمدرّبَ معا؟
   وهل يُرسَل مرّتان حين يولد اللقاءُ ورابطُه معا؟ فالفحصُ يقرأ الصفوف. */

import { beforeAll, describe, expect, it } from 'vitest'
import type { PrismaClient } from '@prisma/client'
import { setupTestDb, testPrisma } from '../helpers/db'
import { AuthService } from '../../services/auth.service'
import { CohortService } from '../../services/cohort.service'

let prisma: PrismaClient
let auth: AuthService
let cohorts: CohortService
let managerId = ''
let trainerUserId = ''
let profileId = ''
const COURSE = 'C-BIZ-101'
const S = Date.now().toString(36).slice(-5)

beforeAll(async () => {
  await setupTestDb()
  prisma = await testPrisma()
  auth = new AuthService(prisma)
  cohorts = new CohortService(prisma)

  const m = await auth.register(`link-manager-${S}@test.local`, 'Manager#12345', 'مدير أكاديمي')
  managerId = m.userId
  await auth.setRoles(managerId, ['academic_manager'])

  const t = await auth.register(`link-trainer-${S}@test.local`, 'Trainer#12345', 'مدرّبُ اللقاء')
  trainerUserId = t.userId
  await auth.setRoles(trainerUserId, ['trainer'])
  const application = await prisma.trainerApplication.create({
    data: { reference: `TA-LINK-${S}`, fullName: 'مدرّبُ اللقاء', email: `link-trainer-${S}@test.local`, status: 'active', userId: trainerUserId },
  })
  const profile = await prisma.trainerProfile.create({
    data: { userId: trainerUserId, applicationId: application.id },
  })
  profileId = profile.id
}, 240_000)

/** عدّادٌ يفرّق بُرُدَ الاختبار — والعنوانُ لاتينيٌّ لا يحمل اسمَ الشعبة */
let seq = 0

/** شعبةٌ فيها متعلّمٌ مسجَّلٌ ومدرّبٌ مسنَدٌ ولقاءٌ مجدول */
async function cohortWithSession(title: string) {
  seq += 1
  const cohort = await cohorts.create(managerId, {
    courseId: COURSE, title, daysOfWeek: ['tue'], startTime: '18:00', capacity: 20, price: 180,
  })
  await prisma.cohortTrainer.create({ data: { cohortId: cohort.id, profileId } })
  const learner = await auth.register(`link-learner-${S}-${seq}@test.local`, 'Learner#12345', 'متعلّمُ اللقاء')
  await prisma.enrollment.create({ data: { cohortId: cohort.id, userId: learner.userId, status: 'enrolled' } })
  /* وموعدٌ مستقلٌّ لكلّ شعبة: المدرّبُ واحدٌ في هذا الملفّ، وحارسُ تعارضِ
     الجدول في المنصّة يردّ لقاءَين له في ساعةٍ واحدة — وهو على حقّ. */
  const session = await cohorts.addSession(managerId, cohort.id, {
    title: 'اللقاءُ الأوّل', startsAt: new Date(Date.UTC(2026, 9, 6 + seq, 18, 0, 0)),
  })
  return { cohort, session, learnerId: learner.userId }
}

const linkedFor = (userId: string, key: string) =>
  prisma.notification.findFirst({ where: { userId, templateKey: key } })

describe('رابطُ اللقاء يبلغ من يحضره', () => {
  it('الإلصاقُ اليدويُّ يُبلِّغ المتعلّمَ والمدرّبَ — كلًّا بمفتاحه', async () => {
    const { session, learnerId } = await cohortWithSession('شعبةُ الرابط')
    await cohorts.attachManualZoom(managerId, session.id, { joinUrl: 'https://zoom.us/j/900100200' })

    expect(
      await linkedFor(learnerId, 'cohort.meeting.linked'),
      'أُلصق الرابطُ ولم يُخبَر من يحضر اللقاء',
    ).not.toBeNull()
    expect(
      await linkedFor(trainerUserId, 'cohort.meeting.linked.trainer'),
      'أُلصق الرابطُ ولم يُخبَر مدرّبُ الشعبة',
    ).not.toBeNull()

    /* ولا يُخلَط المفتاحان: «موعدٌ له» غيرُ «موعدٍ عليه»، وصنفاهما يفترقان
       في الكتم — فمفتاحُ المدرّب لا يصل المتعلّمَ ولا العكس. */
    expect(
      await linkedFor(learnerId, 'cohort.meeting.linked.trainer'),
      'وصل مفتاحُ المدرّب إلى المتعلّم',
    ).toBeNull()
  })

  /* ═══ ولا يُرسَل مرّتان عن شيءٍ واحد ═══

     `addSessionWithMeeting` يُبلّغ بنفسه بعد أن يُلصق الرابط، فيمرّر
     `announce = false` كي لا يقول «لقاءٌ جديدٌ ورابطُه» ثمّ «صار للقاء رابط».

     والفحصُ على **الرايةِ نفسِها** من الباب اليدويّ لا من باب الواجهة:
     مسارُ الواجهة يحتاج مفاتيحَ Zoom حقيقيّةً لا وجودَ لها في الاختبار،
     فيسقط قبل أن يبلغ الراية — وفحصٌ لا يبلغ ما يدّعي فحصَه أسوأُ من لا
     فحص. والرايةُ واحدةٌ في الطريقَين، فمن نقضها نقضهما. */
  it('ورايةُ عدم التكرار تمنع البلاغَ حين يُبلّغ المُنادي بنفسه', async () => {
    const { session, learnerId } = await cohortWithSession('شعبةُ الراية')
    await cohorts.attachManualZoom(
      managerId, session.id, { joinUrl: 'https://zoom.us/j/900100300' }, false,
    )
    expect(
      await linkedFor(learnerId, 'cohort.meeting.linked'),
      'أُرسل البلاغُ رغم أنّ المُنادي قال إنّه يُبلّغ بنفسه — فتصل رسالتان عن شيءٍ واحد',
    ).toBeNull()
  })

  it('ولقاءٌ وُلد بلا اجتماعٍ يُخبَر عنه مرّةً واحدةً بمفتاح اللقاء الجديد', async () => {
    const cohort = await cohorts.create(managerId, {
      courseId: COURSE, title: 'شعبةُ الولادة', daysOfWeek: ['tue'], startTime: '18:00', capacity: 20, price: 180,
    })
    const learner = await auth.register(`link-born-${S}@test.local`, 'Learner#12345', 'متعلّمُ الولادة')
    await prisma.enrollment.create({ data: { cohortId: cohort.id, userId: learner.userId, status: 'enrolled' } })

    await cohorts.addSessionWithMeeting(managerId, cohort.id, {
      title: 'لقاءٌ بلا اجتماع', startsAt: new Date('2026-10-13T18:00:00Z'),
    })

    expect(
      await linkedFor(learner.userId, 'cohort.session.scheduled'),
      'لم يُخبَر بلقاءٍ جديدٍ أصلا',
    ).not.toBeNull()
    expect(
      await linkedFor(learner.userId, 'cohort.meeting.linked'),
      'لقاءٌ بلا رابطٍ وصل عنه خبرُ «صار له رابط»',
    ).toBeNull()
  })
})
