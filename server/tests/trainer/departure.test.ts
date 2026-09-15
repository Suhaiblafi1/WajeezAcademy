/* رحيلُ مدرّب على قاعدةٍ حقيقيّة (ن-٩ · ن-١٠).

   وأثقلُ ما هنا قاعدتان تحملان السمعةَ:

   ① **القرارُ قبل الرسالة** — لا تخرج على صفٍّ لم يُقرَّر. فلا يقرأ متعلّمٌ
      «رحل مدرّبُك» ثمّ ينتظر.
   ② **والاختيارُ لصاحبه** — لا يُحَلّ صفٌّ بردٍّ ولا برصيدٍ قبل أن يختار،
      ولا يُنفَّذ مآلٌ يخالف ما اختاره. */

import { beforeAll, describe, expect, it } from 'vitest'
import type { PrismaClient } from '@prisma/client'
import { setupTestDb, testPrisma } from '../helpers/db'
import { AuthService } from '../../services/auth.service'
import { TrainerApplicationService } from '../../services/trainer-application.service'
import { TrainerReviewService } from '../../services/trainer-review.service'
import { TrainerDepartureService } from '../../services/trainer-departure.service'
import {
  CHOICE_LABEL_AR, LEARNER_CHOICES,
} from '../../../src/application/trainer/departure-rules'

let prisma: PrismaClient
let auth: AuthService
let apps: TrainerApplicationService
let review: TrainerReviewService
let dep: TrainerDepartureService
let adminId: string

const base = {
  phoneCountryCode: '+962', phone: '771050000', country: 'الأردن', timezone: 'Asia/Amman',
  jobTitle: 'مدرّب', specialties: ['الأتمتة'],
  domainYears: '8-12' as const, trainingYears: 'formal_teaching',
  bio: 'خبرة', trainingLanguages: ['العربية'], deliveryMode: 'both' as const,
  motivation: 'درّبتُ فرقا حقيقيّةً في بيئات عملٍ عربيّة، وأعرف الفرقَ بين من يعرف المادّة ومن يستطيع تعليمها. سأعطي كلَّ متعلّمٍ مهمّةً من واقع عمله في كلّ وحدة، وأراجع مخرجاته بنفسي وأكتب له ما ينقصه تحديدا لا تقييما عاما.',
  privacyConsent: true as const,
  password: 'Trainer#12345',
}

async function trainer(email: string, fullName: string, courseIds: string[]) {
  const res = await apps.submitPhase1({ ...base, email, fullName })
  const row = await prisma.trainerApplication.findUniqueOrThrow({ where: { reference: res.reference } })
  await apps.completePhase2(res.reference, res.candidateToken, {
    previousCourses: [], teachableCourseIds: [], availability: { seasons: ['nov_jan'] },
    demoConsent: true, contact: { channel: 'email' },
  })
  await prisma.trainerApplication.update({ where: { id: row.id }, data: { emailVerifiedAt: new Date() } })
  await review.decide(row.id, adminId, 'approve', 'اعتماد')
  const profile = await prisma.trainerProfile.findUniqueOrThrow({ where: { applicationId: row.id } })
  for (const courseId of courseIds) {
    await prisma.trainerCourseQualification.create({ data: { profileId: profile.id, courseId } })
  }
  return profile.id
}

async function cohort(id: string, courseId: string, title: string, profileId?: string) {
  const c = await prisma.cohort.create({
    data: { id, courseId, title, status: 'active', capacity: 20 },
  })
  if (profileId) {
    await prisma.cohortTrainer.create({ data: { cohortId: c.id, profileId, role: 'lead' } })
  }
  return c.id
}

/** شراءُ الشعبة فعلا: طلبٌ ببندِ `cohort` وفاتورةٌ ودفعةٌ ناجحة */
async function paidFor(userId: string, cohortId: string, amount: number) {
  const order = await prisma.order.create({
    data: {
      userId, status: 'paid', subtotal: amount, total: amount, paidAt: new Date(),
      items: { create: { kind: 'cohort', refId: cohortId, titleAr: 'شعبة', unitPrice: amount } },
    },
  })
  const invoice = await prisma.invoice.create({
    data: { number: `WJ-INV-TEST-${order.id.slice(0, 8)}`, orderId: order.id, amount, status: 'paid', paidAt: new Date() },
  })
  return prisma.payment.create({
    data: {
      invoiceId: invoice.id, provider: 'manual', amount, status: 'succeeded',
      idempotencyKey: `test-${order.id}`, succeededAt: new Date(),
    },
  })
}

