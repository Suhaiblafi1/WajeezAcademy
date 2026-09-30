/* بذرُ حسابَي «دليل المدرّب» — لقطاتُ الدليل تُصوَّر من بوّابةٍ حقيقيّة.

   ═══ لماذا حسابان لا حسابُ الديمو ═══

   حسابُ الديمو (`server/db/seed-demo.ts`) كُتب لفحص الشاشات لا لتصويرها:
   اسمُه «أستاذ رامي — مدرّب ديمو»، وشعبتُه «شعبة ديمو — …»، وأكثرُ أبوابه
   فارغة (لا مسار، ولا عقد، ولا تقييم). ودليلٌ يُري المدرّبَ «شعبة ديمو» في
   كلّ صورةٍ يعلّمه أنّ ما يراه تجربةٌ لا بوّابتُه.

   فحسابان، كلٌّ في اللحظة التي يصفها الدليل:

   ① **«من اعتُمد توقيعُه الآن»** — وقّع عرضَه المشروط واعتمدناه، فهو في طور
      الموادّ ومهلتُه تجري من هذه اللحظة. وهي اللحظةُ التي يصله فيها بريدُ
      الاعتماد ورابطُ الدليل، فأوّلُ ما يراه في الدليل هو ما سيراه فعلا.
   ② **«مدرّبٌ نشط»** — اعتُمدت موادُّه ونُشر حسابُه، فله شعبٌ وطلبةٌ
      ومستحقّاتٌ وعروضٌ ومقترحات: كلُّ بابٍ فيه ما يُشرح.

   ═══ وما يُبذر يمرّ بالخدمات نفسِها ═══

   التوقيعُ والاعتمادُ والنشرُ تُنادى من خدماتها (`TrainerReviewService`)
   لا تُكتب صفوفُها باليد: صورةٌ من حالٍ لا تبلغه المنصّةُ بطريقها تكذب على
   من يقرأ الدليل. وما لا خدمةَ له يُكتب كما يكتبه البذرُ الأصليّ.

   ═══ وحدودُه ═══

   · **محلّيٌّ وحدَه**: يُردّ في الإنتاج وعلى قاعدةٍ ليست محلّيّة.
   · **ونطاقُه `@wajeez.local`**: نطاقُ الديمو نفسُه، فيحذفه
     `scripts/purge-demo-data.ts` مع غيره بلا قائمةٍ ثانية.
   · **ولا اسمَ مدرّبٍ حقيقيّ**: «مدرّب وجيز» اسمُ دورٍ لا اسمُ إنسان —
     قاعدةُ المستودع: لا اسمَ مدرّبٍ يُعرض حقيقةً قبل توثيقه.

   التشغيل: `npm run guide:seed` ثمّ `npm run guide:shots`. */

import { createHash } from 'node:crypto'
import type { PrismaClient } from '@prisma/client'
import { AuthService } from '../../server/services/auth.service'
import { TrainerReviewService } from '../../server/services/trainer-review.service'
import { TrainerOfferService } from '../../server/services/trainer-offer.service'
import { CourseProposalService } from '../../server/services/course-proposal.service'
import { TrainerPathService } from '../../server/services/trainer-path.service'
import { TrainerMarketingService } from '../../server/services/trainer-marketing.service'
import { CohortService } from '../../server/services/cohort.service'
import { EarningsService } from '../../server/services/earnings.service'
import { RatingService } from '../../server/services/rating.service'
import { CohortPlanService, type TrainerPlanContent } from '../../server/services/cohort-plan.service'
import { AssessmentService } from '../../server/services/assessment.service'
import { contractAcks } from '../../src/application/trainer/contract-body'
import { deadlineFrom } from '../../src/application/trainer/conditional-offer'
import {
  GUIDE_ACCOUNTS, GUIDE_ASSET_HOST, GUIDE_COURSES, GUIDE_PASSWORD, GUIDE_TRAINER_NAME,
} from './accounts'

/** من يعتمد ويُسنِد — حسابُ الإدارة في بذر الديمو */
const ADMIN_EMAIL = 'admin.demo@wajeez.local'

const sha256 = (v: string) => createHash('sha256').update(v).digest('hex')

function refuseOutsideLocal() {
  if (process.env.NODE_ENV === 'production') {
    throw new Error('بذرُ الدليل لا يُشغَّل في الإنتاج')
  }
  /* بلا `DATABASE_URL` يشغّل العميلُ PostgreSQL المدمجة — وهي محلّيّةٌ بطبعها */
  const url = process.env.DATABASE_URL ?? ''
  const local = url === '' || process.env.WAJEEZ_EMBEDDED_PG === '1' || /@(localhost|127\.0\.0\.1)[:/]/.test(url)
  if (!local) throw new Error('بذرُ الدليل للقاعدة المحلّيّة وحدَها — شغّله عبر scripts/with-db.ts')
}

interface Ctx {
  prisma: PrismaClient
  auth: AuthService
  review: TrainerReviewService
  adminId: string
}

