/* اسمُ الطرف الثاني — يُطابَق قبل التجميد، ويُصحَّح ببديلٍ بعده. بقاعدةٍ حقيقيّة.
 *
 * ── العطبُ الذي يحرسه ──
 *
 * بلاغُ صاحب المنصّة (٢٦ سبتمبر ٢٠٢٦): «الطرف الثاني كاسم يجب أن يكون مطابقا
 * للهويّة أو أعطِه الحقَّ بكتابته بنفسه، لأنّ الاسم الموجود هنا هو ما أُخذ من
 * حسابه وغالبا ليس اسما ثلاثيّا ولا يشبه جواز السفر أو الهويّة».
 *
 * وكانت الديباجةُ تُطبَع بـ`application.fullName` بلا سبيلٍ إلى تغييره — لا
 * للموظّف ولا للمدرّب — ثمّ يوقّع المدرّبُ باسمه القانونيّ في خانة التوقيع.
 * فتخرج وثيقةٌ **تسمّي طرفا ويوقّعها آخر**، ومن نازع فيها بعد سنةٍ وجد
 * الثغرةَ مكتوبةً في متنها.
 *
 * ── وأدقُّ ما يُقاس: أنّ البديلَ يَنسخ البنودَ ولا يُعيد التفاوض ──
 *
 * تصحيحُ الاسم ليس إعادةَ تركيب: لو قُرئت أتعابُ **اليوم** بدل أتعابِ العقد
 * لَتبدّل أجرُه بلا أن يقصد أحدٌ ذلك، ولَوقّع على غير ما اتُّفق عليه. فتُبدَّل
 * قاعدةُ أتعابه بعد التركيب، ويُقاس أنّ متنَ البديل ما زال يحمل الأوّلَ.
 */

import { beforeAll, describe, expect, it } from 'vitest'
import { createHash } from 'node:crypto'
import type { PrismaClient } from '@prisma/client'
import { setupTestDb, testPrisma } from '../helpers/db'
import { AuthService } from '../../services/auth.service'
import { TrainerReviewService } from '../../services/trainer-review.service'
import { EarningsService } from '../../services/earnings.service'
import { contractAcks } from '../../../src/application/trainer/contract-body'

let prisma: PrismaClient
let auth: AuthService
let review: TrainerReviewService
let adminId = ''

const sha256 = (s: string) => createHash('sha256').update(s).digest('hex')
const COURSE = 'C-NAME-101'
const ACCOUNT_NAME = 'سهيب الخوالدة'
const ID_NAME = 'سهيب عبد الله محمد الخوالدة'

beforeAll(async () => {
  await setupTestDb()
  prisma = await testPrisma()
  auth = new AuthService(prisma)
  review = new TrainerReviewService(prisma)
  const admin = await auth.register('name-admin@test.local', 'Admin#12345', 'المدير الأكاديمي')
  adminId = admin.userId
  await auth.setRoles(adminId, ['academic_manager'])
  await prisma.course.create({ data: { id: COURSE, status: 'published', currentVersion: 1 } })
  await prisma.courseVersion.create({
    data: { courseId: COURSE, version: 1, titleAr: 'أساسيّاتُ المحاسبة', totalHours: 10 },
  })
}, 240_000)

let seq = 0

/** مرشّحٌ مقبولٌ مشروطا، بملفٍّ ومؤهّلٍ وأتعابٍ — جاهزٌ لتركيب عقده */
async function candidate() {
  seq += 1
  const email = `name-${seq}-${Date.now()}@test.local`
  const user = await auth.register(email, 'Trainer#12345', ACCOUNT_NAME)
  const application = await prisma.trainerApplication.create({
    data: {
      reference: `TR-NAME-${Date.now()}-${seq}`, fullName: ACCOUNT_NAME, email,
      status: 'conditionally_approved', motivation: 'اختبار',
      privacyConsentAt: new Date(), userId: user.userId,
    },
  })
  const profile = await prisma.trainerProfile.create({
    data: { applicationId: application.id, userId: user.userId, isVerified: true },
  })
  await prisma.trainerCourseQualification.create({
    data: { profileId: profile.id, courseId: COURSE, status: 'qualified' },
  })
  await new EarningsService(prisma).setRule(adminId, {
    profileId: profile.id, type: 'per_seat', rate: 25, minSeats: 0,
  })
  /* ومهامُّ التهيئة تُبذَر مع القبول المشروط في الإنتاج — وهذه سقالةٌ تبني
     الملفَّ بيدها، فتبذر ما يخصّ هذه الجولة. وبدونها لا صفَّ يُغلَق ولا
     يُفتَح، ويخضرّ الفحصُ على `undefined`. */
  await prisma.trainerOnboardingTask.create({
    data: { profileId: profile.id, key: 'sign_contract', title: 'توقيع العقد' },
  })
  return { application, profile, email }
}

