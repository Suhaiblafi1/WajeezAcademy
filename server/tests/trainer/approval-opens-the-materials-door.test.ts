/* اعتمادُ التوقيع يفتح بابَ الموادّ — بقاعدةٍ حقيقيّة.
 *
 * ── العطبُ الذي يحرسه: قفلٌ مغلقٌ على نفسه ──
 *
 * كان التوقيعُ ينقل الطلبَ إلى `onboarding` فورا، وكان حارسُ هذا الملفّ
 * يُثبّت ذلك ويخضرّ. **وكان يخضرّ لسببٍ خاطئ**: سقالتُه تمنح المرشّحَ دورَ
 * `trainer` وتربط ملفَّه بحسابه بيدها، فتقيس بابا مفتوحا سلفا.
 *
 * وما يقع للمدرّب الحقيقيّ غيرُ ذلك: من وقّع يبقى دورُه `trainer_applicant`،
 * وهو لا يملك `trainer.portal` أصلا (`server/auth/permissions.ts`: «حتى ذلك
 * الحين لا يملك إلا رؤية طلبه»). وملفُّه لا يُربَط بحسابه إلّا في
 * `consumeInvitation` — أي بعد النشر. فبوّابةُ الموادّ كانت **غيرَ مطروقةٍ
 * منذ بُنيت**: الحالةُ تُفتح والصلاحيّةُ تردّ.
 *
 * فكانت المهلةُ تجري على من لا يستطيع الوفاءَ بها، والمذكِّرُ يطرق بابا
 * مقفلا من جهتنا نحن.
 *
 * ── وما صار (٢٧ سبتمبر ٢٠٢٦) ──
 *
 * خطواتُ صاحب المنصّة: «② نراجع توقيعَك ونعتمده · ③ نمنحك حقَّ فتح الحساب ·
 * ④ **بعدها** لديك ٥ أيّام». فالاعتمادُ يفعل الثلاثةَ معا في معاملةٍ واحدة:
 * يمنح الدورَ ويربط الملفَّ، وينقل الحالةَ، ويكتب المهلة. والتوقيعُ يبقى
 * توقيعا.
 *
 * ── وما يُقاس هنا: الأثرُ لا السطر ──
 *
 * لا يكفي أن تُقرأ الحالةُ `onboarding`: هي إحدى بوّابتَين. فيُسأل البابُ
 * (`canWorkOnMaterials`) **والصلاحيّةُ** (`trainer.portal` في أدواره)
 * **والربطُ** (`profile.userId`) — فثلاثتُها كانت تلزم ولم تكن تجتمع.
 * ويُشغَّل العاملُ نفسُه ويُعَدُّ من وجدهم.
 *
 * ── والوجهُ الثاني: من لا تهيئةَ له لا يُحرَّك ──
 *
 * بندٌ يُوثَّق على مدرّبٍ **نشطٍ أصلا** (`gatesActivation = false`) طلبُه
 * `active`، و`active → onboarding` لا تُجيزه الخريطة. فلا توقيعُه ولا
 * اعتمادُه يمسّ حالتَه — وإلّا عُطّل مدرّبٌ يعمل بتوثيقه بندا.
 */

import { beforeAll, describe, expect, it } from 'vitest'
import { createHash } from 'node:crypto'
import type { PrismaClient } from '@prisma/client'
import { setupTestDb, testPrisma } from '../helpers/db'
import { AuthService } from '../../services/auth.service'
import { TrainerReviewService } from '../../services/trainer-review.service'
import { contractAcks, CONDITION_CLAUSE_MARK } from '../../../src/application/trainer/contract-body'
import { canWorkOnMaterials } from '../../../src/application/trainer/portal-access'
import { MATERIALS_WINDOW_DAYS } from '../../../src/application/trainer/conditional-offer'

let prisma: PrismaClient
let auth: AuthService
let review: TrainerReviewService
let adminId = ''

const sha256 = (s: string) => createHash('sha256').update(s).digest('hex')
const BODY = `نصُّ اتفاقيّةٍ للاختبار — البند 1 وما بعده.

${CONDITION_CLAUSE_MARK} لا عقد نهائي. ونفاذه معلق على قبول الأكاديمية لمواد المدرب.`
const DAY = 24 * 3600_000

beforeAll(async () => {
  await setupTestDb()
  prisma = await testPrisma()
  auth = new AuthService(prisma)
  review = new TrainerReviewService(prisma)
  const admin = await auth.register('door-admin@test.local', 'Admin#12345', 'المدير الأكاديمي')
  adminId = admin.userId
  await auth.setRoles(adminId, ['academic_manager'])
}, 240_000)

let seq = 0

