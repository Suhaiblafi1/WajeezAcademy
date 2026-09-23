/* التأهيلُ يصحّ قبل التفعيل، والإسنادُ لا — وهذا صلبُ عقد المدرّب.

   ═══ العطبُ الذي كُشف ═══

   طُلب أن يحمل العقدُ «الدوراتِ التي أهّلناها له»، وأن يُرسَل بعد القبول
   المشروط. وعلى ذلك المسار بعينه كان الملحقُ (أ) يخرج **خاليا دائما**، لسببين
   متراكبين لا واحد:

   ① `decide('conditionally_approve')` تُنشئ الملفَّ ولا تبذر مؤهّلا —
      البذرُ كان في `approve`/`activate` وحدَهما.
   ② ولا يستطيع المسؤولُ تداركَه بيده: `qualifyForCourse` كانت تبدأ بـ
      `requireActiveProfile` التي تشترط `active`.

   فالبندُ الذي يقوم عليه العقدُ كلُّه كان سيُطبَع تحته جدولٌ فارغ.

   ═══ والتخفيفُ له سقفٌ يُحرَس ═══

   شقُّ الحارس بابٌ يُفتح، ولكلّ بابٍ مفتوحٍ احتمالُ أن يُدخَل منه ما لا
   يُراد. فيُقاس هنا الطرفان معا:

   · **ما فُتح**: التأهيلُ من `conditionally_approved` فصاعدا.
   · **وما بقي مغلقا**: الإسنادُ لا يقع إلّا على `active` — في الخدمتين
     كلتيهما. فلو سقط هذا لصار التخفيفُ بابا خلفيّا حول «مؤهَّلٌ ≠ مُسنَدٌ
     إليه»، وهو البندُ الثاني من العقد بعينه.
   · **وأرضيّةٌ تحته**: من لم يُقبل بعد (`draft`) لا يُؤهَّل — وإلّا لم يكن
     ثمّة حارسٌ أصلا، بل حذفٌ له. */

import { beforeAll, describe, expect, it } from 'vitest'
import type { PrismaClient } from '@prisma/client'
import { setupTestDb, testPrisma } from '../helpers/db'
import { AuthService } from '../../services/auth.service'
import { TrainerReviewService } from '../../services/trainer-review.service'
import { CohortService } from '../../services/cohort.service'
import { missingAcademyLegalFields } from '../../../src/data/academy-legal'

let prisma: PrismaClient
let auth: AuthService
let review: TrainerReviewService
let cohorts: CohortService

let academicId = ''
/** مرشّحٌ قُبل قبولا مشروطا — الطورُ الذي يُرسَل منه العقد */
let pendingAppId = ''
let pendingProfileId = ''
/** مدرّبٌ نشطٌ — لقياس `gatesActivation` على الطرف الآخر */
let activeAppId = ''

const COURSE = 'C-BIZ-101'
const DAY = 86_400_000

beforeAll(async () => {
  await setupTestDb()
  prisma = await testPrisma()
  auth = new AuthService(prisma)
  review = new TrainerReviewService(prisma)
  cohorts = new CohortService(prisma)

  const academic = await auth.register('qba-academic@test.local', 'Acad#12345', 'المدير الأكاديمي')
  academicId = academic.userId
  await auth.setRoles(academicId, ['academic_manager'])

  /* ويحمل `teachableCourseIds` — فهو ما يُبذَر عند القبول المشروط */
  const app = await prisma.trainerApplication.create({
    data: {
      reference: `TR-QBA-${Date.now()}`, fullName: 'مرشّحُ العقد', email: 'qba-cand@test.local',
      status: 'academic_review', motivation: 'اختبار', privacyConsentAt: new Date(),
      teachableCourseIds: [COURSE],
    },
  })
  pendingAppId = app.id
  await review.decide(pendingAppId, academicId, 'conditionally_approve')
  pendingProfileId = (await prisma.trainerProfile.findUniqueOrThrow({ where: { applicationId: pendingAppId } })).id

  const act = await prisma.trainerApplication.create({
    data: {
      reference: `TR-QBA-ACT-${Date.now()}`, fullName: 'مدرّبٌ نشط', email: 'qba-active@test.local',
      status: 'active', motivation: 'اختبار', privacyConsentAt: new Date(),
    },
  })
  activeAppId = act.id
  await prisma.trainerProfile.create({ data: { applicationId: act.id, isVerified: true } })
}, 240_000)

describe('القبولُ المشروطُ يبذر المؤهّلات — وإلّا خرج الملحقُ (أ) خاليا', () => {
  it('دوراتُ الطلب تصير تأهيلا قائما لحظةَ القبول المشروط', async () => {
    /* و«اخترناها له» (`pending`) هي ما يُطبَع في الملحق (أ) من العرض
       المشروط — ولا `qualified` بعد، إذ لم تُقيَّم موادُّه (§٥). */
    const rows = await prisma.trainerCourseQualification.findMany({
      where: { profileId: pendingProfileId, status: 'pending' },
      select: { courseId: true },
    })
    expect(rows.map((r) => r.courseId), 'لم يُبذَر شيءٌ عند القبول المشروط').toContain(COURSE)
    const approved = await prisma.trainerCourseQualification.count({
      where: { profileId: pendingProfileId, status: 'qualified' },
    })
    expect(approved, 'قُبلت موادُّه ولم تُقدَّم بعد').toBe(0)
  })
})