async function learner(email: string, name: string, cohortId: string) {
  const u = await auth.register(email, 'Learner#12345', name)
  const e = await prisma.enrollment.create({
    data: { cohortId, userId: u.userId, status: 'enrolled' },
  })
  return { userId: u.userId, enrollmentId: e.id }
}

beforeAll(async () => {
  await setupTestDb()
  prisma = await testPrisma()
  auth = new AuthService(prisma)
  apps = new TrainerApplicationService(prisma)
  review = new TrainerReviewService(prisma)
  dep = new TrainerDepartureService(prisma)
  const admin = await auth.register('admin-dep@test.local', 'Admin#12345', 'المدير')
  adminId = admin.userId
  await auth.setRoles(adminId, ['academic_manager'])

  for (const [id, t] of [['C-DEP-1', 'دورةُ الرحيل'], ['C-DEP-2', 'دورةٌ أخرى']] as const) {
    await prisma.course.create({ data: { id, status: 'published', currentVersion: 1 } })
    await prisma.courseVersion.create({ data: { courseId: id, version: 1, titleAr: t, totalHours: 10 } })
  }
}, 180_000)

describe('ن-٩ · الطريقُ الأوّل: بديلٌ يأخذ مكانَه', () => {
  it('يُفتح الملفُّ فيَعُدّ كلَّ متعلّمٍ في شعبه الحيّة — ولا يُترك اسمٌ خارجَه', async () => {
    const gone = await trainer('dep-a@test.local', 'الراحلُ أ', ['C-DEP-1'])
    const c = await cohort(crypto.randomUUID(), 'C-DEP-1', 'شعبةُ أ', gone)
    await learner('l-a1@test.local', 'متعلّمٌ ١', c)
    await learner('l-a2@test.local', 'متعلّمٌ ٢', c)

    const d = await dep.open(adminId, gone, 'انتهى تعاقدُنا معه')
    expect(d.learners, 'لم يُحصَ كلُّ من في شعبه').toBe(2)

    const full = await dep.detail(d.id)
    expect(full.cases).toHaveLength(2)
    expect(full.cases.every((x) => x.outcome === 'pending')).toBe(true)
  })

  it('والبديلُ يُحَلّ به كلُّ من في الشعبة دفعةً — فلا يتحرّك إلّا الاسم', async () => {
    const gone = await trainer('dep-b@test.local', 'الراحلُ ب', ['C-DEP-1'])
    const sub = await trainer('dep-b2@test.local', 'البديلُ ب', ['C-DEP-1'])
    const c = await cohort(crypto.randomUUID(), 'C-DEP-1', 'شعبةُ ب', gone)
    const l1 = await learner('l-b1@test.local', 'متعلّمٌ ٣', c)
    await learner('l-b2@test.local', 'متعلّمٌ ٤', c)

    const d = await dep.open(adminId, gone, 'سافر ولم يعد')

    /* والقائمةُ تُنتجها المنصّةُ — البديلُ فيها لأنّه مؤهَّلٌ لدورة الشعبة */
    const subs = await dep.substitutesFor(c)
    expect(subs.some((s) => s.profileId === sub), 'لم تُنتج المنصّةُ البديلَ المؤهَّل').toBe(true)

    const r = await dep.substitute(adminId, d.id, c, sub)
    expect(r.resolved, 'لم يُحَلّ كلُّ من في الشعبة دفعةً').toBe(2)

    /* لم يتحرّك إلّا الاسم: التسجيلُ في شعبته، والشعبةُ بمدرّبها الجديد */
    const e = await prisma.enrollment.findUniqueOrThrow({ where: { id: l1.enrollmentId } })
    expect(e.cohortId, 'تحرّك مقعدُ المتعلّم وكان يكفي تغييرُ الاسم').toBe(c)
    const lead = await prisma.cohortTrainer.findMany({ where: { cohortId: c } })
    expect(lead).toHaveLength(1)
    expect(lead[0].profileId).toBe(sub)
  })

  it('ولا يُسنَد بديلٌ غيرُ مؤهَّلٍ لدورة الشعبة', async () => {
    const gone = await trainer('dep-c@test.local', 'الراحلُ ج', ['C-DEP-1'])
    const other = await trainer('dep-c2@test.local', 'غيرُ مؤهَّل', ['C-DEP-2'])
    const c = await cohort(crypto.randomUUID(), 'C-DEP-1', 'شعبةُ ج', gone)
    await learner('l-c1@test.local', 'متعلّمٌ ٥', c)
    const d = await dep.open(adminId, gone, 'أنهى تعاقدَه معنا')
    await expect(dep.substitute(adminId, d.id, c, other)).rejects.toMatchObject({ status: 409 })
  })
})

