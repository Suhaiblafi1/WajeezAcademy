/* بابُ كود المدرّب — القبولُ والإصدارُ والإيقافُ والإلغاء (٤ب).

   قرارُ صاحب المنصّة (٢٧ سبتمبر ٢٠٢٦): «اصدار كود وليس خصم مباشر، والخصم يكون
   نسبة وليس رقما» — سقفُه ٣٠٪ على دوراته وحدَها. ودفترُ الاستعمال والحسم في
   `server/tests/commerce/trainer-code-ledger.test.ts`؛ وهنا البابُ نفسُه:

   ① **لا كودَ بلا سندٍ في عقده**: من وقّع قبل الجيل الثالث عشر يقبل البندَ 4-10
      بصيغته الجديدة مرّةً واحدة، ومن وقّع عليه لا يُسأل. والقبولُ يُحفظ بإصداره
      ونصِّه في الأثر.
   ② **والإصدارُ بحاجز القواعد**: نسبةٌ صحيحةٌ حتّى السقف، ولمن يُنشَر.
   ③ **والإيقافُ والإلغاءُ يُطفئان الكوبونَ في المعاملة نفسِها** — كودٌ «موقوفٌ»
      وكوبونٌ يعمل رمزٌ ما زال يخصم من مستحقّاته.
   ④ **وما أصدره غيرُه لا يمسّه**. */

import { beforeAll, describe, expect, it } from 'vitest'
import type { PrismaClient } from '@prisma/client'
import { setupTestDb, testPrisma } from '../helpers/db'
import { AuthService } from '../../services/auth.service'
import { CommerceService } from '../../services/commerce.service'
import { TrainerCodeService } from '../../services/trainer-code.service'
import { EarningsService } from '../../services/earnings.service'
import { CODE_TERMS_FIRST_BODY, CODE_TERMS_VERSION } from '../../../src/application/trainer/trainer-code'
import { CLAUSE_4_10_AR } from '../../../src/application/trainer/contract-body'

let prisma: PrismaClient
let codes: TrainerCodeService
let commerce: CommerceService
let auth: AuthService
let adminId = ''
const STAMP = Date.now()

async function trainer(tag: string) {
  const user = await prisma.user.create({ data: { email: `tcs-${tag}-${STAMP}@wajeez.test`, displayName: `مدرّب ${tag}`, passwordHash: 'x' } })
  const application = await prisma.trainerApplication.create({
    data: { reference: `WJ-TR-TCS-${tag}-${STAMP}`, fullName: `مدرّب ${tag}`, email: user.email, status: 'active' },
  })
  const profile = await prisma.trainerProfile.create({ data: { userId: user.id, applicationId: application.id } })
  return { userId: user.id, profileId: profile.id }
}

/* ═══ والجيلُ الذي يحمل البندَ بصيغته الحاليّة — من الثابت لا رقما مكتوبا ═══
   كان `'v13-…'` حرفا، فلمّا تغيّرت الصيغةُ في الجيل الحادي والعشرين (الكودُ
   نسبةٌ أو مبلغ) صار «من وقّع على الجيل الذي حمله» يعني جيلا آخر. والثابتُ
   يتبع الصيغةَ حيث انتقلت، فيبقى الفحصُ يقيس ما سمّاه. */
const CARRIES = `v${CODE_TERMS_FIRST_BODY}-2026-10-01`

const signed = (profileId: string, bodyVersion: string) =>
  prisma.trainerContract.create({ data: { profileId, title: 'اتفاقيّةُ تقديم خدمات', status: 'signed', bodyVersion, signedAt: new Date() } })

beforeAll(async () => {
  await setupTestDb()
  prisma = await testPrisma()
  codes = new TrainerCodeService(prisma)
  commerce = new CommerceService(prisma)
  auth = new AuthService(prisma)
  adminId = (await auth.register(`tcs-admin-${STAMP}@test.local`, 'Admin#12345', 'المالية')).userId
  await auth.setRoles(adminId, ['academic_manager'])
}, 240_000)