/** عقدٌ مرسَلٌ ينتظر التوقيعَ — بحالِ المرشّح الحقيقيّ لا بسقالةٍ تُسهّل
 *
 *  ودورُه `trainer_applicant` وملفُّه **غيرُ مربوطٍ** بحسابه: هي حالُ من
 *  وصله عرضٌ ولم يُعتمَد بعد. وسقالةٌ تمنحه `trainer` وتربط ملفَّه تقيس
 *  بابا فتحته هي بيدها — وذاك ما كان يُخضِر الحارسَ القديمَ بالباطل. */
async function readyToSign(opts: { gatesActivation: boolean; appStatus: string }) {
  seq += 1
  const email = `door-${seq}-${Date.now()}@test.local`
  const user = await auth.register(email, 'Trainer#12345', `مرشّحٌ ${seq}`)
  await auth.setRoles(user.userId, opts.gatesActivation ? ['trainer_applicant'] : ['trainer'])
  const application = await prisma.trainerApplication.create({
    data: {
      reference: `TR-DOOR-${Date.now()}-${seq}`, fullName: `مرشّحٌ ${seq}`, email,
      status: opts.appStatus, motivation: 'اختبار', privacyConsentAt: new Date(),
      userId: user.userId,
    },
  })
  const profile = await prisma.trainerProfile.create({
    data: {
      applicationId: application.id, isVerified: true,
      /* والنشطُ مربوطٌ أصلا؛ والمرشّحُ لا — فالربطُ ممّا يُقاس */
      userId: opts.gatesActivation ? null : user.userId,
    },
  })
  const contract = await prisma.trainerContract.create({
    data: {
      profileId: profile.id, title: `عقدُ ${seq}`, status: 'draft',
      bodyVersion: 'v-test', bodyAr: BODY, bodyHash: sha256(BODY),
      requiredDocuments: [], signerEmail: email,
      gatesActivation: opts.gatesActivation,
    },
  })
  const sent = await review.sendContract(contract.id, adminId)
  return {
    application, profile, contract, userId: user.userId,
    token: decodeURIComponent(sent.signingUrl.split('/c/')[1]),
  }
}

const sign = (token: string) => review.signContractByToken(token, {
  legalName: 'الاسمُ القانونيُّ الكامل', addressAr: 'عمّان — بناية ١٢',
  phone: '+962790000000', bodyHash: sha256(BODY),
  acks: contractAcks(true).map((a) => a.key),
})

const rolesOf = async (userId: string) => (await prisma.userRole.findMany({
  where: { userId }, select: { roleId: true },
})).map((r) => r.roleId)

