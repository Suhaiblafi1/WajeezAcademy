/* الاعتمادُ يفتح طورَ الموادّ، والنشرُ قرارٌ تالٍ — قراران لا قرار.
 * بقاعدةٍ حقيقيّة.
 *
 * ── ما كان يحرسه هذا الملفّ، ولمَ قُلب ──
 *
 * كان اسمُه `countersign-activates` ويُثبّت أنّ زرّا واحدا يختم العرضَ ويفتح
 * الحسابَ معا. وقد نُسخ ذلك بخطوات صاحب المنصّة (٢٧ سبتمبر ٢٠٢٦):
 *
 *   ② نراجع توقيعَك ونطابق الاسمَ ونعتمده · ③ نمنحك حقَّ فتح الحساب ·
 *   ④ بعدها لديك ٥ أيّام لتعديل محاور دوراتك · ⑤ يُنشر حسابُك رسميّا.
 *
 * فبين الاعتماد والنشر **طورٌ كامل**. وزرٌّ يفعلهما معا يتخطّاه.
 *
 * ── والعطبُ الذي انكشف بالتبديل ──
 *
 * طورُ الموادّ لم يكن مطروقا أصلا: من وقّع يبقى دورُه `trainer_applicant`،
 * ولا `trainer.portal` فيه. فالحالةُ تُفتح والصلاحيّةُ تردّ. فصار الاعتمادُ
 * يمنح الدورَ ويربط الملفَّ فعلا — لا ينقل حالةً وحدَها.
 *
 * ── وأدقُّ ما يُقاس هنا ──
 *
 * ① أنّ الاعتمادَ **لا ينشر**: لا `active` ولا `conditionMetAt` — وإلّا عاد
 *   الزرُّ يتخطّى الطورَ من حيث لا يُقصَد.
 * ② أنّ النشرَ **لا يُعيد ختمَ** ما خُتم: `countersignedAt` يبقى يومَ اعتُمد
 *   توقيعُه. ولو أُعيد لَقرأ العقدُ أنّنا وقّعناه بعد أن رفع موادَّه — خلافَ
 *   ما جرى، وهو محلُّ الحجّة إن نُوزع بعد سنة.
 * ③ أنّ الحمايةَ لم تسقط: من لم تُعلَن موادُّه لا يُنشَر.
 * ④ وأنّ ملحوظةَ مطابقةِ الهويّة تبقى في الصفّ بعد النشر — لا يمحوها.
 */

import { beforeAll, describe, expect, it } from 'vitest'
import { createHash } from 'node:crypto'
import type { PrismaClient } from '@prisma/client'
import { setupTestDb, testPrisma } from '../helpers/db'
import { makeReadyForApproval } from '../helpers/trainer-ready'
import { AuthService } from '../../services/auth.service'
import { TrainerReviewService } from '../../services/trainer-review.service'
import { contractAcks, CONDITION_CLAUSE_MARK } from '../../../src/application/trainer/contract-body'
import { readApprovedCourses } from '../../../src/application/trainer/contract-execution'

let prisma: PrismaClient
let auth: AuthService
let review: TrainerReviewService
let adminId = ''

const sha256 = (s: string) => createHash('sha256').update(s).digest('hex')
const BODY = `نصُّ اتفاقيّةٍ للاختبار — البند 1 وما بعده.

${CONDITION_CLAUSE_MARK} لا عقد نهائي. ونفاذه معلق على قبول الأكاديمية لمواد المدرب.`
const COURSE = 'C-SEAL-101'

beforeAll(async () => {
  await setupTestDb()
  prisma = await testPrisma()
  auth = new AuthService(prisma)
  review = new TrainerReviewService(prisma)
  const admin = await auth.register('seal-admin@test.local', 'Admin#12345', 'المدير الأكاديمي')
  adminId = admin.userId
  await auth.setRoles(adminId, ['academic_manager'])
  await prisma.course.create({ data: { id: COURSE, status: 'published', currentVersion: 1 } })
  await prisma.courseVersion.create({
    data: { courseId: COURSE, version: 1, titleAr: 'أساسيّاتُ المحاسبة', totalHours: 10 },
  })
}, 240_000)

let seq = 0

/** عرضٌ مشروطٌ وقّعه صاحبُه وينتظر ختمَنا.
 *
 *  والترتيبُ مقصود: يُوقَّع **قبل** `makeReadyForApproval` — فالسقالةُ تكتب
 *  عقدا `signed` بلا `signedAt` إن لم تجد موقَّعا، فيزاحم الحقيقيَّ على
 *  الخَتم (علّتُه في رأس `approval-annex.test.ts`). */