describe('ن-٩ · الطريقُ الثاني: النظيرُ معرَّفٌ لا مجتهَدٌ فيه', () => {
  it('يُنقل المتعلّمُ إلى شعبةٍ على الرمز نفسِه — وهنا يثمر ح-٣', async () => {
    const gone = await trainer('dep-d@test.local', 'الراحلُ د', ['C-DEP-1'])
    const from = await cohort(crypto.randomUUID(), 'C-DEP-1', 'شعبةُ د', gone)
    const to = await cohort(crypto.randomUUID(), 'C-DEP-1', 'شعبةٌ نظيرة')
    const l = await learner('l-d1@test.local', 'متعلّمٌ ٦', from)
    const d = await dep.open(adminId, gone, 'أنهى تعاقدَه معنا')
    const [c1] = (await dep.detail(d.id)).cases

    const eq = await dep.equivalentCohorts(c1.id)
    expect(eq.some((x) => x.cohortId === to), 'لم تُعرض الشعبةُ النظيرة').toBe(true)

    await dep.moveLearner(adminId, c1.id, to, 'لا بديلَ مؤهَّل')
    const e = await prisma.enrollment.findUniqueOrThrow({ where: { id: l.enrollmentId } })
    expect(e.cohortId, 'لم يُنقل فعلا').toBe(to)
  })

  it('ولا يُنقل إلى رمزٍ آخر — فذاك تغييرٌ لما دفع لأجله', async () => {
    const gone = await trainer('dep-e@test.local', 'الراحلُ هـ', ['C-DEP-1'])
    const from = await cohort(crypto.randomUUID(), 'C-DEP-1', 'شعبةُ هـ', gone)
    const alien = await cohort(crypto.randomUUID(), 'C-DEP-2', 'دورةٌ أخرى تماما')
    await learner('l-e1@test.local', 'متعلّمٌ ٧', from)
    const d = await dep.open(adminId, gone, 'أنهى تعاقدَه معنا')
    const [c1] = (await dep.detail(d.id)).cases
    await expect(dep.moveLearner(adminId, c1.id, alien)).rejects.toMatchObject({ status: 409 })
  })
})