/** حسابٌ ومتقدّمٌ قُبل قبولا مشروطا بمؤهّلاتٍ مبذورةٍ من طلبه */
async function candidate(ctx: Ctx, email: string, reference: string, courses: string[]) {
  const { prisma, auth, review } = ctx
  const existing = await prisma.trainerApplication.findUnique({ where: { reference } })
  if (existing) return existing
  const user = (await prisma.user.findUnique({ where: { email } }))
    ?? { id: (await auth.register(email, GUIDE_PASSWORD, GUIDE_TRAINER_NAME)).userId }
  await prisma.user.update({ where: { id: user.id }, data: { emailVerifiedAt: new Date() } }).catch(() => undefined)
  const app = await prisma.trainerApplication.create({
    data: {
      reference, fullName: GUIDE_TRAINER_NAME, email, status: 'academic_review',
      emailVerifiedAt: new Date(), country: 'الأردن', timezone: 'Asia/Amman',
      employmentStatus: 'full_time_training', jobTitle: 'مدرّب تواصلٍ وتفاوض',
      motivation: 'حسابُ «دليل المدرّب» — للتصوير المحلّيّ وحدَه.',
      privacyConsentAt: new Date(), teachableCourseIds: courses, userId: user.id,
    },
  })
  await review.decide(app.id, ctx.adminId, 'conditionally_approve')
  const profile = await prisma.trainerProfile.findUniqueOrThrow({ where: { applicationId: app.id } })
  await prisma.trainerCompensationRule.create({
    data: { profileId: profile.id, type: 'per_seat', rate: 25, currency: 'USD', minSeats: 0 },
  })
  return app
}

/** يركّب العرضَ ويرسله، ويرفع الهويّة ويوقّع، ثمّ يُعتمَد التوقيع */
async function signAndCountersign(ctx: Ctx, applicationId: string) {
  const { prisma, review } = ctx
  const profile = await prisma.trainerProfile.findUniqueOrThrow({ where: { applicationId } })
  const done = await prisma.trainerContract.findFirst({
    where: { profileId: profile.id, status: 'countersigned' },
  })
  if (done) return done
  const made = await review.composeContract(applicationId, ctx.adminId, {
    title: 'عرضُ تدريبٍ مشروط',
    trainerLegalNameAr: GUIDE_TRAINER_NAME,
    requiredDocuments: [{ kind: 'national_id', labelAr: 'الهوية الوطنية', required: true }],
  })
  const row = await prisma.trainerContract.findUniqueOrThrow({ where: { id: made.id } })
  const sent = await review.sendContract(made.id, ctx.adminId)
  await prisma.trainerContractDocument.create({
    data: {
      contractId: made.id, kind: 'national_id', storageKey: `guide-${made.id}`,
      originalName: 'id.pdf', mime: 'application/pdf', sizeBytes: 1024,
    },
  })
  await review.signContractByToken(decodeURIComponent(sent.signingUrl.split('/c/')[1]), {
    legalName: GUIDE_TRAINER_NAME, addressAr: 'عمّان',
    phone: '+962790000000', bodyHash: sha256(row.bodyAr!),
    acks: contractAcks(true).map((a) => a.key),
  })
  await review.countersignContract(made.id, ctx.adminId)
  return prisma.trainerContract.findUniqueOrThrow({ where: { id: made.id } })
}

/* ═══ ① من اعتُمد توقيعُه الآن ═══

   والمهلةُ تُعاد إلى أوّلها في كلّ تشغيل: الصورةُ تُلتقط يومَ تُلتقط، ومن
   بذر أمسِ ثمّ صوّر اليومَ رأى «أمامك ٤ أيّام» على بريدٍ يقول خمسة. */
async function seedFresh(ctx: Ctx) {
  const { prisma } = ctx
  const a = GUIDE_ACCOUNTS.fresh
  const app = await candidate(ctx, a.email, a.ref, [
    GUIDE_COURSES.message, GUIDE_COURSES.speaking, GUIDE_COURSES.negotiation,
  ])
  const contract = await signAndCountersign(ctx, app.id)
  const now = new Date()
  await prisma.trainerContract.update({
    where: { id: contract.id },
    data: {
      countersignedAt: now, conditionDeadlineAt: deadlineFrom(now),
      conditionPausedAt: null, conditionExtendedAt: null, conditionExtensionsUsed: 0,
    },
  })
  return app
}

/* ═══ ② المدرّبُ النشط ═══

   يمرّ بالطريق كلِّه كما يمرّ به إنسان: يوقّع ويُعتمَد توقيعُه، ثمّ يُعلن
   اكتمالَ موادّه، فتُعتمَد دوراتُه واحدةً واحدة، ثمّ يُقبَل قبولا كاملا —
   وهو قرارٌ يقرأ الجاهزيّةَ الثلاث (`readinessFor`) فلا يمرّ ناقص. */
async function seedActive(ctx: Ctx) {
  const { prisma, review } = ctx
  const a = GUIDE_ACCOUNTS.active
  const courses = [
    GUIDE_COURSES.message, GUIDE_COURSES.speaking, GUIDE_COURSES.persuasion, GUIDE_COURSES.negotiation,
  ]
  const app = await candidate(ctx, a.email, a.ref, courses)
  if ((await prisma.trainerApplication.findUniqueOrThrow({ where: { id: app.id } })).status === 'active') {
    return prisma.trainerProfile.findUniqueOrThrow({ where: { applicationId: app.id } })
  }
  await signAndCountersign(ctx, app.id)
  const profile = await prisma.trainerProfile.findUniqueOrThrow({ where: { applicationId: app.id } })
  await review.declareMaterialsComplete(profile.userId!)
  for (const c of courses) await review.qualifyForCourse(profile.id, c, ctx.adminId, 'اعتُمدت موادُّها')
  await review.decide(app.id, ctx.adminId, 'approve')
  await prisma.trainerProfile.update({
    where: { id: profile.id },
    data: {
      headline: 'مدرّبُ تواصلٍ وعرضٍ وتفاوض',
      bioPublic: 'يدرّب على بناء الرسالة والعرض التنفيذيّ والتفاوض المنهجيّ بتمارينَ من مواقفِ عملٍ حقيقيّة.',
    },
  })
  return profile
}

