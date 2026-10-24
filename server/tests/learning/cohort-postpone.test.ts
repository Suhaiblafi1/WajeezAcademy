/* تأجيلُ شعب الشهر إلى الشهر التالي — على قاعدةٍ حقيقيّة (٢٤ أكتوبر ٢٠٢٦).

   «افحص كلَّ الدورات التي تبدأ بشهر ١١ واقترح تأجيلا لها وأرسلها للمدرّب مع إعلامه بأنّه سيتمّ توقيفُ الشعبة
   تلقائيّا» (صاحب المنصّة). فيُحرس:
   ١) المعاينةُ تجمع شعبَ الشهر التي لم تبدأ وحدَها، بموعدها بعد التأجيل — ولا ترسل شيئا؛
   ٢) الإرسالُ يصل المدرّبَ جرسا وبريدا يقولان الموعدين والمهلةَ والتوقّفَ التلقائيّ؛
   ٣) القبولُ يزيح الشعبةَ ولقاءاتِها بأسابيعَ كاملةٍ ولا يغيّر فصلَها — وما حُسم لا يُحسم ثانية؛
   ٤) عدمُ القبول يوقفها الآن، والسكوتُ حتّى المهلة يوقفها العامل — ويصل متعلّميها الخبر. */

import { beforeAll, describe, expect, it } from 'vitest'
import type { PrismaClient } from '@prisma/client'
import { setupTestDb, testPrisma } from '../helpers/db'
import { TrainerReviewService } from '../../services/trainer-review.service'
import { CohortPostponeService } from '../../services/cohort-postpone.service'
import { runCohortPostponeExpire } from '../../worker/jobs'

let prisma: PrismaClient
const ACTOR = '00000000-0000-0000-0000-000000000009'
const COURSE = 'C-BIZ-101'
const DAY = 86_400_000
let profileId = ''
let trainerUserId = ''
let seq = 0

/* بعيدا في المستقبل — فلا يلتقي «الآن» الحقيقيّ ولا شعبَ ملفٍّ آخر */
const NOW = new Date('2030-10-25T09:00:00Z')
const DEADLINE = new Date('2030-10-28T09:00:00Z')

async function cohortAt(title: string, firstAt: Date, status = 'open') {
  const c = await prisma.cohort.create({ data: { courseId: COURSE, title, status, startsAt: firstAt, endsAt: new Date(firstAt.getTime() + 28 * DAY) } })
  await prisma.cohortTrainer.create({ data: { cohortId: c.id, profileId, role: 'lead' } })
  for (let i = 0; i < 3; i++) {
    await prisma.cohortSession.create({ data: { cohortId: c.id, title: `لقاء ${i + 1}`, startsAt: new Date(firstAt.getTime() + i * 7 * DAY) } })
  }
  const u = await prisma.user.create({ data: { email: `pp-${++seq}@test.local`, passwordHash: 'x', displayName: 'متعلم' } })
  await prisma.enrollment.create({ data: { userId: u.id, cohortId: c.id, status: 'enrolled' } })
  return { cohort: c, learnerId: u.id }
}

const svc = () => new CohortPostponeService(prisma)

beforeAll(async () => {
  await setupTestDb()
  prisma = await testPrisma()
  profileId = (await new TrainerReviewService(prisma)
    .createTrainerDirectly(ACTOR, { fullName: 'مدرب نوفمبر', email: 'pp-trainer@test.local' })).profileId
  trainerUserId = (await prisma.trainerProfile.findUniqueOrThrow({ where: { id: profileId } })).userId!
}, 240_000)

describe('① المعاينة', () => {
  it('⚠️ شعب الشهر التي لم تبدأ وحدها — وموعدها بعد التأجيل في الشهر التالي بنفس اليوم والساعة', async () => {
    /* الأحد ٣ نوفمبر ٢٠٣٠، السابعة مساء عمّان */
    const { cohort: nov } = await cohortAt('شعبة نوفمبر', new Date('2030-11-03T16:00:00Z'))
    await cohortAt('شعبة ديسمبر', new Date('2030-12-08T16:00:00Z'))
    await cohortAt('شعبة نوفمبر ملغاة', new Date('2030-11-05T16:00:00Z'), 'cancelled')
    const rows = await svc().preview(2030, 11, NOW)
    expect(rows.map((r) => r.title)).toEqual(['شعبة نوفمبر'])
    expect(rows[0]).toMatchObject({ cohortId: nov.id, weeks: 4, blockedAr: null, enrolled: 1, trainersAr: ['مدرب نوفمبر'] })
    expect(rows[0].toFirstAt).toBe('2030-12-01T16:00:00.000Z')
    expect(await prisma.cohortPostponeOffer.count({ where: { cohortId: nov.id } }), 'المعاينة أرسلت').toBe(0)
  })
})