describe('ما فُتح: التأهيلُ قبل التفعيل', () => {
  it('يُؤهَّل مرشّحٌ في `conditionally_approved` — وكان يُردّ', async () => {
    const other = 'C-DAT-101'
    const q = await review.qualifyForCourse(pendingProfileId, other, academicId)
    expect(q.status).toBe('qualified')
  })

  it('ويُؤهَّل في `contract_pending` كذلك — وهو طورُ انتظار التوقيع', async () => {
    await prisma.trainerApplication.update({
      where: { id: pendingAppId }, data: { status: 'contract_pending' },
    })
    const q = await review.qualifyForCourse(pendingProfileId, 'C-MKT-101', academicId)
    expect(q.status).toBe('qualified')
    await prisma.trainerApplication.update({
      where: { id: pendingAppId }, data: { status: 'conditionally_approved' },
    })
  })
})

describe('وما بقي مغلقا: الإسنادُ لا يقع إلّا على نشط', () => {
  /** شعبةٌ حقيقيّةٌ — فالإسنادُ يُقاس على مسارِه لا على استثناءٍ مبكّر */
  async function mkCohort(title: string) {
    return prisma.cohort.create({
      data: {
        courseId: COURSE, title, status: 'open', registrationOpen: true,
        financialReady: true, price: 100, currency: 'USD', capacity: 10,
        startsAt: new Date(Date.now() + 30 * DAY),
      },
    })
  }

  it('`assignToCohort` تردُّ المرشّحَ المؤهَّلَ غيرَ النشط', async () => {
    const c = await mkCohort('شعبةُ الردّ أ')
    await expect(review.assignToCohort(pendingProfileId, COURSE, c.id, academicId))
      .rejects.toMatchObject({ code: 'not_active' })
  })

  it('و`CohortService.assignTrainer` تردُّه كذلك — فلا بابَ ثانٍ يلتفّ حوله', async () => {
    const c = await mkCohort('شعبةُ الردّ ب')
    await expect(cohorts.assignTrainer(c.id, pendingProfileId, academicId, 'lead'))
      .rejects.toMatchObject({ code: 'not_active' })
  })
})

describe('وأرضيّةٌ تحت التخفيف — لا يُؤهَّل من لم يُقبل بعد', () => {
  it('`draft` يُردّ بـ`not_live` — وإلّا فالحارسُ محذوفٌ لا مشقوق', async () => {
    const draft = await prisma.trainerApplication.create({
      data: {
        reference: `TR-QBA-DR-${Date.now()}`, fullName: 'مسوّدة', email: 'qba-draft@test.local',
        status: 'draft', motivation: 'اختبار', privacyConsentAt: new Date(),
      },
    })
    const p = await prisma.trainerProfile.create({ data: { applicationId: draft.id } })
    await expect(review.qualifyForCourse(p.id, COURSE, academicId))
      .rejects.toMatchObject({ code: 'not_live' })
  })
})

describe('وبوّابةُ التفعيل تُحسب من حالة الطلب لا من رأي', () => {
  it('المرشّحُ يحبس عقدُه تفعيلَه، والنشطُ لا تُمسُّ حالتُه', async () => {
    const forPending = await review.contractPrefill(pendingAppId)
    const forActive = await review.contractPrefill(activeAppId)
    expect(forPending.gatesActivation, 'عقدُ المرشّح لا يحبس شيئا').toBe(true)
    expect(forActive.gatesActivation, 'عقدُ النشطِ يطرده من بوّابته').toBe(false)
  })
})

describe('والمعاينةُ تُخرج ملحقا (أ) عامرا على المسار الذي وُصف', () => {
  const docs = [{ kind: 'national_id', labelAr: 'الهوية الوطنية', required: true }]

  it('متنُ المعاينة يحمل الدورةَ المبذورةَ باسمها', async () => {
    const pre = await review.contractPrefill(pendingAppId)
    const seeded = pre.courses.find((c) => c.courseId === COURSE)
    expect(seeded, 'الدورةُ المبذورةُ لا تصل الشاشة').toBeTruthy()

    const body = await review.previewContract(pendingAppId, {
      title: 'اتفاقية اختبار', requiredDocuments: docs,
    })
    expect(body, 'الملحقُ (أ) خرج بلا اسمِ الدورة').toContain(seeded!.titleAr)
  })

  it('والتركيبُ يُردّ ما دامت هويّةُ الأكاديميّة ناقصة — فلا وثيقةَ بطرفٍ أوّلَ أعرج', async () => {
    /* يُقاس شرطا: ما دام الناقصُ قائما يُردّ، وحين يكتمل لا يُردّ لهذا السبب.
       فيبقى الحارسُ صادقا يومَ تُملأ `academy-legal.ts` ولا يحمرّ كذبا. */
    if (missingAcademyLegalFields().length === 0) return
    await expect(review.composeContract(pendingAppId, academicId, {
      title: 'اتفاقية اختبار', requiredDocuments: docs,
    })).rejects.toMatchObject({ code: 'academy_identity_missing' })
  })
})