/* ═══ ③ ما يملأ أبوابَ النشط ═══

   كلُّ بابٍ في البوّابة يُصوَّر وفيه ما يُشرح: شعبةٌ في التجهيز، وشعبةٌ
   جارية، وشعبةٌ منتهيةٌ لها كشف، وعروضٌ مفتوحةٌ ومسحوبة، ومقترحٌ قيد
   المراجعة وآخرُ دُمج، ومسارٌ، وتعريفٌ بالفيديو، وملصقٌ ينتظر موافقتَه،
   وتقييماتٌ معتمَدة. ويُبذر مرّةً: من له شعبةٌ مسنَدةٌ بُذرت أبوابُه. */

const DAY = 86_400_000

/** متعلّمون بأسماءٍ أولى وحرفٍ من العائلة — لا اسمَ كاملا يُظنّ إنسانا بعينه */
const LEARNERS = ['سارة م.', 'خالد ع.', 'ليان ح.', 'عمر س.', 'نور ك.', 'يزن ب.', 'رنا ط.', 'فادي ج.']

async function learners(ctx: Ctx): Promise<string[]> {
  const ids: string[] = []
  for (const [i, name] of LEARNERS.entries()) {
    const email = `guide.learner${i + 1}@wajeez.local`
    const u = (await ctx.prisma.user.findUnique({ where: { email } }))
      ?? { id: (await ctx.auth.register(email, GUIDE_PASSWORD, name)).userId }
    ids.push(u.id)
  }
  return ids
}

/** محاورُ الدورة بترتيبها في الكتالوج — تُربط بها الجلسات */
async function modulesOf(ctx: Ctx, courseId: string) {
  const mods = await ctx.prisma.courseModule.findMany({
    where: { courseId, status: { not: 'archived' } },
    include: { versions: { orderBy: { version: 'desc' }, take: 1 } },
  })
  return mods.sort((a, b) => (a.versions[0]?.sequence ?? 0) - (b.versions[0]?.sequence ?? 0))
}

/** يومٌ بتوقيت عمّان في الساعة المطلوبة — والشعبُ كلُّها مساءً */
function at(dayOffset: number, hourAmman = 18): Date {
  const d = new Date(Date.now() + dayOffset * DAY)
  d.setUTCHours(hourAmman - 3, 0, 0, 0)
  return d
}