describe('① لا كودَ بلا سندٍ في عقده', () => {
  it('⚠️ من وقّع على المبلغ لا يُصدر حتّى يقبل الصيغةَ الجديدة — بنصّها كما في العقد', async () => {
    const t = await trainer('old')
    await signed(t.profileId, 'v12-2026-09-27')

    const before = await codes.listFor(t.userId)
    expect(before.terms.accepted, 'عقدُ الجيل الثاني عشر يحمل الصيغةَ الجديدة؟').toBe(false)
    expect(before.terms.clauseAr, 'المعروضُ للقبول غيرُ المطبوع في العقد').toBe(CLAUSE_4_10_AR)
    await expect(codes.create(t.userId, { percentOff: 20, labelAr: 'متابعو القناة' }), 'أُصدر كودٌ بلا قبول')
      .rejects.toMatchObject({ code: 'terms_required' })

    const accepted = await codes.acceptTerms(t.userId, '203.0.113.7')
    expect(accepted.accepted).toBe(true)
    expect(accepted.via).toBe('consent')
    const consent = await prisma.consentRecord.findMany({ where: { userId: t.userId, kind: 'terms' } })
    expect(consent, 'لم يُحفظ القبول').toHaveLength(1)
    expect(consent[0].textVersion).toBe(CODE_TERMS_VERSION)
    const audit = await prisma.auditEvent.findFirst({ where: { action: 'trainer_code.terms_accept', entityId: t.profileId } })
    expect((audit?.meta as { clauseAr?: string } | null)?.clauseAr, 'الأثرُ لا يحفظ النصَّ الذي قُبل').toBe(CLAUSE_4_10_AR)

    /* ومرّةً واحدة: القبولُ الثاني لا يُنشئ صفّا ثانيا */
    await codes.acceptTerms(t.userId)
    expect(await prisma.consentRecord.count({ where: { userId: t.userId, kind: 'terms' } })).toBe(1)

    const made = await codes.create(t.userId, { percentOff: 20, labelAr: 'متابعو القناة' })
    expect(made.code).toMatch(/^WD-/)
  })

  it('⚠️ ومن وقّع على الجيل الذي حمله لا يُسأل ثانيةً', async () => {
    const t = await trainer('new')
    await signed(t.profileId, CARRIES)
    const { terms } = await codes.listFor(t.userId)
    expect(terms.accepted).toBe(true)
    expect(terms.via).toBe('contract')
    await expect(codes.create(t.userId, { percentOff: 10, labelAr: 'زملاءُ العمل' })).resolves.toMatchObject({ percentOff: 10 })
  })

  it('وقبولُ إصدارٍ سابقٍ لنصٍّ تغيّر لا يُحتسب', async () => {
    const t = await trainer('stale')
    await prisma.consentRecord.create({ data: { userId: t.userId, kind: 'terms', textVersion: 'code-4-10-v0-2026-01-01' } })
    expect((await codes.listFor(t.userId)).terms.accepted, 'قبولٌ على نصٍّ قديمٍ فتح البابَ على الجديد').toBe(false)
  })
})

describe('② الإصدارُ بحاجز القواعد', () => {
  it('⚠️ فوق السقف، وبلا من يُنشَر له، وبتاريخٍ مضى — يُردّ بجملة', async () => {
    const t = await trainer('guard')
    await signed(t.profileId, CARRIES)
    await expect(codes.create(t.userId, { percentOff: 31, labelAr: 'فوق السقف' })).rejects.toMatchObject({ code: 'bad_code' })
    await expect(codes.create(t.userId, { percentOff: 10, labelAr: ' ' })).rejects.toMatchObject({ code: 'bad_code' })
    await expect(codes.create(t.userId, { percentOff: 10, labelAr: 'أمس', expiresAt: new Date(Date.now() - 86_400_000) }))
      .rejects.toMatchObject({ code: 'bad_code' })
  })

  it('⚠️ والكودُ كوبونٌ بنسبته وحدّه — وصفُّه يقول من يتحمّله', async () => {
    const t = await trainer('made')
    await signed(t.profileId, CARRIES)
    const made = await codes.create(t.userId, { percentOff: 25, labelAr: 'متابعو إنستغرام', maxUses: 40 })
    const row = await prisma.trainerCode.findUniqueOrThrow({ where: { id: made.id }, include: { coupon: true } })
    expect(row.profileId).toBe(t.profileId)
    expect(row.percentOff).toBe(25)
    expect(row.coupon.percentOff).toBe(25)
    expect(row.coupon.maxUses).toBe(40)
    expect(row.coupon.amountOff, 'كودُ النسبة يحمل مبلغا').toBeNull()
    expect(await prisma.auditEvent.findFirst({ where: { action: 'trainer_code.create', entityId: t.profileId } })).not.toBeNull()
  })
})