describe('ن-١٠ · والاختيارُ لصاحبه', () => {
  it('لا يُحَلّ بردٍّ ولا برصيدٍ قبل أن يختار', async () => {
    const gone = await trainer('dep-f@test.local', 'الراحلُ و', ['C-DEP-1'])
    const c = await cohort(crypto.randomUUID(), 'C-DEP-1', 'شعبةُ و', gone)
    await learner('l-f1@test.local', 'متعلّمٌ ٨', c)
    const d = await dep.open(adminId, gone, 'أنهى تعاقدَه معنا')
    const [c1] = (await dep.detail(d.id)).cases

    await dep.offerChoice(adminId, c1.id, 'لا بديلَ ولا نظير')
    /* عُرض ولم يُختر — فالتنفيذُ يُردّ */
    await expect(dep.settleChoice(adminId, c1.id, { amount: 100 })).rejects.toMatchObject({ status: 409 })
  })

  it('ويختار هو، فيُنفَّذ ما اختاره — والرصيدُ كوبونٌ باسمه لا يتداوله أحد', async () => {
    const gone = await trainer('dep-g@test.local', 'الراحلُ ز', ['C-DEP-1'])
    const c = await cohort(crypto.randomUUID(), 'C-DEP-1', 'شعبةُ ز', gone)
    const l = await learner('l-g1@test.local', 'متعلّمٌ ٩', c)
    const d = await dep.open(adminId, gone, 'أنهى تعاقدَه معنا')
    const [c1] = (await dep.detail(d.id)).cases
    await dep.offerChoice(adminId, c1.id)

    /* ما عُرض عليه يظهر في بوّابته — ولا يختار عنه أحد */
    const mine = await dep.myOpenChoices(l.userId)
    expect(mine.some((x) => x.caseId === c1.id), 'لا يرى ما عُرض عليه').toBe(true)

    await dep.chooseAsLearner(l.userId, c1.id, 'credit')
    await dep.settleChoice(adminId, c1.id, { amount: 100, bonus: 20 })

    const row = await prisma.departureCase.findUniqueOrThrow({ where: { id: c1.id } })
    expect(row.outcome).toBe('credited')

    const coupon = await prisma.coupon.findFirst({ where: { restrictedToUserId: l.userId } })
    expect(coupon, 'اختار رصيدا ولا رصيدَ له').toBeTruthy()
    expect(Number(coupon!.amountOff), 'الرصيدُ بلا الزيادةِ لأجل ما سبّبناه').toBe(120)
    expect(coupon!.maxUses, 'رصيدٌ يُستعمل مرارا').toBe(1)
  })

  /* ═══ وعرضٌ صامتٌ ليس عرضا ═══

     `offerChoice` كانت تكتب `choiceOfferedAt` وتصمت: علامةٌ في قاعدةٍ لا
     يبلغها صاحبُها إلّا أن يدخل بوّابتَه مصادفةً. و«الاختيارُ لصاحبه» لا
     تتحقّق بخيارٍ لا يعلم به — تصير انتظارا لا يعرف صاحبُه أنّه ينتظره.

     والنصُّ يُقابَل بـ`CHOICE_LABEL_AR` لا بعبارةٍ مكتوبةٍ هنا: من زاد
     خيارا ثالثا فنسي البريدَ سقط هذا الفحص. */
  it('ويخرج البلاغُ بالعرض — وفيه الخياران بنصّهما لا إشارةٌ إليهما', async () => {
    const gone = await trainer('dep-l@test.local', 'الراحلُ ل', ['C-DEP-1'])
    const c = await cohort(crypto.randomUUID(), 'C-DEP-1', 'شعبةُ ل', gone)
    const l = await learner('l-l1@test.local', 'متعلّمٌ ١٢', c)
    const d = await dep.open(adminId, gone, 'أنهى تعاقدَه معنا')
    const [c1] = (await dep.detail(d.id)).cases

    await dep.offerChoice(adminId, c1.id, 'راجعنا كلَّ شعبِ الرمز فلم نجد نظيرا')

    const n = await prisma.notification.findFirst({
      where: { userId: l.userId, templateKey: 'departure.choice' },
    })
    expect(n, 'عُرض عليه خيارٌ ولم يُبلَّغ به — انتظارٌ لا يعلم صاحبُه أنّه فيه').toBeTruthy()
    for (const ch of LEARNER_CHOICES) {
      expect(n!.body, `«${ch}» ليس في البلاغ — يُطلب منه أن يختار بين ما لم يُعرض`)
        .toContain(CHOICE_LABEL_AR[ch])
    }
    expect(n!.body, 'سببُ العرضِ لم يصل صاحبَه').toContain('فلم نجد نظيرا')
  })

  /* ولا يُرسَل اسمُ الراحل إلى بوّابة المتعلّم: قاعدةُ `CLAUDE.md` تقصر
     عرضَ أسماء المدرّبين على المعتمَدِ نشرُه، والراحلُ قد لا يكون منهم.
     وبوّابةُ المتعلّم لا تسمّي مدرّبا في موضعٍ واحدٍ أصلا — تقول «مدرّبك». */
  it('ولا يحمل ما يصله اسمَ الراحل — والحقلُ الذي لا يُعرض لا يُرسَل', async () => {
    const gone = await trainer('dep-m@test.local', 'الراحلُ م', ['C-DEP-1'])
    const c = await cohort(crypto.randomUUID(), 'C-DEP-1', 'شعبةُ م', gone)
    const l = await learner('l-m1@test.local', 'متعلّمٌ ١٣', c)
    const d = await dep.open(adminId, gone, 'أنهى تعاقدَه معنا')
    const [c1] = (await dep.detail(d.id)).cases
    await dep.offerChoice(adminId, c1.id)

    const [mine] = await dep.myOpenChoices(l.userId)
    const carried = JSON.stringify(mine)
    expect(carried, 'اسمُ الراحل يصل بوّابةَ المتعلّم').not.toContain('الراحلُ م')

    const n = await prisma.notification.findFirstOrThrow({
      where: { userId: l.userId, templateKey: 'departure.choice' },
    })
    expect(n.body + n.title, 'اسمُه في نصّ البلاغ').not.toContain('الراحلُ م')
  })

  /* ═══ «رُفع الطلبُ إلى الماليّة» — فليُرفع ═══

     كان الردُّ سطرا في السجلّ وحدَه: لا `Refund` ولا شيءَ يصل الماليّة،
     ونصُّ البلاغ يقول لصاحب المال إنّ طلبَه رُفع. وهو أخطرُ ما مرّ في هذا
     الملفّ — إذ بُني كلُّه على ألّا تَعِد رسالةٌ بما لم يقع.

     والحارسُ على **الأثر** لا على النصّ: صفٌّ في `Refund` حالتُه `pending`،
     يبقى إقرارُه لمن يملك صلاحيّةَ الماليّة. */
  it('ويُرفع طلبُ الردِّ فعلا إلى الماليّة — لا سطرا في السجلّ وحدَه', async () => {
    const gone = await trainer('dep-n@test.local', 'الراحلُ ن', ['C-DEP-1'])
    const c = await cohort(crypto.randomUUID(), 'C-DEP-1', 'شعبةُ ن', gone)
    const l = await learner('l-n1@test.local', 'متعلّمٌ ١٤', c)
    const pay = await paidFor(l.userId, c, 400)

    /* وله شراءٌ آخرُ لا علاقةَ له بهذه الشعبة. وبدونه يمرّ ترشيحٌ يقول
       «أيُّ دفعةِ شعبةٍ للمتعلّم» — فتُعرَض دفعةُ دورةٍ أخرى ويُردّ منها. */
    const other = await cohort(crypto.randomUUID(), 'C-DEP-2', 'شعبةٌ أخرى لا تخصّه')
    const otherPay = await paidFor(l.userId, other, 900)

    const d = await dep.open(adminId, gone, 'أنهى تعاقدَه معنا')
    const [c1] = (await dep.detail(d.id)).cases
    await dep.offerChoice(adminId, c1.id)
    await dep.chooseAsLearner(l.userId, c1.id, 'refund')

    /* الدفعةُ تُعرَض ولا تُخمَّن — وهي بندُ هذه الشعبة بعينها */
    const payable = await dep.refundablePayments(c1.id)
    expect(payable.map((p) => p.paymentId), 'دفعةُ هذه الشعبة لا تُعرَض').toContain(pay.id)
    expect(payable.map((p) => p.paymentId), 'دفعةُ شعبةٍ أخرى تُعرَض — يُردّ من شراءٍ لا يخصّ هذا الصفّ')
      .not.toContain(otherPay.id)
    expect(payable, 'أكثرُ من دفعةٍ لشعبةٍ اشتُريت مرّة').toHaveLength(1)
    expect(payable[0].remaining).toBe(400)

    /* ولا يُرفع طلبٌ بلا دفعةٍ خلفَه */
    await expect(dep.settleChoice(adminId, c1.id, { amount: 300 }))
      .rejects.toMatchObject({ status: 400 })

    await dep.settleChoice(adminId, c1.id, { amount: 300, paymentId: pay.id })

    const refund = await prisma.refund.findFirst({ where: { paymentId: pay.id } })
    expect(refund, 'قيل له «رُفع الطلبُ» ولا طلبَ في الماليّة').toBeTruthy()
    expect(Number(refund!.amount)).toBe(300)
    expect(refund!.status, 'صُرف من هذه الشاشة — والإقرارُ صلاحيّةٌ ماليّةٌ مستقلّة').toBe('pending')
    expect(refund!.processedAt, 'نُفِّذ بلا إقرار').toBeNull()
  })

  it('ولا يختار غيرُ صاحبه', async () => {
    const gone = await trainer('dep-h@test.local', 'الراحلُ ح', ['C-DEP-1'])
    const c = await cohort(crypto.randomUUID(), 'C-DEP-1', 'شعبةُ ح', gone)
    await learner('l-h1@test.local', 'متعلّمٌ ١٠', c)
    const stranger = await auth.register('stranger@test.local', 'Learner#12345', 'غريب')
    const d = await dep.open(adminId, gone, 'أنهى تعاقدَه معنا')
    const [c1] = (await dep.detail(d.id)).cases
    await dep.offerChoice(adminId, c1.id)
    await expect(dep.chooseAsLearner(stranger.userId, c1.id, 'refund')).rejects.toMatchObject({ status: 404 })
  })
})

