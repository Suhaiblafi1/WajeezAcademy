/* المرحلةُ الثالثة — الاعتمادُ يُنفِذ العقدَ ويفتح الحساب، والعرضُ يُقبَل ويُردّ.

   ═══ وأربعةُ أعطابٍ يقيسها هذا الملفُّ ولا يشتكي منها أحد ═══

   ① **العرضُ يُكتب إسنادا قبل قبوله.** وهو أخطرُ ما في المرحلة: صفٌّ في
      `TrainerCourseAssignment` يُنشَر اسمُ صاحبه على صفحة الدورة العامّة
      (`publicCourseTrainer`) ويصير قائدَ شعبةٍ افتراضيّا في احتساب
      المستحقّات (`cohortLeadTrainer`)، وصفٌّ في `CohortTrainer` يفتح له
      «شعبي» والحضورَ وطابورَ التصحيح. فمن عُرض عليه ولم يجب بعدُ يصير
      مدرّبا معلَنا ومستحِقّا للمال — ولا أحدَ يلاحظ، لأنّ الشاشةَ تقول
      «ينتظر جوابَه».
   ② **والقبولُ يُصدَّق على لقطةٍ قديمة.** العرضُ يُكتب اليومَ ويُقبَل بعد
      أسبوع: سُحب التأهيلُ بينهما، أو امتلأ الجدولُ، أو أُوقف الملفّ.
      فالقبولُ يعيد فحصَ الدنيا أو يكتب إسنادا ممنوعا.
   ③ **والاعتمادُ يُبدَّل بحالةٍ تُكتب باليد.** `status = 'countersigned'`
      سطرٌ واحد، وفتحُ الحساب سطرٌ آخر — ومن فصلهما ترك مدرّبا عقدُه نافذٌ
      وحسابُه مغلق، أو حسابا مفتوحا بلا عقدٍ نافذ.
   ④ **وأجلُ الإعداد يسحب الإسنادَ بمؤقّت.** شعبةٌ فيها متعلّمون دفعوا
      مقاعدَهم لا يُبَتّ أمرُها بمؤقّت.

   والفحصُ على **البنية** لا على ورودِ حرفٍ في ملفّ: تُقرأ الصفوفُ من
   القاعدة بعد كلّ فعل، ويُقابَل ما وقع بما كان ينبغي أن يقع. */

import { beforeAll, describe, expect, it } from 'vitest'
import { createHash } from 'node:crypto'
import type { PrismaClient } from '@prisma/client'
import { setupTestDb, testPrisma } from '../helpers/db'
import { makeReadyForApproval } from '../helpers/trainer-ready'
import { AuthService } from '../../services/auth.service'
import { TrainerReviewService } from '../../services/trainer-review.service'
import { TrainerOfferService } from '../../services/trainer-offer.service'
import { ACADEMY_LEGAL } from '../../../src/data/academy-legal'
import { COURSE_PREP_MIN_DAYS } from '../../../src/application/trainer/notice-periods'

let prisma: PrismaClient
let auth: AuthService
let review: TrainerReviewService
let offers: TrainerOfferService
let adminId = ''

const sha256 = (s: string) => createHash('sha256').update(s).digest('hex')
const BODY = 'نصُّ اتفاقيّةٍ للاختبار — البند 1 وما بعده.'
const DAY = 86_400_000
const COURSE = 'C-OFR-101'
const COURSE_B = 'C-OFR-202'

beforeAll(async () => {
  await setupTestDb()
  prisma = await testPrisma()
  auth = new AuthService(prisma)
  review = new TrainerReviewService(prisma)
  offers = new TrainerOfferService(prisma)

  const admin = await auth.register('ofr-admin@test.local', 'Admin#12345', 'المدير الأكاديمي')
  adminId = admin.userId
  await auth.setRoles(adminId, ['academic_manager'])

  for (const [id, t] of [[COURSE, 'دورةُ العرض'], [COURSE_B, 'دورةٌ أخرى']] as const) {
    await prisma.course.create({ data: { id, status: 'published', currentVersion: 1 } })
    await prisma.courseVersion.create({ data: { courseId: id, version: 1, titleAr: t, totalHours: 10 } })
  }
}, 240_000)

