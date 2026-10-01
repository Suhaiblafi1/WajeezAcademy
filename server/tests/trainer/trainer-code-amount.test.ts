/* ═══ كودُ المدرّب بمبلغ — من الإصدار إلى السلّة (١ أكتوبر ٢٠٢٦) ═══

   قرارُ صاحب المنصّة: «يحقّ للمدرّب أن يختار إمّا نسبةً أو رقما». والبند 4-10
   بصيغته الثانية يقول ثلاثة، وهنا تُقاس من القاعدة لا من الدالّة:

   ① **الوجهُ يُحفظ كما اختار** — مبلغا في صفّ الكود وفي كوبونه، والقاعدةُ ترفض
      كودا بوجهين.
   ② **والسقفُ يسري على المبلغ في الطلب الحقيقيّ** — عبر `commerce.quote` الذي
      يمرّ بـ`cart.service`، لا عبر `priceCart` تُنادى بوسائطَ تُكتب هنا.
   ③ **والرقمُ الذي تُريه «دعوتي» هو الذي يقتطعه الطلب** — وهو الحارسُ الذي لا
      يُكتب إلّا هنا: `codeValueFor` تُقابَل بما ردّه الطلبُ بوسائط `cart.service`
      نفسِها، فإن نسي ذاك السقفَ يوما افترقا.

   ومعها ما يترتّب على تغيّر النصّ: من وقّع على صيغة النسبة وحدَها يقبل الجديدةَ
   قبل أوّل كود. */

import { beforeAll, describe, expect, it } from 'vitest'
import type { PrismaClient } from '@prisma/client'
import { setupTestDb, testPrisma } from '../helpers/db'
import { AuthService } from '../../services/auth.service'
import { CommerceService } from '../../services/commerce.service'
import { TrainerCodeService } from '../../services/trainer-code.service'
import { EarningsService } from '../../services/earnings.service'
import { codeValueFor, MAX_TRAINER_CODE_PERCENT } from '../../../src/application/trainer/trainer-code'
import { CONTRACT_BODY_VERSION } from '../../../src/application/trainer/contract-body'

let prisma: PrismaClient
let codes: TrainerCodeService
let commerce: CommerceService
let auth: AuthService
let adminId = ''
const STAMP = Date.now()
/** من وقّع العقدَ الجاري — وهو يحمل البندَ بصيغته الثانية */
const CARRIES = CONTRACT_BODY_VERSION
/* وآخرُ متنٍ حمل صيغةَ «النسبة وحدَها» — يُكتب بحرفه ولا يُشتقّ من
   `CODE_TERMS_FIRST_BODY`: لو اشتُقّ منه لَتحرّك معه، فيخضرّ الفحصُ ولو أُعيد
   الثابتُ إلى الجيل الثالث عشر فقُبلت الصيغةُ الجديدةُ بتوقيعٍ على القديمة.
   وقد خضرّ كذلك مرّةً قبل أن يُكتب هكذا. */
const PERCENT_ONLY_BODY = 'v20-2026-10-01'

async function trainer(tag: string) {
  const user = await prisma.user.create({ data: { email: `tca-${tag}-${STAMP}@wajeez.test`, displayName: `مدرّب ${tag}`, passwordHash: 'x' } })
  const application = await prisma.trainerApplication.create({
    data: { reference: `WJ-TR-TCA-${tag}-${STAMP}`, fullName: `مدرّب ${tag}`, email: user.email, status: 'active' },
  })
  const profile = await prisma.trainerProfile.create({ data: { userId: user.id, applicationId: application.id } })
  return { userId: user.id, profileId: profile.id }
}
const signed = (profileId: string, bodyVersion: string) =>
  prisma.trainerContract.create({ data: { profileId, title: 'اتفاقيّةُ تقديم خدمات', status: 'signed', bodyVersion, signedAt: new Date() } })

/** شعبةٌ مفتوحةٌ للمدرّب بسعرها — وله أجرٌ يسع رصيدُه الخصم، فلا يُردّ الكودُ بعلّةٍ غير المقيسة */
async function cohortOf(profileId: string, price: number) {
  const course = await prisma.course.findFirstOrThrow({ select: { id: true } })
  const c = await prisma.cohort.create({
    data: { courseId: course.id, title: `شعبةٌ بـ${price}`, status: 'open', registrationOpen: true, financialReady: true, price, currency: 'USD', capacity: 10 },
  })
  await prisma.cohortTrainer.create({ data: { cohortId: c.id, profileId, role: 'lead', assignedBy: adminId } })
  return c.id
}

let n = 0
const learner = async () => (await auth.register(`tca-l${++n}-${STAMP}@test.local`, 'Learner#12345', 'متعلّم')).userId

beforeAll(async () => {
  await setupTestDb()
  prisma = await testPrisma()
  codes = new TrainerCodeService(prisma)
  commerce = new CommerceService(prisma)
  auth = new AuthService(prisma)
  adminId = (await auth.register(`tca-admin-${STAMP}@test.local`, 'Admin#12345', 'المالية')).userId
  await auth.setRoles(adminId, ['academic_manager'])
}, 240_000)

