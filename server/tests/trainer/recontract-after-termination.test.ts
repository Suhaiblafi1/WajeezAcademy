/* عقدٌ جديدٌ لمن فُسخ عقدُه — بالطريق كلِّه، على قاعدةٍ حقيقيّة.

   ═══ ما سُئل عنه (٣٠ سبتمبر ٢٠٢٦) ═══

   سأل صاحبُ المنصّة عند العقود المفسوخة: «ألا يمكن إعادةُ إنشاء عقدٍ آخرَ
   لهم؟». والفسخُ لا يقع إلّا برحيلٍ يُسجَّل («أنهِ تعاقدَه»)، والرحيلُ لا يمسّ
   حالةَ الطلب — فمن رحل يبقى نشطا ويُركَّب له عقدٌ جديد. وهذا ما يُثبَت هنا
   بالطريق كلِّه، لا بحالةٍ مكتوبةٍ باليد.

   ═══ وما كان عطبا ═══

   من أُوقف مع رحيله كان «ركِّبْ عقدا جديدا» في خطوات تجهيزه يركّب له مسودّةً،
   ثمّ يُردّ إرسالُها بـ«لا يمكن الانتقال من «suspended» إلى «contract_pending»»
   — رموزٌ لا يقرؤها أحد، ومسودّةٌ يتيمة. فصار التركيبُ يُردّ قبل أن يُكتب صفّ،
   والإرسالُ كذلك، بقولٍ يسمّي المخرج (`contractBlockedAr`). */

import { beforeAll, describe, expect, it } from 'vitest'
import type { PrismaClient } from '@prisma/client'
import { createHash } from 'node:crypto'
import { setupTestDb, testPrisma } from '../helpers/db'
import { makeReadyForApproval } from '../helpers/trainer-ready'
import { AuthService } from '../../services/auth.service'
import { TrainerReviewService } from '../../services/trainer-review.service'
import { TrainerDepartureService } from '../../services/trainer-departure.service'
import { contractAcks } from '../../../src/application/trainer/contract-body'

const sha256 = (v: string) => createHash('sha256').update(v).digest('hex')
let prisma: PrismaClient
let auth: AuthService
let review: TrainerReviewService
let departures: TrainerDepartureService
let adminId = ''
const DOCS = [{ kind: 'national_id', labelAr: 'الهوية الوطنية', required: true }]
const WHY_LEFT = 'انتقل إلى جهةٍ أخرى'
let seq = 0

beforeAll(async () => {
  await setupTestDb()
  prisma = await testPrisma()
  /* قناةٌ ميّتة — البريدُ يخفق ولا يخرج، والقرارُ يُفحص وحدَه */
  process.env.RESEND_BASE_URL = 'http://127.0.0.1:1'
  auth = new AuthService(prisma)
  review = new TrainerReviewService(prisma)
  departures = new TrainerDepartureService(prisma)
  const admin = await auth.register('recontract-admin@test.local', 'Admin#12345', 'المدير الأكاديمي')
  adminId = admin.userId
  await auth.setRoles(adminId, ['academic_manager'])
}, 240_000)

/** مدرّبٌ نشطٌ بعقدٍ نافذٍ معتمَد — بالطريق الذي يُعتمَد به فعلا */
async function mkContracted() {
  seq += 1
  const email = `recontract-${seq}-${Date.now()}@test.local`
  const user = await auth.register(email, 'Pass#12345', `مدرّبٌ ${seq}`)
  const app = await prisma.trainerApplication.create({
    data: {
      reference: `TR-RC-${Date.now()}-${seq}`, fullName: `مدرّبٌ ${seq}`, email,
      status: 'contract_pending', motivation: 'اختبار', privacyConsentAt: new Date(), userId: user.userId,
    },
  })
  const profile = await prisma.trainerProfile.create({ data: { applicationId: app.id } })
  await prisma.trainerContract.create({
    data: {
      profileId: profile.id, title: `اتفاقيّةٌ ${seq}`, status: 'signed',
      bodyVersion: 'v-test', bodyAr: 'نصُّ اتفاقيّةٍ للاختبار', signerEmail: email,
      signerLegalName: `الاسمُ القانونيُّ ${seq}`, signedAt: new Date(), gatesActivation: true,
    },
  })
  await makeReadyForApproval(prisma, app.id, adminId)
  await review.decide(app.id, adminId, 'approve')
  const first = await prisma.trainerContract.findFirstOrThrow({ where: { profileId: profile.id } })
  expect(first.status, 'لم ينفذ العقدُ الأوّل — فلا فسخَ يُفحص').toBe('countersigned')
  return { app, profile, userId: user.userId }
}

