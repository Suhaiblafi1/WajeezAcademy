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
 */

import { beforeAll, describe, expect, it } from 'vitest'
import type { PrismaClient } from '@prisma/client'
import { setupTestDb, testPrisma } from '../helpers/db'
import { makeReadyForApproval } from '../helpers/trainer-ready'
import { AuthService } from '../../services/auth.service'
import { TrainerReviewService } from '../../services/trainer-review.service'

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
}) {
  const applicationId = await freshApplication()
  const { profileId } = await makeReadyForApproval(prisma, applicationId, adminId)
  /* والسقالةُ تكتب عقدا `signed` — يُجعَل مشروطا بطوره */
  const contract = await prisma.trainerContract.findFirst({
    where: { profileId }, orderBy: { createdAt: 'desc' },
  })
  if (!contract) throw new Error('السقالةُ لم تكتب عقدا — الفحصُ يقيس الفراغ')
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
  it('يعمل ولم يُعلنْ اكتمالَ موادّه: يُردّ، ويبقى في طور التهيئة', async () => {
    const t = await readyButForMaterials({ deadlineDays: 5, declared: false })
    await expect(review.decide(t.applicationId, adminId, 'activate'))
      .rejects.toMatchObject({ code: 'materials_pending' })
    expect(await statusOf(t.applicationId), 'صار نشطا ولم تُقرأ موادُّه').toBe('onboarding')
  })

  it('انقضت مهلتُه ولم يُعلنْ: يُردّ كذلك', async () => {
    const t = await readyButForMaterials({ deadlineDays: -2, declared: false })
    await expect(review.decide(t.applicationId, adminId, 'activate'))
      .rejects.toMatchObject({ code: 'materials_pending' })
    expect(await statusOf(t.applicationId)).toBe('onboarding')
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

describe('البابُ الثاني: زرُّ شاشة العقود', () => {
  it('الختمُ يُردّ ما دامت موادُّه لم تُعرَض', async () => {
    const t = await readyButForMaterials({ deadlineDays: 5, declared: false })
    await expect(review.countersignContract(t.contractId, adminId, {}))
      .rejects.toMatchObject({ code: 'materials_pending' })
    const c = await prisma.trainerContract.findUniqueOrThrow({ where: { id: t.contractId } })
    expect(c.status, 'خُتم العقدُ ولم تُقرأ موادُّه').toBe('signed')
    expect(c.countersignedAt).toBeNull()
  })

  it('ويمرّ بعد إعلانها — فيُختَم ويصير نشطا في اللحظة نفسِها', async () => {
    const t = await readyButForMaterials({ deadlineDays: 5, declared: true })
    const out = await review.countersignContract(t.contractId, adminId, {})
    expect(out.activated).toBe(true)
    expect(await statusOf(t.applicationId)).toBe('active')
    const c = await prisma.trainerContract.findUniqueOrThrow({ where: { id: t.contractId } })
    expect(c.status).toBe('countersigned')
    expect(c.conditionMetAt, 'خُتم ولم يُكتب تحقّقُ شرطه').not.toBeNull()
  })
})

describe('والمخرجُ يُسمّى من سلكه ولماذا', () => {
  it('المديرُ الأعلى يتجاوز — بسببٍ يُكتب، ولا يتجاوز بلا سبب', async () => {
    const t = await readyButForMaterials({ deadlineDays: 5, declared: false })
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
    const t = await readyButForMaterials({ deadlineDays: 5, declared: false })
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
