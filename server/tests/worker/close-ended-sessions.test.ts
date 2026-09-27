/* ═══ انتهاءُ اللقاء — حالةٌ تُكتب، والحضورُ يُحسب على ما أُخذ فيه ═══

   قرارُ المرحلة الثانية (٢٧ سبتمبر ٢٠٢٦): «حالةُ انتهاء اللقاء، ومعها إصلاحُ
   الحضور». والعلّةُ كاملةً في رأس `closeEndedSessions` (`server/worker/jobs.ts`).

   ① اللقاءُ المعتمَدُ الذي مضت نهايتُه يُكتب منعقدا — وبلا نهايةٍ مكتوبةٍ
      فبعد ساعتين من بدئه. ولا المبدئيُّ ولا المنتظرُ ولا الملغى ولا لقاءُ
      شعبةٍ أُلغيت، ولا ما لم تمضِ نهايتُه.
   ② ويُعاد حسابُ تقدّم من في الشعبة: الحضورُ صار يُحسب — على ما أُخذ فيه
      الحضورُ وحدَه، لا على كلّ ما انتهى.
   ③ ودورةٌ ثانيةٌ بلا أثر.
   ④ والتذكيرُ لا يصل عن لقاءٍ ينتظر الاعتمادَ أو أُلغي. */

import { beforeAll, describe, expect, it } from 'vitest'
import type { PrismaClient } from '@prisma/client'
import { setupTestDb, testPrisma } from '../helpers/db'
import { closeEndedSessions, sendSessionReminders } from '../../worker/jobs'

let prisma: PrismaClient
let cohortId = ''
let goneCohortId = ''
const ids: Record<string, string> = {}
const learners: { user: string; enrollment: string }[] = []

const NOW = new Date('2026-11-10T12:00:00.000Z')
const ago = (h: number) => new Date(NOW.getTime() - h * 3_600_000)

beforeAll(async () => {
  await setupTestDb()
  prisma = await testPrisma()
  const course = await prisma.course.findFirst({ select: { id: true } })
  const cohort = await prisma.cohort.create({
    data: { courseId: course!.id, title: 'شعبةُ انتهاء اللقاءات', status: 'active', capacity: 20, price: 100, currency: 'USD' },
  })
  cohortId = cohort.id
  const gone = await prisma.cohort.create({
    data: { courseId: course!.id, title: 'شعبةٌ أُلغيت', status: 'cancelled', capacity: 20, price: 100, currency: 'USD' },
  })
  goneCohortId = gone.id

  const make = async (key: string, data: Record<string, unknown>, where = cohortId) => {
    const s = await prisma.cohortSession.create({ data: { cohortId: where, title: key, ...data } as never })
    ids[key] = s.id
  }
  await make('ended', { startsAt: ago(26), endsAt: ago(24) })
  await make('noEnd', { startsAt: ago(3) })
  await make('noEndSoon', { startsAt: ago(1) })
  await make('future', { startsAt: new Date(NOW.getTime() + 3_600_000), endsAt: new Date(NOW.getTime() + 3 * 3_600_000) })
  await make('pending', { startsAt: ago(26), endsAt: ago(24), approvalState: 'pending' })
  await make('placeholder', { startsAt: ago(26), endsAt: ago(24), placeholder: true })
  await make('cancelled', { startsAt: ago(26), endsAt: ago(24), status: 'cancelled', approvalState: 'rejected' })
  await make('goneCohort', { startsAt: ago(26), endsAt: ago(24) }, goneCohortId)

  for (const n of [1, 2]) {
    const u = await prisma.user.create({ data: { email: `close-ended-${n}-${Date.now()}@test.local`, displayName: `متعلّم ${n}`, passwordHash: 'x' } })
    const e = await prisma.enrollment.create({ data: { cohortId, userId: u.id, status: 'enrolled' } })
    learners.push({ user: u.id, enrollment: e.id })
  }
  /* الحضورُ أُخذ في «ended» وحدَه: الأوّلُ حضر، والثاني غاب */
  await prisma.attendance.create({ data: { sessionId: ids.ended, enrollmentId: learners[0].enrollment, status: 'present' } })
  await prisma.attendance.create({ data: { sessionId: ids.ended, enrollmentId: learners[1].enrollment, status: 'absent' } })
})

