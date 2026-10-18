/* شعبُ التعبئة — لكلّ مدرّبٍ مؤهَّلٍ شعبةٌ مسوّدةٌ وعرضٌ بها (٢ أكتوبر ٢٠٢٦).

   المدرّبُ لا يعبّئ محتوى دورته إلّا في شعبةٍ قبِلها («شعبي»)، والتأهيلُ وحدَه
   لا يصنع شعبة. فـ`prepCohorts` تُنشئ الشعبةَ وتعرضها لما يختاره صاحبُ المنصّة.
   وما يقيسه هذا الملفّ، على صفوف القاعدة لا على نصّ:

   ① المرشَّحُ مدرّبٌ نشطٌ مؤهَّلٌ بلا شعبةٍ له ولا عرضٍ مفتوح — ومن قبِل عرضا
      بلا شعبةٍ مرشَّحٌ أيضا، معلَّمٌ بذلك.
   ② ما يُجهَّز شعبةٌ **مسوّدة** (لا تُعرَض للناس) وعرضٌ **بها** — ثمّ يخرج
      صاحبُه من المرشَّحين فلا يُجهَّز مرّتين.
   ③ شعبةٌ قامت ولم يقم عرضُها تُحذَف — فلا تبقى مسوّدةٌ بلا صاحب.
   ④ والبابُ الإداريُّ للعرض يردّ عرضا بلا شعبة — فلا يُرسَل بعد اليوم عرضٌ
      يقبله المدرّبُ ولا يجد في «شعبي» شيئا.
   ⑤ وكلُّ دورةٍ معلَّمةٌ بموادّها (معتمدة · ناقصة · بلا موادّ)، وقبولُ عرضها ينقل ما اعتُمد
      منها إلى الشعبة — فلا يجدها فارغة (١٨ أكتوبر ٢٠٢٦). */

import { beforeAll, describe, expect, it, vi } from 'vitest'
import { createHash } from 'node:crypto'
import type { PrismaClient } from '@prisma/client'
import type { FastifyInstance } from 'fastify'
import { buildApp } from '../../http/app'
import { SESSION_COOKIE } from '../../http/auth-plugin'
import { setupTestDb, testPrisma } from '../helpers/db'
import { makeReadyForApproval } from '../helpers/trainer-ready'
import { AuthService, AuthError } from '../../services/auth.service'
import { TrainerReviewService } from '../../services/trainer-review.service'
import { TrainerOfferService } from '../../services/trainer-offer.service'

let prisma: PrismaClient
let auth: AuthService
let review: TrainerReviewService
let offers: TrainerOfferService
let adminId = ''
let app: FastifyInstance
let cookie = ''

const sha256 = (s: string) => createHash('sha256').update(s).digest('hex')
const BODY = 'نصُّ اتفاقيّةٍ للاختبار — البند 1 وما بعده.'
const COURSE = 'C-PREP-101'
const COURSE_B = 'C-PREP-202'

beforeAll(async () => {
  await setupTestDb()
  prisma = await testPrisma()
  auth = new AuthService(prisma)
  review = new TrainerReviewService(prisma)
  offers = new TrainerOfferService(prisma)

  const admin = await auth.register('prep-admin@test.local', 'Admin#12345', 'المدير الأكاديمي')
  adminId = admin.userId
  await auth.setRoles(adminId, ['academic_manager'])
  cookie = `${SESSION_COOKIE}=${(await auth.login('prep-admin@test.local', 'Admin#12345')).token}`
  app = await buildApp(prisma)
  await app.ready()

  for (const [id, t] of [[COURSE, 'دورةُ التعبئة'], [COURSE_B, 'دورةٌ ثانية']] as const) {
    await prisma.course.create({ data: { id, status: 'published', currentVersion: 1 } })
    await prisma.courseVersion.create({ data: { courseId: id, version: 1, titleAr: t, totalHours: 10 } })
  }
}, 240_000)

let seq = 0