async function seedActiveData(ctx: Ctx, profileId: string) {
  const { prisma } = ctx
  const profile = await prisma.trainerProfile.findUniqueOrThrow({ where: { id: profileId } })
  const userId = profile.userId!
  const cohorts = new CohortService(prisma)
  const offers = new TrainerOfferService(prisma)
  const staff = { userId: ctx.adminId, roles: ['academic_manager'] }

  /* الأجرُ بالمقعد، وللمقعد الذي يأتي من رابطه أجرٌ أعلى — كما في «مستحقاتي» */
  await prisma.trainerCompensationRule.updateMany({
    where: { profileId, effectiveTo: null }, data: { referralRate: 35 },
  })

  const people = await learners(ctx)

  /* وكلُّ بابٍ يُبذر مرّةً بحارسه — فتشغيلٌ سقط في وسطه يُكمل ما بقي ولا يكرّر ما تمّ */
  if (!(await prisma.cohortTrainer.findFirst({ where: { profileId } }))) {

  /* ── الشعبةُ المنتهية: لها كشفُ مستحقّاتٍ وتقييمات ── */
  const done = await prisma.cohort.create({
    data: {
      courseId: GUIDE_COURSES.negotiation, title: 'التحضيرُ للتفاوض — دفعةُ أغسطس',
      status: 'active', startsAt: at(-70), endsAt: at(-40),
      daysOfWeek: ['sun', 'wed'], startTime: '18:00', timezone: 'Asia/Amman',
      capacity: 20, price: 180, currency: 'USD', financialReady: true,
    },
  })
  await cohorts.assignTrainer(done.id, profileId, ctx.adminId, 'lead', false)
  const doneEnrollments = []
  for (const [i, uid] of people.slice(0, 6).entries()) {
    doneEnrollments.push(await prisma.enrollment.create({
      data: {
        cohortId: done.id, userId: uid, status: 'completed', enrolledBy: ctx.adminId,
        ...(i < 2 ? { referralProfileId: profileId } : {}),
      },
    }))
  }
  await prisma.cohort.update({ where: { id: done.id }, data: { status: 'completed' } })

  const COMMENTS = [
    { score: 5, text: 'أوّلُ مرّةٍ أدخل تفاوضا ومعي ورقةُ تحضيرٍ مكتوبة — وفرقُها ظهر من الدقيقة الأولى.' },
    { score: 5, text: 'التمارينُ من مواقفَ نعيشها في العمل، لا أمثلةٌ مترجمة.' },
    { score: 4, text: 'كنت أتمنّى وقتا أطول لمحاكاة الصفقة في اللقاء الأخير.' },
    { score: 5, text: 'يردّ على كلّ سؤالٍ في المجموعة، ويعيد شرحَ ما لم يُفهم بمثالٍ آخر.' },
    { score: 4, text: 'مذكّرةُ التحضير وحدَها تستحقّ الدورة.' },
  ]
  for (const [i, c] of COMMENTS.entries()) {
    await prisma.rating.create({
      data: {
        enrollmentId: doneEnrollments[i].id, raterId: doneEnrollments[i].userId,
        subjectType: 'trainer', subjectId: profileId, score: c.score, commentAr: c.text,
        publishStatus: 'approved', moderatedBy: ctx.adminId, moderatedAt: new Date(),
      },
    })
  }
  await new RatingService(prisma).recomputeTrainerAggregate(profileId)
  await new EarningsService(prisma).generateForCohort(ctx.adminId, done.id)

  /* ── الشعبةُ الجارية: جلساتٌ مضت وأخرى قادمة، وطلبة، وتسليمان ينتظران ── */
  const running = await prisma.cohort.create({
    data: {
      courseId: GUIDE_COURSES.negotiation, title: 'التحضيرُ للتفاوض — دفعةُ أكتوبر',
      status: 'active', startsAt: at(-9), endsAt: at(19),
      daysOfWeek: ['sun', 'wed'], startTime: '18:00', timezone: 'Asia/Amman',
      capacity: 20, price: 180, currency: 'USD', registrationOpen: false, financialReady: true,
    },
  })
  await cohorts.assignTrainer(running.id, profileId, ctx.adminId, 'lead', true)
  const runEnrollments = []
  for (const [i, uid] of people.slice(2, 8).entries()) {
    runEnrollments.push(await prisma.enrollment.create({
      data: {
        cohortId: running.id, userId: uid, status: 'enrolled', enrolledBy: ctx.adminId,
        ...(i === 0 ? { referralProfileId: profileId } : {}),
      },
    }))
  }
  const mods = (await modulesOf(ctx, GUIDE_COURSES.negotiation)).slice(0, 4)
  const plan = [-9, -6, -2, 1, 5, 8, 12, 15]
  for (const [i, off] of plan.entries()) {
    const m = mods[Math.floor(i / 2)] ?? mods[mods.length - 1]
    const startsAt = at(off)
    const past = off < 0
    const session = await prisma.cohortSession.create({
      data: {
        cohortId: running.id, moduleId: m.id, moduleIds: [m.id],
        title: `${m.versions[0]?.titleAr ?? 'لقاء'} — ${i % 2 === 0 ? 'اللقاءُ المباشر' : 'تطبيقٌ وأسئلة'}`,
        startsAt, endsAt: new Date(startsAt.getTime() + 2 * 3600_000),
        timezone: 'Asia/Amman', status: past ? 'done' : 'scheduled',
      },
    })
    if (!past) continue
    for (const [j, e] of runEnrollments.entries()) {
      await prisma.attendance.create({
        data: {
          sessionId: session.id, enrollmentId: e.id,
          status: (i + j) % 7 === 3 ? 'absent' : (i + j) % 5 === 2 ? 'late' : 'present',
          markedBy: userId,
        },
      })
    }
  }
  const task = await prisma.cohortAssessment.create({
    data: {
      cohortId: running.id, title: 'مذكّرةُ تحضيرٍ لتفاوضٍ تعيشه الآن',
      type: 'assignment', maxScore: 20, passScore: 12, dueAt: at(-1, 23),
      status: 'published', createdBy: userId, moduleId: mods[1]?.id ?? null,
    },
  })
  for (const [j, e] of runEnrollments.slice(0, 3).entries()) {
    await prisma.assignmentSubmission.create({
      data: {
        assessmentId: task.id, enrollmentId: e.id, status: 'submitted',
        submittedAt: new Date(Date.now() - (j + 1) * 5 * 3600_000),
        textAnswer: [
          'الموقف: تجديدُ عقد توريدٍ سنويّ. بديلي إن لم نتّفق: موردٌ ثانٍ بسعرٍ أعلى ٨٪ وتسليمٍ أبطأ أسبوعا.',
          'الموقف: طلبُ زيادةٍ في الراتب. أعلى ما أطلبه ١٥٪، وأدنى ما أقبله ٨٪ مع يومِ عملٍ من البيت.',
          'الموقف: تقاسمُ ميزانيّة التسويق مع قسم المبيعات. مصلحتُهم الأرقامُ الفصليّة، ومصلحتُنا الحملةُ الطويلة.',
        ][j],
      },
    })
  }

  }

  /* ── العروض: واحدٌ قُبل فصارت شعبتُه في التجهيز، واثنان مفتوحان، وواحدٌ سُحب ── */
  if (!(await prisma.trainerAssignmentOffer.findFirst({ where: { profileId } }))) {
  const draft = (courseId: string, title: string, startDay: number) => prisma.cohort.create({
    data: {
      courseId, title, status: 'draft', startsAt: at(startDay),
      daysOfWeek: ['tue', 'thu'], startTime: '18:00', timezone: 'Asia/Amman',
      capacity: 20, price: 160, currency: 'USD', language: 'العربية', deliveryMode: 'remote',
      registrationOpen: false, financialReady: true,
    },
  })
  const prep = await draft(GUIDE_COURSES.message, 'تصميمُ الرسالة والعرض التنفيذيّ — نوفمبر', 34)
  const accepted = await offers.offer({
    profileId, courseId: GUIDE_COURSES.message, cohortId: prep.id, sessionsCount: 8,
    feeNoteAr: 'بالمقعد كما في اتّفاقك', noteAr: 'شعبةٌ مسائيّةٌ يومَي الثلاثاء والخميس.',
  }, ctx.adminId)
  await offers.accept(accepted.id, userId)

  const speaking = await draft(GUIDE_COURSES.speaking, 'الإلقاءُ والتحدّث أمام الجمهور — ديسمبر', 62)
  await offers.offer({
    profileId, courseId: GUIDE_COURSES.speaking, cohortId: speaking.id, sessionsCount: 4,
    feeNoteAr: 'بالمقعد كما في اتّفاقك', noteAr: 'أربعةُ لقاءاتٍ مسائيّة، وتبدأ بعد عطلة المولد.',
  }, ctx.adminId)
  const persuasion = await draft(GUIDE_COURSES.persuasion, 'الإقناعُ والتواصل المؤثّر — ديسمبر', 69)
  await offers.offer({
    profileId, courseId: GUIDE_COURSES.persuasion, cohortId: persuasion.id, sessionsCount: 4,
    feeNoteAr: 'بالمقعد كما في اتّفاقك',
  }, ctx.adminId)
  const later = await draft(GUIDE_COURSES.negotiation, 'التحضيرُ للتفاوض — يناير', 100)
  const withdrawn = await offers.offer({
    profileId, courseId: GUIDE_COURSES.negotiation, cohortId: later.id, sessionsCount: 8,
  }, ctx.adminId)
  await offers.withdraw(withdrawn.id, ctx.adminId, 'نُقلت شعبةُ يناير إلى الفصل الذي يليه لقلّة التسجيل المبكّر')

  }

  /* ── دوراتي المقترحة: واحدٌ قيد المراجعة، وآخرُ دُمج في دورةٍ قائمة ── */
  if (!(await prisma.trainerCourseProposal.findFirst({ where: { profileId } }))) {
  const proposals = new CourseProposalService(prisma)
  await proposals.add(userId, {
    titleAr: 'التفاوضُ على العرض الوظيفيّ والراتب',
    summaryAr: 'يحضّر فيها الباحثُ عن عملٍ لتفاوضه الأوّل: كيف يقدّر قيمتَه، ومتى يذكر رقما، وكيف يقبل أو يعتذر ويحفظ العلاقة.',
    details: {
      audienceAr: 'الخرّيجون الجدد ومن يغيّرون مسارهم المهنيّ', level: 'beginner',
      outcomesAr: 'يكتب مذكّرةَ تحضيرٍ لعرضٍ وظيفيّ\nيحدّد أدنى ما يقبله قبل المقابلة\nيردّ على العرض الأوّل بلا ارتباك',
      topicsAr: 'قيمتُك في السوق\nالرقمُ الأوّل\nالحزمةُ لا الراتب\nالقبولُ والاعتذار',
      hours: 8, format: 'live_online', experience: 'once', materials: ['exercises', 'cases'],
      closestCourseAr: 'التحضيرُ المنهجيّ للتفاوض', merge: 'discuss',
    },
  })
  /* والمدموجُ على دورةٍ لا عرضَ عليها: حالُ المؤهَّل يُقرأ من عرضه أوّلا،
     فمقترحٌ يُدمج في دورةٍ قُبل عرضُها يُرى «أُضيفت» لا «دُمجت». */
  const merged = await proposals.add(userId, {
    titleAr: 'الردُّ على أسئلة الجمهور الصعبة',
    summaryAr: 'كيف تجيب بإيجازٍ وصدقٍ حين يُسأل عرضُك سؤالا لم تحضّره.',
    details: { audienceAr: 'من يعرضون أمام الإدارة أو العملاء', level: 'intermediate', hours: 8, merge: 'yes' },
  })
  await proposals.linkToCourse(staff, merged.id, GUIDE_COURSES.qa,
    'وجدناها في «إدارة الأسئلة والأجوبة» بمحاورها — فأهّلناك لها بدلَ أن تكون دورتين متشابهتين.')
  await ctx.review.qualifyForCourse(profileId, GUIDE_COURSES.qa, ctx.adminId, 'دُمج فيها مقترحُه')

  }

  /* ── مساراتي: مسوّدةٌ لم تُرسَل ──

     ولا تُرسَل عن قصد: الإرسالُ يشترط اعتمادَ ظهور اسمه للعامّة
     (`publishApprovedAt`)، وقاعدةُ المستودع ألّا يُعتمَد ظهورُ اسمٍ لم يُوثَّق
     — ولو كان اسمَ دورٍ على قاعدةٍ محلّيّة. والمسوّدةُ تُري الشرطَ نفسَه
     مكتوبا في الشاشة، وهو ممّا يُشرح في الدليل. */
  const paths = new TrainerPathService(prisma)
  const existingPath = await prisma.trainerPath.findFirst({ where: { profileId } })
  const term = (await paths.upcomingTerms())[0]
  const pathInput = {
    titleAr: 'من الفكرة إلى الاتّفاق',
    blurbAr: 'أربعُ دوراتٍ متتابعة: تبني رسالتك، وتلقيها بثقة، وتقنع بها، ثمّ تفاوض عليها حتّى تصل إلى اتّفاقٍ مكتوب.',
    termId: term?.id ?? null,
    courseIds: [GUIDE_COURSES.message, GUIDE_COURSES.speaking, GUIDE_COURSES.persuasion, GUIDE_COURSES.negotiation],
  }
  if (existingPath) await paths.update(userId, existingPath.id, pathInput)
  else await paths.create(userId, pathInput)

  /* ── التسويق: فيديو تعريفٍ به وبدورة، وصورة، وملصقٌ ينتظر موافقتَه ── */
  if (await prisma.trainerPoster.findFirst({ where: { profileId } })) return
  const marketing = new TrainerMarketingService(prisma)
  await marketing.setVideo(userId, { targetKind: 'bio', url: 'https://youtu.be/wajeez-guide-bio' })
  await marketing.setVideo(userId, {
    targetKind: 'course', targetId: GUIDE_COURSES.negotiation, url: 'https://youtu.be/wajeez-guide-negotiation',
  })
  await marketing.addPhoto(userId, { url: `${GUIDE_ASSET_HOST}/portrait.jpg`, captionAr: 'صورةٌ في قاعة تدريب' })
  const poster = await marketing.createPoster(ctx.adminId, profileId, {
    targetKind: 'course', targetId: GUIDE_COURSES.negotiation,
    url: `${GUIDE_ASSET_HOST}/poster-negotiation.png`,
    staffNoteAr: 'صمّمناه بصورتك التي رفعتَها — وافِقْ عليه أو اطلب تعديلا.',
  })
  await marketing.submitPoster(ctx.adminId, poster.id)
}

