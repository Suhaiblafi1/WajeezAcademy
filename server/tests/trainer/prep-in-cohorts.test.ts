/* شعبةُ الإعداد — طورُ الموادّ في «شعبي» (٢ أكتوبر ٢٠٢٦).

   قرارُ صاحب المنصّة: لا يكتب المدرّبُ موادَّه مرّتين. يقبل الدورةَ في
   «مؤهّلاتي»، فتُنشأ لها شعبةُ إعدادٍ في «شعبي» يعبّئها مرّةً واحدة، واعتمادُ
   خطّتها يعتمد الدورة، واعتمادُ دوراته كلِّها يفعّله. وما يُقاس هنا على صفوف
   القاعدة:

   ① القبولُ ينشئ شعبةً **مسوّدةً** باسم دورتها هو قائدُها — والتأهيلُ باقٍ
      معلَّقا، والقبولُ الثاني لا يُنشئ ثانية. وورشتُها تُفتح له وهو في الطور.
   ② وما كتبه في اللوح القديم يُنقل إليها: محاورُه ورابطُه ومصادرُه ومهمّتُه.
   ③ والاعتذارُ يُخرج الدورةَ بسببها، ويُلغي شعبةَ إعدادٍ قامت لها.
   ④ وإرسالُ آخرِ خطّةٍ يُعلن اكتمالَ موادّه (تتجمّد مهلتُه)، والردُّ يُعيدها.
   ⑤ واعتمادُ الخطّة يعتمد الدورة، واعتمادُ آخرها يفعّله ويوقّع عقدَه — وما
      دام له دورةٌ تنتظر لا يُفعَّل. */

import { beforeAll, describe, expect, it } from 'vitest'
import { createHash } from 'node:crypto'
import type { PrismaClient } from '@prisma/client'
import { setupTestDb, testPrisma } from '../helpers/db'
import { AuthService } from '../../services/auth.service'
import { TrainerReviewService } from '../../services/trainer-review.service'
import { TrainerPrepService, DECLINED_NOTE_PREFIX } from '../../services/trainer-prep.service'
import { CohortPlanService } from '../../services/cohort-plan.service'
import { contractAcks, CONDITION_CLAUSE_MARK } from '../../../src/application/trainer/contract-body'

let prisma: PrismaClient
let auth: AuthService
let review: TrainerReviewService
let prep: TrainerPrepService
let plans: CohortPlanService
let adminId = ''

const sha256 = (s: string) => createHash('sha256').update(s).digest('hex')
const BODY = `نصُّ اتفاقيّةٍ للاختبار — البند 1 وما بعده.
${CONDITION_CLAUSE_MARK} لا عقد نهائي. ونفاذه معلق على قبول الأكاديمية لمواد المدرب.`
const C1 = 'C-PREPC-101'
const C2 = 'C-PREPC-202'

beforeAll(async () => {
  await setupTestDb()
  prisma = await testPrisma()
  auth = new AuthService(prisma)
  review = new TrainerReviewService(prisma)
  prep = new TrainerPrepService(prisma)
  plans = new CohortPlanService(prisma)
  const admin = await auth.register('prepc-admin@test.local', 'Admin#12345', 'المدير الأكاديمي')
  adminId = admin.userId
  await auth.setRoles(adminId, ['academic_manager'])
  for (const [id, t] of [[C1, 'دورةُ الإعداد'], [C2, 'دورةٌ ثانيةٌ للإعداد']] as const) {
    await prisma.course.create({ data: { id, status: 'published', currentVersion: 1 } })
    await prisma.courseVersion.create({ data: { courseId: id, version: 1, titleAr: t, totalHours: 10 } })
    for (const n of [1, 2]) {
      await prisma.courseModule.create({ data: { id: `${id}-M${n}`, courseId: id, createdAt: new Date(Date.UTC(2026, 0, n)) } })
      await prisma.courseModuleVersion.create({
        data: { moduleId: `${id}-M${n}`, version: 1, sequence: n, hours: 2, titleAr: `محورُ الكتالوج ${n}`, outcomeAr: `مخرجُ الكتالوج ${n}` },
      })
    }
  }
}, 240_000)

let seq = 0