async function signedOffer(opts: { ready: boolean }) {
  seq += 1
  const email = `seal-${seq}-${Date.now()}@test.local`
  const user = await auth.register(email, 'Trainer#12345', `مرشّحٌ ${seq}`)
  const application = await prisma.trainerApplication.create({
    data: {
      reference: `TR-SEAL-${Date.now()}-${seq}`, fullName: `مرشّحٌ ${seq}`, email,
      status: 'conditionally_approved', motivation: 'اختبار', privacyConsentAt: new Date(),
      userId: user.userId,
    },
  })
  const profile = await prisma.trainerProfile.create({
    data: { applicationId: application.id, isVerified: true },
  })
  await prisma.trainerCourseQualification.create({
    data: { profileId: profile.id, courseId: COURSE, status: 'qualified' },
  })
  const contract = await prisma.trainerContract.create({
    data: {
      profileId: profile.id, title: `عرضٌ مشروطٌ ${seq}`, status: 'draft',
      bodyVersion: 'v-test', bodyAr: BODY, bodyHash: sha256(BODY),
      requiredDocuments: [], signerEmail: email, gatesActivation: true,
    },
  })
  const sent = await review.sendContract(contract.id, adminId)
  await review.signContractByToken(decodeURIComponent(sent.signingUrl.split('/c/')[1]), {
    legalName: `الاسمُ القانونيُّ ${seq}`, addressAr: 'عمّان — بناية ١٢',
    phone: '+962790000000', bodyHash: sha256(BODY),
    acks: contractAcks(true).map((a) => a.key),
  })
  /* ═══ ويُعلن اكتمالَ موادّه مع التجهيز ═══

     ومع `ready` لا قبلَه: فحصُ المنع يترك التجهيزَ ناقصا بقصدٍ ليُثبِت أنّ
     البوّابةَ تردّ — ولو أُعلن فيه لَبقي الردُّ قائما بعلّةٍ أخرى فاختلط
     مِحَكّا الفحصَين. */
  if (opts.ready) {
    /* والإعلانُ يُكتب في العمود لا يُنادى بالخدمة: `declareMaterialsComplete`
       تقرأ ملفَّ المدرّب **من حسابه**، وملفُّ هذا المُعِدِّ غيرُ مرتبطٍ بحسابٍ
       بقصد — فالربطُ هو ممّا يُثبِته الفحصُ نفسُه في `decide('activate')`.
       فلو رُبط هنا لأجل الإعلان لَخضرّ الفحصُ على ربطٍ صنعناه نحن.

       و`conditionPausedAt` هو ما تكتبه الخدمةُ بعينه — فالمحاكاةُ في العمود
       الذي تكتبه لا في أثرٍ جانبيّ. */
    await prisma.trainerContract.update({
      where: { id: contract.id }, data: { conditionPausedAt: new Date() },
    })
    await makeReadyForApproval(prisma, application.id, adminId)
  }
  return { application, profile, contract, userId: user.userId }
}

/** «انشُرْ حسابَه» — القرارُ التالي، وهو `decide('activate')` نفسُها */
const publish = (applicationId: string) =>
  review.decide(applicationId, adminId, 'activate', 'نشرُ الحساب بعد اعتماد الموادّ',
    { actorRoles: ['academic_manager'] })

