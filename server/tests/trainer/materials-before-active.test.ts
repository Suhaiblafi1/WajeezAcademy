/* لا يصير نشطا قبل أن تُقرأ موادُّه — بقاعدةٍ حقيقيّة، ومن البابَين.
 *
 * ── البلاغُ الذي وُلد منه ──
 *
 * صاحبُ المنصّة (٢٦ سبتمبر ٢٠٢٦): «ما وجدتُ بالتجربة أنّك اعتمدتَ المدرّبَ
 * رسميّا عند توقيعي — وهذا خطأ. اعتمدِ العقدَ المشروط وينتقل لمرحلة وضع
 * المواد، وبعد أن يضع المواد كاملا أقول إنّه ١٠٠٪ نشط».
 *
 * وهو عطبٌ شُحن صباحَ ذلك اليوم: زرُّ الختم صار ينادي `decide('activate')`
 * لأيّ عرضٍ مشروطٍ موقَّع، بلا شرطِ أن يكون صاحبُه أعلن اكتمالَ موادّه.
 *
 * ── وأدقُّ ما يُقاس: البابان لا بابٌ واحد ──
 *
 * الاعتمادُ يقع من موضعَين: زرِّ شاشة العقود (`countersignContract`) وزرِّ
 * شاشة الطلبات (`decide('activate')` مباشرةً). فحارسٌ في الأوّل وحدَه يترك
 * الثانيَ مفتوحا — ويُقاس الاثنان.
 *
 * ── وأنّ البوّابةَ لا تُغلَق على من فرغ ──
 *
 * حارسٌ يمنع دائما ليس حارسا بل عطب. فيُعلَن اكتمالُ الموادّ ويُقاس أنّ
 * الاعتمادَ **يمرّ** — وهو الوجهُ الآخرُ الذي بلا قياسه لا يُعرف أنّ المنعَ
 * كان بسببه.
 *
 * ── ودورةٌ معتمَدةٌ واحدةٌ تكفي (٢٠ أكتوبر ٢٠٢٦) ──
 *
 * «one cohort is enough for them to be active». فمن اعتُمدت له دورةٌ قُرئت موادُّه
 * فيها ويُفعَّل — أعلن الباقي أم لا. فالممنوعُ هنا من **لم تُعتمَد له دورةٌ بعد**
 * (`approved: false`)، وكان قبل هذا اليوم «له معتمَدةٌ وأخرى معلّقة».
 */

import { beforeAll, describe, expect as vexpect, it } from 'vitest'
import { plainExpect } from '../helpers/plain-expect'
/* يُقارَن بلا تشكيلٍ إعرابيّ — العلّةُ في `helpers/plain-expect.ts` */
const expect = plainExpect(vexpect)
import type { PrismaClient } from '@prisma/client'
import { setupTestDb, testPrisma } from '../helpers/db'
import { makeReadyForApproval } from '../helpers/trainer-ready'
import { AuthService } from '../../services/auth.service'
import { TrainerReviewService } from '../../services/trainer-review.service'
import { TrainerPrepService } from '../../services/trainer-prep.service'

let prisma: PrismaClient
let auth: AuthService
let review: TrainerReviewService
let adminId = ''
const DAY = 86_400_000

beforeAll(async () => {
  await setupTestDb()
  prisma = await testPrisma()
  auth = new AuthService(prisma)
  review = new TrainerReviewService(prisma)
  const admin = await auth.register('materials-admin@test.local', 'Admin#12345', 'المدير الأكاديمي')
  adminId = admin.userId
  await auth.setRoles(adminId, ['academic_manager'])
}, 240_000)

let seq = 0

/** طلبٌ جديدٌ بحسابٍ — السقالةُ تجهّز ما بعده */
async function freshApplication() {
  seq += 1
  const email = `mat-${seq}-${Date.now()}@test.local`
  const user = await auth.register(email, 'Trainer#12345', `مرشّحٌ ${seq}`)
  const app = await prisma.trainerApplication.create({
    data: {
      reference: `TR-MAT-${Date.now()}-${seq}`, fullName: `مرشّحٌ ${seq}`, email,
      status: 'under_review', motivation: 'اختبار', privacyConsentAt: new Date(),
      userId: user.userId,
    },
  })
  return app.id
}