/** مدرّبٌ في طور الموادّ: وقّع واعتُمد توقيعُه، ودوراتُه معلَّقة */
async function onboarding(courses: string[] = [C1]) {
  seq += 1
  const email = `prepc-${seq}-${Date.now()}@test.local`
  const user = await auth.register(email, 'Trainer#12345', `مرشّحٌ ${seq}`)
  await auth.setRoles(user.userId, ['trainer_applicant'])
  const application = await prisma.trainerApplication.create({
    data: {
      reference: `TR-PREPC-${Date.now()}-${seq}`, fullName: `مرشّحٌ ${seq}`, email,
      status: 'conditionally_approved', motivation: 'اختبار', privacyConsentAt: new Date(), userId: user.userId,
    },
  })
  const profile = await prisma.trainerProfile.create({ data: { applicationId: application.id, isVerified: true } })
  for (const courseId of courses) {
    await prisma.trainerCourseQualification.create({ data: { profileId: profile.id, courseId, status: 'pending' } })
  }
  await prisma.trainerCompensationRule.create({
    data: { profileId: profile.id, type: 'per_seat', rate: 25, currency: 'USD', minSeats: 0 },
  })
  const contract = await prisma.trainerContract.create({
    data: {
      profileId: profile.id, title: `عقدُ ${seq}`, status: 'draft',
      bodyVersion: 'v-test', bodyAr: BODY, bodyHash: sha256(BODY),
      requiredDocuments: [], signerEmail: email, gatesActivation: true,
    },
  })
  const sent = await review.sendContract(contract.id, adminId)
  await review.signContractByToken(decodeURIComponent(sent.signingUrl.split('/c/')[1]), {
    legalName: 'الاسمُ القانونيُّ الكامل', addressAr: 'عمّان — بناية ١٢',
    phone: '+962790000000', bodyHash: sha256(BODY), acks: contractAcks(true).map((a) => a.key),
  })
  await review.approveSignature(contract.id, adminId)
  return { applicationId: application.id, profileId: profile.id, contractId: contract.id, userId: user.userId }
}

/** خطّةٌ مرسَلةٌ للاعتماد — اختصارُ ستِّ خطواتٍ لا تفحصها هذه الجولة */
async function submitted(cohortId: string, trainerId: string) {
  return prisma.cohortDeliveryPlan.create({
    data: { cohortId, trainerId, status: 'submitted', submittedAt: new Date(), content: { kind: 'trainer', modules: [], resources: [] } },
  })
}

