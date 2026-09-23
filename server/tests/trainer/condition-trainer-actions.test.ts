/* ما يفعله المدرّبُ بمهلته — والتجميدُ يقع فعلا.

   ── الفراغُ الذي فُتح له هذا الحارس ──

   عاملُ المهلة (#272) يقرأ `conditionPausedAt` ويحترمها — **ولا أحدَ
   يكتبها**: تُمحى في ثلاثة مواضعَ ولا تُكتب في موضعٍ واحد، ولا مسلكَ في
   المستودَع كلِّه يعلن اكتمالَ الموادّ. فالتجميدُ الذي بُني له كلُّ شيءٍ لا
   يقع، ومن رفع موادَّه في اليوم السادس وأخذت مراجعتُنا يومين يخرج من المهلة
   بلا ذنبٍ منه — وهي الشكوى الوحيدةُ التي تصمد في وجه عقدٍ كُتب للحماية.

   و`conditionExtendedAt` كذلك: بلا كاتبٍ البتّة. */

import { beforeAll, describe, expect, it } from 'vitest'
import type { PrismaClient } from '@prisma/client'
import { setupTestDb, testPrisma } from '../helpers/db'
import { TrainerReviewService } from '../../services/trainer-review.service'

let prisma: PrismaClient
let review: TrainerReviewService
let adminId = ''
let seq = 0

beforeAll(async () => {
  await setupTestDb()
  prisma = await testPrisma()
  review = new TrainerReviewService(prisma)
  /* ومعرِّفٌ حقيقيّ: `AuditEvent.actorId` عمودُ `@db.Uuid`، فنصٌّ حرٌّ يردّه
     PostgreSQL — ولا يظهر ذلك إلّا على قاعدةٍ حقيقيّة. */
  const admin = await prisma.user.create({
    data: {
      email: `cond-act-admin-${Date.now()}@test.local`, displayName: 'موظّفُ الاختبار',
      passwordHash: 'x', status: 'active',
    },
  })
  adminId = admin.id
}, 240_000)

const NOW = new Date('2026-10-06T10:00:00Z')

/** مدرّبٌ بحسابٍ وعقدٍ موقَّعٍ ومهلةٍ قائمة */
async function trainerInPhase(over: Record<string, unknown> = {}) {
  seq += 1
  const app = await prisma.trainerApplication.create({
    data: {
      reference: `TR-CA-${Date.now()}-${seq}`, fullName: `مدرّبُ المهلة ${seq}`,
      email: `condact-${seq}-${Date.now()}@test.local`,
      status: 'onboarding', motivation: 'اختبار', privacyConsentAt: new Date(),
    },
  })
  const user = await prisma.user.create({
    data: { email: app.email, displayName: app.fullName, passwordHash: 'x', status: 'active' },
  })
  const profile = await prisma.trainerProfile.create({
    data: { applicationId: app.id, userId: user.id },
  })
  const contract = await prisma.trainerContract.create({
    data: {
      profileId: profile.id, title: `عرضٌ مشروط ${seq}`, status: 'signed',
      signedAt: new Date('2026-09-29T10:00:00Z'),
      orientationAt: new Date('2026-10-01T19:00:00Z'),
      conditionDeadlineAt: new Date('2026-10-08T19:00:00Z'),
      gatesActivation: true,
      ...over,
    },
  })
  return { app, user, profile, contract }
}

const row = (id: string) => prisma.trainerContract.findUniqueOrThrow({ where: { id } })

describe('المدرّبُ يعلن اكتمالَ موادّه', () => {
  it('١) تتجمّد المهلةُ بإعلانه — وهو ما لم يكن يقع أصلا', async () => {
    const { user, contract } = await trainerInPhase()
    await review.declareMaterialsComplete(user.id, NOW)
    expect((await row(contract.id)).conditionPausedAt, 'أعلن ولم تتجمّد').toBeTruthy()
  })

  it('٢) ولا يُعلن مرّتين', async () => {
    const { user } = await trainerInPhase()
    await review.declareMaterialsComplete(user.id, NOW)
    await expect(review.declareMaterialsComplete(user.id, NOW))
      .rejects.toMatchObject({ code: 'already_declared' })
  })

  it('٣) ويُقبل إعلانُه ولو انقضت مهلتُه — فالقرارُ بعدُ لإنسانٍ ينظر', async () => {
    const { user, contract } = await trainerInPhase()
    await review.declareMaterialsComplete(user.id, new Date('2026-10-10T10:00:00Z'))
    expect((await row(contract.id)).conditionPausedAt).toBeTruthy()
  })

  it('٤) ولا يعلن أحدٌ عن موادّ غيره — الملفُّ من حسابه لا من جسم الطلب', async () => {
    const other = await prisma.user.create({
      data: {
        email: `stranger-${Date.now()}@test.local`, displayName: 'غريب',
        passwordHash: 'x', status: 'active',
      },
    })
    await expect(review.declareMaterialsComplete(other.id, NOW))
      .rejects.toMatchObject({ code: 'no_profile' })
  })
})