let seq = 0

/** مرشّحٌ له حسابٌ وملفٌّ وعقدٌ موقَّع — الحالُ التي ينطلق منها الاعتماد.

    والحسابُ يُنشأ ويُربط بالطلب كما يقع في الواقع: المتقدّمُ يسجّل ثمّ
    يتقدّم، و`decide('activate')` تربط حسابَه بالملفّ وتمنحه الدور. */
async function mkSigned(opts: { status?: string; gatesActivation?: boolean; withUser?: boolean } = {}) {
  seq += 1
  const status = opts.status ?? 'contract_pending'
  const email = `ofr-${seq}-${Date.now()}@test.local`
  const user = opts.withUser === false ? null : await auth.register(email, 'Pass#12345', `مرشّحٌ ${seq}`)
  const app = await prisma.trainerApplication.create({
    data: {
      reference: `TR-OFR-${Date.now()}-${seq}`, fullName: `مرشّحٌ ${seq}`, email,
      status, motivation: 'اختبار', privacyConsentAt: new Date(),
      userId: user?.userId ?? null,
    },
  })
  const profile = await prisma.trainerProfile.create({ data: { applicationId: app.id } })
  const contract = await prisma.trainerContract.create({
    data: {
      profileId: profile.id, title: `اتفاقيّةُ اختبارٍ ${seq}`, status: 'signed',
      bodyVersion: 'v-test', bodyAr: BODY, bodyHash: sha256(BODY), signedBodyHash: sha256(BODY),
      signerEmail: email, signerLegalName: `الاسمُ القانونيُّ ${seq}`, signedAt: new Date(),
      gatesActivation: opts.gatesActivation ?? (status !== 'active'),
    },
  })
  return { app, profile, contract, userId: user?.userId ?? null, email }
}

/** مدرّبٌ نشطٌ مؤهَّلٌ لدورةٍ — نقطةُ انطلاق العروض */
async function mkActiveTrainer(courseIds: string[] = [COURSE]) {
  const made = await mkSigned()
  for (const courseId of courseIds) {
    await prisma.trainerCourseQualification.upsert({
      where: { profileId_courseId: { profileId: made.profile.id, courseId } },
      update: { status: 'qualified' },
      create: { profileId: made.profile.id, courseId, status: 'qualified' },
    })
  }
  /* ═══ والختمُ في لحظة التفعيل منذ ٢٣ سبتمبر ٢٠٢٦ (§٨-٧) ═══

     كان السطرُ `countersignContract` هنا يسبق الاعتماد. وصار العرضُ المشروطُ
     يُختَم **في `decide('approve')` نفسِها**: توقيعُنا في آخر الطور لا في
     أوّله، فما بين توقيعه واعتمادِنا لا وثيقةَ نافذةً على أحد. وزرُّ
     الاعتماد في شاشة العقود يمرّ من `decide('activate')` نفسِها منذ ٢٦
     سبتمبر ٢٠٢٦ — فالمسلكُ واحدٌ وإن تعدّد بابُه، وناقصُ التجهيز يُردّ من
     كليهما (أوّلُ describe في هذا الملفّ).

     والعرضُ لا يُقدَّم إلّا على مدرّبٍ نشطٍ يفتح بوّابتَه ليراه. */
  await makeReadyForApproval(prisma, made.app.id, adminId)
  await review.decide(made.app.id, adminId, 'approve')
  return made
}

async function mkCohort(courseId = COURSE, startsAt = new Date(Date.now() + 30 * DAY)) {
  seq += 1
  const c = await prisma.cohort.create({
    data: {
      courseId, title: `شعبةُ اختبارٍ ${seq}`, status: 'open', capacity: 10,
      price: 100, currency: 'USD', startsAt,
    },
  })
  await prisma.cohortSession.create({
    data: { cohortId: c.id, title: `جلسة ${seq}`, startsAt, endsAt: new Date(startsAt.getTime() + 3_600_000) },
  })
  return c
}

