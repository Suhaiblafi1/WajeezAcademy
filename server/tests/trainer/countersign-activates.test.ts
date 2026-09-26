/* «اعتمِدْ وفعِّلْ» — الزرُّ الواحدُ يختم العرضَ ويفتح الحساب. بقاعدةٍ حقيقيّة.
 *
 * ── العطبُ الذي يحرسه ──
 *
 * بلاغُ صاحب المنصّة (٢٦ سبتمبر ٢٠٢٦): «عندما أقوم بتوقيع الاتفاقية منّي
 * كأدمن لا يتمّ التوقيع ولا يتغيّر شيءٌ بالصفحة ولا يصل للمدرّب شيء».
 *
 * وعلّتُه أنّ `countersignContract` كانت ترمي 409 `conditional_offer` على كلّ
 * عرضٍ مشروطٍ موقَّع، والزرُّ معروضٌ عليه في شاشة العقود. فيُضغط فيُردّ — كلَّ
 * مرّة. وقرارُ صاحب المنصّة أن يكون هذا الزرُّ هو المعبر: يُختَم العرضُ،
 * ويصير صاحبُه نشطا، وتُفتح بوّابتُه، ويصله العقدُ مختوما.
 *
 * ── وأدقُّ ما يُقاس: أنّ الحمايةَ لم تسقط مع البابِ المسدود ──
 *
 * الطورُ المشروطُ كلُّه بُني ليمنع أن يصير العرضُ عقدا نافذا **قبل أن تُقيَّم
 * موادُّه**. ولو صار الزرُّ يختم بلا فحصٍ لَسقطت تلك الحماية. وهي لم تسقط:
 * النداءُ يمرّ من `decide('activate')` نفسِها، فبوّابةُ التجهيز تفحص كما
 * تفحص من ملفّ المدرّب. فيُبنى مدرّبٌ ناقصُ التجهيز ويُضغَط عليه الزرُّ،
 * ويُقاس أنّه **رُدّ** وأنّ الصفَّ لم يُختَم — وهو الفحصُ الذي يُبقي القرارَ
 * الجديدَ من غير أن ينقض ما قبله.
 *
 * ── وملحوظةُ مطابقةِ الهويّة ──
 *
 * الحقلُ الذي يكتب فيه المعتمِدُ ما طابقه بوثيقته محلُّ الحجّة إن نُوزع في
 * الاسم بعد سنة. و`completeConditionalOffer` تكتب ملحوظتَها هي في العمود
 * نفسِه — فلو لم تُضَمَّ إليها لَضاعت في كلّ خَتمٍ يمرّ من هذا الزرّ.
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
  /* والتجهيزُ يُتمّ أو يُترك ناقصا بقصد — وهو مِحَكُّ الفحصَين */
  if (opts.ready) await makeReadyForApproval(prisma, application.id, adminId)
  return { application, profile, contract, userId: user.userId }
}

describe('اعتمادُ التوقيع يختم العرضَ ويفتح الحساب', () => {
  it('يختم الصفَّ ويصيّر صاحبَه نشطا ويمنحه دورَه، ويكتب ملحقَ المعتمَد', async () => {
    const { application, contract, userId } = await signedOffer({ ready: true })

    const out = await review.countersignContract(contract.id, adminId, {
      noteAr: 'طابقتُ الاسمَ بجواز سفرٍ رقم X1234567',
      actorRoles: ['academic_manager'],
    })
    expect(out.activated, 'لم تُعلِم الشاشةَ أنّ الحسابَ فُتح').toBe(true)
    expect(out.countersignedAt, 'خُتم بلا تاريخٍ يُقرأ').not.toBeNull()

    const sealed = await prisma.trainerContract.findUniqueOrThrow({ where: { id: contract.id } })
    expect(sealed.status, 'ضُغط الزرُّ ولم يُختَم الصفّ').toBe('countersigned')
    expect(sealed.countersignedAt).not.toBeNull()
    expect(sealed.conditionMetAt, 'خُتم والمهلةُ ما زالت تجري عليه').not.toBeNull()

    /* والملحقُ (وعدُ البند 2-11) يُكتب في الخَتم نفسِه */
    expect(readApprovedCourses(sealed.approvedCoursesSnapshot).map((c) => c.titleAr))
      .toEqual(['أساسيّاتُ المحاسبة'])

    /* والغايةُ: صار نشطا وبوّابتُه تُفتح من حسابه */
    const app = await prisma.trainerApplication.findUniqueOrThrow({ where: { id: application.id } })
    expect(app.status, 'خُتم عقدُه وبقي غيرَ نشط').toBe('active')
    const profile = await prisma.trainerProfile.findUniqueOrThrow({
      where: { applicationId: application.id },
    })
    expect(profile.userId, 'نشطٌ بلا حسابٍ مربوط — لا يفتح بوّابتَه').toBe(userId)
    const roles = await prisma.userRole.findMany({ where: { userId }, select: { roleId: true } })
    expect(roles.map((r) => r.roleId), 'فُعّل بلا دورِ مدرّب').toContain('trainer')
  })

  it('وملحوظةُ مطابقةِ الهويّة تبقى في الصفّ مع ملحوظة الخَتم', async () => {
    const { contract } = await signedOffer({ ready: true })
    await review.countersignContract(contract.id, adminId, {
      noteAr: 'طابقتُ الاسمَ بهويّةٍ أردنيّةٍ رقم 9891234567',
      actorRoles: ['academic_manager'],
    })
    const sealed = await prisma.trainerContract.findUniqueOrThrow({ where: { id: contract.id } })
    expect(sealed.countersignNoteAr ?? '', 'ضاعت ملحوظةُ من طابق الهويّة')
      .toContain('9891234567')
    /* ولا تُزيح ملحوظةَ الخَتم: كلتاهما تُقرأ بعد سنة */
    expect(sealed.countersignNoteAr ?? '').toContain('تحقّق شرطُ البند 2-10')
  })

  it('ولا يُختَم ناقصُ التجهيز — البوّابةُ تمنع كما تمنع من ملفّ المدرّب', async () => {
    const { application, contract } = await signedOffer({ ready: false })

    await expect(review.countersignContract(contract.id, adminId, {
      noteAr: 'طابقتُ الاسمَ', actorRoles: ['academic_manager'],
    })).rejects.toMatchObject({ code: 'not_ready' })

    const still = await prisma.trainerContract.findUniqueOrThrow({ where: { id: contract.id } })
    expect(still.status, 'خُتم عرضٌ لم يكتمل تجهيزُ صاحبه').toBe('signed')
    expect(still.countersignedAt).toBeNull()
    const app = await prisma.trainerApplication.findUniqueOrThrow({ where: { id: application.id } })
    expect(app.status, 'فُعّل من رُدّ تفعيلُه').not.toBe('active')
  })
})