const DOCS = [{ kind: 'national_id', labelAr: 'الهويّة', required: true }]

async function compose(applicationId: string, trainerLegalNameAr?: string | null) {
  return review.composeContract(applicationId, adminId, {
    title: 'اتفاقية تقديم خدمات تدريبية',
    trainerLegalNameAr,
    requiredDocuments: DOCS,
  })
}

describe('اسمُ الطرف الثاني يُطابَق قبل التجميد', () => {
  it('المكتوبُ في الشاشة هو ما يُطبَع في الديباجة — لا اسمُ الحساب', async () => {
    const { application } = await candidate()
    const c = await compose(application.id, ID_NAME)

    expect(c.bodyAr ?? '', 'طُبع اسمُ الحساب طرفا ثانيا').toContain(`الطرف الثاني: ${ID_NAME}`)
    expect(c.bodyAr ?? '', 'بقي اسمُ الحساب في الديباجة').not.toContain(`الطرف الثاني: ${ACCOUNT_NAME}`)
  })

  it('ويُحفَظ في الملفّ، فيَرِثه العقدُ الذي بعده بلا أن يُكتب ثانية', async () => {
    const { application, profile } = await candidate()
    await compose(application.id, ID_NAME)

    const saved = await prisma.trainerProfile.findUniqueOrThrow({ where: { id: profile.id } })
    expect(saved.legalNameAr, 'لم يُحفَظ الاسمُ في الملفّ').toBe(ID_NAME)

    /* ولا يُركَّب ثانٍ وأوّلُه مفتوح — فيُلغى ثمّ يُركَّب، كما في الإنتاج */
    const open = await prisma.trainerContract.findFirstOrThrow({ where: { profileId: profile.id } })
    await review.revokeContract(open.id, adminId, 'اختبارٌ — يُركَّب غيرُه')
    const second = await compose(application.id)
    expect(second.bodyAr ?? '', 'لم يَرِث العقدُ الثاني الاسمَ المثبَّت').toContain(`الطرف الثاني: ${ID_NAME}`)
  })

  it('وبلا اسمٍ مكتوبٍ يبقى اسمُ الحساب — فلا يُخترَع اسمٌ لأحد', async () => {
    const { application } = await candidate()
    const c = await compose(application.id)
    expect(c.bodyAr ?? '').toContain(`الطرف الثاني: ${ACCOUNT_NAME}`)
  })
})

