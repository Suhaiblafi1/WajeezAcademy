/* «طلبُ تأهيل» أم «دورةٌ يعدّها» — على قاعدةٍ حقيقيّة (١٣ أكتوبر ٢٠٢٦).

   سأل صاحبُ المنصّة عن ٥٥ بطاقةً تحت «طلبات التأهيل المعلّقة» أكثرُها «من طلب
   الانضمام»، فاختار أن تُفصلا (`src/application/trainer/pending-kind.ts`).
   وهذا يحرس الخادمَ في موضعيه:

   ① الطابورُ يَسِم كلَّ صفٍّ بنوعه — والدورةُ التي يعدّها تحمل حالَ إعدادها.
   ② وملفُّ المدرّب لا يعدّ الدورةَ التي يعدّها «طلبَ تأهيل».
   والشاشةُ في `src/tests/trainer/pending-kind.test.ts`. */

import { beforeAll, describe, expect as vexpect, it } from 'vitest'
import { plainExpect } from '../helpers/plain-expect'
const expect = plainExpect(vexpect)
import type { PrismaClient } from '@prisma/client'
import { setupTestDb, testPrisma } from '../helpers/db'
import { AuthService } from '../../services/auth.service'
import { TrainerReviewService } from '../../services/trainer-review.service'

let prisma: PrismaClient
let review: TrainerReviewService
let applicationId = ''
let profileId = ''
let opsId = ''

const PREPARING = 'C-BIZ-101'  // قال في طلبه إنّه يدرّسها
const REQUESTED = 'C-BIZ-103'  // طلبها من يجدول شعبتها
const DAY = 86_400_000

beforeAll(async () => {
  await setupTestDb()
  prisma = await testPrisma()
  const auth = new AuthService(prisma)
  review = new TrainerReviewService(prisma)

  const ops = await auth.register('pk-ops@test.local', 'Ops#12345', 'مدير العمليات')
  opsId = ops.userId
  await auth.setRoles(opsId, ['operations_manager'])

  const user = await auth.register('pk-trainer@test.local', 'Trainer#12345', 'مدرّب النوعين')
  await auth.setRoles(user.userId, ['trainer'])
  const app = await prisma.trainerApplication.create({
    data: {
      reference: `TR-PK-${Date.now()}`, fullName: 'مدرّب النوعين', email: 'pk-trainer@test.local',
      status: 'active', motivation: 'اختبار', privacyConsentAt: new Date(),
      teachableCourseIds: [PREPARING],
    },
  })
  applicationId = app.id
  profileId = (await prisma.trainerProfile.create({
    data: { applicationId, userId: user.userId, isVerified: true },
  })).id

  /* الأولى كما تُبذَر فعلا من طلبه، والثانيةُ طلبٌ من شعبتها */
  await review.syncQualificationsFromApplication(profileId, null)
  const startsAt = new Date(Date.now() + 40 * DAY)
  const cohort = await prisma.cohort.create({
    data: {
      courseId: REQUESTED, title: 'شعبة الطلب', status: 'open', registrationOpen: true,
      financialReady: true, price: 100, currency: 'USD', capacity: 10, startsAt,
    },
  })
  await prisma.cohortSession.create({
    data: { cohortId: cohort.id, title: 'جلسة', startsAt, endsAt: new Date(startsAt.getTime() + 3_600_000) },
  })
  await review.requestQualification(profileId, REQUESTED, cohort.id, opsId)
}, 240_000)

describe('① الطابورُ يَسِم كلَّ صفٍّ بنوعه', () => {
  it('⚠️ المبذورةُ من طلبه «دورةٌ يعدّها» بحال إعدادها — والمطلوبةُ من شعبتها «طلب»', async () => {
    const mine = (await review.pendingQualifications()).filter((r) => r.profileId === profileId)
    const prep = mine.find((r) => r.courseId === PREPARING)
    const ask = mine.find((r) => r.courseId === REQUESTED)

    expect(prep?.kind, 'دورةٌ يعدّها تُقرأ طلبا — فيُبتّ فيها قبل خطّتها').toBe('preparing')
    expect(prep?.prep?.state, 'بلا حال إعداد — فلا تقول الشاشةُ أين هي').toBe('to_decide')
    expect(prep?.prep?.cohortId).toBeNull()

    expect(ask?.kind).toBe('request')
    expect(ask?.prep, 'الطلبُ لا حالَ إعدادٍ له').toBeNull()
    expect(ask?.requestedCohort?.title).toBe('شعبة الطلب')
  })
})

describe('② وملفُّ المدرّب لا يعدّها طلبا', () => {
  it('⚠️ طلبٌ واحدٌ بانتظار القرار، ودورةٌ واحدةٌ قيد الإعداد', async () => {
    const { summary } = await review.getApplication(applicationId)
    expect(summary.pendingQualifications).toBe(1)
    expect(summary.preparingCourses).toBe(1)
  })
})