/** مدرّبٌ جاهزٌ للاعتماد من كلّ وجهٍ **إلّا** طورَ موادّه */
async function readyButForMaterials(opts: {
  deadlineDays: number | null
  declared: boolean
  /** أله دورةٌ معتمَدة؟ — والغائبُ «نعم»، كما تكتبه السقالة */
  approved?: boolean
}) {
  const applicationId = await freshApplication()
  const { profileId } = await makeReadyForApproval(prisma, applicationId, adminId)
  /* والسقالةُ تكتب عقدا `signed` — يُجعَل مشروطا بطوره */
  const contract = await prisma.trainerContract.findFirst({
    where: { profileId }, orderBy: { createdAt: 'desc' },
  })
  if (!contract) throw new Error('السقالةُ لم تكتب عقدا — الفحصُ يقيس الفراغ')
  /* ═══ ودورةٌ لم يُحكم في موادّها بعد (١٧ أكتوبر ٢٠٢٦) ═══
     البوّابةُ تمنع حكما على ما لم يُعرَض، ومن اعتُمدت دوراتُه كلُّها حُكم فيه دورةً دورة فيمرّ
     (`materialsGateProblemAr`، ويقيسه `qualify-activates.test.ts`). والسقالةُ تؤهّله لدورةٍ
     واحدة — شرطُ الجاهزيّة — فيُضاف ما لم يُعتمَد بعد: وهو الطورُ الذي وُلد منه هذا الحارس. */
  const have = (await prisma.trainerCourseQualification.findMany({ where: { profileId }, select: { courseId: true } }))
    .map((q) => q.courseId)
  const other = await prisma.course.findFirst({ where: { id: { notIn: have } }, select: { id: true } })
  if (!other) throw new Error('لا دورةَ ثانيةَ في القاعدة — الفحصُ يقيس الفراغ')
  await prisma.trainerCourseQualification.create({ data: { profileId, courseId: other.id, status: 'pending' } })
  /* ومن لم تُعتمَد له دورةٌ بعد: ما أهّلته السقالةُ معلّقٌ كالباقي */
  if (opts.approved === false) {
    await prisma.trainerCourseQualification.updateMany({ where: { profileId }, data: { status: 'pending' } })
  }
  await prisma.trainerContract.update({
    where: { id: contract.id },
    data: {
      gatesActivation: true, status: 'signed', signedAt: new Date(),
      conditionMetAt: null,
      orientationAt: new Date(Date.now() - 10 * DAY),
      conditionDeadlineAt: opts.deadlineDays === null
        ? null
        : new Date(Date.now() + opts.deadlineDays * DAY),
      conditionPausedAt: opts.declared ? new Date() : null,
    },
  })
  await prisma.trainerApplication.update({
    where: { id: applicationId }, data: { status: 'onboarding' },
  })
  return { applicationId, profileId, contractId: contract.id }
}

const statusOf = async (applicationId: string) =>
  (await prisma.trainerApplication.findUniqueOrThrow({ where: { id: applicationId } })).status