const status = async (key: string) => (await prisma.cohortSession.findUniqueOrThrow({ where: { id: ids[key] } })).status

describe('① ما انتهى يُكتب منعقدا — وما لا يُعدّ لا يُمَسّ', () => {
  it('⚠️ المعتمَدُ الذي مضت نهايتُه، والذي بلا نهايةٍ بعد ساعتين من بدئه', async () => {
    const out = await closeEndedSessions(prisma, NOW)
    expect(out.done, out.summaryAr).toBe(2)
    expect(await status('ended')).toBe('done')
    expect(await status('noEnd')).toBe('done')
  })

  it('⚠️ ولا ما لم تمضِ نهايتُه، ولا المنتظرُ ولا المبدئيُّ ولا الملغى ولا لقاءُ شعبةٍ أُلغيت', async () => {
    expect(await status('noEndSoon'), 'انتهى لقاءٌ بدأ قبل ساعة').toBe('scheduled')
    expect(await status('future')).toBe('scheduled')
    expect(await status('pending'), 'عُدّ منعقدا ما لا يراه المتعلّم').toBe('scheduled')
    expect(await status('placeholder'), 'عُدّ المثالُ منعقدا — ولم يحضره أحد').toBe('scheduled')
    expect(await status('cancelled')).toBe('cancelled')
    expect(await status('goneCohort')).toBe('scheduled')
  })
})

describe('② والحضورُ يُحسب — على ما أُخذ فيه وحدَه', () => {
  it('⚠️ من حضر مئةٌ ومن غاب صفر — ولقاءٌ انتهى بلا حضورٍ مأخوذٍ لا يُحسب على أحد', async () => {
    const [a, b] = await Promise.all(learners.map(async (l) => {
      const row = await prisma.courseProgress.findUniqueOrThrow({ where: { enrollmentId: l.enrollment } })
      return (row.evidence as { attendancePct: number }).attendancePct
    }))
    /* «noEnd» انتهى ولم يُسجَّل فيه حضور — لو عُدّ لصار الحاضرُ خمسين */
    expect(a, 'الحاضرُ لم يُحسب حضورُه — أو حُسب عليه لقاءٌ لم يُسأل فيه').toBe(100)
    expect(b).toBe(0)
  })
})

describe('③ ودورةٌ ثانيةٌ بلا أثر', () => {
  it('لا شيءَ يُكتب مرّتين', async () => {
    const out = await closeEndedSessions(prisma, NOW)
    expect(out.done).toBe(0)
    expect(out.summaryAr).toContain('لا لقاءَ انتهى')
  })
})

describe('④ والتذكيرُ بما يراه المتعلّمُ وحدَه', () => {
  it('⚠️ لا «جلستُك غدا» عن لقاءٍ ينتظر الاعتمادَ أو أُلغي', async () => {
    const soon = new Date(Date.now() + 5 * 3_600_000)
    const pending = await prisma.cohortSession.create({ data: { cohortId, title: 'ينتظر', startsAt: soon, approvalState: 'pending' } })
    /* ألغته الإدارةُ بعد اعتماده — فاعتمادُه باقٍ وحالتُه ملغاة: يُفحص الشرطان كلٌّ على حدة */
    const dropped = await prisma.cohortSession.create({ data: { cohortId, title: 'أُلغي', startsAt: soon, status: 'cancelled' } })
    const shown = await prisma.cohortSession.create({ data: { cohortId, title: 'معتمَد', startsAt: soon } })
    await sendSessionReminders(prisma)
    const about = async (id: string) => prisma.notification.count({
      where: { userId: learners[0].user, templateKey: 'session.reminder.24h', data: { path: ['sessionId'], equals: id } },
    })
    expect(await about(shown.id), 'المعتمَدُ لم يُذكَّر به').toBe(1)
    expect(await about(pending.id), 'ذُكِّر بلقاءٍ ينتظر الاعتماد').toBe(0)
    expect(await about(dropped.id), 'ذُكِّر بلقاءٍ أُلغي').toBe(0)
  })
})