/* ═══ ④ خطّةُ شعبة التجهيز — كلُّ خطوةٍ من الستّ فيها ما يُصوَّر ═══

   تُكتب بالخدمة التي تكتبها الشاشة (`CohortPlanService.savePlan`)، ولا تُرسَل
   للاعتماد: الدليلُ يُري الخطوةَ السادسةَ قبل الإرسال لا بعده. */
const ISO = (d: Date) => d.toISOString().slice(0, 10)

async function seedPrepPlan(ctx: Ctx, profileId: string) {
  const { prisma } = ctx
  const link = await prisma.cohortTrainer.findFirst({
    where: { profileId, cohort: { courseId: GUIDE_COURSES.message, status: 'draft' } },
    include: { cohort: true },
  })
  if (!link) return
  const cohortId = link.cohortId
  if (await prisma.cohortDeliveryPlan.findFirst({ where: { cohortId, trainerId: { not: null } } })) return
  const profile = await prisma.trainerProfile.findUniqueOrThrow({ where: { id: profileId } })
  const userId = profile.userId!
  const plans = new CohortPlanService(prisma)

  await plans.updateCohort(userId, cohortId, { title: 'الدفعةُ الأولى — مساءَي الثلاثاء والخميس' })

  const mods = (await modulesOf(ctx, GUIDE_COURSES.message)).slice(0, 4)
  const start = link.cohort.startsAt ?? at(34)
  const day = (n: number) => ISO(new Date(start.getTime() + n * DAY))
  const TEXT = [
    { outcome: 'يسمّي جمهورَه والقرارَ الذي يريده منه قبل أن يكتب سطرا.', activity: 'بطاقةُ جمهور لموقفٍ من عمله.',
      body: 'نبدأ من السؤال الذي يسبق كلَّ عرض: من سيقرأ، وما القرارُ الذي نريده منه؟ ثمّ نكتب ذلك في جملتين قبل أيّ شريحة.' },
    { outcome: 'يكتب فكرتَه الرئيسة في جملةٍ واحدةٍ تُفهم بلا شرح.', activity: 'خريطةُ رسالةٍ من ثلاثة أعمدة.',
      body: 'الفكرةُ الرئيسة جملةٌ واحدة يقبل بها القارئُ أو يرفضها. نبني تحتها ثلاثة أعمدة، ولكلّ عمودٍ دليلٌ واحد يسنده.' },
    { outcome: 'يسند رسالتَه بقصّةٍ ودليلٍ يناسبان جمهورَه.', activity: 'قصّةٌ من دقيقتين بدليلٍ رقميّ.',
      body: 'القصّةُ تحمل الدليلَ ولا تغني عنه. نختار موقفا واحدا، ونضع فيه رقما يمكن التحقّق منه، ونربطه بالفكرة الرئيسة.' },
    { outcome: 'يعرض رسالتَه في عشر دقائق أمام من يملك القرار.', activity: 'عرضٌ قصيرٌ يُسجَّل ويُراجَع.',
      body: 'نجمع ما سبق في عرضٍ من عشر دقائق: الخلاصةُ أوّلا، ثمّ الأعمدةُ الثلاثة، ثمّ ما نطلبه من الحاضرين بالتحديد.' },
  ]
  const content: TrainerPlanContent = {
    kind: 'trainer',
    summaryAr: 'أربعةُ أسابيعَ مسائيّة تبني فيها رسالةً واحدةً واضحة، وتسندها بالدليل، ثمّ تعرضها في عشر دقائق أمام من يملك القرار.',
    startsOn: day(0),
    endsOn: day(27),
    modules: mods.map((m, i) => ({
      moduleId: m.id, titleAr: m.versions[0]?.titleAr ?? `المحور ${i + 1}`,
      outcomeAr: TEXT[i].outcome, activityAr: TEXT[i].activity, bodyAr: TEXT[i].body,
    })),
    slots: mods.map((m, i) => ({
      startsOn: day(i * 7), endsOn: day(i * 7 + 6), moduleIds: [m.id],
      workbook: { title: `كرّاسةُ المحور ${i + 1}`, url: `https://drive.google.com/file/d/guide-workbook-${i + 1}` },
    })),
    resources: [
      { title: 'فصلُ «البساطة» من كتاب Made to Stick', kind: 'book', category: 'reading', moduleId: mods[1]?.id ?? null, preReading: true },
      { title: 'نموذجُ خريطة الرسالة — قالبٌ فارغ', kind: 'link', category: 'public', url: 'https://drive.google.com/file/d/guide-message-map', moduleId: mods[1]?.id ?? null },
    ],
  }
  await plans.savePlan(userId, cohortId, content)

  const cohorts = new CohortService(prisma)
  for (const [i, m] of mods.entries()) {
    const s = new Date(`${day(i * 7 + 1)}T15:00:00Z`)
    await cohorts.trainerAddSessionWithMeeting(userId, cohortId, {
      title: `${m.versions[0]?.titleAr ?? 'لقاء'} — اللقاءُ المباشر`,
      startsAt: s, endsAt: new Date(s.getTime() + 2 * 3600_000), timezone: 'Asia/Amman', moduleIds: [m.id],
    })
  }
  await new AssessmentService(prisma).createAssessment(userId, {
    cohortId, title: 'خريطةُ رسالةٍ لعرضٍ تقدّمه هذا الشهر', type: 'assignment', moduleId: mods[1]?.id,
    briefAr: 'اختر عرضا ستقدّمه فعلا، واكتب فكرتَه الرئيسة في جملة، وتحتها ثلاثة أعمدة ولكلّ عمودٍ دليل.',
    maxScore: 20, passScore: 12,
  }, { byTrainer: true })
}