describe('① الوجهُ يُحفظ كما اختار', () => {
  it('⚠️ كودٌ بمبلغ: في صفّه وفي كوبونه، بلا نسبة', async () => {
    const t = await trainer('face')
    await signed(t.profileId, CARRIES)
    const made = await codes.create(t.userId, { amountOff: 20, labelAr: 'متابعو القناة' })
    expect(made).toMatchObject({ percentOff: null, amountOff: 20 })
    const row = await prisma.trainerCode.findUniqueOrThrow({ where: { id: made.id }, include: { coupon: true } })
    expect(Number(row.amountOff), 'لم يُحفظ المبلغُ في صفّ الكود').toBe(20)
    expect(row.percentOff).toBeNull()
    expect(Number(row.coupon.amountOff), 'الكوبونُ يُقرأ بخلاف صفّه').toBe(20)
    expect(row.coupon.currency, 'مبلغٌ بلا عملة').toBe('USD')
  })

  it('⚠️ والقاعدةُ ترفض كودا بوجهين — `TrainerCode_one_face`', async () => {
    const t = await trainer('both')
    const coupon = await prisma.coupon.create({ data: { code: `BOTH-${STAMP}`, percentOff: 10, active: true } })
    await expect(
      prisma.trainerCode.create({ data: { profileId: t.profileId, couponId: coupon.id, percentOff: 10, amountOff: 20, labelAr: 'وجهان' } }),
      'قُبل كودٌ بنسبةٍ ومبلغٍ معا — فأيُّهما يُسعَّر؟',
    ).rejects.toThrow(/TrainerCode_one_face/)
  })

  it('وبلا وجهٍ يُردّ بجملة — قبل أن يبلغ القاعدة', async () => {
    const t = await trainer('none')
    await signed(t.profileId, CARRIES)
    await expect(codes.create(t.userId, { labelAr: 'لا شيء' })).rejects.toMatchObject({ code: 'bad_code' })
  })
})

describe('② و③ السقفُ في الطلب الحقيقيّ، والمعروضُ هو المقتطَع', () => {
  /* الحالةُ التي جاء بها القرار: مبلغٌ على دورةٍ رخيصةٍ يتخطّى سقفَ الثلاثين */
  it('⚠️ خمسون على دورةٍ بستّين تُقتطع ثمانيةَ عشر — وكما تعرضها «دعوتي»', async () => {
    const t = await trainer('cap')
    await signed(t.profileId, CARRIES)
    const cohortId = await cohortOf(t.profileId, 60)
    await new EarningsService(prisma).setRule(adminId, { profileId: t.profileId, type: 'per_seat', rate: 50 })
    const made = await codes.create(t.userId, { amountOff: 50, labelAr: 'فوق السقف' })

    const q = await commerce.quote(await learner(), [cohortId], made.code)
    expect(q.couponDiscount, `اقتُطع فوق ${MAX_TRAINER_CODE_PERCENT}٪ من السعر`).toBe(18)
    expect(q.couponDiscount, 'افترق ما تعرضه «دعوتي» عمّا يقتطعه الطلب')
      .toBe(codeValueFor({ percentOff: null, amountOff: 50 }, 60))
  })

  it('⚠️ وما دون السقف يُقتطع كما كُتب — وكما تعرضه', async () => {
    const t = await trainer('under')
    await signed(t.profileId, CARRIES)
    const cohortId = await cohortOf(t.profileId, 200)
    await new EarningsService(prisma).setRule(adminId, { profileId: t.profileId, type: 'per_seat', rate: 50 })
    const made = await codes.create(t.userId, { amountOff: 20, labelAr: 'دون السقف' })

    const q = await commerce.quote(await learner(), [cohortId], made.code)
    expect(q.couponDiscount).toBe(20)
    expect(q.couponDiscount).toBe(codeValueFor({ percentOff: null, amountOff: 20 }, 200))
  })

  it('و«دعوتي» تحمل دوراتِه بأسعارها وأجرِ مقعده فيها', async () => {
    const t = await trainer('table')
    await signed(t.profileId, CARRIES)
    const cohortId = await cohortOf(t.profileId, 120)
    await new EarningsService(prisma).setRule(adminId, { profileId: t.profileId, type: 'per_seat', rate: 15, referralRate: 25 })
    const { pricing } = await codes.listFor(t.userId)
    expect(pricing.find((c) => c.cohortId === cohortId), 'غابت دورتُه عن الجدول')
      .toMatchObject({ price: 120, currency: 'USD', seatFee: 15, referralSeatFee: 25 })
  })
})

describe('وتغيّرُ النصّ يُسأل عنه', () => {
  /* من وقّع على صيغة «النسبة وحدَها» لم يقبل السقفَ على المبلغ ولا الوجهَ الثاني */
  it('⚠️ من وقّع على الجيل الذي قبله يقبل الصيغةَ الجديدةَ قبل أوّل كود', async () => {
    const t = await trainer('prev')
    await signed(t.profileId, PERCENT_ONLY_BODY)
    expect((await codes.listFor(t.userId)).terms.accepted, 'قُبلت الصيغةُ الجديدةُ بتوقيعٍ على القديمة').toBe(false)
    await expect(codes.create(t.userId, { amountOff: 20, labelAr: 'قبل القبول' }))
      .rejects.toMatchObject({ code: 'terms_required' })
    await codes.acceptTerms(t.userId)
    await expect(codes.create(t.userId, { amountOff: 20, labelAr: 'بعد القبول' })).resolves.toMatchObject({ amountOff: 20 })
  })
})