describe('البابُ الأوّل: زرُّ شاشة الطلبات', () => {
  it('لم تُعتمَد له دورةٌ بعد: يُردّ، ويبقى في طور التهيئة', async () => {
    const t = await readyButForMaterials({ deadlineDays: 5, declared: false, approved: false })
    await expect(review.decide(t.applicationId, adminId, 'activate'))
      .rejects.toMatchObject({ code: 'not_ready' })
    expect(await statusOf(t.applicationId), 'صار نشطا ولم تُقرأ موادُّه').toBe('onboarding')
  })

  it('انقضت مهلتُه ولم تُعتمَد له دورة: يُردّ كذلك', async () => {
    const t = await readyButForMaterials({ deadlineDays: -2, declared: false, approved: false })
    await expect(review.decide(t.applicationId, adminId, 'activate'))
      .rejects.toMatchObject({ code: 'not_ready' })
    expect(await statusOf(t.applicationId)).toBe('onboarding')
  })

  /* ═══ و«المعتمَدةُ» خطّةُ شعبةٍ اعتمدناها لا تأهيلٌ وحدَه (٢٠ أكتوبر ٢٠٢٦، «Approved cohort only») ═══
     السقالةُ تؤهّله لدورةٍ بلا شعبة: لم يُحكم في موادّه بعد، فيُردّ. وتُعتمَد له خطّةُ شعبةٍ فيمرّ */
  it('⚠️ أُهِّل لدورةٍ ولم تُعتمَد له خطّةُ شعبة: يُردّ', async () => {
    const t = await readyButForMaterials({ deadlineDays: 5, declared: false })
    await expect(review.decide(t.applicationId, adminId, 'activate'))
      .rejects.toMatchObject({ code: 'materials_pending' })
    expect(await statusOf(t.applicationId), 'فُعِّل بتأهيلٍ لم تُعتمَد له شعبة').toBe('onboarding')
  })

  it('⚠️ وخطّةُ شعبةٍ معتمَدةٌ واحدةٌ تكفي — ولو لم يُعلن الباقي (٢٠ أكتوبر ٢٠٢٦)', async () => {
    const t = await readyButForMaterials({ deadlineDays: 5, declared: false })
    const q = await prisma.trainerCourseQualification.findFirstOrThrow({ where: { profileId: t.profileId, status: 'qualified' } })
    const cohort = await prisma.cohort.create({ data: { courseId: q.courseId, title: 'شعبةُ الاختبار' } })
    await prisma.cohortDeliveryPlan.create({
      data: {
        cohortId: cohort.id, trainerId: t.profileId, status: 'approved', reviewedBy: adminId, reviewedAt: new Date(),
        content: { kind: 'trainer', modules: [], resources: [] },
      },
    })
    await review.decide(t.applicationId, adminId, 'activate')
    expect(await statusOf(t.applicationId), 'اعتُمدت له شعبةٌ وحُبس حتّى يُعلن الباقي').toBe('active')
  })

  it('وعرضٌ مشروطٌ بلا مهلة: يمرّ — ولا يُحبَس من لا يملك أن يُعلن', async () => {
    /* المهلةُ من جلسة التهيئة وهي اختياريّةٌ عند التركيب، و`declareMaterials
       Complete` تشترط مهلةً قائمة. فمنعُ هذه الحالة حبسٌ أبديّ — وقد أسقطت
       أوّلُ صياغةٍ منعتها ١٢٦ فحصا في الجولة الكاملة. */
    const t = await readyButForMaterials({ deadlineDays: null, declared: false })
    await review.decide(t.applicationId, adminId, 'activate')
    expect(await statusOf(t.applicationId), 'حُبس عرضٌ لا مهلةَ له').toBe('active')
  })

  it('أعلن اكتمالَها: يمرّ ويصير نشطا — فالبوّابةُ تُفتح لمن فرغ', async () => {
    /* ═══ وهذا الوجهُ الآخرُ الذي بلا قياسه لا معنى للمنع ═══
       حارسٌ يمنع دائما ليس حارسا. */
    const t = await readyButForMaterials({ deadlineDays: 5, declared: true })
    await review.decide(t.applicationId, adminId, 'activate')
    expect(await statusOf(t.applicationId), 'مُنع من صارت موادُّه بين يدينا').toBe('active')
  })
})

/* ═══ والبابُ الثاني انتقل (٢٧ سبتمبر ٢٠٢٦) ═══

   كان زرُّ شاشة العقود يختم ويُفعّل معا، فكان حارسُ الموادّ عليه. وقد صار
   الاعتمادُ **يسبق** طورَ الموادّ بقرار صاحب المنصّة، فلا معنى لأن يُشترَط
   فيه ما لم يبدأ طورُه بعد.

   فانتقل الحارسُ إلى موضعه الصحيح: **النشر**. ويُقاس هنا الانتقالُ نفسُه —
   أنّ الاعتمادَ يمرّ، وأنّ النشرَ يُردّ. ولو سقط أحدُ الطرفَين لَعاد العطبُ:
   إمّا زرٌّ يُردّ أبدا، وإمّا حسابٌ يُنشَر بلا موادّ. */