describe('③ الإيقافُ والإلغاءُ يُطفئان الكوبون', () => {
  it('⚠️ موقوفٌ لا يخصم، ومستأنَفٌ يعود، وملغىً لا يعود', async () => {
    const t = await trainer('life')
    await signed(t.profileId, CARRIES)
    const made = await codes.create(t.userId, { percentOff: 15, labelAr: 'نشرةُ البريد' })
    const couponActive = async () =>
      (await prisma.trainerCode.findUniqueOrThrow({ where: { id: made.id }, include: { coupon: true } })).coupon.active

    await codes.pause(t.userId, made.id)
    expect(await couponActive(), 'كودٌ موقوفٌ وكوبونُه يعمل').toBe(false)
    const learner = (await auth.register(`tcs-l-${STAMP}@test.local`, 'Learner#12345', 'متعلّم')).userId
    const course = await prisma.course.findFirstOrThrow({ select: { id: true } })
    const cohort = await prisma.cohort.create({
      data: { courseId: course.id, title: 'شعبةُ الكود', status: 'open', registrationOpen: true, financialReady: true, price: 100, currency: 'USD', capacity: 10 },
    })
    await prisma.cohortTrainer.create({ data: { cohortId: cohort.id, profileId: t.profileId, role: 'lead', assignedBy: adminId } })
    /* وله أجرٌ يقع عليه الكود: الكودُ يُسقَف بما له عندنا (٢٨ سبتمبر ٢٠٢٦)، ومن لا
       قاعدةَ أتعابٍ له لا رصيدَ له — فيُردّ كودُه بعلّةٍ غير التي يقيسها هذا */
    await new EarningsService(prisma).setRule(adminId, { profileId: t.profileId, type: 'per_seat', rate: 50 })
    await expect(commerce.quote(learner, [cohort.id], made.code), 'خصم كودٌ موقوف').rejects.toMatchObject({ code: 'bad_coupon' })

    await codes.resume(t.userId, made.id)
    expect(await couponActive()).toBe(true)
    expect((await commerce.quote(learner, [cohort.id], made.code)).couponDiscount).toBe(15)

    await codes.revoke(t.userId, made.id)
    expect(await couponActive()).toBe(false)
    await expect(codes.resume(t.userId, made.id), 'عاد كودٌ ملغى').rejects.toMatchObject({ code: 'bad_state' })
    await expect(codes.pause(t.userId, made.id)).rejects.toMatchObject({ code: 'bad_state' })
    const listed = (await codes.listFor(t.userId)).codes.find((c) => c.id === made.id)!
    expect(listed.state).toBe('revoked')
  })
})

describe('④ وما أصدره غيرُه لا يمسّه', () => {
  it('⚠️ لا يُوقف كودَ مدرّبٍ آخر ولا يراه', async () => {
    const owner = await trainer('owner')
    const other = await trainer('other')
    await signed(owner.profileId, CARRIES)
    await signed(other.profileId, CARRIES)
    const made = await codes.create(owner.userId, { percentOff: 5, labelAr: 'جمهوري' })
    await expect(codes.pause(other.userId, made.id)).rejects.toMatchObject({ code: 'not_found' })
    await expect(codes.revoke(other.userId, made.id)).rejects.toMatchObject({ code: 'not_found' })
    expect((await codes.listFor(other.userId)).codes.some((c) => c.id === made.id), 'رأى كودَ غيره').toBe(false)
  })
})
