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
 * ── وانقلب الخَتمُ إلى النشر (١ أكتوبر ٢٠٢٦) ──
 *
 * سأل صاحبُ المنصّة: «عندما أصادق على توقيعٍ هل هذا معناه أنّنا وقّعنا مع
 * المدرّب؟». وكان الاعتمادُ يختم العرضَ — توقيعَ المفوَّض عنّا — ويقول بريدُه
 * «فصار العقدُ نافذا بين الطرفين». وقرارُه: «لا أريد أن أتعاقد مع أحدٍ قبل أن
 * أعتمد دوراته… سوف نقوم بتوقيع العقد وتحويله إلى عقدٍ غير مشروط عندما نقوم
 * باعتماد دوراتك».
 *
 * ── وأدقُّ ما يُقاس هنا ──
 *
 * ① أنّ الاعتمادَ **لا ينشر ولا يوقّع عنّا**: لا `active` ولا `conditionMetAt`،
 *   ولا عمودَ من أعمدة الخَتم ولا أثرَ خَتم — ويفتح البوّابةَ مع ذلك. ويقول
 *   بريدُه إنّا نوقّع حين نعتمد دوراتِه، لا إنّ العقدَ نفذ.
 * ② أنّ النشرَ **هو الخَتم**: يُكتب توقيعُ المفوَّض وتاريخُه يومَ النشر لا يومَ
 *   الاعتماد، ويقول بريدُه «ووقّعنا العقدَ من جهتنا».
 * ③ أنّ الحمايةَ لم تسقط: من لم تُعلَن موادُّه لا يُنشَر.
 * ④ وأنّ ملحوظةَ مطابقةِ الهويّة — كُتبت يومَ الاعتماد — تُضَمّ إلى ملحوظة الخَتم.
 * ⑤ وما خُتم يومَ اعتُمد توقيعُه (٢٧ سبتمبر — ١ أكتوبر) لا يُعاد ختمُه عند
 *   النشر: لو أُعيد لَقرأ العقدُ أنّنا وقّعناه يومَ النشر خلافَ ما جرى يومَها.
 * ⑥ وأنّ خَتمَ النشر يُزيح ما كان نافذا له قبله، ويُكتب أثرُ الإزاحة.
 * ⑦ وما وُقّع على نصٍّ سابقٍ (v12–v23) واعتُمد «كالعقود الجديدة» — خيارُ صاحب
 *   المنصّة (٢ أكتوبر ٢٠٢٦، «Option 4») — يُختَم عند النشر كغيره: لا يقف خَتمُه
 *   عند إصدار نصّه.
 *
 * والبريدُ يُلتقَط عند `sendDirectEmail` — فما يُقاس هو ما خرج من الخدمة.
 */
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { createHash } from 'node:crypto'
import type { PrismaClient } from '@prisma/client'

const outbox = vi.hoisted(() => [] as { to: string; subject: string; text: string }[])
vi.mock('../../services/notification.service', async (orig) => {
  const real = await orig<typeof import('../../services/notification.service')>()
  return {
    ...real,
    sendDirectEmail: async (_p: unknown, input: { to: string; subject: string; text: string }) => {
      outbox.push({ to: input.to, subject: input.subject, text: input.text })
      return { status: 'sent' as const }
    },
  }
})

import { setupTestDb, testPrisma } from '../helpers/db'
import { makeReadyForApproval } from '../helpers/trainer-ready'
import { AuthService } from '../../services/auth.service'
import { TrainerReviewService } from '../../services/trainer-review.service'
import { contractAcks, CONDITION_CLAUSE_MARK } from '../../../src/application/trainer/contract-body'
import { readApprovedCourses } from '../../../src/application/trainer/contract-execution'
import { ACADEMY_LEGAL } from '../../../src/data/academy-legal'

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

beforeEach(() => { outbox.length = 0 })

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
  return { application, profile, contract, userId: user.userId, email }
}

/** أفعالُ الأثر على صفٍّ بعينه — ما وقع لا ما كُتب في السطر */
const actionsOn = async (contractId: string) => (await prisma.auditEvent.findMany({
  where: { entityType: 'trainer_contract', entityId: contractId }, select: { action: true },
})).map((a) => a.action)

/** «انشُرْ حسابَه» — القرارُ التالي، وهو `decide('activate')` نفسُها */
const publish = (applicationId: string) =>
  review.decide(applicationId, adminId, 'activate', 'نشرُ الحساب بعد اعتماد الموادّ',
    { actorRoles: ['academic_manager'] })