/** يُرسَل ويُرفع مستندُ الهويّة ويُوقَّع ثمّ يُعتمَد — كما يقع من الرابط */
async function signAndCountersign(contractId: string) {
  const row = await prisma.trainerContract.findUniqueOrThrow({ where: { id: contractId } })
  const sent = await review.sendContract(contractId, adminId)
  await prisma.trainerContractDocument.create({
    data: {
      contractId, kind: 'national_id', storageKey: `rc-${contractId}`,
      originalName: 'id.pdf', mime: 'application/pdf', sizeBytes: 1024,
    },
  })
  await review.signContractByToken(decodeURIComponent(sent.signingUrl.split('/c/')[1]), {
    legalName: 'الاسمُ القانونيّ', addressAr: 'عمّان — بناية ١٢', phone: '+962790000000',
    bodyHash: sha256(row.bodyAr!), acks: contractAcks(row.gatesActivation).map((a) => a.key),
  })
  await review.countersignContract(contractId, adminId)
  return prisma.trainerContract.findUniqueOrThrow({ where: { id: contractId } })
}

const contractsOf = (profileId: string) => prisma.trainerContract.count({ where: { profileId } })
const inCandidates = async (applicationId: string) =>
  (await review.listContracts()).candidates.some((c) => c.id === applicationId)

describe('من فُسخ عقدُه برحيله يُركَّب له عقدٌ جديد', () => {
  it('① ينتظر عقدا — ويُركَّب له ويُرسَل ويُوقَّع ويُعتمَد، ويبقى نشطا بدوره', async () => {
    const t = await mkContracted()
    await departures.open(adminId, t.profile.id, WHY_LEFT)
    expect((await prisma.trainerContract.findFirstOrThrow({ where: { profileId: t.profile.id } })).status)
      .toBe('terminated')

    expect(await inCandidates(t.app.id), 'من رحل غاب عن «من ينتظر عقدا»').toBe(true)
    expect((await review.contractPrefill(t.app.id)).blockedAr, 'مُنع التركيبُ لمن رحل').toBeNull()

    const made = await review.composeContract(t.app.id, adminId, { title: 'اتفاقيّةٌ جديدة', requiredDocuments: DOCS })
    /* اعتُمد من قبل — فالجديدُ توثيقٌ على ملفٍّ حيّ لا عرضٌ مشروطٌ بطور موادّ */
    expect(made.gatesActivation, 'عاد من رحل إلى طور الموادّ كأنّه مرشّح').toBe(false)
    expect((await signAndCountersign(made.id)).status).toBe('countersigned')

    const app = await prisma.trainerApplication.findUniqueOrThrow({ where: { id: t.app.id } })
    expect(app.status, 'تحرّكت حالةُ طلبه بعقدٍ على ملفٍّ حيّ').toBe('active')
    const roles = (await prisma.userRole.findMany({ where: { userId: t.userId } })).map((r) => r.roleId)
    expect(roles, 'سقط دورُه مدرّبا').toContain('trainer')
  })
})