/* ═══════════ ① الاعتماد ═══════════ */

/* ═══ وقد انقلب هذا الحارسُ يومَ ٢٠ سبتمبر ٢٠٢٦ ═══

   كان يُثبت أنّ اعتمادَ العقد **يفتح الحساب** — وهو ما كانت الشيفرة تفعله.
   وقرارُ صاحب المنصّة أن يبقى القبولُ الكاملُ قرارَه هو: «حين يوقّع يصلني
   خبرُه، فأقبله قبولا كاملا». فاعتمادُ العقد يُتمّ الخطوةَ الثالثةَ من
   التجهيز ولا يتجاوز القرارَ الذي بعدها.

   والحارسُ باقٍ مقلوبا لا محذوفا: يُثبت الآن أنّ الحالةَ **لا تتحرّك**،
   فالرجوعُ إلى التفعيل الآليّ يُسقطه.

   ═══ ثمّ انقلب ما يخصّ العرضَ المشروطَ وحدَه (٢٦ سبتمبر ٢٠٢٦) ═══

   قرارُ صاحب المنصّة: العرضُ المشروطُ يُختَم بزرّ الاعتماد ويصير صاحبُه
   نشطا في اللحظة نفسِها. فما بقي تحت عنوان «ولا يفتح الحساب» هو **البندُ
   الموثَّقُ على نشطٍ أصلا** (`mkDocumented`) — لا حسابَ يُفتح به لأنّه
   مفتوحٌ من قبل. وتفصيلُ الانقلاب في الفحص الذي يليه. */
/** بندٌ يُوثَّق على مدرّبٍ نشطٍ أصلا — وهو المسارُ الذي يبقى فيه الختمُ بيدٍ
    مشروعا: لا شرطَ فيه ولا مهلةَ، فلا شيءَ يُنتظر قبل نفاذه. */
const mkDocumented = () => mkSigned({ status: 'active', gatesActivation: false })