/* ═══ ⑤ خطّتا الشعبتين الجارية والمنتهية — معتمَدتان كما تكون شعبةٌ درّس فيها أحد ═══

   شعبةٌ بلا خطّةٍ معتمَدةٍ تفتح مساحتَها على الخطوة الأولى مقفلةً ما بعدها،
   ويقول عنها «شعبي» إنّها «في التجهيز» — وليس هذا حالَ شعبةٍ يدرّس فيها أحد.
   فتُكتب خطّتُها وتُرسَل وتُعتمَد بالطريق نفسِه: المدرّبُ يحفظ ويرسل،
   والإدارةُ تعتمد. ومدّتُها تبدأ يومَ بدأت الشعبة — وهو ما يُجيزه
   `periodProblem` لتاريخٍ مضى إن كان بدءَها المعتمَد.

   والحارسُ **خطّةٌ معتمَدة** لا خطّةٌ ما: تشغيلٌ سقط بعد الحفظ وقبل الاعتماد
   يترك مسوّدةً، والحارسُ الذي يكتفي بوجودها يُبقيها مسوّدةً إلى الأبد. */
const NEGOTIATION_OUTCOMES = [
  'يفرّق بين موقف الطرف الآخر ومصلحته، ويكتب مصلحتين خلف كلّ موقف.',
  'يحدّد بديلَه الأفضل وحدَّه الأدنى قبل أن يجلس.',
  'يرسم منطقةَ الاتّفاق الممكنة ويختار معيارا موضوعيّا يحتكم إليه.',
  'يكتب مذكّرةَ تحضيرٍ من صفحةٍ واحدة لتفاوضٍ حقيقيّ.',
]