describe('الاعتمادُ يفتح طورَ الموادّ ولا ينشر', () => {
  it('⚠️ يعتمد التوقيعَ ويمنح الدورَ ويربط الملفَّ — ولا يوقّع عنّا ولا يجعله نشطا', async () => {
    const { application, contract, userId, email } = await signedOffer({ ready: true })

    /* وما خرج قبل الاعتماد (العرضُ وخبرُ التوقيع) لا يُقرأ رسالةَ الاعتماد */
    outbox.length = 0
    const out = await review.approveSignature(contract.id, adminId, {
      noteAr: 'طابقتُ الاسمَ بجواز سفرٍ رقم X1234567',
      actorRoles: ['academic_manager'],
    })
    expect(out.sealed, 'قالت الخدمةُ إنّا وقّعنا العرض').toBe(false)
    expect(out.countersignedAt, 'رُدّ تاريخُ خَتمٍ لم يقع').toBeNull()
    expect(out.activated, 'قالت الشاشةُ إنّ الحسابَ نُشر — والنشرُ قرارٌ تالٍ').toBe(false)

    const row = await prisma.trainerContract.findUniqueOrThrow({ where: { id: contract.id } })
    expect(row.status, 'ضُغط الزرُّ ولم يُكتب اعتمادُ التوقيع').toBe('signature_approved')
    expect(row.signatureApprovedAt, 'اعتُمد بلا تاريخٍ يُقرأ').not.toBeNull()
    expect(row.signatureApprovedBy, 'لا يُعرف من اعتمد').toBe(adminId)
    /* والخَتمُ لم يقع: لا تاريخَ ولا مفوَّضَ ولا من وقّع عنّا */
    expect(row.countersignedAt, 'وقّعنا العرضَ باعتماد توقيعه').toBeNull()
    expect(row.countersignedBy).toBeNull()
    expect(row.academySignatoryName, 'طُبع اسمُ المفوَّض على عرضٍ لم نوقّعه').toBeNull()
    expect(await actionsOn(contract.id), 'كُتب أثرُ خَتمٍ لم يقع').not.toContain('trainer.contract.countersign')
    expect(await actionsOn(contract.id), 'لا أثرَ لاعتماد التوقيع').toContain('trainer.contract.approve_signature')
    expect(row.conditionMetAt, 'تحقّق الشرطُ باعتماد التوقيع — وموادُّه لم تُقيَّم بعد')
      .toBeNull()
    expect(row.conditionDeadlineAt, 'اعتُمد ولا مهلةَ — فلا طورَ موادّ').not.toBeNull()

    /* وبريدُه يقول ما وقع: اعتمدنا توقيعَك ونوقّع حين نعتمد دوراتك — لا «نافذ» */
    const mail = outbox.find((m) => m.to === email)
    expect(mail, 'لم يصله خبرُ اعتماد توقيعه').toBeDefined()
    expect(mail!.text, 'قيل له إنّ العقدَ نفذ ولم نوقّعه').not.toContain('نافذا بين الطرفين')
    expect(mail!.text, 'وُعد بنسخةٍ بتوقيع الطرفين قبل أن نوقّع').not.toContain('ونسختُك بتوقيع الطرفين')
    expect(mail!.text, 'لم يُقل متى نوقّع').toContain('وسنوقّع العقدَ من جهتنا ونحوّله إلى عقدٍ غيرِ مشروطٍ حين نعتمد دوراتك')

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

  it('⚠️ والنشرُ هو توقيعُنا: يُختَم الآن مع تحقّق الشرط وملحقِه', async () => {
    const { application, contract, email } = await signedOffer({ ready: true })
    await review.approveSignature(contract.id, adminId, {
      noteAr: 'طابقتُ الاسمَ بجواز سفرٍ رقم X1234567',
      actorRoles: ['academic_manager'],
    })
    const approvedAt = (await prisma.trainerContract.findUniqueOrThrow({
      where: { id: contract.id },
    })).signatureApprovedAt!

    outbox.length = 0
    const before = Date.now()
    await publish(application.id)

    const after = await prisma.trainerContract.findUniqueOrThrow({ where: { id: contract.id } })
    expect(after.status, 'نُشر ولم يُختَم العرض').toBe('countersigned')
    expect(after.conditionMetAt, 'نُشر ولم يُكتب تحقّقُ الشرط').not.toBeNull()
    /* ═══ وتاريخُ توقيعنا يومُ النشر لا يومُ الاعتماد ═══
       وهو ما يقوله البندُ 2-12: «فإذا تحقق وقعت الأكاديمية العقد من جهتها». */
    expect(after.countersignedAt, 'نُشر ولم نوقّع').not.toBeNull()
    expect(after.countersignedAt!.getTime(), 'وُقّع العرضُ قبل النشر — يومَ اعتُمد توقيعُه')
      .toBeGreaterThanOrEqual(before)
    expect(after.countersignedAt!.getTime()).toBeGreaterThan(approvedAt.getTime())
    expect(after.academySignatoryName, 'خُتم بلا اسم المفوَّض').toBe(ACADEMY_LEGAL.signatoryNameAr)
    expect(after.countersignedBy, 'لا يُعرف من وقّع عنّا').toBe(adminId)
    expect(await actionsOn(contract.id), 'لا أثرَ للخَتم').toContain('trainer.contract.countersign')

    /* وبريدُه يقول إنّا وقّعنا الآن */
    const mail = outbox.find((m) => m.to === email)
    expect(mail?.text, 'لم يُقل له إنّا وقّعنا العقدَ مع اعتماد دوراته').toContain('ووقّعنا العقدَ من جهتنا')
    /* والملحقُ (وعدُ البند 2-11) يُكتب عند النشر — فهو ما اعتُمد من دوراته */
    expect(readApprovedCourses(after.approvedCoursesSnapshot).map((c) => c.titleAr))
      .toEqual(['أساسيّاتُ المحاسبة'])

    const app = await prisma.trainerApplication.findUniqueOrThrow({ where: { id: application.id } })
    expect(app.status, 'اعتُمدت موادُّه ولم يُنشَر حسابُه').toBe('active')
  })

  it('وملحوظةُ مطابقةِ الهويّة — كُتبت يومَ الاعتماد — تُضَمّ إلى ملحوظة الخَتم', async () => {
    const { application, contract } = await signedOffer({ ready: true })
    await review.approveSignature(contract.id, adminId, {
      noteAr: 'طابقتُ الاسمَ بهويّةٍ أردنيّةٍ رقم 9891234567',
      actorRoles: ['academic_manager'],
    })
    const approved = await prisma.trainerContract.findUniqueOrThrow({ where: { id: contract.id } })
    expect(approved.signatureApprovalNoteAr ?? '', 'لم تُحفَظ ملحوظةُ المطابقة يومَ كُتبت')
      .toContain('9891234567')
    await publish(application.id)
    const sealed = await prisma.trainerContract.findUniqueOrThrow({ where: { id: contract.id } })
    expect(sealed.countersignNoteAr ?? '', 'ضاعت ملحوظةُ من طابق الهويّة حين وقع الخَتم')
      .toContain('9891234567')
  })

  /* ⑤ وما خُتم يومَ اعتُمد توقيعُه — طورُ ٢٧ سبتمبر إلى ١ أكتوبر — يُنشَر ولا
     يُعاد ختمُه: تاريخُ توقيعنا يومَ وقع، والنشرُ يكتب تحقّقَ الشرط وحدَه. */
  it('وما خُتم يومَ اعتُمد توقيعُه لا يُعاد ختمُه عند النشر', async () => {
    const { application, contract, email } = await signedOffer({ ready: true })
    const sealedThen = new Date(Date.now() - 2 * 86_400_000)
    await prisma.trainerContract.update({
      where: { id: contract.id },
      data: {
        status: 'countersigned', countersignedAt: sealedThen, countersignedBy: adminId,
        academySignatoryName: ACADEMY_LEGAL.signatoryNameAr, academySignatoryTitle: ACADEMY_LEGAL.signatoryTitleAr,
        conditionDeadlineAt: new Date(sealedThen.getTime() + 5 * 86_400_000),
      },
    })
    await prisma.trainerApplication.update({ where: { id: application.id }, data: { status: 'onboarding' } })
    outbox.length = 0
    await publish(application.id)
    const after = await prisma.trainerContract.findUniqueOrThrow({ where: { id: contract.id } })
    expect(after.countersignedAt!.getTime(), 'أُعيد ختمُ العقد يومَ النشر').toBe(sealedThen.getTime())
    expect(after.conditionMetAt, 'نُشر ولم يُكتب تحقّقُ الشرط').not.toBeNull()
    /* ولا يُقال له «وقّعنا الآن» — وقّعناه يومَ اعتمدنا توقيعَه */
    expect(outbox.find((m) => m.to === email)?.text ?? '', 'قيل «وقّعنا الآن» عن عقدٍ وُقّع قبل')
      .not.toContain('ووقّعنا العقدَ من جهتنا')
  })

  /* ⑥ والنشرُ خَتمٌ، فيُزيح ما كان نافذا له قبله — ويُكتب أثرُ الإزاحة.
     والصورةُ الواقعةُ: عرضٌ خُتم يومَ اعتُمد توقيعُه (طورُ ٢٧ سبتمبر — ١ أكتوبر)
     وطورُه مفتوح، ثمّ أُعيد له عرضٌ على v24 فوقّعه. فيوم تُعتمَد دوراتُه يُختَم
     الأحدثُ ويُزاح القديم — ولا يبقى له عقدان نافذان. وأثرُ الإزاحة يكتبه
     بابُ النشر بنفسه (`supersedePriorLive` تردّ ما أزاحت ولا تكتب)، فهنا يُثبَت
     أنّه لم يُنسَ في هذا الباب. */
  it('والنشرُ يُزيح ما كان نافذا له قبله ويكتب أثرَ الإزاحة', async () => {
    const { application, profile, contract } = await signedOffer({ ready: true })
    const sealedThen = new Date(Date.now() - 3 * 86_400_000)
    const prior = await prisma.trainerContract.create({
      data: {
        profileId: profile.id, title: 'عرضٌ خُتم يومَ اعتُمد توقيعُه', status: 'countersigned',
        bodyVersion: 'v-test', bodyAr: BODY, bodyHash: sha256(BODY), signedBodyHash: sha256(BODY),
        gatesActivation: true, signedAt: new Date(sealedThen.getTime() - 86_400_000),
        signerLegalName: 'الاسمُ القانونيّ', countersignedAt: sealedThen, countersignedBy: adminId,
        academySignatoryName: ACADEMY_LEGAL.signatoryNameAr, academySignatoryTitle: ACADEMY_LEGAL.signatoryTitleAr,
        conditionDeadlineAt: new Date(sealedThen.getTime() + 5 * 86_400_000),
      },
    })
    await review.approveSignature(contract.id, adminId, {
      noteAr: 'طابقتُ الاسمَ', actorRoles: ['academic_manager'],
    })
    await publish(application.id)

    const sealed = await prisma.trainerContract.findUniqueOrThrow({ where: { id: contract.id } })
    expect(sealed.status, 'خُتم القديمُ بدل الأحدث').toBe('countersigned')
    const old = await prisma.trainerContract.findUniqueOrThrow({ where: { id: prior.id } })
    expect(old.status, 'بقي للمدرّب عقدان نافذان بعد النشر').toBe('superseded')
    expect(old.supersededByContractId, 'لا يقول القديمُ من أزاحه').toBe(contract.id)
    expect(old.supersededAt?.getTime(), 'وقتُ الإزاحة غيرُ وقت الخَتم').toBe(sealed.countersignedAt?.getTime())
    expect(await actionsOn(prior.id), 'أُزيح العقدُ ولم يُكتب أثرُ إزاحته').toContain('trainer.contract.superseded')
  })

  /* اعتُمد كالعقود الجديدة فلم يُختَم يومئذ — فيُختَم يومَ تُعتمَد دوراتُه كما
     يُختَم كلُّ عقدٍ جديد. ولو وقف الخَتمُ عند إصدار نصّه لَبقي «اعتُمد ولم يُوقَّع»
     أبدا: لا يُختَم بالنشر، ولا يُعاد اعتمادُه وقد خرج من `signed`. */
  it('⚠️ وما وُقّع على نصٍّ سابقٍ واعتُمد «كالعقود الجديدة» يُختَم عند النشر كغيره', async () => {
    const { application, contract, email } = await signedOffer({ ready: true })
    /* الصفُّ يُكتب بإصدار نصٍّ سابقٍ بيدٍ: المقيسُ ما يقع بعده لا طريقُه إليه */
    await prisma.trainerContract.update({ where: { id: contract.id }, data: { bodyVersion: 'v20-2026-10-01' } })
    const out = await review.approveSignature(contract.id, adminId, {
      noteAr: 'طابقتُ الاسمَ بجواز سفرٍ رقم X1234567', likeNew: true,
      actorRoles: ['academic_manager'],
    })
    expect(out.sealed, 'خُتم يومَ اعتُمد وقد اختير «كالعقود الجديدة»').toBe(false)

    outbox.length = 0
    await publish(application.id)
    const after = await prisma.trainerContract.findUniqueOrThrow({ where: { id: contract.id } })
    expect(after.status, 'نُشر ولم يُختَم عرضُه').toBe('countersigned')
    expect(after.countersignedAt, 'نُشر ولم نوقّع').not.toBeNull()
    expect(after.academySignatoryName, 'خُتم بلا اسم المفوَّض').toBe(ACADEMY_LEGAL.signatoryNameAr)
    expect(after.conditionMetAt, 'نُشر ولم يُكتب تحقّقُ الشرط').not.toBeNull()
    expect(after.countersignNoteAr ?? '', 'ضاعت ملحوظةُ المطابقة يومَ الخَتم').toContain('X1234567')
    const mail = outbox.find((m) => m.to === email)
    expect(mail?.text, 'لم يُقل له إنّا وقّعنا العقدَ مع اعتماد دوراته').toContain('ووقّعنا العقدَ من جهتنا')
  })

  it('ولا يُنشَر من لم تُعلَن موادُّه — والحمايةُ لم تسقط مع الزرّ', async () => {
    const { application, contract } = await signedOffer({ ready: false })

    /* والاعتمادُ نفسُه يمرّ: هو نظرٌ في توقيعه لا في موادّه */
    await expect(review.approveSignature(contract.id, adminId, {
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