describe('② الإرسال والقبول', () => {
  it('⚠️ يصل المدرب جرسا وبريدا بالموعدين والتوقف التلقائي — والقبول يزيح كل شيء ولا يغير الفصل', async () => {
    const first = new Date('2030-11-10T16:00:00Z')
    const { cohort: c, learnerId } = await cohortAt('شعبة تقبل التأجيل', first)
    const term = await prisma.cohort.findUniqueOrThrow({ where: { id: c.id }, select: { termId: true } })

    const r = await svc().send(ACTOR, { cohortIds: [c.id], deadlineAt: DEADLINE, reasonAr: 'بدأنا التسويق متأخرين' }, NOW)
    expect(r).toEqual({ sent: 1, skipped: [] })
    const told = (await prisma.notification.findMany({ where: { userId: trainerUserId, templateKey: 'cohort.postpone.proposed' } }))
      .filter((n) => (n.data as { cohortId?: string } | null)?.cohortId === c.id)
    expect(told.map((n) => n.channel).sort()).toEqual(['email', 'in_app'])
    expect(told[0].body).toContain('بدأنا التسويق متأخرين')
    expect(told[0].body).toContain('تتوقف الشعبة تلقائيا')

    /* وطلبٌ ثانٍ للشعبة نفسِها لا يُرسل */
    expect((await svc().send(ACTOR, { cohortIds: [c.id], deadlineAt: DEADLINE, reasonAr: 'مرة ثانية' }, NOW)).sent).toBe(0)

    const [offer] = await svc().mine(trainerUserId)
    expect(offer.cohortId).toBe(c.id)
    await svc().decide(trainerUserId, offer.id, 'accept', NOW)

    const after = await prisma.cohort.findUniqueOrThrow({ where: { id: c.id }, include: { sessions: { orderBy: { startsAt: 'asc' } } } })
    /* الأحد ١٠ نوفمبر ← الأحد الأوّل من ديسمبر: ثلاثة أسابيع */
    const shift = 21 * DAY
    expect(after.startsAt!.getTime()).toBe(first.getTime() + shift)
    expect(after.sessions.map((s) => s.startsAt.getTime())).toEqual([0, 1, 2].map((i) => first.getTime() + shift + i * 7 * DAY))
    expect(after.status).toBe('open')
    expect(after.termId, 'التأجيل غير الفصل').toBe(term.termId)
    expect(await prisma.notification.count({ where: { userId: learnerId, channel: 'in_app', templateKey: 'cohort.schedule_changed' } })).toBe(1)
    expect(await prisma.auditEvent.count({ where: { action: 'cohort.postpone.accept', entityId: c.id } })).toBe(1)

    await expect(svc().decide(trainerUserId, offer.id, 'decline', NOW)).rejects.toThrow(/حسم/)
    expect((await prisma.cohort.findUniqueOrThrow({ where: { id: c.id } })).status, 'حسم مرتين').toBe('open')
  })

  it('⚠️ ولا يرد على الاقتراح إلا مدرب الشعبة', async () => {
    const { cohort: c } = await cohortAt('شعبة لغيره', new Date('2030-11-12T16:00:00Z'))
    await svc().send(ACTOR, { cohortIds: [c.id], deadlineAt: DEADLINE, reasonAr: 'سبب' }, NOW)
    const offer = await prisma.cohortPostponeOffer.findFirstOrThrow({ where: { cohortId: c.id } })
    await expect(svc().decide(ACTOR, offer.id, 'accept', NOW)).rejects.toThrow(/ليست من شعبك/)
  })
})

describe('③ من لم يقبل تتوقف شعبته', () => {
  it('⚠️ عدم القبول يوقفها الآن — ويصل متعلميها الخبر', async () => {
    const { cohort: c, learnerId } = await cohortAt('شعبة لا تقبل', new Date('2030-11-14T16:00:00Z'))
    await svc().send(ACTOR, { cohortIds: [c.id], deadlineAt: DEADLINE, reasonAr: 'سبب' }, NOW)
    const offer = await prisma.cohortPostponeOffer.findFirstOrThrow({ where: { cohortId: c.id } })
    await svc().decide(trainerUserId, offer.id, 'decline', NOW)
    expect((await prisma.cohort.findUniqueOrThrow({ where: { id: c.id } })).status).toBe('cancelled')
    expect((await prisma.cohortPostponeOffer.findUniqueOrThrow({ where: { id: offer.id } })).status).toBe('declined')
    expect(await prisma.notification.count({ where: { userId: learnerId, channel: 'in_app', templateKey: 'cohort.cancelled' } })).toBe(1)
  })

  it('⚠️ والسكوت حتى المهلة يوقفها العامل — وقبلها لا', async () => {
    const first = new Date('2030-11-17T16:00:00Z')
    const { cohort: c } = await cohortAt('شعبة لم يرد مدربها', first)
    await svc().send(ACTOR, { cohortIds: [c.id], deadlineAt: DEADLINE, reasonAr: 'سبب' }, NOW)
    const offer = await prisma.cohortPostponeOffer.findFirstOrThrow({ where: { cohortId: c.id } })

    await runCohortPostponeExpire(prisma, new Date(DEADLINE.getTime() - 60_000))
    expect((await prisma.cohort.findUniqueOrThrow({ where: { id: c.id } })).status, 'أوقفها قبل المهلة').toBe('open')

    const r = await runCohortPostponeExpire(prisma, new Date(DEADLINE.getTime() + 60_000))
    expect(r.done).toBeGreaterThanOrEqual(1)
    expect((await prisma.cohort.findUniqueOrThrow({ where: { id: c.id } })).status).toBe('cancelled')
    expect((await prisma.cohortPostponeOffer.findUniqueOrThrow({ where: { id: offer.id } })).status).toBe('expired')
    const sessions = await prisma.cohortSession.findMany({ where: { cohortId: c.id }, orderBy: { startsAt: 'asc' } })
    expect(sessions[0].startsAt.getTime(), 'السكوت أزاحها').toBe(first.getTime())
  })

  it('⚠️ ومهلة بعد أول لقاء لا ترسل', async () => {
    const { cohort: c } = await cohortAt('شعبة قريبة جدا', new Date('2030-11-01T16:00:00Z'))
    const r = await svc().send(ACTOR, { cohortIds: [c.id], deadlineAt: new Date('2030-11-02T09:00:00Z'), reasonAr: 'سبب' }, NOW)
    expect(r.sent).toBe(0)
    expect(r.skipped[0].reasonAr).toMatch(/بعد أول لقاء/)
  })
})