describe('الاعتمادُ يُنفِذ العقدَ — ويفتح الحسابَ حيث يحبسه', () => {
  it('الموقَّعُ يصير نافذا، ويحمل اسمَ المفوَّضِ في السجلّ ومن ضغط فعلا', async () => {
    const { contract } = await mkDocumented()
    const r = await review.countersignContract(contract.id, adminId, { noteAr: 'طابقتُ الاسمَ بالهويّة' })
    const after = await prisma.trainerContract.findUniqueOrThrow({ where: { id: contract.id } })
    expect(after.status).toBe('countersigned')
    expect(after.countersignedAt).toBeTruthy()
    /* من ضغط فعلا — لا من يُفترض أنّه ضغط */
    expect(after.countersignedBy).toBe(adminId)
    /* والمطبوعُ في المستند اسمُ المفوَّض في السجلّ الأردنيّ */
    expect(after.academySignatoryName).toBe(ACADEMY_LEGAL.signatoryNameAr)
    expect(after.academySignatoryTitle).toBe(ACADEMY_LEGAL.signatoryTitleAr)
    expect(after.countersignNoteAr).toBe('طابقتُ الاسمَ بالهويّة')
    expect(r.ok).toBe(true)
  })

  /* ═══ وقد انقلب هذا الحارسُ ثانيةً يومَ ٢٦ سبتمبر ٢٠٢٦ ═══

     كان يُثبت أنّ العرضَ المشروطَ **يُردّ ختمُه بيدٍ مطلقا** (قرارُ ٢٣
     سبتمبر). وقرارُ صاحب المنصّة اليومَ ناسخٌ له: «بعد أن أقوم بالتوقيع
     كأدمن يتحوّل إلى مدرّب نشط مباشرةً وتتفعّل منصّتُه». فالزرُّ صار يختم
     ويفعّل في لحظةٍ واحدة، ويحرسه `countersign-activates.test.ts`.

     ── وما الذي يحرسه هذا الفحصُ إذن ──

     **الحمايةَ بعينها، في موضعها الصحيح.** علّةُ الردّ المطلق كانت أن
     يصير العرضُ نافذا «قبل أن تُقيَّم موادُّه» — ومقياسُ تقييمها ليس نوعَ
     العقد بل بوّابةُ التجهيز: دورةٌ `qualified` واتّفاقٌ ماليٌّ ساري.
     فمن لم تُعتمَد موادُّه يُردّ اليومَ كما كان يُردّ أمس، **بالسبب الصحيح
     لا بسببٍ يشمل المعتمَدَ معه**. وهذا `mkSigned` بلا `makeReadyForApproval`
     — أي عرضٌ موقَّعٌ لم يُجهَّز صاحبُه بعد.

     والحارسُ باقٍ مقلوبا لا محذوفا، كما انقلب أوّلَ مرّة: فمن أعاد الردَّ
     المطلقَ أسقطه، ومن أسقط البوّابةَ أسقطه. */
  it('ولا يُختَم عرضٌ لم تُعتمَد موادُّ صاحبه — ولو ضُغط الزرُّ بيد', async () => {
    const { app, contract, userId } = await mkSigned()
    await expect(review.countersignContract(contract.id, adminId, {}))
      .rejects.toMatchObject({ code: 'not_ready' })
    const after = await prisma.trainerContract.findUniqueOrThrow({ where: { id: contract.id } })
    expect(after.status, 'خُتم عرضٌ مشروطٌ قبل تقييم موادّه').toBe('signed')
    expect(after.countersignedAt).toBeNull()
    /* ولا تتحرّك حالتُه ولا يُمنَح دورُ المدرّب: القبولُ الكاملُ قرارٌ بعدَه */
    const appAfter = await prisma.trainerApplication.findUniqueOrThrow({ where: { id: app.id } })
    expect(appAfter.status).not.toBe('active')
    const roles = await prisma.userRole.findMany({ where: { userId: userId! } })
    expect(roles.map((x) => x.roleId), 'مُنح دورُ المدرّب قبل القبول الكامل').not.toContain('trainer')
  })

  /* ═══ وفي لحظة التفعيل يُختَم ويُقال إنّ الشرطَ تحقّق ═══

     بيانُ صاحب المنصّة: «ويُعاد إليه العقدُ موقَّعا منّا عقدا نهائيّا لا
     عرضا مشروطا». فالخَتمُ و`conditionMetAt` والبريدُ حقيقةٌ واحدة. */
  it('والتفعيلُ يختمه ويكتب أنّ الشرطَ تحقّق', async () => {
    const { app, contract } = await mkSigned()
    await makeReadyForApproval(prisma, app.id, adminId)
    await review.decide(app.id, adminId, 'approve')
    const after = await prisma.trainerContract.findUniqueOrThrow({ where: { id: contract.id } })
    expect(after.status, 'صار نشطا وعرضُه لم يُختَم').toBe('countersigned')
    expect(after.countersignedAt).toBeTruthy()
    expect(after.countersignedBy).toBe(adminId)
    expect(after.academySignatoryName).toBe(ACADEMY_LEGAL.signatoryNameAr)
    expect(after.conditionMetAt, 'اكتمل الشرطُ ولم يُكتب').toBeTruthy()
    /* ولا يبقى تجميدٌ معلَّقٌ بعد انتهاء المهلة */
    expect(after.conditionPausedAt).toBeNull()
  })

  it('ويردّ الجاهزيّةَ مع النتيجة — فيُقرأ الباقي حيث ضُغط', async () => {
    const { contract } = await mkDocumented()
    const r = await review.countersignContract(contract.id, adminId, {})
    /* العقدُ صار موقَّعا، فخطوتُه خضراء — وما عداها يُقرأ من الرَّدّ نفسِه */
    expect(r.readiness.steps.find((st) => st.key === 'contract')!.done).toBe(true)
  })

  it('ولا يُعتمَد إلّا موقَّع — والمسودّةُ تُردّ', async () => {
    const { contract } = await mkDocumented()
    await prisma.trainerContract.update({ where: { id: contract.id }, data: { status: 'draft' } })
    await expect(review.countersignContract(contract.id, adminId, {})).rejects.toThrow()
  })

  it('ولا يُعتمَد مرّتين — فالنافذُ لا يُنفَّذ ثانية', async () => {
    const { contract } = await mkDocumented()
    await review.countersignContract(contract.id, adminId, {})
    await expect(review.countersignContract(contract.id, adminId, {})).rejects.toThrow()
  })

  it('⚠️ ومدرّبٌ نشطٌ أصلا يُعتمَد عقدُه ولا تُمسّ حالتُه', async () => {
    /* `gatesActivation = false`: بندٌ يُوثَّق على ملفٍّ حيّ. ونقلُه إلى
       `contract_pending` كان يطرده من بوّابته — «حسابك التدريبيّ موقوف». */
    const { app, contract } = await mkSigned({ status: 'active', gatesActivation: false })
    await review.countersignContract(contract.id, adminId, {})
    const appAfter = await prisma.trainerApplication.findUniqueOrThrow({ where: { id: app.id } })
    expect(appAfter.status, 'مُسّت حالةُ مدرّبٍ يعمل').toBe('active')
  })

  it('ولا يعتمد أحدٌ عقدا مرتبطا ببريده', async () => {
    /* والطلبُ بلا حساب، ثمّ يُسجَّل الموظّفُ ببريده هو — فالبريدُ فريدٌ
       في `User`، ولا يُصطنع تعارضٌ بحسابين على بريدٍ واحد. */
    const { contract, email } = await mkSigned({ withUser: false, status: 'active', gatesActivation: false })
    const self = await auth.register(email, 'Admin#12345', 'هو نفسُه')
    await auth.setRoles(self.userId, ['academic_manager'])
    await expect(review.countersignContract(contract.id, self.userId, {})).rejects.toThrow(/بريدك/)
  })

  it('⚠️ ورفضُ التوقيع يُغلق العقدَ ولا يمحو دليلَه', async () => {
    const { contract } = await mkSigned()
    const before = await prisma.trainerContract.findUniqueOrThrow({ where: { id: contract.id } })
    await review.rejectSignature(contract.id, adminId, 'الاسمُ في الهويّة غيرُ الاسم المكتوب')
    const after = await prisma.trainerContract.findUniqueOrThrow({ where: { id: contract.id } })
    expect(after.status).toBe('revoked')
    expect(after.revokeReasonAr).toContain('الاسمُ في الهويّة')
    /* والدليلُ باقٍ: ما فعله وقع، ولا يُمحى لأنّنا لم نقبله */
    expect(after.signedAt?.getTime()).toBe(before.signedAt?.getTime())
    expect(after.signerLegalName).toBe(before.signerLegalName)
    expect(after.signedBodyHash).toBe(before.signedBodyHash)
  })

  it('ولا رفضَ بلا سبب — يصل صاحبَه نصّا', async () => {
    const { contract } = await mkSigned()
    await expect(review.rejectSignature(contract.id, adminId, ' ')).rejects.toThrow()
  })
})