describe('شعبةُ الإعداد', () => {
  it('① القبولُ ينشئ مسوّدةً باسم دورتها هو قائدُها — مرّةً واحدة، وورشتُها له', async () => {
    const t = await onboarding()
    const app = await prisma.trainerApplication.findUniqueOrThrow({ where: { id: t.applicationId } })
    expect(app.status).toBe('onboarding')

    const made = await prep.accept(t.userId, C1)
    const cohort = await prisma.cohort.findUniqueOrThrow({ where: { id: made.id }, include: { trainers: true } })
    expect(cohort.status).toBe('draft')
    expect(cohort.title).toMatch(/^دورةُ الإعداد — شعبة [١-٩][٠-٩]*$/)
    expect(cohort.trainers).toMatchObject([{ profileId: t.profileId, role: 'lead' }])
    const qual = await prisma.trainerCourseQualification.findFirstOrThrow({ where: { profileId: t.profileId, courseId: C1 } })
    expect(qual.status, 'القبولُ لا يؤهّل — الاعتمادُ يؤهّل').toBe('pending')

    const again = await prep.accept(t.userId, C1)
    expect(again.id).toBe(made.id)
    expect(await prisma.cohortTrainer.count({ where: { profileId: t.profileId } })).toBe(1)

    await expect(plans.workspace(t.userId, made.id)).resolves.toBeTruthy()
    expect((await prep.mine(t.userId))[0]).toMatchObject({ courseId: C1, state: 'preparing', cohortId: made.id })
  })

  it('② وما كتبه في اللوح القديم يُنقل إليها', async () => {
    const t = await onboarding()
    await prisma.trainerCourseQualification.updateMany({
      where: { profileId: t.profileId, courseId: C1 },
      data: {
        materialsAt: new Date(),
        materials: {
          modules: [{ titleAr: 'محورٌ كتبتُه', outcomeAr: 'يستطيع كذا' }],
          materialsUrl: 'https://drive.example.com/mine',
          taskAr: 'مشروعٌ يسلّمه المتعلّم', sourcesAr: 'كتابُ الإقناع https://example.com/book\nمقالٌ بلا رابط', noteAr: '',
        },
      },
    })
    const made = await prep.accept(t.userId, C1)
    const plan = await prisma.cohortDeliveryPlan.findFirstOrThrow({ where: { cohortId: made.id, trainerId: { not: null } } })
    const content = plan.content as { modules: { titleAr: string }[]; resources: { title: string; url: string | null }[]; workbook?: { url: string } }
    /* المحورُ الأوّلُ أخذ ما كتبه، والثاني بقي من الكتالوج — بموضعه لا بإلحاقه */
    expect(content.modules.map((x) => x.titleAr)).toEqual(['محورٌ كتبتُه', 'محورُ الكتالوج 2'])
    expect(content.workbook?.url).toBe('https://drive.example.com/mine')
    expect(content.resources).toEqual(expect.arrayContaining([
      expect.objectContaining({ url: 'https://example.com/book' }),
      expect.objectContaining({ title: 'مقالٌ بلا رابط', url: null }),
    ]))
    const task = await prisma.cohortAssessment.findFirst({ where: { cohortId: made.id, type: 'project' } })
    expect(task?.briefAr).toBe('مشروعٌ يسلّمه المتعلّم')
  })

  it('③ والاعتذارُ يُخرج الدورةَ بسببها ويُلغي شعبتَها', async () => {
    const t = await onboarding([C1, C2])
    const made = await prep.accept(t.userId, C2)
    await prep.decline(t.userId, C2, 'لا أدرّسها هذا الفصل')
    const qual = await prisma.trainerCourseQualification.findFirstOrThrow({ where: { profileId: t.profileId, courseId: C2 } })
    expect(qual.status).toBe('retired')
    expect(qual.note).toBe(`${DECLINED_NOTE_PREFIX}لا أدرّسها هذا الفصل`)
    expect((await prisma.cohort.findUniqueOrThrow({ where: { id: made.id } })).status).toBe('cancelled')
    const states = Object.fromEntries((await prep.mine(t.userId)).map((c) => [c.courseId, c.state]))
    expect(states).toEqual({ [C1]: 'to_decide', [C2]: 'declined' })
  })

  it('④ إرسالُ آخر خطّةٍ يجمّد المهلة، والردُّ يُعيدها', async () => {
    const t = await onboarding()
    const made = await prep.accept(t.userId, C1)
    const plan = await submitted(made.id, t.profileId)
    await prep.afterSubmit(made.id)
    const paused = await prisma.trainerContract.findUniqueOrThrow({ where: { id: t.contractId } })
    expect(paused.conditionPausedAt, 'أُرسلت خطّةُ دورته الوحيدة ولم تتجمّد مهلتُه').not.toBeNull()

    await plans.decide(adminId, plan.id, false, 'المحورُ الثاني بلا مخرج')
    const resumed = await prisma.trainerContract.findUniqueOrThrow({ where: { id: t.contractId } })
    expect(resumed.conditionPausedAt, 'رُدّت خطّتُه وبقيت مهلتُه متجمّدة').toBeNull()
    expect((await prep.mine(t.userId))[0]!.state).toBe('returned')
  })

  it('⑤ اعتمادُ الخطّة يعتمد الدورة، واعتمادُ آخرها يفعّله — لا قبله', async () => {
    const t = await onboarding([C1, C2])
    const one = await prep.accept(t.userId, C1)
    const two = await prep.accept(t.userId, C2)

    const p1 = await submitted(one.id, t.profileId)
    const r1 = await plans.decide(adminId, p1.id, true)
    expect((await prisma.trainerCourseQualification.findFirstOrThrow({ where: { profileId: t.profileId, courseId: C1 } })).status)
      .toBe('qualified')
    expect((await prisma.trainerApplication.findUniqueOrThrow({ where: { id: t.applicationId } })).status,
      'فُعِّل ودورتُه الثانيةُ لم تُعتمَد').toBe('onboarding')
    expect(r1).toMatchObject({ status: 'approved', prep: { activated: false, waiting: 1 } })

    /* ولتتجمّد مهلتُه قبل التفعيل كما تتجمّد في الواقع بإرسال آخر خطّة */
    const p2 = await submitted(two.id, t.profileId)
    await prep.afterSubmit(two.id)
    const r2 = await plans.decide(adminId, p2.id, true)
    expect(r2).toMatchObject({ status: 'approved', prep: { activated: true } })
    expect((await prisma.trainerApplication.findUniqueOrThrow({ where: { id: t.applicationId } })).status).toBe('active')
    const contract = await prisma.trainerContract.findUniqueOrThrow({ where: { id: t.contractId } })
    expect(contract.status, 'فُعِّل ولم يُوقَّع عقدُه من جهتنا').toBe('countersigned')
    expect(contract.conditionMetAt).not.toBeNull()
  })
})
