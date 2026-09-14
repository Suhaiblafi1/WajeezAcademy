/* الحذفُ يبلغ ملفَّ المدرّب — والحارسُ صار على ما بيد متعلّم.

   ═══ ما كان ولماذا زال ═══

   كان `purge` يردّ بـ`has_profile`: «صاحبُ هذا الطلب صار مدرّبا — لا يُحذف
   طلبُه». وعلّتُه أنّ من تعاقدنا معه له تاريخٌ لا يُمحى بضغطة.

   وقال صاحبُ المنصّة (١٤ سبتمبر ٢٠٢٦): «أبلغك أنّنا لم نتعاقد مع أحدٍ إطلاقا،
   وأوّلُ شخصٍ حقيقيٍّ هي المدرّبةُ الأولى. فاسمح لي أن أحذف أيَّ شخصٍ آخرَ
   أبديّا وإلغاءِ كلِّ شيءٍ يتعلّق بحسابه — وهذا قراري أتحمّل مسؤوليّته».

   فالعلّةُ كانت افتراضا عن البيانات، والافتراضُ خاطئ.

   ═══ وما يُحرَس الآن ═══

   ١) **الملفُّ يذهب وأبناؤه معه** — تأهيلاتٌ وإسنادٌ ورموزُ إحالةٍ وقواعدُ
      مستحقّات، كلُّها `Cascade`. ولا يبقى ملفٌّ بلا طلبٍ ولا العكس.
   ٢) **و`CohortTrainer` تُحذف بيدٍ**: مرجعٌ لازمٌ بلا `onDelete`، أي
      `Restrict` — فلولا حذفُها لسقطت المعاملةُ برسالةِ قاعدةٍ لا تدلّ على
      سببها. وهذا أخطرُ ما في البند: يمرّ في مراجعةٍ ولا يظهر إلّا على
      مدرّبٍ أُسنِد فعلا.
   ٣) **وشهادةٌ صادرةٌ توقِف الحذف**: رقمُها معلَنٌ ويُتحقَّق منه برابط، وهي
      دعوى إنسانٍ ثالثٍ لا سجلُّنا عن المدرّب.
   ٤) **والحسابُ يذهب معه** — ودورُ «مدرّب» لم يعد يُبقيه، وإلّا بقي حسابٌ
      يتيمٌ بدورٍ لا ملفَّ خلفه. */

import { beforeAll, describe, expect, it } from 'vitest'
import type { PrismaClient } from '@prisma/client'
import { setupTestDb, testPrisma } from '../helpers/db'
import { TrainerApplicationService } from '../../services/trainer-application.service'
import { TrainerReviewService } from '../../services/trainer-review.service'
import { PURGEABLE_STATUSES } from '../../../src/application/trainer/purgeable'

let prisma: PrismaClient
let apps: TrainerApplicationService
let review: TrainerReviewService
const ACTOR = '00000000-0000-0000-0000-0000000000b1'

beforeAll(async () => {
  await setupTestDb()
  prisma = await testPrisma()
  apps = new TrainerApplicationService(prisma)
  review = new TrainerReviewService(prisma)
}, 240_000)

/** شعبةٌ تُنشأ لهذا الفحص — قاعدةُ الاختبار تحمل الكتالوجَ لا شعبا */
async function makeCohort(tag: string) {
  return prisma.cohort.create({
    data: {
      courseId: 'C-BIZ-101', title: `شعبةُ ${tag}`, status: 'active',
      capacity: 20, price: 100, currency: 'USD', financialReady: true,
      startsAt: new Date(Date.now() - 30 * 86_400_000),
    },
  })
}

/** مدرّبٌ معتمَدٌ كاملٌ: طلبٌ نشطٌ وملفٌّ وحسابٌ ودورٌ */
async function makeTrainer(tag: string) {
  const made = await review.createTrainerDirectly(ACTOR, {
    fullName: `مدرّبُ ${tag}`, email: `${tag}@purge.test.local`,
  })
  return made
}

describe('الحالاتُ التي تُحذف', () => {
  it('حالاتُ المدرّب المعتمَد صارت منها — ولا طريقَ لها إلى حالةٍ منتهية', () => {
    /* `active` تصل إلى `suspended` وحدَها و`suspended` تعود إليها. فلو بقيت
       خارج القائمة لكان معناها «لا حذفَ أبدا» لا «حذفا بعد رفض». */
    for (const s of ['active', 'onboarding', 'suspended']) {
      expect(PURGEABLE_STATUSES as readonly string[], `${s} غيرُ قابلٍ للحذف`).toContain(s)
    }
  })
})