/* ═══════════ ② العرضُ لا يكتب شيئا ═══════════ */

describe('العرضُ دعوةٌ — ولا أثرَ له في تشغيلٍ ولا نشرٍ ولا مال', () => {
  it('⚠️ لا صفَّ في CohortTrainer ولا في TrainerCourseAssignment قبل القبول', async () => {
    const t = await mkActiveTrainer()
    const cohort = await mkCohort()
    await offers.offer({ profileId: t.profile.id, courseId: COURSE, cohortId: cohort.id }, adminId)

    const links = await prisma.cohortTrainer.count({ where: { profileId: t.profile.id } })
    expect(links, 'صار مشتغلا بشعبةٍ لم يوافق عليها').toBe(0)
    const assigns = await prisma.trainerCourseAssignment.count({ where: { profileId: t.profile.id } })
    expect(assigns, 'نُشر اسمُه وصار مستحِقّا قبل أن يجيب').toBe(0)
  })

  it('ولا يُعرَض على غير المؤهَّل', async () => {
    const t = await mkActiveTrainer([COURSE])
    await expect(
      offers.offer({ profileId: t.profile.id, courseId: COURSE_B }, adminId),
    ).rejects.toThrow()
  })

  it('ولا يُعرَض على موقوفٍ ولا على غيرِ نشط', async () => {
    const t = await mkActiveTrainer()
    await prisma.trainerProfile.update({ where: { id: t.profile.id }, data: { suspendedAt: new Date() } })
    await expect(offers.offer({ profileId: t.profile.id, courseId: COURSE }, adminId)).rejects.toThrow()
  })

  it('وشعبةٌ من دورةٍ أخرى تُردّ — فلا يُعرَض ما لا يتّسق', async () => {
    const t = await mkActiveTrainer([COURSE, COURSE_B])
    const other = await mkCohort(COURSE_B)
    await expect(
      offers.offer({ profileId: t.profile.id, courseId: COURSE, cohortId: other.id }, adminId),
    ).rejects.toThrow()
  })

  it('وأجلُ الإعداد لا ينزل تحت حدّه الأدنى ولو طُلب', async () => {
    const t = await mkActiveTrainer()
    const o = await offers.offer({ profileId: t.profile.id, courseId: COURSE, prepDays: 1 }, adminId)
    expect(o.prepDays).toBeGreaterThanOrEqual(COURSE_PREP_MIN_DAYS)
  })
})