describe('البابُ الثاني: زرُّ شاشة العقود — يعتمد ولا ينشر', () => {
  it('الاعتمادُ يمرّ ولو لم تُعرَض موادُّه — فهو نظرٌ في توقيعه لا في موادّه', async () => {
    const t = await readyButForMaterials({ deadlineDays: 5, declared: false })
    await expect(review.approveSignature(t.contractId, adminId, {}))
      .resolves.toMatchObject({ ok: true, activated: false, sealed: false })
    const c = await prisma.trainerContract.findUniqueOrThrow({ where: { id: t.contractId } })
    /* ولا يوقّع عنّا (١ أكتوبر ٢٠٢٦): نوقّع العرضَ حين نعتمد دوراتِه — أي عند النشر */
    expect(c.status).toBe('signature_approved')
    expect(c.countersignedAt, 'خُتم العرضُ قبل أن تُعتمَد دوراتُه').toBeNull()
    expect(c.conditionMetAt, 'تحقّق شرطُ موادّه باعتماد توقيعه').toBeNull()
    /* ومنذ أُلغيت «تهيئة» (٢١ أكتوبر ٢٠٢٦) يصير نشطا باعتماد توقيعه — والخَتمُ وتحقّقُ الشرط لأوّل شعبةٍ تُعتمَد */
    expect(await statusOf(t.applicationId), 'اعتُمد توقيعُه ولم يصر نشطا').toBe('active')
  })

  /* وكان: «والنشرُ بعده يُردّ ما دامت لم تُعتمَد له دورة» — والتفعيلُ صار باعتماد التوقيع (٢١ أكتوبر ٢٠٢٦).
     فيُقاس ما بقي منه: لا يُختَم عقدُه ولا يتحقّق شرطُه بلا شعبةٍ معتمَدة، والعاملُ لا يوقّعه */
  it('ولا يُختَم عرضُه ما دامت لم تُعتمَد له شعبة', async () => {
    const t = await readyButForMaterials({ deadlineDays: 5, declared: false, approved: false })
    await review.approveSignature(t.contractId, adminId, {})
    expect(await statusOf(t.applicationId)).toBe('active')
    await new TrainerPrepService(prisma).sealFirstCourseActive()
    const c = await prisma.trainerContract.findUniqueOrThrow({ where: { id: t.contractId } })
    expect(c.status, 'خُتم عرضُه بلا شعبةٍ معتمَدة').toBe('signature_approved')
    expect(c.conditionMetAt, 'تحقّق شرطُه بلا شعبةٍ معتمَدة').toBeNull()
  })

  it('ويمرّ النشرُ بعد إعلانها — فيُكتب تحقّقُ الشرط ويصير نشطا', async () => {
    const t = await readyButForMaterials({ deadlineDays: 5, declared: true })
    await review.approveSignature(t.contractId, adminId, {})
    await review.decide(t.applicationId, adminId, 'activate')
    expect(await statusOf(t.applicationId)).toBe('active')
    const c = await prisma.trainerContract.findUniqueOrThrow({ where: { id: t.contractId } })
    expect(c.status).toBe('countersigned')
    expect(c.conditionMetAt, 'نُشر ولم يُكتب تحقّقُ شرطه').not.toBeNull()
  })
})

describe('والمخرجُ يُسمّى من سلكه ولماذا', () => {
  it('المديرُ الأعلى يتجاوز — بسببٍ يُكتب، ولا يتجاوز بلا سبب', async () => {
    const t = await readyButForMaterials({ deadlineDays: 5, declared: false, approved: false })
    /* بلا سببٍ: يُردّ ٤٢٢ لا يُمرَّر */
    await expect(review.decide(t.applicationId, adminId, 'activate', undefined, {
      actorRoles: ['super_admin'],
    })).rejects.toMatchObject({ code: 'override_reason_required' })
    expect(await statusOf(t.applicationId)).toBe('onboarding')

    await review.decide(t.applicationId, adminId, 'activate', undefined, {
      actorRoles: ['super_admin'],
      overrideReasonAr: 'موادُّه وصلت على البريد قبل إتاحة الإعلان، وراجعتُها بنفسي',
    })
    expect(await statusOf(t.applicationId)).toBe('active')
  })

  it('والتجاوزُ يُكتب في الأثر بسببه وبما نقص', async () => {
    const t = await readyButForMaterials({ deadlineDays: 5, declared: false, approved: false })
    await review.decide(t.applicationId, adminId, 'activate', undefined, {
      actorRoles: ['super_admin'],
      overrideReasonAr: 'حالةٌ استثنائيّةٌ وثّقتُها في ملفّه الورقيّ',
    })
    const ev = await prisma.auditEvent.findFirst({
      where: { action: 'trainer.materials.override', entityId: t.applicationId },
    })
    expect(ev, 'تُجوِّز البوّابةُ في صمت — فلا يُعرف من تجاوزها ولا لماذا').not.toBeNull()
    const meta = ev!.meta as { reasonAr?: string; problemAr?: string }
    expect(meta.reasonAr).toMatch(/ملفّه الورقيّ/)
    expect(meta.problemAr, 'لا يُكتب ما كان ناقصا وقتَ التجاوز').toMatch(/لم يُعلنْ/)
  })
})

describe('ولا يُمَسُّ من لا طورَ له', () => {
  it('عقدٌ غيرُ مشروطٍ لا تعترضه هذه البوّابة', async () => {
    /* البوّابةُ تقرأ `gatesActivation: true` وحدَه. ولو عمّت لَحُبس كلُّ
       مدرّبٍ بعقدٍ عاديٍّ خلف طورٍ لا وجودَ له في عقده. */
    const applicationId = await freshApplication()
    const { profileId } = await makeReadyForApproval(prisma, applicationId, adminId)
    await prisma.trainerContract.updateMany({
      where: { profileId },
      data: { gatesActivation: false, status: 'signed', signedAt: new Date() },
    })
    await prisma.trainerApplication.update({
      where: { id: applicationId }, data: { status: 'onboarding' },
    })
    await review.decide(applicationId, adminId, 'activate')
    expect(await statusOf(applicationId)).toBe('active')
  })
})