/** مدرّبٌ نشطٌ مؤهَّلٌ لما يُعطى من دورات */
async function mkActiveTrainer(courseIds: string[]) {
  seq += 1
  const email = `prep-${seq}-${Date.now()}@test.local`
  const user = await auth.register(email, 'Pass#12345', `مدرّبٌ ${seq}`)
  const app = await prisma.trainerApplication.create({
    data: {
      reference: `TR-PREP-${Date.now()}-${seq}`, fullName: `مدرّبٌ ${seq}`, email,
      status: 'contract_pending', motivation: 'اختبار', privacyConsentAt: new Date(), userId: user.userId,
    },
  })
  const profile = await prisma.trainerProfile.create({ data: { applicationId: app.id } })
  await prisma.trainerContract.create({
    data: {
      profileId: profile.id, title: `اتفاقيّةُ اختبارٍ ${seq}`, status: 'signed',
      bodyVersion: 'v-test', bodyAr: BODY, bodyHash: sha256(BODY), signedBodyHash: sha256(BODY),
      signerEmail: email, signerLegalName: `الاسمُ القانونيُّ ${seq}`, signedAt: new Date(), gatesActivation: true,
    },
  })
  for (const courseId of courseIds) {
    await prisma.trainerCourseQualification.create({ data: { profileId: profile.id, courseId, status: 'qualified' } })
  }
  await makeReadyForApproval(prisma, app.id, adminId)
  await review.decide(app.id, adminId, 'approve')
  return { profileId: profile.id, userId: user.userId }
}

const coursesOf = async (profileId: string) =>
  (await offers.prepCandidates()).find((p) => p.profileId === profileId)?.courses ?? []

describe('شعبُ التعبئة', () => {
  it('① المرشَّحُ مدرّبٌ نشطٌ مؤهَّلٌ بلا شعبةٍ ولا عرضٍ مفتوح', async () => {
    const t = await mkActiveTrainer([COURSE, COURSE_B])
    expect((await coursesOf(t.profileId)).map((c) => c.courseId).sort()).toEqual([COURSE, COURSE_B])

    /* عرضٌ مفتوحٌ على إحداهما يُخرجها */
    await offers.offer({ profileId: t.profileId, courseId: COURSE_B }, adminId)
    expect((await coursesOf(t.profileId)).map((c) => c.courseId)).toEqual([COURSE])
  })

  it('① ومن قبِل عرضا بلا شعبةٍ مرشَّحٌ — معلَّمٌ بأنّه لا يجد ما يعبّئه', async () => {
    const t = await mkActiveTrainer([COURSE])
    const o = await offers.offer({ profileId: t.profileId, courseId: COURSE }, adminId)
    await offers.accept(o.id, t.userId)
    const [c] = await coursesOf(t.profileId)
    expect(c).toMatchObject({ courseId: COURSE, acceptedWithoutCohort: true })
  })

  it('② يُنشئ شعبةً مسوّدةً وعرضا بها، ثمّ لا يعود صاحبُها مرشَّحا', async () => {
    const t = await mkActiveTrainer([COURSE])
    const r = await offers.prepCohorts([{ profileId: t.profileId, courseId: COURSE }], {}, adminId)
    expect(r).toMatchObject({ done: 1, failed: 0 })

    const offer = await prisma.trainerAssignmentOffer.findUniqueOrThrow({ where: { id: r.results[0].offerId! } })
    expect(offer).toMatchObject({ profileId: t.profileId, courseId: COURSE, status: 'offered', cohortId: r.results[0].cohortId })
    const cohort = await prisma.cohort.findUniqueOrThrow({ where: { id: r.results[0].cohortId! } })
    expect(cohort).toMatchObject({ courseId: COURSE, status: 'draft' })
    expect(cohort.title).toMatch(/^دورةُ التعبئة — شعبة [١-٩][٠-٩]*$/)

    expect(await coursesOf(t.profileId)).toEqual([])
    /* والتكرارُ يُردّ بسببه، ولا شعبةَ ثانية */
    const again = await offers.prepCohorts([{ profileId: t.profileId, courseId: COURSE }], {}, adminId)
    expect(again).toMatchObject({ done: 0, failed: 1 })
    expect(await prisma.cohort.count({ where: { trainerOffers: { some: { profileId: t.profileId } } } })).toBe(1)
  })

  it('③ شعبةٌ لم يقم عرضُها تُحذَف', async () => {
    const t = await mkActiveTrainer([COURSE_B])
    const before = await prisma.cohort.count({ where: { courseId: COURSE_B } })
    const spy = vi.spyOn(offers, 'offer').mockRejectedValueOnce(new AuthError('busy', 'جدولُه ممتلئ', 409))
    const r = await offers.prepCohorts([{ profileId: t.profileId, courseId: COURSE_B }], {}, adminId)
    spy.mockRestore()
    expect(r).toMatchObject({ done: 0, failed: 1 })
    expect(r.results[0].errorAr).toBe('جدولُه ممتلئ')
    expect(await prisma.cohort.count({ where: { courseId: COURSE_B } })).toBe(before)
  })
})