describe('الحذفُ يبلغ الملفَّ والحساب', () => {
  it('⚠️ مدرّبٌ معتمَدٌ يُحذف: طلبُه وملفُّه وحسابُه', async () => {
    const t = await makeTrainer('kamil')
    const res = await apps.purge(t.reference, ACTOR, 'طلبُ تجربةٍ أنشأتُه بنفسي')

    expect(res.reference).toBe(t.reference)
    expect(await prisma.trainerApplication.findUnique({ where: { id: t.applicationId } })).toBeNull()
    expect(await prisma.trainerProfile.findUnique({ where: { id: t.profileId } })).toBeNull()
    expect(res.deletedAccount, `بقي الحساب: ${res.keptAccountReason}`).toBe(true)
    expect(await prisma.user.findUnique({ where: { id: t.userId } })).toBeNull()
  })

  it('وأبناءُ الملفّ يذهبون معه — لا تأهيلَ يتيمٌ ولا رمزُ إحالة', async () => {
    const t = await makeTrainer('abnaa')
    const course = await prisma.course.findFirst({ select: { id: true } })
    await review.qualifyForCourse(t.profileId, course!.id, ACTOR)
    await prisma.trainerReferralLink.create({
      data: { profileId: t.profileId, code: `REF-${Date.now()}` },
    })

    await apps.purge(t.reference, ACTOR, 'طلبُ تجربةٍ أنشأتُه بنفسي')

    expect(await prisma.trainerCourseQualification.count({ where: { profileId: t.profileId } })).toBe(0)
    expect(await prisma.trainerReferralLink.count({ where: { profileId: t.profileId } })).toBe(0)
  })

  it('⚠️ ومُسنَدٌ إلى شعبةٍ يُحذف — و`CohortTrainer` مرجعٌ لازمٌ يوقف القاعدة لولا حذفُه', async () => {
    const t = await makeTrainer('musnad')
    const cohort = await makeCohort('الإسناد')
    await prisma.cohortTrainer.create({ data: { cohortId: cohort.id, profileId: t.profileId } })

    await apps.purge(t.reference, ACTOR, 'طلبُ تجربةٍ أنشأتُه بنفسي')

    expect(await prisma.trainerProfile.findUnique({ where: { id: t.profileId } })).toBeNull()
    expect(await prisma.cohortTrainer.count({ where: { profileId: t.profileId } })).toBe(0)
    /* والشعبةُ نفسُها تبقى: حُذف المدرّبُ لا ما يُدرَّس */
    expect(await prisma.cohort.findUnique({ where: { id: cohort.id } })).not.toBeNull()
  })
})

describe('وما بيد متعلّمٍ يوقفه', () => {
  it('⚠️ شهادةٌ صادرةٌ في شعبةٍ يقودها: يُردّ ولا يُحذف شيء', async () => {
    const t = await makeTrainer('shahada')
    const cohort = await makeCohort('الشهادة')
    await prisma.cohortTrainer.create({ data: { cohortId: cohort.id, profileId: t.profileId } })

    const learner = await prisma.user.create({
      data: { email: `learner-${Date.now()}@purge.test.local`, displayName: 'متعلّمٌ له شهادة', passwordHash: 'x' },
    })
    const enrollment = await prisma.enrollment.create({
      data: { cohortId: cohort.id, userId: learner.id, status: 'completed' },
    })
    await prisma.certificate.create({
      data: {
        number: `WJ-CERT-TEST-${Date.now()}`, enrollmentId: enrollment.id,
        learnerName: 'متعلّمٌ له شهادة', courseId: cohort.courseId, courseVersion: 1,
      },
    })

    await expect(
      apps.purge(t.reference, ACTOR, 'طلبُ تجربةٍ أنشأتُه بنفسي'),
    ).rejects.toThrow(/شهادة/)

    /* ولا نصفَ حذف: الطلبُ والملفُّ قائمان كما كانا */
    expect(await prisma.trainerApplication.findUnique({ where: { id: t.applicationId } })).not.toBeNull()
    expect(await prisma.trainerProfile.findUnique({ where: { id: t.profileId } })).not.toBeNull()
  })
})