describe('«اسمي في هويّتي غيرُ هذا» — جوابُ المدرّب الرابع', () => {
  async function sentContract() {
    const made = await candidate()
    const c = await compose(made.application.id)
    const sent = await review.sendContract(c.id, adminId)
    return { ...made, contract: c, token: decodeURIComponent(sent.signingUrl.split('/c/')[1]) }
  }

  it('يقف التوقيعُ ويُحفَظ ما قاله بحرفه', async () => {
    const { contract, token } = await sentContract()
    await review.requestNameCorrection(token, ID_NAME)

    const after = await prisma.trainerContract.findUniqueOrThrow({ where: { id: contract.id } })
    expect(after.status, 'لم يقف التوقيعُ').toBe('amendment_requested')
    expect(after.nameCorrectionAr, 'ضاع الاسمُ الذي كتبه').toBe(ID_NAME)
    expect(after.nameCorrectionAt).not.toBeNull()

    /* ولا يُوقَّع بعده: البابُ الذي يوقّع منه يشترط `sent`.
       والوثيقةُ مرفوعةٌ كي يكون الردُّ عن الحالة لا عن نقص وثيقة. */
    await prisma.trainerContractDocument.create({
      data: {
        contractId: contract.id, kind: 'national_id', storageKey: `k2-${contract.id}`,
        originalName: 'id.pdf', mime: 'application/pdf', sizeBytes: 1024,
      },
    })
    await expect(review.signContractByToken(token, {
      legalName: ID_NAME, addressAr: 'عمّان — بناية ١٢', phone: '+962790000000',
      bodyHash: sha256(contract.bodyAr ?? ''), acks: contractAcks(true).map((a) => a.key),
    })).rejects.toBeTruthy()
  })

  it('ويُردّ اسمٌ هو المكتوبُ نفسُه — فلا يقف عقدٌ بلا سبب', async () => {
    const { contract, token } = await sentContract()
    await expect(review.requestNameCorrection(token, ACCOUNT_NAME))
      .rejects.toMatchObject({ code: 'same_name' })
    const after = await prisma.trainerContract.findUniqueOrThrow({ where: { id: contract.id } })
    expect(after.status, 'وقف العقدُ على تصحيحٍ لا تصحيحَ فيه').toBe('sent')
  })
})

describe('البديلُ يُصحّح الاسمَ ولا يُعيد التفاوض', () => {
  it('يُغلق القائمَ، ويُنشئ بديلا باسمه، ويقول من حلَّ محلَّه، ويُرسَل', async () => {
    const made = await candidate()
    const c = await compose(made.application.id)
    const sent = await review.sendContract(c.id, adminId)
    const token = decodeURIComponent(sent.signingUrl.split('/c/')[1])
    await review.requestNameCorrection(token, ID_NAME)

    const out = await review.reissueWithCorrectedName(c.id, adminId, {})

    const oldRow = await prisma.trainerContract.findUniqueOrThrow({ where: { id: c.id } })
    expect(oldRow.status, 'بقي العرضُ الأوّلُ مفتوحا — فبابان على وثيقتَين').toBe('revoked')
    expect(oldRow.tokenHash, 'بقي رابطٌ حيٌّ على المتن القديم').toBeNull()

    const next = await prisma.trainerContract.findUniqueOrThrow({ where: { id: out.contractId } })
    expect(next.bodyAr ?? '', 'لم يُصحَّح الاسمُ في متن البديل').toContain(`الطرف الثاني: ${ID_NAME}`)
    expect(next.kind).toBe('replacement')
    expect(next.replacesContractId, 'لا يقول البديلُ من حلَّ محلَّه').toBe(c.id)
    expect(next.revision, 'لم تُرفَع الصياغة').toBe(oldRow.revision + 1)
    expect(next.status, 'رُكِّب البديلُ ولم يُرسَل').toBe('sent')
    expect(next.tokenHash, 'أُرسل بلا رابطٍ يوقّع منه').not.toBeNull()
    /* والبصمةُ تتبع المتنَ الجديد — وإلّا قُوبل الموقَّعُ ببصمةِ متنٍ آخر */
    expect(next.bodyHash).toBe(sha256(next.bodyAr ?? ''))
  })

  it('وينسخ بنودَ العقد القديم لا أتعابَ اليوم', async () => {
    const made = await candidate()
    const c = await compose(made.application.id)
    expect(c.bodyAr ?? '', 'لم يُطبَع أساسُ الأتعاب أصلا').toContain('25 USD')

    /* ═══ وهذا مِحَكُّ الفحص ═══

       تُبدَّل قاعدةُ أتعابه بعد التركيب. فلو قرأ البديلُ الحاضرَ لَحمل ٩٩،
       ولَوقّع المدرّبُ على أجرٍ لم يُتّفق عليه — وهو يظنّ أنّه صحّح اسمَه. */
    await new EarningsService(prisma).setRule(adminId, {
      profileId: made.profile.id, type: 'per_seat', rate: 99, minSeats: 0,
    })

    const out = await review.reissueWithCorrectedName(c.id, adminId, { legalNameAr: ID_NAME })
    const next = await prisma.trainerContract.findUniqueOrThrow({ where: { id: out.contractId } })

    /* والمقابلةُ على **جملة الأتعاب** لا على المتن كلِّه: المرجعُ مطبوعٌ في
       رأس الوثيقة وفيه أرقامُ `Date.now()`، فمسحٌ على «99» وحدَها يحمرّ على
       مرجعٍ صادف أن حمل الرقمَين. وصيغةُ الوحدة `${rate} ${currency}`. */
    expect(next.bodyAr ?? '', 'تبدّلت أتعابُه في بديلٍ يصحّح اسما').not.toContain('99 USD')
    expect(next.bodyAr ?? '', 'ضاع أساسُ أتعابه من البديل').toContain('25 USD')
    expect(String(next.compensationRate ?? ''), 'تبدّل الأجرُ المحفوظُ في الصفّ').toContain('25')
  })

  it('ولا يُستبدَل عقدٌ نافذ — بابُه الفسخُ لا التصحيح', async () => {
    const made = await candidate()
    const c = await compose(made.application.id)
    await prisma.trainerContract.update({
      where: { id: c.id }, data: { status: 'countersigned', countersignedAt: new Date() },
    })
    await expect(review.reissueWithCorrectedName(c.id, adminId, { legalNameAr: ID_NAME }))
      .rejects.toMatchObject({ code: 'bad_state' })
  })
})