describe('④ البابُ الإداريّ', () => {
  it('يردّ عرضا بلا شعبةٍ ولا يكتبه — ويقبله بشعبة', async () => {
    const t = await mkActiveTrainer([COURSE])
    const bare = await app.inject({
      method: 'POST', url: '/api/admin/trainer-offers', headers: { cookie },
      payload: { profileId: t.profileId, courseId: COURSE, cohortId: null },
    })
    expect(bare.statusCode).toBe(422)
    expect(await prisma.trainerAssignmentOffer.count({ where: { profileId: t.profileId } })).toBe(0)

    const prep = await app.inject({
      method: 'POST', url: '/api/admin/trainer-offers/prep', headers: { cookie },
      payload: { items: [{ profileId: t.profileId, courseId: COURSE }] },
    })
    expect(prep.statusCode).toBe(200)
    expect(prep.json()).toMatchObject({ done: 1, failed: 0 })
    const o = await prisma.trainerAssignmentOffer.findFirstOrThrow({ where: { profileId: t.profileId } })
    expect(o.cohortId).toBeTruthy()
  })
})

describe('⑤ علامةُ الموادّ — ونقلُها مع العرض', () => {
  const COURSE_C = 'C-PREP-303'
  const FULL = {
    modules: [{ titleAr: 'محورٌ كتبه المدرّب', outcomeAr: 'مخرجٌ كتبه المدرّب' }],
    materialsUrl: 'https://example.com/m', taskAr: 'مشروعٌ يسلّمه المتعلّم', sourcesAr: 'كتابٌ https://example.com/b', noteAr: '',
  }

  it('معتمدة · ناقصة · بلا موادّ — من صفّ التأهيل', async () => {
    const t = await mkActiveTrainer([COURSE, COURSE_B])
    await prisma.trainerCourseQualification.updateMany({ where: { profileId: t.profileId, courseId: COURSE }, data: { materials: FULL } })
    const marks = Object.fromEntries((await coursesOf(t.profileId)).map((c) => [c.courseId, c.materials]))
    expect(marks).toEqual({ [COURSE]: 'complete', [COURSE_B]: 'none' })

    await prisma.trainerCourseQualification.updateMany({
      where: { profileId: t.profileId, courseId: COURSE_B }, data: { materials: { ...FULL, materialsUrl: null } },
    })
    expect((await coursesOf(t.profileId)).find((c) => c.courseId === COURSE_B)?.materials).toBe('partial')
  })

  it('قبولُ العرض ينقل ما اعتُمد من موادّه إلى الشعبة', async () => {
    if (!(await prisma.course.findUnique({ where: { id: COURSE_C } }))) {
      await prisma.course.create({ data: { id: COURSE_C, status: 'published', currentVersion: 1 } })
      await prisma.courseVersion.create({ data: { courseId: COURSE_C, version: 1, titleAr: 'دورةُ النقل مع العرض', totalHours: 10 } })
      await prisma.courseModule.create({ data: { id: `${COURSE_C}-M1`, courseId: COURSE_C } })
      await prisma.courseModuleVersion.create({
        data: { moduleId: `${COURSE_C}-M1`, version: 1, sequence: 1, hours: 2, titleAr: 'محورُ الكتالوج', outcomeAr: 'مخرجُ الكتالوج' },
      })
    }
    const t = await mkActiveTrainer([COURSE_C])
    await prisma.trainerCourseQualification.updateMany({ where: { profileId: t.profileId }, data: { materials: FULL } })
    const r = await offers.prepCohorts([{ profileId: t.profileId, courseId: COURSE_C }], {}, adminId)
    expect(r).toMatchObject({ done: 1, failed: 0 })
    await offers.accept(r.results[0].offerId!, t.userId)

    const plan = await prisma.cohortDeliveryPlan.findFirst({
      where: { cohortId: r.results[0].cohortId!, trainerId: { not: null } }, orderBy: { createdAt: 'desc' },
    })
    expect(plan, 'قبل العرض فوجد شعبته فارغة').not.toBeNull()
    const modules = (plan!.content as { modules: { titleAr: string }[] }).modules
    expect(modules[0].titleAr).toBe('محورٌ كتبه المدرّب')
  })
})