async function approvedNegotiationPlan(ctx: Ctx, profileId: string, title: string) {
  const { prisma } = ctx
  const link = await prisma.cohortTrainer.findFirst({
    where: { profileId, cohort: { title } }, include: { cohort: true },
  })
  if (!link) return
  const cohortId = link.cohortId
  const approved = await prisma.cohortDeliveryPlan.findFirst({
    where: { cohortId, trainerId: { not: null }, status: { in: ['approved', 'published'] } },
  })
  if (approved) return
  const profile = await prisma.trainerProfile.findUniqueOrThrow({ where: { id: profileId } })
  const userId = profile.userId!
  const plans = new CohortPlanService(prisma)
  const mods = (await modulesOf(ctx, GUIDE_COURSES.negotiation)).slice(0, 4)
  const start = link.cohort.startsAt!
  const day = (n: number) => ISO(new Date(start.getTime() + n * DAY))

  /* لقاءاتُها تُعدّ لمحاورها بـ`moduleIds` — وما بُذر قبل هذا العمود يُلحَق به */
  for (const x of await prisma.cohortSession.findMany({ where: { cohortId, moduleIds: { isEmpty: true } } })) {
    if (x.moduleId) await prisma.cohortSession.update({ where: { id: x.id }, data: { moduleIds: [x.moduleId] } })
  }
  /* والمنتهيةُ تُكتب خطّتُها وهي جارية ثمّ تُختم — كما وقع لها يومَها */
  const finished = link.cohort.status === 'completed'
  if (finished) await prisma.cohort.update({ where: { id: cohortId }, data: { status: 'active' } })
  try {
    await plans.savePlan(userId, cohortId, {
      kind: 'trainer',
      summaryAr: 'أربعةُ أسابيع تتعلّم فيها أن تدخل أيَّ تفاوضٍ ومعك بديلُك الأفضل وحدُّك الأدنى ومذكّرةُ تحضيرٍ مكتوبة.',
      startsOn: day(0), endsOn: day(27),
      modules: mods.map((m, i) => ({
        moduleId: m.id, titleAr: m.versions[0]?.titleAr ?? `المحور ${i + 1}`, outcomeAr: NEGOTIATION_OUTCOMES[i],
        activityAr: 'تمرينٌ ثنائيٌّ على موقفٍ من عمل المتعلّم.',
        bodyAr: `${NEGOTIATION_OUTCOMES[i]} نشرح الفكرةَ بمثالٍ واحد، ثمّ يطبّقها كلُّ متعلّمٍ على موقفٍ يعيشه الآن ويعرضه في اللقاء.`,
      })),
      slots: mods.map((m, i) => ({
        startsOn: day(i * 7), endsOn: day(i * 7 + 6), moduleIds: [m.id],
        workbook: { title: `كرّاسةُ المحور ${i + 1}`, url: `https://drive.google.com/file/d/guide-negotiation-${i + 1}` },
      })),
      resources: [
        { title: 'فصلُ «افصل الناس عن المشكلة» من كتاب Getting to Yes', kind: 'book', category: 'reading', moduleId: mods[0]?.id ?? null, preReading: true },
        { title: 'نموذجُ مذكّرة التحضير — صفحةٌ واحدة', kind: 'link', category: 'public', url: 'https://drive.google.com/file/d/guide-prep-memo', moduleId: mods[3]?.id ?? null },
      ],
    })
    await plans.submit(userId, cohortId, true)
    const plan = await prisma.cohortDeliveryPlan.findFirstOrThrow({
      where: { cohortId, trainerId: { not: null }, status: 'submitted' }, orderBy: { createdAt: 'desc' },
    })
    await plans.decide(ctx.adminId, plan.id, true, 'خطّةٌ واضحة — اعتُمدت.')
  } finally {
    if (finished) await prisma.cohort.update({ where: { id: cohortId }, data: { status: 'completed' } })
  }
}