describe('ومن لا يُركَّب له بعدُ يُقال له المخرج — ولا تبقى مسودّةٌ يتيمة', () => {
  it('② الموقوفُ مع رحيله لا ينتظر عقدا، ولا يُكتب له صفٌّ — والمنعُ يسمّي «ارفع الإيقاف»', async () => {
    const t = await mkContracted()
    await departures.open(adminId, t.profile.id, WHY_LEFT)
    await review.suspendTrainer(t.profile.id, adminId, 'إيقافٌ بعد الرحيل')

    expect(await inCandidates(t.app.id), 'عُرض الموقوفُ فيمن ينتظر عقدا').toBe(false)
    const row = (await review.listContracts()).contracts.find((c) => c.profile?.id === t.profile.id)
    expect(row?.profile?.suspendedAt, 'الصفُّ لا يعرف الإيقافَ فلا يقول سببَ المنع').toBeTruthy()

    const before = await contractsOf(t.profile.id)
    const refused = review.composeContract(t.app.id, adminId, { title: 'اتفاقيّةٌ للموقوف', requiredDocuments: DOCS })
    await expect(refused).rejects.toMatchObject({ code: 'not_contractable' })
    await expect(refused).rejects.toThrow(/«ارفع الإيقاف»/)
    expect(await contractsOf(t.profile.id), 'رُكّبت مسودّةٌ لا تُرسَل').toBe(before)
  })

  it('③ فإن رُفع إيقافُه عاد ينتظر عقدا، ورُكّب له وأُرسل', async () => {
    const t = await mkContracted()
    await departures.open(adminId, t.profile.id, WHY_LEFT)
    await review.suspendTrainer(t.profile.id, adminId, 'إيقافٌ بعد الرحيل')
    await review.decide(t.app.id, adminId, 'reinstate')

    expect(await inCandidates(t.app.id), 'رُفع إيقافُه ولم يعد ينتظر عقدا').toBe(true)
    const made = await review.composeContract(t.app.id, adminId, { title: 'اتفاقيّةٌ بعد رفع الإيقاف', requiredDocuments: DOCS })
    await review.sendContract(made.id, adminId)
    expect((await prisma.trainerContract.findUniqueOrThrow({ where: { id: made.id } })).status).toBe('sent')
  })

  it('④ ومسودّةٌ رُكّبت ثمّ أُوقف صاحبُها لا تُرسَل — بقولٍ يُقرأ لا برموز حالتَين', async () => {
    const t = await mkContracted()
    await departures.open(adminId, t.profile.id, WHY_LEFT)
    const made = await review.composeContract(t.app.id, adminId, { title: 'اتفاقيّةٌ قبل الإيقاف', requiredDocuments: DOCS })
    await review.suspendTrainer(t.profile.id, adminId, 'إيقافٌ بعد التركيب')

    const refused = review.sendContract(made.id, adminId)
    await expect(refused).rejects.toMatchObject({ code: 'not_contractable' })
    await expect(refused).rejects.toThrow(/«ارفع الإيقاف»/)
    expect((await prisma.trainerContract.findUniqueOrThrow({ where: { id: made.id } })).status).toBe('draft')
    expect((await prisma.trainerApplication.findUniqueOrThrow({ where: { id: t.app.id } })).status).toBe('suspended')
  })

  it('⑤ والإيقافُ على الملفّ وحدَه يكفي — طلبُه حيٌّ ولا ينتظر عقدا', async () => {
    /* `suspendTrainer` لا تنقل إلى «موقوف» إلّا طلبا نشطا: من أُوقف وهو مقبولٌ
       داخليّا يبقى طلبُه حيّا، والإيقافُ على ملفّه وحدَه — فلا يكفي سؤالُ الحالة */
    seq += 1
    const app = await prisma.trainerApplication.create({
      data: {
        reference: `TR-RC-S-${Date.now()}-${seq}`, fullName: `موقوفٌ ${seq}`,
        email: `recontract-s-${seq}-${Date.now()}@test.local`,
        status: 'conditionally_approved', motivation: 'اختبار', privacyConsentAt: new Date(),
      },
    })
    const profile = await prisma.trainerProfile.create({ data: { applicationId: app.id } })
    await review.suspendTrainer(profile.id, adminId, 'إيقافٌ قبل العقد')
    expect((await prisma.trainerApplication.findUniqueOrThrow({ where: { id: app.id } })).status,
      'نُقل الطلبُ فلا يُفحص الإيقافُ على الملفّ وحدَه').toBe('conditionally_approved')

    expect(await inCandidates(app.id), 'عُرض موقوفُ الملفّ فيمن ينتظر عقدا').toBe(false)
    await expect(review.composeContract(app.id, adminId, { title: 'اتفاقيّةٌ لموقوف', requiredDocuments: DOCS }))
      .rejects.toMatchObject({ code: 'not_contractable' })
  })

  it('⑥ والمردودُ يُسمّى له بابُه — لا يُركَّب له قبل أن يُتراجَع عن ردّه', async () => {
    seq += 1
    const app = await prisma.trainerApplication.create({
      data: {
        reference: `TR-RC-R-${Date.now()}-${seq}`, fullName: `مردودٌ ${seq}`,
        email: `recontract-r-${seq}-${Date.now()}@test.local`,
        status: 'rejected', motivation: 'اختبار', privacyConsentAt: new Date(),
      },
    })
    const profile = await prisma.trainerProfile.create({ data: { applicationId: app.id } })

    const refused = review.composeContract(app.id, adminId, { title: 'اتفاقيّةٌ لمردود', requiredDocuments: DOCS })
    await expect(refused).rejects.toMatchObject({ code: 'not_contractable' })
    await expect(refused).rejects.toThrow(/«تراجَعْ عن الرفض»/)
    expect(await contractsOf(profile.id)).toBe(0)
  })
})