/* ═══════════ ③ القبولُ يعيد فحصَ الدنيا ═══════════ */

describe('القبولُ يمرّ من بابِ الإسناد نفسِه', () => {
  it('يكتب الصفَّين معا: الإسنادَ الإداريَّ والربطَ التشغيليّ', async () => {
    const t = await mkActiveTrainer()
    const cohort = await mkCohort()
    const o = await offers.offer({ profileId: t.profile.id, courseId: COURSE, cohortId: cohort.id }, adminId)
    const r = await offers.accept(o.id, t.userId!)

    const after = await prisma.trainerAssignmentOffer.findUniqueOrThrow({ where: { id: o.id } })
    expect(after.status).toBe('accepted')
    expect(after.respondedAt).toBeTruthy()
    expect(after.prepDueAt, 'قُبِل بلا أجلِ إعداد').toBeTruthy()
    expect(r.prepDueAt.getTime()).toBeGreaterThan(Date.now())

    const link = await prisma.cohortTrainer.findUnique({
      where: { cohortId_profileId: { cohortId: cohort.id, profileId: t.profile.id } },
    })
    expect(link, 'قُبِل ولا شعبةَ في بوّابته').toBeTruthy()
    const assign = await prisma.trainerCourseAssignment.findFirst({
      where: { profileId: t.profile.id, courseId: COURSE, cohortId: cohort.id },
    })
    expect(assign, 'قُبِل ولا إسنادَ إداريّ').toBeTruthy()
  })

  it('⚠️ وسحبُ التأهيل بين العرض والقبول يمنع القبول — والعرضُ يعود مفتوحا', async () => {
    const t = await mkActiveTrainer()
    const cohort = await mkCohort()
    const o = await offers.offer({ profileId: t.profile.id, courseId: COURSE, cohortId: cohort.id }, adminId)
    /* ما بين العرض والقبول: سُحب التأهيل */
    await prisma.trainerCourseQualification.update({
      where: { profileId_courseId: { profileId: t.profile.id, courseId: COURSE } },
      data: { status: 'retired' },
    })
    await expect(offers.accept(o.id, t.userId!)).rejects.toThrow()

    const after = await prisma.trainerAssignmentOffer.findUniqueOrThrow({ where: { id: o.id } })
    expect(after.status, 'ضاع عليه عرضٌ سقط لسببٍ لا يدَ له فيه').toBe('offered')
    expect(after.respondedAt).toBeNull()
    expect(after.prepDueAt).toBeNull()
    const assigns = await prisma.trainerCourseAssignment.count({ where: { profileId: t.profile.id } })
    expect(assigns, 'كُتب إسنادٌ ممنوع').toBe(0)
  })

  it('⚠️ وإيقافُ الملفِّ بين العرض والقبول يمنعه كذلك', async () => {
    const t = await mkActiveTrainer()
    const cohort = await mkCohort()
    const o = await offers.offer({ profileId: t.profile.id, courseId: COURSE, cohortId: cohort.id }, adminId)
    await prisma.trainerProfile.update({ where: { id: t.profile.id }, data: { suspendedAt: new Date() } })
    await expect(offers.accept(o.id, t.userId!)).rejects.toThrow()
    const links = await prisma.cohortTrainer.count({ where: { profileId: t.profile.id } })
    expect(links).toBe(0)
  })

  it('ولا يُقبَل عرضُ غيرِه — الملفُّ من حسابه لا من جسم الطلب', async () => {
    const t = await mkActiveTrainer()
    const other = await mkActiveTrainer()
    const o = await offers.offer({ profileId: t.profile.id, courseId: COURSE }, adminId)
    await expect(offers.accept(o.id, other.userId!)).rejects.toThrow()
  })

  it('ولا يُقبَل مرّتين', async () => {
    const t = await mkActiveTrainer()
    const o = await offers.offer({ profileId: t.profile.id, courseId: COURSE }, adminId)
    await offers.accept(o.id, t.userId!)
    await expect(offers.accept(o.id, t.userId!)).rejects.toThrow()
  })

  it('⚠️ والمنقضي لا يُقبَل — ويُغلَق في الحال لا يبقى معلَّقا', async () => {
    const t = await mkActiveTrainer()
    const o = await offers.offer({ profileId: t.profile.id, courseId: COURSE }, adminId)
    await prisma.trainerAssignmentOffer.update({
      where: { id: o.id }, data: { expiresAt: new Date(Date.now() - DAY) },
    })
    await expect(offers.accept(o.id, t.userId!)).rejects.toThrow()
    const after = await prisma.trainerAssignmentOffer.findUniqueOrThrow({ where: { id: o.id } })
    expect(after.status, 'صفحةٌ تقول «مفتوح» عن منقضٍ تكذب على قارئها').toBe('lapsed')
  })
})