describe('ورفضُ التوقيع يُعيد فتحَ مهمّة التوقيع', () => {
  it('فلا يقرأ في تهيئته «توقيع العقد ✓» وتوقيعُه مرفوض', async () => {
    const made = await candidate()
    const c = await compose(made.application.id)
    const sent = await review.sendContract(c.id, adminId)
    const token = decodeURIComponent(sent.signingUrl.split('/c/')[1])
    /* والوثيقةُ إلزاميّةٌ قبل التوقيع (البند 15) — تُرفَع كما يرفعها هو */
    await prisma.trainerContractDocument.create({
      data: {
        contractId: c.id, kind: 'national_id', storageKey: `k-${c.id}`,
        originalName: 'id.pdf', mime: 'application/pdf', sizeBytes: 1024,
      },
    })
    await review.signContractByToken(token, {
      legalName: 'اسمٌ لا يطابق', addressAr: 'عمّان — بناية ١٢', phone: '+962790000000',
      bodyHash: c.bodyHash ?? '', acks: contractAcks(c.gatesActivation).map((a) => a.key),
    })

    const closed = await prisma.trainerOnboardingTask.findUnique({
      where: { profileId_key: { profileId: made.profile.id, key: 'sign_contract' } },
    })
    /* و`?.` وحدَها تُخضِر الفحصَ على صفٍّ غيرِ موجود (`undefined` ليس `null`)
       — فيُسأل عن وجود الصفّ أوّلا، ثمّ عن قيمته. */
    expect(closed, 'لا صفَّ لمهمّة التوقيع أصلا — فالفحصُ يقيس لا شيء').not.toBeNull()
    expect(closed!.doneAt, 'لم تُغلَق المهمّةُ بالتوقيع').not.toBeNull()

    await review.rejectSignature(c.id, adminId, 'الاسمُ لا يطابق وثيقةَ الهويّة')

    const reopened = await prisma.trainerOnboardingTask.findUnique({
      where: { profileId_key: { profileId: made.profile.id, key: 'sign_contract' } },
    })
    expect(reopened, 'اختفى صفُّ المهمّة مع الرفض').not.toBeNull()
    expect(reopened!.doneAt, 'بقيت المهمّةُ مغلقةً وتوقيعُه مرفوض').toBeNull()
    /* ولا يُمَسّ دليلُ التوقيع: ما فعله وقع */
    const row = await prisma.trainerContract.findUniqueOrThrow({ where: { id: c.id } })
    expect(row.signedAt, 'مُحي دليلُ التوقيع مع رفضه').not.toBeNull()
    expect(row.signerLegalName).toBe('اسمٌ لا يطابق')
  })
})