describe('ن-٩ · قاعدةُ السمعة: القرارُ قبل الرسالة', () => {
  it('لا تخرج الرسالةُ على صفٍّ لم يُقرَّر', async () => {
    const gone = await trainer('dep-i@test.local', 'الراحلُ ط', ['C-DEP-1'])
    const c = await cohort(crypto.randomUUID(), 'C-DEP-1', 'شعبةُ ط', gone)
    await learner('l-i1@test.local', 'متعلّمٌ ١١', c)
    const d = await dep.open(adminId, gone, 'أنهى تعاقدَه معنا')
    const [c1] = (await dep.detail(d.id)).cases

    await expect(dep.notify(adminId, c1.id)).rejects.toMatchObject({ status: 409 })
    const row = await prisma.departureCase.findUniqueOrThrow({ where: { id: c1.id } })
    expect(row.notifiedAt, 'أُبلغ قبل أن يُقرَّر').toBeNull()
  })

  it('وتخرج بعده — وتحمل ما يجري لا اعتذارا', async () => {
    const gone = await trainer('dep-j@test.local', 'الراحلُ ي', ['C-DEP-1'])
    const sub = await trainer('dep-j2@test.local', 'البديلُ ي', ['C-DEP-1'])
    const c = await cohort(crypto.randomUUID(), 'C-DEP-1', 'شعبةُ ي', gone)
    const l = await learner('l-j1@test.local', 'متعلّمٌ ١٢', c)
    const d = await dep.open(adminId, gone, 'أنهى تعاقدَه معنا')
    await dep.substitute(adminId, d.id, c, sub)
    const [c1] = (await dep.detail(d.id)).cases

    /* ي-٤: ولم تعد تُطلَب بيد — `substitute` أعلاه أبلغ صاحبَها معه.
       فالحارسُ باقٍ على جوهره (الرسالةُ تخرج بعد القرار وتحمل ما بعده)
       وصار أقوى: تخرج بلا أن يتذكّرها أحد. */
    expect(c1).toBeTruthy()
    const note = await prisma.notification.findFirst({
      where: { userId: l.userId, templateKey: 'departure.resolved' },
    })
    expect(note, 'لم يصل الخبرُ صاحبَه').toBeTruthy()
    expect(note!.body, 'الرسالةُ لا تقول ما يجري بعدها').toMatch(/مقعدُك وجدولُك/)
  })
})