/** لقاءاتُ الشعبة المنتهية وحضورُها — مضت كلُّها */
async function seedAugustSessions(ctx: Ctx, profileId: string) {
  const { prisma } = ctx
  const cohort = await prisma.cohort.findFirst({
    where: { title: 'التحضيرُ للتفاوض — دفعةُ أغسطس', trainers: { some: { profileId } } },
    include: { enrollments: true },
  })
  if (!cohort) return
  const mods = (await modulesOf(ctx, GUIDE_COURSES.negotiation)).slice(0, 4)
  const start = cohort.startsAt!
  /* ومهمّتُها — لا تُعتمَد خطّةٌ بلا مهمّةٍ واحدةٍ على الأقلّ */
  if ((await prisma.cohortAssessment.count({ where: { cohortId: cohort.id } })) === 0) {
    const profile = await prisma.trainerProfile.findUniqueOrThrow({ where: { id: profileId } })
    await prisma.cohortAssessment.create({
      data: {
        cohortId: cohort.id, title: 'مذكّرةُ تحضيرٍ لتفاوضٍ تعيشه الآن', type: 'assignment',
        maxScore: 20, passScore: 12, dueAt: new Date(start.getTime() + 13 * DAY),
        status: 'published', createdBy: profile.userId!, moduleId: mods[1]?.id ?? null,
      },
    })
  }
  if ((await prisma.cohortSession.count({ where: { cohortId: cohort.id } })) > 0) return
  for (const [i, off] of [0, 3, 7, 10, 14, 17, 21, 24].entries()) {
    const m = mods[Math.floor(i / 2)]
    const startsAt = new Date(start.getTime() + off * DAY)
    const session = await prisma.cohortSession.create({
      data: {
        cohortId: cohort.id, moduleId: m.id, moduleIds: [m.id],
        title: `${m.versions[0]?.titleAr ?? 'لقاء'} — ${i % 2 === 0 ? 'اللقاءُ المباشر' : 'تطبيقٌ وأسئلة'}`,
        startsAt, endsAt: new Date(startsAt.getTime() + 2 * 3600_000), timezone: 'Asia/Amman', status: 'done',
      },
    })
    for (const [j, e] of cohort.enrollments.entries()) {
      await prisma.attendance.create({
        data: { sessionId: session.id, enrollmentId: e.id, status: (i + j) % 6 === 4 ? 'absent' : 'present' },
      })
    }
  }
}

/* ═══ ⑥ اجتماعاتُ Zoom للشعبة الجارية ═══

   زرُّ «ابدأ اللقاء مضيفا» لا يظهر إلّا لاجتماعٍ أنشأته المنصّة. والرقمُ هنا
   مثالٌ لا اجتماعٌ حقيقيّ — لا يُضغط الزرُّ في التصوير، يُرى فحسب. */
async function seedZoom(ctx: Ctx, profileId: string) {
  const { prisma } = ctx
  const sessions = await prisma.cohortSession.findMany({
    where: { cohort: { title: 'التحضيرُ للتفاوض — دفعةُ أكتوبر', trainers: { some: { profileId } } } },
    orderBy: { startsAt: 'asc' }, include: { zoom: true, attendance: true },
  })
  for (const [i, s] of sessions.entries()) {
    if (s.zoom) continue
    const id = `8412${String(700000 + i).padStart(6, '0')}`
    const past = s.status === 'done'
    await prisma.zoomMeeting.create({
      data: {
        sessionId: s.id, provider: 'zoom_api', meetingId: id, joinUrl: `https://zoom.us/j/${id}`,
        hostProfileId: profileId,
        ...(past ? {
          actualStartAt: new Date(s.startsAt.getTime() + 2 * 60_000),
          actualEndAt: new Date(s.startsAt.getTime() + 118 * 60_000),
          durationMin: 116, participantCount: s.attendance.filter((a) => a.status !== 'absent').length,
          syncState: 'synced',
        } : {}),
      },
    })
  }
}

export async function seedGuide(prisma: PrismaClient) {
  refuseOutsideLocal()
  const admin = await prisma.user.findUnique({ where: { email: ADMIN_EMAIL } })
  if (!admin) throw new Error('لا حسابَ إدارةٍ من بذر الديمو — شغّل npm run seed:demo أوّلا')
  const ctx: Ctx = {
    prisma, auth: new AuthService(prisma), review: new TrainerReviewService(prisma), adminId: admin.id,
  }
  const fresh = await seedFresh(ctx)
  const active = await seedActive(ctx)
  await seedActiveData(ctx, active.id)
  await seedPrepPlan(ctx, active.id)
  await seedAugustSessions(ctx, active.id)
  await approvedNegotiationPlan(ctx, active.id, 'التحضيرُ للتفاوض — دفعةُ أكتوبر')
  await approvedNegotiationPlan(ctx, active.id, 'التحضيرُ للتفاوض — دفعةُ أغسطس')
  await seedZoom(ctx, active.id)
  return { fresh: fresh.id, active: active.id }
}

/* تشغيلٌ مباشر: npx tsx scripts/with-db.ts tsx scripts/trainer-guide/seed.ts */
if (process.argv[1]?.endsWith('seed.ts')) {
  const { getPrisma, disconnectPrisma } = await import('../../server/db/client')
  const prisma = await getPrisma()
  const out = await seedGuide(prisma)
  console.log('✅ بذرُ الدليل:', out)
  for (const a of Object.values(GUIDE_ACCOUNTS)) console.log(`   · ${a.email}`)
  await disconnectPrisma()
  process.exit(0)
}