/* ═══════════ ④ الجوابُ الآخر ═══════════ */

describe('الاعتذارُ والسحبُ والانقضاء', () => {
  it('الاعتذارُ يُغلق العرضَ بسببه، ولا يكتب إسنادا', async () => {
    const t = await mkActiveTrainer()
    const o = await offers.offer({ profileId: t.profile.id, courseId: COURSE }, adminId)
    await offers.decline(o.id, t.userId!, 'جدولي مشغولٌ في هذه الفترة')
    const after = await prisma.trainerAssignmentOffer.findUniqueOrThrow({ where: { id: o.id } })
    expect(after.status).toBe('declined')
    expect(after.declineReasonAr).toContain('جدولي')
    expect(await prisma.trainerCourseAssignment.count({ where: { profileId: t.profile.id } })).toBe(0)
  })

  it('ولا اعتذارَ بلا سبب', async () => {
    const t = await mkActiveTrainer()
    const o = await offers.offer({ profileId: t.profile.id, courseId: COURSE }, adminId)
    await expect(offers.decline(o.id, t.userId!, 'لا')).rejects.toThrow()
  })

  it('والسحبُ للمفتوح وحدَه — وما قُبِل لا يُسحَب', async () => {
    const t = await mkActiveTrainer()
    const o = await offers.offer({ profileId: t.profile.id, courseId: COURSE }, adminId)
    await offers.accept(o.id, t.userId!)
    await expect(offers.withdraw(o.id, adminId, 'تأجّلت الشعبة')).rejects.toThrow()
  })

  it('والعاملُ يُغلق ما انقضت مهلتُه', async () => {
    const t = await mkActiveTrainer()
    const o = await offers.offer({ profileId: t.profile.id, courseId: COURSE }, adminId)
    await prisma.trainerAssignmentOffer.update({
      where: { id: o.id }, data: { expiresAt: new Date(Date.now() - DAY) },
    })
    const r = await offers.lapseExpiredOffers()
    expect(r.lapsed).toBeGreaterThanOrEqual(1)
    const after = await prisma.trainerAssignmentOffer.findUniqueOrThrow({ where: { id: o.id } })
    expect(after.status).toBe('lapsed')
  })
})