describe('ولا تُغلق الحالةُ واسمٌ معلَّق', () => {
  it('يُردّ الإغلاقُ ويقول العددَ لا «غيرُ مكتملة»', async () => {
    const gone = await trainer('dep-k@test.local', 'الراحلُ ك', ['C-DEP-1'])
    const sub = await trainer('dep-k2@test.local', 'البديلُ ك', ['C-DEP-1'])
    const c = await cohort(crypto.randomUUID(), 'C-DEP-1', 'شعبةُ ك', gone)
    await learner('l-k1@test.local', 'متعلّمٌ ١٣', c)
    const d = await dep.open(adminId, gone, 'أنهى تعاقدَه معنا')

    await expect(dep.close(adminId, d.id)).rejects.toMatchObject({ status: 409 })

    await dep.substitute(adminId, d.id, c, sub)

    /* ═══ حُلّ ولم يُبلَّغ — وذلك أيضا يمنع الإغلاق ═══

       وصارت هذه الحالُ تُبنى صراحةً بعد ي-٤: القرارُ صار يُبلِغ بنفسه، فلا
       يبقى المقرَّرُ غيرَ المُبلَّغ حالا تقع بالسهو. **لكنّها لم تزل ممكنة**:
       `tellResolved` يبتلع خطأ الإرسال ويردّ `false` ولا يضع `notifiedAt` —
       كي لا يُنقض قرارٌ وقع في القاعدة لأنّ جرسا لم يُقرع. فمن أخفق إبلاغُه
       يبقى معلَّقا، والحاجزُ هو ما يمنع طيَّ ملفّه عليه. */
    await prisma.departureCase.updateMany({ where: { departureId: d.id }, data: { notifiedAt: null } })
    const blocked = await dep.detail(d.id)
    expect(blocked.canClose, 'أُغلق وفيه من لم يُبلَّغ').toBe(false)
    expect(blocked.closeBlockersAr.join(' ')).toMatch(/لم يُبلَّغ/)

    const [c1] = blocked.cases
    await dep.notify(adminId, c1.id)
    const ready = await dep.detail(d.id)
    expect(ready.canClose, 'حُلّ الجميعُ وأُبلغوا ولا يُغلق').toBe(true)
    await dep.close(adminId, d.id)
  })
})