describe('الاعتمادُ يفتح طورَ الموادّ ولا ينشر', () => {
  it('يختم توقيعَنا ويمنح الدورَ ويربط الملفَّ — ولا يجعله نشطا', async () => {
    const { application, contract, userId } = await signedOffer({ ready: true })

    const out = await review.countersignContract(contract.id, adminId, {
      noteAr: 'طابقتُ الاسمَ بجواز سفرٍ رقم X1234567',
      actorRoles: ['academic_manager'],
    })
    expect(out.countersignedAt, 'اعتُمد بلا تاريخٍ يُقرأ').not.toBeNull()
    expect(out.activated, 'قالت الشاشةُ إنّ الحسابَ نُشر — والنشرُ قرارٌ تالٍ').toBe(false)

    const sealed = await prisma.trainerContract.findUniqueOrThrow({ where: { id: contract.id } })
    expect(sealed.status, 'ضُغط الزرُّ ولم يُختَم الصفّ').toBe('countersigned')
    expect(sealed.conditionMetAt, 'تحقّق الشرطُ باعتماد التوقيع — وموادُّه لم تُقيَّم بعد')
      .toBeNull()
    expect(sealed.conditionDeadlineAt, 'اعتُمد ولا مهلةَ — فلا طورَ موادّ').not.toBeNull()

    /* والغايةُ: بابُه مفتوحٌ فعلا — حالةً ودورا وربطا */
    const app = await prisma.trainerApplication.findUniqueOrThrow({ where: { id: application.id } })
    expect(app.status, 'اعتُمد توقيعُه ولم يدخل طورَ الموادّ').toBe('onboarding')
    expect(app.status, 'نُشر حسابُه قبل أن تُقيَّم موادُّه').not.toBe('active')
    const profile = await prisma.trainerProfile.findUniqueOrThrow({
      where: { applicationId: application.id },
    })
    expect(profile.userId, 'ملفُّه غيرُ مربوطٍ بحسابه — فلا يفتح بوّابتَه').toBe(userId)
    const roles = await prisma.userRole.findMany({ where: { userId }, select: { roleId: true } })
    expect(roles.map((r) => r.roleId), 'مُنح الحالةَ ولم يُمنَح `trainer.portal`')
      .toContain('trainer')
  })

  it('والنشرُ قرارٌ تالٍ: يكتب تحقّقَ الشرط وملحقَه، ولا يُعيد ختمَ ما خُتم', async () => {
    const { application, contract } = await signedOffer({ ready: true })
    await review.countersignContract(contract.id, adminId, {
      noteAr: 'طابقتُ الاسمَ بجواز سفرٍ رقم X1234567',
      actorRoles: ['academic_manager'],
    })
    const atApproval = (await prisma.trainerContract.findUniqueOrThrow({
      where: { id: contract.id },
    })).countersignedAt!

    await publish(application.id)

    const after = await prisma.trainerContract.findUniqueOrThrow({ where: { id: contract.id } })
    expect(after.conditionMetAt, 'نُشر ولم يُكتب تحقّقُ الشرط').not.toBeNull()
    /* ═══ وتاريخُ توقيعنا لا يتحرّك ═══
       لو أُعيد لَقرأ العقدُ أنّنا وقّعناه يومَ النشر، بعد أن رفع موادَّه —
       وذاك نقضُ ترتيبِ ما جرى في وثيقةٍ محلُّها النزاع. */
    expect(after.countersignedAt!.getTime(), 'أُعيد ختمُ العقد يومَ النشر')
      .toBe(atApproval.getTime())
    /* والملحقُ (وعدُ البند 2-11) يُكتب عند النشر — فهو ما اعتُمد من دوراته */
    expect(readApprovedCourses(after.approvedCoursesSnapshot).map((c) => c.titleAr))
      .toEqual(['أساسيّاتُ المحاسبة'])

    const app = await prisma.trainerApplication.findUniqueOrThrow({ where: { id: application.id } })
    expect(app.status, 'اعتُمدت موادُّه ولم يُنشَر حسابُه').toBe('active')
  })

  it('وملحوظةُ مطابقةِ الهويّة تبقى في الصفّ بعد النشر', async () => {
    const { application, contract } = await signedOffer({ ready: true })
    await review.countersignContract(contract.id, adminId, {
      noteAr: 'طابقتُ الاسمَ بهويّةٍ أردنيّةٍ رقم 9891234567',
      actorRoles: ['academic_manager'],
    })
    await publish(application.id)
    const sealed = await prisma.trainerContract.findUniqueOrThrow({ where: { id: contract.id } })
    expect(sealed.countersignNoteAr ?? '', 'محا النشرُ ملحوظةَ من طابق الهويّة')
      .toContain('9891234567')
  })

  it('ولا يُنشَر من لم تُعلَن موادُّه — والحمايةُ لم تسقط مع الزرّ', async () => {
    const { application, contract } = await signedOffer({ ready: false })

    /* والاعتمادُ نفسُه يمرّ: هو نظرٌ في توقيعه لا في موادّه */
    await expect(review.countersignContract(contract.id, adminId, {
      noteAr: 'طابقتُ الاسمَ', actorRoles: ['academic_manager'],
    })).resolves.toMatchObject({ ok: true })

    /* والنشرُ يُردّ — وهو موضعُ الحماية اليوم */
    await expect(publish(application.id)).rejects.toMatchObject({ code: 'not_ready' })

    const still = await prisma.trainerContract.findUniqueOrThrow({ where: { id: contract.id } })
    expect(still.conditionMetAt, 'تحقّق الشرطُ لمن لم يُعلن موادَّه').toBeNull()
    const app = await prisma.trainerApplication.findUniqueOrThrow({ where: { id: application.id } })
    expect(app.status, 'نُشر من رُدّ نشرُه').not.toBe('active')
  })
})