/* ═══════════ ⑤ أجلُ الإعداد ═══════════ */

describe('أجلُ الإعداد يُذكَّر به ويُرفَع — ولا يسحب إسنادا', () => {
  it('⚠️ انقضاؤه يرفع الخبرَ ولا يُلغي الشعبةَ ولا الإسناد', async () => {
    const t = await mkActiveTrainer()
    const cohort = await mkCohort()
    const o = await offers.offer({ profileId: t.profile.id, courseId: COURSE, cohortId: cohort.id }, adminId)
    await offers.accept(o.id, t.userId!)
    await prisma.trainerAssignmentOffer.update({
      where: { id: o.id }, data: { prepDueAt: new Date(Date.now() - DAY) },
    })

    const r = await offers.lapsePrepDue()
    expect(r.raised).toBeGreaterThanOrEqual(1)
    const after = await prisma.trainerAssignmentOffer.findUniqueOrThrow({ where: { id: o.id } })
    expect(after.prepLapsedAt).toBeTruthy()
    /* والإسنادُ قائمٌ كما هو: شعبةٌ فيها متعلّمون لا يُبَتّ أمرُها بمؤقّت */
    expect(after.status).toBe('accepted')
    const link = await prisma.cohortTrainer.findUnique({
      where: { cohortId_profileId: { cohortId: cohort.id, profileId: t.profile.id } },
    })
    expect(link, 'سُحب إسنادٌ بمؤقّت').toBeTruthy()
  })

  it('ولا يُرفَع مرّتين — فالمنقضي يُعلَّم مرّةً', async () => {
    const t = await mkActiveTrainer()
    const o = await offers.offer({ profileId: t.profile.id, courseId: COURSE }, adminId)
    await offers.accept(o.id, t.userId!)
    await prisma.trainerAssignmentOffer.update({
      where: { id: o.id }, data: { prepDueAt: new Date(Date.now() - DAY) },
    })
    await offers.lapsePrepDue()
    const again = await offers.lapsePrepDue()
    const mine = await prisma.trainerAssignmentOffer.findUniqueOrThrow({ where: { id: o.id } })
    expect(mine.prepLapsedAt).toBeTruthy()
    expect(again.raised, 'رُفع الخبرُ ثانيةً عن أجلٍ واحد').toBe(0)
  })

  it('والإقرارُ بالجاهزيّة يطوي الأجلَ — وهو فعلُ صاحبه وحدَه', async () => {
    const t = await mkActiveTrainer()
    const other = await mkActiveTrainer()
    const o = await offers.offer({ profileId: t.profile.id, courseId: COURSE }, adminId)
    await offers.accept(o.id, t.userId!)
    await expect(offers.confirmPrep(o.id, other.userId!)).rejects.toThrow()
    await offers.confirmPrep(o.id, t.userId!)
    const after = await prisma.trainerAssignmentOffer.findUniqueOrThrow({ where: { id: o.id } })
    expect(after.prepConfirmedAt).toBeTruthy()
    /* ومن أقرّ لا يُذكَّر ولا يُرفَع عنه خبر */
    await prisma.trainerAssignmentOffer.update({
      where: { id: o.id }, data: { prepDueAt: new Date(Date.now() - DAY) },
    })
    const r = await offers.lapsePrepDue()
    expect(r.raised).toBe(0)
  })
})
