/* آخرُ نشاطٍ للجلسة — ومنه «آخرُ نشاطٍ» للمدرّب في «المدربون» (٢٤ أكتوبر ٢٠٢٦).

   «أعطني مؤشّرا لمتى آخرُ دخولٍ لكلّ مدرّبٍ لمنصّته، لأعلمَ من منهم فعّالٌ ومنهم اختفى» (صاحب المنصّة).
   والجلسةُ تبقى ثلاثين يوما، فيُحرس:
   ١) أنّ الدخولَ يكتب النشاط، وأنّ الطلبَ يجدّده إن مضت خمسُ دقائق — ولا يكتب في كلّ طلب؛
   ٢) وأنّ «المدربون» تقرأ أحدثَ جلساته، ومن لا حسابَ له `null`؛
   ٣) وأنّ «آخرَ نشاطٍ» أحدثُ أثرٍ تركه لا جلستُه وحدَها — «تواصلوا معنا من المنصّة وتقول إنّهم لم يفتحوا
      منذ مدّة» (صاحب المنصّة): فعلٌ في الأثر، وحسابُ تقديمه، ونموذجُ التواصل ببريده. */

import { beforeAll, describe, expect, it } from 'vitest'
import type { PrismaClient } from '@prisma/client'
import { setupTestDb, testPrisma } from '../helpers/db'
import { AuthService } from '../../services/auth.service'
import { TrainerReviewService } from '../../services/trainer-review.service'

let prisma: PrismaClient
let auth: AuthService
const ACTOR = '00000000-0000-0000-0000-000000000009'

beforeAll(async () => {
  await setupTestDb()
  prisma = await testPrisma()
  auth = new AuthService(prisma)
}, 240_000)

const sessionOf = (userId: string) => prisma.session.findFirstOrThrow({ where: { userId }, orderBy: { createdAt: 'desc' } })

describe('① نشاط الجلسة', () => {
  it('⚠️ الدخول يكتبه، والطلب بعد خمس دقائق يجدده — وقبلها لا يكتب', async () => {
    const { userId } = await auth.register('last.seen@test.local', 'Pass#12345678', 'نشيط')
    const { token } = await auth.login('last.seen@test.local', 'Pass#12345678')
    const first = await sessionOf(userId)
    expect(first.lastSeenAt, 'الدخول لا يكتب النشاط').not.toBeNull()

    /* طلبٌ بعد لحظة لا يكتب */
    await auth.resolve(token)
    expect((await sessionOf(userId)).lastSeenAt!.getTime()).toBe(first.lastSeenAt!.getTime())

    /* ونشاطٌ قديمٌ يجدّده الطلب */
    const old = new Date(Date.now() - 6 * 60_000)
    await prisma.session.update({ where: { id: first.id }, data: { lastSeenAt: old } })
    await auth.resolve(token)
    expect((await sessionOf(userId)).lastSeenAt!.getTime()).toBeGreaterThan(old.getTime())
  })
})

describe('② «المدربون» تقرأ آخر نشاطه', () => {
  it('⚠️ أحدث جلساته — ومن بلا جلسة null', async () => {
    const review = new TrainerReviewService(prisma)
    const seen = await review.createTrainerDirectly(ACTOR, { fullName: 'مدرب نشيط', email: 'seen.trainer@test.local' })
    const quiet = await review.createTrainerDirectly(ACTOR, { fullName: 'مدرب لم يدخل', email: 'quiet.trainer@test.local' })
    const userId = (await prisma.trainerProfile.findUniqueOrThrow({ where: { id: seen.profileId } })).userId!
    const at = new Date(Date.now() - 3 * 86_400_000)
    await prisma.session.create({ data: { userId, tokenHash: 'h-old', expiresAt: new Date(Date.now() + 86_400_000), createdAt: new Date(Date.now() - 20 * 86_400_000), lastSeenAt: at } })
    await prisma.session.create({ data: { userId, tokenHash: 'h-older', expiresAt: new Date(Date.now() + 86_400_000), createdAt: new Date(Date.now() - 25 * 86_400_000), lastSeenAt: null } })

    const rows = await review.listForOps()
    expect(rows.find((r) => r.profileId === seen.profileId)!.lastSeenAt!.getTime()).toBe(at.getTime())
    expect(rows.find((r) => r.profileId === quiet.profileId)!.lastSeenAt).toBeNull()
  })
})

describe('③ آخر نشاط أحدث أثر تركه — لا جلسته وحدها', () => {
  const review = () => new TrainerReviewService(prisma)
  const row = async (profileId: string) => (await review().listForOps()).find((r) => r.profileId === profileId)!
  const day = 86_400_000

  it('⚠️ فعل في الأثر يغلب دخولا قديما', async () => {
    const t = await review().createTrainerDirectly(ACTOR, { fullName: 'مدرب يعمل', email: 'acts.trainer@test.local' })
    const userId = (await prisma.trainerProfile.findUniqueOrThrow({ where: { id: t.profileId } })).userId!
    await prisma.session.create({ data: { userId, tokenHash: 'h-acts', expiresAt: new Date(Date.now() + day), createdAt: new Date(Date.now() - 25 * day), lastSeenAt: new Date(Date.now() - 25 * day) } })
    const acted = new Date(Date.now() - 2 * day)
    await prisma.auditEvent.create({ data: { actorId: userId, action: 'cohort.plan.save', entityType: 'cohort', entityId: 'x', createdAt: acted } })
    expect((await row(t.profileId)).lastSeenAt!.getTime()).toBe(acted.getTime())
  })

  it('⚠️ ومن حساب تقديمه — ومن نموذج التواصل ببريده', async () => {
    const t = await review().createTrainerDirectly(ACTOR, { fullName: 'مدرب يكتب من حساب آخر', email: 'Other.Account@test.local' })
    const profile = await prisma.trainerProfile.findUniqueOrThrow({ where: { id: t.profileId }, select: { applicationId: true } })
    const applicant = await auth.register('applicant.account@test.local', 'Pass#12345678', 'حساب التقديم')
    await prisma.trainerApplication.update({ where: { id: profile.applicationId }, data: { userId: applicant.userId } })
    const wrote = new Date(Date.now() - 4 * day)
    await prisma.supportTicket.create({ data: { userId: applicant.userId, subject: 'سؤال', createdAt: wrote } as never })
    expect((await row(t.profileId)).lastSeenAt!.getTime()).toBeGreaterThanOrEqual(wrote.getTime())

    const contacted = new Date(Date.now() + 1000)
    await prisma.contactMessage.create({ data: { reference: 'C-LAST-1', name: 'م', email: 'other.account@TEST.local', topic: 't', message: 'm', createdAt: contacted } })
    expect((await row(t.profileId)).lastSeenAt!.getTime()).toBe(contacted.getTime())
  })
})
