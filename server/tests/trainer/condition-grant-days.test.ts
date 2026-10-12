/* «امنحه أيّاما» — المهلةُ بيد الإدارة أيضا (١٢ أكتوبر ٢٠٢٦، `grantConditionDays`).

   سأل صاحبُ المنصّة: «إن لم يُسلِّم المدرّبُ موادَّه في وقتها وانتهى تمديدا اليومين،
   فماذا يقع؟ وكيف أمنح استثناء؟» — واختار زرّا للإدارة.

   ① من اليوم إن انقضت، ومن أجلها إن كانت قائمة — ولا تمسّ مرّتَي تمديده.
   ② والسببُ يُكتب في الأثر باسم من منح.
   ③ والمجمّدةُ والمعتمَدةُ لا تُمنَحان، ولا عددٌ خارجَ الحدّ، ولا منحةٌ بلا سبب.
   ④ وانقضاءُ الأيّام الممنوحة يُبلَّغ ثانيةً — مرّةً لكلّ أجل. */

import { beforeAll, describe, expect, it } from 'vitest'
import type { PrismaClient } from '@prisma/client'
import { setupTestDb, testPrisma } from '../helpers/db'
import { TrainerReviewService } from '../../services/trainer-review.service'
import { MAX_GRANT_DAYS } from '../../../src/application/trainer/conditional-offer'

let prisma: PrismaClient
let review: TrainerReviewService
let adminId = ''
let seq = 0
const DAY = 86_400_000

beforeAll(async () => {
  await setupTestDb()
  prisma = await testPrisma()
  review = new TrainerReviewService(prisma)
  const admin = await prisma.user.create({
    data: {
      email: `grant-days-admin-${Date.now()}@test.local`, displayName: 'موظّفُ المنح',
      passwordHash: 'x', status: 'active',
    },
  })
  adminId = admin.id
}, 240_000)

const NOW = new Date('2026-10-12T10:00:00Z')
const REASON = 'طلب أيّاما لظرفٍ عائليّ، وأرسل شعبتين من ثلاث'

/** مدرّبٌ في الطور — أجلُه بعد `dueInDays` من `NOW` (سالبٌ: انقضى) */
async function trainerWithDeadline(dueInDays: number, over: Record<string, unknown> = {}) {
  seq += 1
  const app = await prisma.trainerApplication.create({
    data: {
      reference: `TR-GD-${Date.now()}-${seq}`, fullName: `مدرّبُ المنحة ${seq}`,
      email: `grantdays-${seq}-${Date.now()}@test.local`,
      status: 'onboarding', motivation: 'اختبار', privacyConsentAt: new Date(),
    },
  })
  const user = await prisma.user.create({
    data: { email: app.email, displayName: app.fullName, passwordHash: 'x', status: 'active' },
  })
  const profile = await prisma.trainerProfile.create({ data: { applicationId: app.id, userId: user.id } })
  const contract = await prisma.trainerContract.create({
    data: {
      profileId: profile.id, title: `اتفاقيّةٌ مشروطة ${seq}`, status: 'signature_approved',
      signedAt: new Date('2026-10-01T10:00:00Z'),
      conditionDeadlineAt: new Date(NOW.getTime() + dueInDays * DAY),
      conditionExtensionsUsed: 2,
      gatesActivation: true,
      ...over,
    },
  })
  return { app, user, profile, contract }
}

const row = (id: string) => prisma.trainerContract.findUniqueOrThrow({ where: { id } })
const noticesFor = (id: string) => prisma.auditEvent.count({
  where: { action: 'trainer.condition.lapsed', entityType: 'trainer_contract', entityId: id },
})

describe('① من اليوم إن انقضت، ومن أجلها إن كانت قائمة', () => {
  it('⚠️ انقضت قبل خمسة أيّام فمُنح ثلاثة — أمامه ثلاثةٌ من اليوم، ومرّتاه كما هما', async () => {
    const { contract } = await trainerWithDeadline(-5, { conditionRemindedAt: new Date('2026-10-05T10:00:00Z') })
    const { deadlineAt } = await review.grantConditionDays(contract.id, adminId, { days: 3, reasonAr: REASON }, NOW)
    const after = await row(contract.id)
    expect(after.conditionDeadlineAt!.getTime(), 'لم يُحسب من اليوم').toBe(NOW.getTime() + 3 * DAY)
    expect(deadlineAt.getTime()).toBe(after.conditionDeadlineAt!.getTime())
    expect(after.conditionExtensionsUsed, 'مسّت المنحةُ مرّتَي تمديده').toBe(2)
    expect(after.conditionRemindedAt, 'بقي مذكَّرا بأجلٍ لم يعد قائما').toBeNull()
  })

  it('⚠️ وقائمةٌ بعد يوم فمُنح يومين — من أجلها لا من اليوم', async () => {
    const { contract } = await trainerWithDeadline(1, { conditionExtensionsUsed: 0 })
    await review.grantConditionDays(contract.id, adminId, { days: 2, reasonAr: REASON }, NOW)
    const after = await row(contract.id)
    expect(after.conditionDeadlineAt!.getTime(), 'قُصّر أجلُه بمنحة').toBe(NOW.getTime() + 3 * DAY)
    expect(after.conditionExtensionsUsed).toBe(0)
  })

  it('ومنحةٌ أجلُها داخلَ يومَي التذكير لا يتبعها تذكيرٌ في الساعة التالية — فبريدُها حمل الموعد', async () => {
    const { contract } = await trainerWithDeadline(-2)
    await review.grantConditionDays(contract.id, adminId, { days: 1, reasonAr: REASON }, NOW)
    expect((await row(contract.id)).conditionRemindedAt?.getTime()).toBe(NOW.getTime())
  })
})

