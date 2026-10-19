/* بريدُ المتعلّم مع جرسه — «المالُ وتغيّرُ الشعبة» وحدَهما (١٩ أكتوبر ٢٠٢٦).

   قرارُ صاحب المنصّة أنّ ما يضرّ فواتُه يصل بريدا أيضا، وما سواه يبقى جرسا. والقائمةُ في
   `learner-email.ts`، و`NotificationService.notify` يكتب منها صفَّ البريد. فيُحرس هنا:

   ١) مفتاحٌ في القائمة يكتب صفّين — جرسا وبريدا — بالعنوان نفسِه.
   ٢) وما ليس فيها، أو ليس لمتعلّم، يبقى جرسا وحدَه: البريدُ لا يتّسع بالسهو. وما كتمه صاحبُه
      في الجرس لا يخرج بريدا — فالرسالةُ تعده بأنّه يوقفها من شاشة التفضيلات.
   ٣) والحجزُ في صفحة الدفع لا بريدَ معه — صاحبُه حاضر — وحجزُ الفريق وهو غائبٌ يصله بريدا.
   ٤) والشعبةُ الملغاةُ تُقال لمن فيها جرسا وبريدا — وكانت تُلغى صامتة. */

import { beforeAll, describe, expect, it } from 'vitest'
import type { PrismaClient } from '@prisma/client'
import { setupTestDb, testPrisma } from '../helpers/db'
import { AuthService } from '../../services/auth.service'
import { NotificationService } from '../../services/notification.service'
import { CommerceService } from '../../services/commerce.service'
import { CohortService } from '../../services/cohort.service'
import { EnrollmentService } from '../../services/enrollment.service'
import { approvedTrainerPlan } from '../helpers/approved-trainer'

let prisma: PrismaClient
let auth: AuthService
let notifications: NotificationService
let adminId = ''

const learner = async (tag: string) => {
  const u = await auth.register(`le-${tag}@test.local`, 'Learn#12345', `متعلّم ${tag}`)
  await auth.setRoles(u.userId, ['learner'])
  return u.userId
}

const openCohort = async (title: string) => (await prisma.cohort.create({
  data: {
    plans: { create: await approvedTrainerPlan(prisma) },
    courseId: 'C-BIZ-101', title, status: 'open', registrationOpen: true,
    financialReady: true, price: 100, currency: 'USD', capacity: 20,
    startsAt: new Date(Date.now() + 30 * 86_400_000),
  },
})).id

const channelsOf = async (userId: string, templateKey: string) =>
  (await prisma.notification.findMany({ where: { userId, templateKey }, select: { channel: true } }))
    .map((r) => r.channel).sort()

beforeAll(async () => {
  await setupTestDb()
  prisma = await testPrisma()
  auth = new AuthService(prisma)
  notifications = new NotificationService(prisma)
  const admin = await auth.register('le-admin@test.local', 'Admin#12345', 'مدير')
  await auth.setRoles(admin.userId, ['super_admin'])
  adminId = admin.userId
}, 240_000)

describe('القائمةُ تكتب صفَّ البريد — وما خارجها لا', () => {
  it('إيصالُ الدفع: جرسٌ وبريدٌ بالعنوان نفسِه', async () => {
    const userId = await learner('receipt')
    await notifications.notify({ userId, channel: 'in_app', templateKey: 'payment.succeeded', title: 'تأكد دفعك', body: 'استلمنا دفعتك' })
    const rows = await prisma.notification.findMany({ where: { userId }, orderBy: { channel: 'asc' } })
    expect(rows.map((r) => r.channel)).toEqual(['email', 'in_app'])
    expect(rows.every((r) => r.title === 'تأكد دفعك' && r.audience === 'learner')).toBe(true)
  })

  it('وقبولُ التسجيل — ليس مالا ولا تغيّرا — جرسٌ وحدَه', async () => {
    const userId = await learner('confirmed')
    await notifications.notify({ userId, channel: 'in_app', templateKey: 'enrollment.confirmed', title: 'سجّلت', body: 'أهلا' })
    expect(await channelsOf(userId, 'enrollment.confirmed')).toEqual(['in_app'])
  })

  it('وما كتمه في الجرس لا يخرج بريدا — فـ«ولك أن توقفها» في الرسالة صادقة', async () => {
    const userId = await learner('muted')
    await prisma.notificationPreference.create({ data: { userId, category: 'sessions', channel: 'in_app', enabled: false } })
    await notifications.notify({ userId, channel: 'in_app', templateKey: 'cohort.schedule_changed', title: 'تغيّر موعد', body: 'نصّ' })
    expect(await channelsOf(userId, 'cohort.schedule_changed')).toEqual([])
  })

  it('ومفتاحُ القائمة لغير المتعلّم لا يُبرَد', async () => {
    const userId = await learner('trainer-aud')
    await notifications.notify({ userId, channel: 'in_app', audience: 'trainer', templateKey: 'payment.succeeded', title: 'خبر', body: 'نصّ' })
    expect(await channelsOf(userId, 'payment.succeeded')).toEqual(['in_app'])
  })
})

describe('الحجزُ: حاضرٌ لا يُبرَد، وغائبٌ يُبرَد', () => {
  it('الحجزُ في صفحة الدفع جرسٌ وحدَه', async () => {
    const cohortId = await openCohort('شعبةُ الدفع الحاضر')
    const userId = await learner('checkout')
    await new CommerceService(prisma).checkout(userId, [cohortId])
    expect(await channelsOf(userId, 'order.seats_held')).toEqual(['in_app'])
  })

  it('وحجزُ الفريق بمزوّدٍ لا يُسوّي وحدَه يصله بريدا', async () => {
    await prisma.integrationSetting.upsert({
      where: { provider: 'payment' },
      update: { enabled: true, config: { driver: 'manual' } },
      create: { provider: 'payment', enabled: true, config: { driver: 'manual' } },
    })
    try {
      const commerce = new CommerceService(prisma)
      const cohortId = await openCohort('شعبةُ حجز الفريق')
      const userId = await learner('staff-held')
      const req = await commerce.requestEnrollment(userId, cohortId)
      await commerce.approveEnrollmentRequest(req.id, adminId)
      expect(await channelsOf(userId, 'order.seats_held')).toEqual(['email', 'in_app'])
    } finally {
      await prisma.integrationSetting.delete({ where: { provider: 'payment' } })
    }
  })
})

describe('الشعبةُ الملغاة تُقال لمن فيها', () => {
  it('المسجَّلُ يصله الخبرُ جرسا وبريدا، ومن أُسقط تسجيلُه قبلُ لا يصله', async () => {
    const cohortId = await openCohort('شعبةٌ تُلغى')
    const enrollments = new EnrollmentService(prisma)
    const inside = await learner('cancel-inside')
    const left = await learner('cancel-left')
    await enrollments.enroll(cohortId, inside, adminId)
    const gone = await enrollments.enroll(cohortId, left, adminId)
    await enrollments.drop(gone.id, adminId, 'انسحب قبل الإلغاء')

    await new CohortService(prisma).transition(cohortId, 'cancelled', adminId)

    expect(await channelsOf(inside, 'cohort.cancelled')).toEqual(['email', 'in_app'])
    expect(await channelsOf(left, 'cohort.cancelled')).toEqual([])
    const bell = await prisma.notification.findFirstOrThrow({ where: { userId: inside, templateKey: 'cohort.cancelled', channel: 'in_app' } })
    expect(bell.title).toContain('شعبةٌ تُلغى')
  })
})