describe('الاعتمادُ يفتح بابَ الموادّ — لا التوقيع', () => {
  it('والتوقيعُ وحدَه لا يفتح شيئا: لا حالةً ولا مهلةً ولا دورا', async () => {
    const { application, contract, userId, token } = await readyToSign({
      gatesActivation: true, appStatus: 'conditionally_approved',
    })
    const before = await prisma.trainerApplication.findUniqueOrThrow({ where: { id: application.id } })
    expect(before.status, 'الإرسالُ ينقل إلى «العقد قيد التوقيع»').toBe('contract_pending')
    expect(canWorkOnMaterials({ status: before.status })).toBe(false)

    await sign(token)

    const after = await prisma.trainerApplication.findUniqueOrThrow({ where: { id: application.id } })
    expect(after.status, 'التوقيعُ نقل الطلبَ — وهو ينتظر نظرَنا في اسمه').toBe('contract_pending')
    const row = await prisma.trainerContract.findUniqueOrThrow({ where: { id: contract.id } })
    expect(row.status, 'لم يُكتب التوقيع').toBe('signed')
    expect(row.conditionDeadlineAt, 'جرت مهلتُه قبل أن نعتمده').toBeNull()
    expect(await rolesOf(userId), 'مُنح دورَ المدرّب بتوقيعه وحدَه')
      .not.toContain('trainer')
  })

  it('والاعتمادُ يفتحها ثلاثتَها معا — حالةً ودورا وربطا — ومهلتُه منه', async () => {
    const { application, profile, contract, userId, token } = await readyToSign({
      gatesActivation: true, appStatus: 'conditionally_approved',
    })
    await sign(token)

    const at = Date.now()
    await review.countersignContract(contract.id, adminId, { noteAr: 'طابقتُ الاسمَ بهويّته' })

    const after = await prisma.trainerApplication.findUniqueOrThrow({ where: { id: application.id } })
    expect(after.status, 'اعتُمد ولم يتحرّك طلبُه').toBe('onboarding')
    /* والغايةُ لا الوسيلة: البابُ يُسأل بالدالّة التي تسأله في الخادم */
    expect(canWorkOnMaterials({ status: after.status }), 'اعتُمد والبابُ مقفلٌ دونه').toBe(true)

    /* ═══ والصلاحيّةُ هي القفلُ الذي لم يكن يُفتح ═══ */
    expect(await rolesOf(userId), 'نُقلت حالتُه ولم يُمنَح `trainer.portal` — فالبابُ مقفلٌ كما كان')
      .toContain('trainer')
    expect(await rolesOf(userId), 'بقي دورُ التقديم معه').not.toContain('trainer_applicant')
    const linked = await prisma.trainerProfile.findUniqueOrThrow({ where: { id: profile.id } })
    expect(linked.userId, 'ملفُّه غيرُ مربوطٍ بحسابه — فكلُّ مسلكٍ يبحث عنه بـuserId يردّه')
      .toBe(userId)

    /* ═══ والمهلةُ من الاعتماد، خمسةُ أيّامٍ منه لا من التوقيع ═══ */
    const row = await prisma.trainerContract.findUniqueOrThrow({ where: { id: contract.id } })
    expect(row.conditionDeadlineAt, 'اعتُمد ولا مهلةَ — فلا طورَ موادّ').not.toBeNull()
    const days = (row.conditionDeadlineAt!.getTime() - at) / DAY
    expect(days, 'المهلةُ ليست من لحظة الاعتماد').toBeGreaterThan(MATERIALS_WINDOW_DAYS - 0.1)
    expect(days, 'المهلةُ أطولُ ممّا كُتب في عرضه').toBeLessThan(MATERIALS_WINDOW_DAYS + 0.1)
  })

  it('وعاملُ التذكير يجده بعد الاعتماد — وكان يتخطّاه', async () => {
    const { profile, contract, token } = await readyToSign({
      gatesActivation: true, appStatus: 'conditionally_approved',
    })
    await sign(token)
    await review.countersignContract(contract.id, adminId)

    /* والمذكِّرُ لا يخرج إلّا قبل يومَين من الأجل، فتُقرَّب المهلةُ إلى نافذته:
       المقيسُ **أنّ العاملَ يجده**، لا مقدارُ المهلة — وذاك مقيسٌ أعلاه. */
    await prisma.trainerContract.update({
      where: { id: contract.id }, data: { conditionDeadlineAt: new Date(Date.now() + DAY) },
    })
    const { reminded } = await review.remindConditionDeadlines(new Date())
    expect(reminded, 'تقترب مهلتُه ولا مذكِّر').toBeGreaterThanOrEqual(1)
    const c = await prisma.trainerContract.findFirstOrThrow({ where: { profileId: profile.id } })
    expect(c.conditionRemindedAt, 'ذُكِّر ولم يُؤشَّر — فيُطرَق بابُه كلَّ ساعة').not.toBeNull()
  })

  /* ═══ والرمزُ يموت بالتوقيع — وبهذا الرمزِ بعينه تعرف الشاشةُ ما تقول ═══

     صفحةُ التوقيع تفرّق بين «انتهى هذا الرابط» (لوحُ تنبيهٍ يقول أين نسختُه)
     وبين «تعذّر فتحُ العقد» (لوحٌ أحمر) بـ`code === 'invalid_token'`. فلو
     تبدّل الرمزُ في الخادم لَعاد الموقِّعُ يقرأ الأحمرَ على فعلٍ نجح. */
  it('والرمزُ يموت بالتوقيع، ويُردّ بـ`invalid_token` الذي تقرؤه الشاشة', async () => {
    const { token } = await readyToSign({
      gatesActivation: true, appStatus: 'conditionally_approved',
    })
    await sign(token)
    await expect(review.contractByToken(token))
      .rejects.toMatchObject({ code: 'invalid_token', status: 404 })
  })

  it('ولا يُحرّك بندٌ يُوثَّق على مدرّبٍ نشطٍ حالتَه — لا بتوقيعه ولا باعتماده', async () => {
    const { application, contract, token } = await readyToSign({
      gatesActivation: false, appStatus: 'active',
    })
    const before = await prisma.trainerApplication.findUniqueOrThrow({ where: { id: application.id } })
    expect(before.status, 'الإرسالُ لا يمسّ حالةَ النشط').toBe('active')

    /* ولا يرمي: نقلٌ غيرُ مشروعٍ يُسأل قبل أن يُطلَب، فلا يسقط توقيعٌ صحيح */
    await expect(sign(token)).resolves.toMatchObject({ ok: true })
    await review.countersignContract(contract.id, adminId)

    const after = await prisma.trainerApplication.findUniqueOrThrow({ where: { id: application.id } })
    expect(after.status, 'وُثِّق بندٌ فعُطّل عن عمله').toBe('active')
    const row = await prisma.trainerContract.findUniqueOrThrow({ where: { id: contract.id } })
    expect(row.conditionDeadlineAt, 'بندٌ على نشطٍ لا مهلةَ له — وكُتبت').toBeNull()
  })
})