/* ═══ ي-٤ · والإبلاغُ مسارُ شيفرةٍ لا زرٌّ يُنتظَر ═══

   `departure.resolved` كان يصل صاحبَه فعلا — **بيدِ موظّفٍ يضغط «أبلِغه»
   مرّةً لكلِّ متعلّم**. و`substitute` يحلّ صفوفَ الشعبة كلَّها في نداءٍ
   واحد: فالعبءُ يكبر بكِبَر الشعبة، وهو بعينه الموضعُ الذي يُترك فيه.
   ولا وظيفةَ تذكّر ولا حدَّ للتأخير — وحدَه `close` يمنع إغلاق ملفٍّ فيه
   من قُرِّر أمرُه ولم يُبلَّغ، ولا شيءَ يوجب الإغلاق.

   وحارسُ ي-٣ البنيويُّ لا يرى شيئا من هذا: نداءُ الإرسال كان موجودا في
   الملفّ، في طريقةٍ أخرى ينادِيها زرّ. فالفحصُ على القاعدة. */
describe('ي-٤ · ما قُرّر يبلغ صاحبَه بلا انتظارِ زرّ', () => {
  const told = (userId: string, key = 'departure.resolved') =>
    prisma.notification.findFirst({ where: { userId, templateKey: key } })

  it('البديلُ يُبلَّغ به كلُّ من حُلَّ أمرُه — لا واحدٌ لكلِّ ضغطة', async () => {
    const gone = await trainer('dep-tell1@test.local', 'الراحلُ ط', ['C-DEP-1'])
    const sub = await trainer('dep-tell2@test.local', 'البديلُ ط', ['C-DEP-1'])
    const c = await cohort(crypto.randomUUID(), 'C-DEP-1', 'شعبةُ البلاغ', gone)
    const a = await learner('l-tell1@test.local', 'متعلّمُ البلاغ ١', c)
    const b = await learner('l-tell2@test.local', 'متعلّمُ البلاغ ٢', c)
    const d = await dep.open(adminId, gone, 'سافر ولم يعد')

    const r = await dep.substitute(adminId, d.id, c, sub)
    expect(r.resolved).toBe(2)
    expect(r.told, 'حُلَّ أمرُ اثنَين وأُبلغ أقلُّ منهما').toBe(2)
    expect(await told(a.userId), 'حُلَّ أمرُه ولم يُبلَّغ').not.toBeNull()
    expect(await told(b.userId), 'حُلَّ أمرُ أخيه ولم يُبلَّغ هو').not.toBeNull()

    /* ولا يُبلَّغ مرّتَين: الزرُّ يبقى لمن تعذّر إبلاغُه، ويردّ على المُبلَّغ */
    const [c1] = (await dep.detail(d.id)).cases
    await expect(dep.notify(adminId, c1.id)).rejects.toMatchObject({ status: 409 })
  })

  it('والنقلُ إلى نظيرٍ يُبلَّغ به صاحبُ المقعد — ومقعدُه انتقل فعلا', async () => {
    const gone = await trainer('dep-tell3@test.local', 'الراحلُ ي', ['C-DEP-1'])
    const from = await cohort(crypto.randomUUID(), 'C-DEP-1', 'شعبةُ النقل', gone)
    const to = await cohort(crypto.randomUUID(), 'C-DEP-1', 'الشعبةُ النظيرة')
    const l = await learner('l-tell3@test.local', 'متعلّمُ النقل', from)
    const d = await dep.open(adminId, gone, 'أنهى تعاقدَه')
    const [c1] = (await dep.detail(d.id)).cases

    const moved = await dep.moveLearner(adminId, c1.id, to, 'لا بديلَ مؤهَّل')
    expect(moved.told, 'انتقل مقعدُه ولم يُبلَّغ').toBe(true)
    expect(await told(l.userId)).not.toBeNull()
  })

  it('والرصيدُ يصل ومعه رمزُه — فلا يُقال «لك رصيد» بلا ما يُستعمل به', async () => {
    const gone = await trainer('dep-tell4@test.local', 'الراحلُ ك', ['C-DEP-1'])
    const c = await cohort(crypto.randomUUID(), 'C-DEP-1', 'شعبةُ الرصيد', gone)
    const l = await learner('l-tell4@test.local', 'متعلّمُ الرصيد', c)
    const d = await dep.open(adminId, gone, 'أنهى تعاقدَه')
    const [c1] = (await dep.detail(d.id)).cases
    await dep.offerChoice(adminId, c1.id)
    await dep.chooseAsLearner(l.userId, c1.id, 'credit')
    await dep.settleChoice(adminId, c1.id, { amount: 100, bonus: 20 })

    const note = await told(l.userId)
    expect(note, 'صُرف له رصيدٌ ولم يُبلَّغ').not.toBeNull()
    const coupon = await prisma.coupon.findFirstOrThrow({ where: { restrictedToUserId: l.userId } })
    expect(
      note!.body,
      'أُخبِر أنّ له رصيدا ولم يُخبَر برمزه — فلا يعرف بمَ يستعمله',
    ).toContain(coupon.code)
  })

  it('واختيارُ صاحبِ المقعد يستدعي الإدارةَ — فلا يبقى في عمودٍ لا يراه أحد', async () => {
    const gone = await trainer('dep-tell5@test.local', 'الراحلُ ل', ['C-DEP-1'])
    const c = await cohort(crypto.randomUUID(), 'C-DEP-1', 'شعبةُ الاستدعاء', gone)
    const l = await learner('l-tell5@test.local', 'متعلّمُ الاستدعاء', c)
    const d = await dep.open(adminId, gone, 'أنهى تعاقدَه')
    const [c1] = (await dep.detail(d.id)).cases
    await dep.offerChoice(adminId, c1.id)

    await dep.chooseAsLearner(l.userId, c1.id, 'refund')

    /* و`adminId` يحمل دورا إداريّا في هذا الملفّ — فهو ممّن يُستدعى.
       والبحثُ يُقيَّد بشعبةِ هذا الصفّ: هذا الملفُّ يستدعي الإدارةَ مرارا،
       و`findFirst` بلا قيدٍ يلتقط استدعاءَ اختبارٍ سابقٍ فيخضرّ على غيره. */
    const summoned = await prisma.notification.findFirst({
      where: { userId: adminId, templateKey: 'departure.chosen', body: { contains: 'شعبةُ الاستدعاء' } },
    })
    expect(summoned, 'اختار صاحبُ المقعد ولم يُستدعَ أحدٌ لتنفيذه').not.toBeNull()
    expect(summoned!.body, 'الاستدعاءُ لا يقول ماذا اختار').toContain(CHOICE_LABEL_AR.refund)
  })
})