describe('التمديدُ يومين — مرّةً واحدة', () => {
  it('١) تُزاد المهلةُ ويُمحى خَتمُ التذكير', async () => {
    const { user, contract } = await trainerInPhase({ conditionRemindedAt: NOW })
    const before = (await row(contract.id)).conditionDeadlineAt!
    await review.requestConditionExtension(user.id, NOW)
    const after = await row(contract.id)
    expect(after.conditionDeadlineAt!.getTime()).toBeGreaterThan(before.getTime())
    expect(after.conditionExtendedAt, 'مُدّت ولم يُؤشَّر أنّها مُدّت').toBeTruthy()
    expect(after.conditionRemindedAt, 'بقي مذكَّرا بمهلةٍ لم تعد قائمة').toBeNull()
  })

  it('٢) والثانيةُ تُردّ بنصٍّ يُقرأ لا بصمت', async () => {
    const { user } = await trainerInPhase()
    await review.requestConditionExtension(user.id, NOW)
    await expect(review.requestConditionExtension(user.id, NOW))
      .rejects.toMatchObject({ code: 'cannot_extend' })
  })
})

describe('الإعادةُ بملاحظات', () => {
  it('١) تُستأنف المهلةُ مضافا إليها مدّةُ التجميد بالضبط', async () => {
    const { user, contract } = await trainerInPhase()
    const due = (await row(contract.id)).conditionDeadlineAt!
    const paused = new Date('2026-10-06T10:00:00Z')
    const resumed = new Date('2026-10-08T10:00:00Z')
    await review.declareMaterialsComplete(user.id, paused)
    await review.returnMaterialsWithNotes(contract.id, adminId, 'ينقص محورُ التقويم في الوحدة الثالثة', resumed)

    const after = await row(contract.id)
    expect(after.conditionPausedAt, 'بقيت مجمّدةً بعد الإعادة').toBeNull()
    expect(
      after.conditionDeadlineAt!.getTime() - due.getTime(),
      'لم تُزَد المهلةُ بمقدار التجميد بالضبط — فإمّا حُسب علينا وقتُنا أو أُهدي له',
    ).toBe(resumed.getTime() - paused.getTime())
  })

  it('٢) ولا تُعاد موادُّ ليست عندنا', async () => {
    const { contract } = await trainerInPhase()
    await expect(review.returnMaterialsWithNotes(contract.id, adminId, 'ملاحظةٌ كافية'))
      .rejects.toMatchObject({ code: 'not_paused' })
  })

  it('٣) ولا تُعاد بلا ملاحظاتٍ — فالحلقةُ تدور بما يقرؤه هو', async () => {
    const { user, contract } = await trainerInPhase()
    await review.declareMaterialsComplete(user.id, NOW)
    await expect(review.returnMaterialsWithNotes(contract.id, adminId, '   '))
      .rejects.toMatchObject({ code: 'no_notes' })
  })

  it('٤) وتصله الملاحظاتُ إشعارا — وإلّا فلا معنى لكتابتها', async () => {
    const { user, profile, contract } = await trainerInPhase()
    await review.declareMaterialsComplete(user.id, NOW)
    await review.returnMaterialsWithNotes(contract.id, adminId, 'ينقص محورُ التقويم', new Date('2026-10-07T10:00:00Z'))
    const note = await prisma.notification.findFirst({
      where: { userId: profile.userId!, templateKey: 'trainer.contract.materials_returned' },
    })
    expect(note, 'كُتبت الملاحظاتُ في عمودٍ لا يراه — فتقف الحلقةُ عند أوّل دورة').toBeTruthy()
  })
})