describe('② والسببُ في الأثر باسم من منح', () => {
  it('⚠️ يُكتب الفعلُ بمعتمِده وعدده وسببه — والأجلان قبله وبعده', async () => {
    const { contract } = await trainerWithDeadline(-1)
    await review.grantConditionDays(contract.id, adminId, { days: 4, reasonAr: `  ${REASON}  ` }, NOW)
    const audit = await prisma.auditEvent.findFirstOrThrow({
      where: { action: 'trainer.contract.condition_days_granted', entityId: contract.id },
    })
    expect(audit.actorId).toBe(adminId)
    expect(audit.meta).toMatchObject({
      days: 4, reasonAr: REASON, wasLapsed: true,
      from: new Date(NOW.getTime() - DAY).toISOString(),
      until: new Date(NOW.getTime() + 4 * DAY).toISOString(),
    })
  })
})

describe('③ ما لا يُمنَح — بنصٍّ يُقرأ', () => {
  it('⚠️ المجمّدةُ: موادُّه عندنا — فالمخرجُ إعادتُها بملاحظات', async () => {
    const { contract } = await trainerWithDeadline(1, { conditionPausedAt: NOW })
    await expect(review.grantConditionDays(contract.id, adminId, { days: 2, reasonAr: REASON }, NOW))
      .rejects.toMatchObject({ code: 'cannot_grant', message: expect.stringMatching(/أعدها بملاحظات/) })
  })

  it('⚠️ والمعتمَدةُ موادُّه، والاتفاقيّةُ غيرُ المشروطة', async () => {
    const met = await trainerWithDeadline(-1, { conditionMetAt: NOW })
    await expect(review.grantConditionDays(met.contract.id, adminId, { days: 2, reasonAr: REASON }, NOW))
      .rejects.toMatchObject({ code: 'cannot_grant' })
    const plain = await trainerWithDeadline(-1, { gatesActivation: false })
    await expect(review.grantConditionDays(plain.contract.id, adminId, { days: 2, reasonAr: REASON }, NOW))
      .rejects.toMatchObject({ code: 'cannot_grant' })
  })

  it('⚠️ ولا عددٌ خارجَ الحدّ، ولا منحةٌ بلا سبب — ولا يُكتب شيء', async () => {
    const { contract } = await trainerWithDeadline(-1)
    for (const days of [0, MAX_GRANT_DAYS + 1, 1.5]) {
      await expect(review.grantConditionDays(contract.id, adminId, { days, reasonAr: REASON }, NOW),
        `قُبل ${days}`).rejects.toMatchObject({ code: 'cannot_grant' })
    }
    await expect(review.grantConditionDays(contract.id, adminId, { days: 2, reasonAr: '  قصير  ' }, NOW))
      .rejects.toMatchObject({ code: 'cannot_grant' })
    expect((await row(contract.id)).conditionDeadlineAt!.getTime()).toBe(NOW.getTime() - DAY)
  })
})

describe('④ وانقضاءُ الأيّام الممنوحة يُبلَّغ — مرّةً لكلّ أجل', () => {
  it('⚠️ أُبلغ بالأوّل، ومُنح، فانقضى الثاني فأُبلغ ثانيةً — ولا ثالثة', async () => {
    const { contract } = await trainerWithDeadline(-1)
    await review.noticeLapsedConditions(NOW)
    await review.noticeLapsedConditions(NOW)
    expect(await noticesFor(contract.id), 'أُبلغ بالأجل الأوّل مرّتين').toBe(1)

    await review.grantConditionDays(contract.id, adminId, { days: 2, reasonAr: REASON }, NOW)
    await review.noticeLapsedConditions(new Date(NOW.getTime() + DAY))
    expect(await noticesFor(contract.id), 'أُبلغ وأجلُه الممنوحُ قائم').toBe(1)

    const later = new Date(NOW.getTime() + 3 * DAY)
    await review.noticeLapsedConditions(later)
    expect(await noticesFor(contract.id), 'انقضت الأيّامُ الممنوحةُ ولم يُبلَّغ').toBe(2)
    await review.noticeLapsedConditions(later)
    expect(await noticesFor(contract.id), 'أُبلغ بالأجل الثاني مرّتين').toBe(2)
  })
})
