/* ما كان يُفعل بيدٍ صار يُولَّد: الجلساتُ من الجدول، والنسخةُ من فصلٍ سابق،
   والحالةُ من التواريخ.

   الأصلُ في جولة ٢٠٢٦-٠٩: الجدولُ الأسبوعيُّ محفوظٌ في الشعبة ولا يولّد
   شيئا، فتُضاف الجلساتُ صفًّا صفًّا؛ وإعدادُ الفصل يُعاد من الصفر؛ وحالةُ
   الشعبة تنتظر ضغطةً قد لا تأتي — ومستحقّاتُ المدرّب تُولَّد عند الإكمال. */

import { beforeAll, describe, expect, it } from 'vitest'
import type { PrismaClient } from '@prisma/client'
import { setupTestDb, testPrisma } from '../helpers/db'
import { AuthService } from '../../services/auth.service'
import { CohortService } from '../../services/cohort.service'

let prisma: PrismaClient
let cohorts: CohortService
let managerId = ''
const COURSE = 'C-BIZ-101'

beforeAll(async () => {
  await setupTestDb()
  prisma = await testPrisma()
  const auth = new AuthService(prisma)
  cohorts = new CohortService(prisma)
  const m = await auth.register('automation-manager@test.local', 'Manager#12345', 'مدير أكاديمي')
  managerId = m.userId
  await auth.setRoles(managerId, ['academic_manager'])
}, 240_000)

/** شعبةٌ بجدولٍ أسبوعيّ — الحالةُ الشائعةُ في الواقع */
async function scheduled(title: string, days = ['tue', 'thu'], startTime = '18:00') {
  return cohorts.create(managerId, { courseId: COURSE, title, daysOfWeek: days, startTime, capacity: 20, price: 180 })
}

describe('توليدُ الجلسات من الجدول', () => {
  it('يعرض قبل أن يكتب — والافتراضُ عرضٌ لا تنفيذ', async () => {
    const c = await scheduled('شعبةُ المعاينة')
    const preview = await cohorts.generateSessions(managerId, c.id, { weeks: 3, from: new Date('2026-10-04T00:00:00Z') })
    expect(preview.applied).toBe(false)
    expect(preview.sessions).toHaveLength(6)
    expect(await prisma.cohortSession.count({ where: { cohortId: c.id } }), 'المعاينةُ لا تكتب').toBe(0)
  })

  it('ويولّد يوما لكلّ أسبوعٍ في وقته، مرتّبةً ومسمّاةً بالتسلسل', async () => {
    const c = await scheduled('شعبةُ التوليد')
    const r = await cohorts.generateSessions(managerId, c.id, { weeks: 2, from: new Date('2026-10-04T00:00:00Z'), apply: true })
    expect(r.created).toBe(4)
    const rows = await cohorts.sessionsFor(c.id)
    expect(rows.map((s) => s.title)).toEqual(['الجلسة 1', 'الجلسة 2', 'الجلسة 3', 'الجلسة 4'])
    /* الثلاثاء ٦ أكتوبر ثمّ الخميس ٨ — بالساعة ١٨:٠٠ */
    expect(rows[0].startsAt.toISOString()).toBe('2026-10-06T18:00:00.000Z')
    expect(rows[1].startsAt.toISOString()).toBe('2026-10-08T18:00:00.000Z')
    expect(new Date(rows[0].endsAt!).getTime() - rows[0].startsAt.getTime(), 'ساعتان افتراضا').toBe(120 * 60_000)
  })

  it('وبدايةُ الشعبة ونهايتُها تتبعان جلساتِها', async () => {
    const c = await scheduled('شعبةُ الحدود')
    await cohorts.generateSessions(managerId, c.id, { weeks: 2, from: new Date('2026-11-01T00:00:00Z'), apply: true })
    const after = await prisma.cohort.findUnique({ where: { id: c.id }, select: { startsAt: true, endsAt: true } })
    expect(after!.startsAt!.toISOString()).toBe('2026-11-03T18:00:00.000Z')
    expect(after!.endsAt!.toISOString()).toBe('2026-11-12T20:00:00.000Z')
  })

  it('ولا يكرّر ما وُلِّد — تشغيلٌ ثانٍ بالنطاق نفسه يُرفض بلا كتابة', async () => {
    const c = await scheduled('شعبةُ التكرار')
    await cohorts.generateSessions(managerId, c.id, { weeks: 1, from: new Date('2026-10-04T00:00:00Z'), apply: true })
    await expect(cohorts.generateSessions(managerId, c.id, { weeks: 1, from: new Date('2026-10-04T00:00:00Z'), apply: true }))
      .rejects.toMatchObject({ code: 'nothing_to_create' })
    expect(await prisma.cohortSession.count({ where: { cohortId: c.id } })).toBe(2)
  })

  it('ويرفض بلا جدولٍ أو بلا وقتٍ أو بمدًى مستحيل', async () => {
    const bare = await cohorts.create(managerId, { courseId: COURSE, title: 'شعبةٌ بلا جدول' })
    await expect(cohorts.generateSessions(managerId, bare.id, { weeks: 2 })).rejects.toMatchObject({ code: 'no_pattern' })
    const noTime = await cohorts.create(managerId, { courseId: COURSE, title: 'شعبةٌ بلا وقت', daysOfWeek: ['mon'] })
    await expect(cohorts.generateSessions(managerId, noTime.id, { weeks: 2 })).rejects.toMatchObject({ code: 'no_time' })
    const c = await scheduled('شعبةُ المدى')
    await expect(cohorts.generateSessions(managerId, c.id, { weeks: 0 })).rejects.toMatchObject({ code: 'bad_weeks' })
  })
})

describe('تكرارُ شعبةٍ لفصلٍ قادم', () => {
  it('ينسخ الإعدادَ ويُزيح الجلسات، والنسخةُ مسودّةٌ مغلقةُ التسجيل', async () => {
    const src = await scheduled('شعبةُ الأصل')
    await cohorts.generateSessions(managerId, src.id, { weeks: 2, from: new Date('2026-10-04T00:00:00Z'), apply: true })
    const copy = await cohorts.duplicate(managerId, src.id, { shiftWeeks: 8, withSessions: true })

    expect(copy.status).toBe('draft')
    expect(copy.registrationOpen).toBe(false)
    expect(copy.title).toBe('شعبةُ الأصل — نسخة')
    expect(copy.daysOfWeek).toEqual(['tue', 'thu'])
    expect(Number(copy.price)).toBe(180)

    const copied = await cohorts.sessionsFor(copy.id)
    expect(copied).toHaveLength(4)
    /* ثمانيةُ أسابيعَ بعد ٦ أكتوبر = ١ ديسمبر */
    expect(copied[0].startsAt.toISOString()).toBe('2026-12-01T18:00:00.000Z')
  })

  it('ولا ينقل ما يخصّ أشخاصا: لا تسجيلاتٍ ولا اجتماعات', async () => {
    const src = await scheduled('شعبةُ الأشخاص')
    await cohorts.generateSessions(managerId, src.id, { weeks: 1, from: new Date('2026-10-04T00:00:00Z'), apply: true })
    const sessions = await cohorts.sessionsFor(src.id)
    await cohorts.attachManualZoom(managerId, sessions[0].id, { joinUrl: 'https://zoom.us/j/555000111' })
    const learner = await new AuthService(prisma).register('dup.learner@test.local', 'Learner#12345', 'متعلّمُ النسخ')
    await prisma.enrollment.create({ data: { cohortId: src.id, userId: learner.userId, status: 'enrolled' } })

    const copy = await cohorts.duplicate(managerId, src.id, { shiftWeeks: 4, withSessions: true })
    expect(await prisma.enrollment.count({ where: { cohortId: copy.id } })).toBe(0)
    const copied = await cohorts.sessionsFor(copy.id)
    expect(copied.every((s) => s.hasZoom === false), 'اجتماعُ الأصل لا يُنسخ — رابطٌ واحدٌ لموعدَين خطأ').toBe(true)
  })

  it('ويكتفي بالإعداد إن لم تُطلب الجلسات', async () => {
    const src = await scheduled('شعبةُ الإعداد')
    await cohorts.generateSessions(managerId, src.id, { weeks: 1, from: new Date('2026-10-04T00:00:00Z'), apply: true })
    const copy = await cohorts.duplicate(managerId, src.id, { title: 'فصلُ الربيع' })
    expect(copy.title).toBe('فصلُ الربيع')
    expect(await prisma.cohortSession.count({ where: { cohortId: copy.id } })).toBe(0)
    expect(copy.startsAt).toBeNull()
  })
})

describe('الحالةُ تتبع التواريخ', () => {
  it('تُنهي ما انتهت جلساتُه وتُجري ما بدأ — ولا تفتح شيئا', async () => {
    /* شعبةٌ انتهت: جلساتُها في الماضي */
    const past = await scheduled('شعبةٌ منتهية')
    await cohorts.generateSessions(managerId, past.id, { weeks: 1, from: new Date('2026-01-05T00:00:00Z'), apply: true })
    await prisma.cohort.update({ where: { id: past.id }, data: { status: 'active' } })

    /* شعبةٌ بدأت ولم تنته */
    const running = await scheduled('شعبةٌ جارية')
    await cohorts.generateSessions(managerId, running.id, { weeks: 4, from: new Date('2026-01-05T00:00:00Z'), apply: true })
    await prisma.cohort.update({ where: { id: running.id }, data: { status: 'open', registrationOpen: true } })

    /* ومسودّةٌ لا تُلمَس مهما مضى تاريخُها */
    const draft = await scheduled('مسودّةٌ قديمة')
    await cohorts.generateSessions(managerId, draft.id, { weeks: 1, from: new Date('2026-01-05T00:00:00Z'), apply: true })

    const now = new Date('2026-01-14T00:00:00Z')
    const preview = await cohorts.syncStatusesByDate(managerId, { now })
    expect(preview.applied).toBe(false)
    const ids = preview.changes.map((ch) => ch.cohortId)
    expect(ids).toContain(past.id)
    expect(ids).toContain(running.id)
    expect(ids, 'المسودّةُ لا تُفتح آليّا').not.toContain(draft.id)

    const applied = await cohorts.syncStatusesByDate(managerId, { now, apply: true })
    expect(applied.changed).toBeGreaterThanOrEqual(2)
    expect((await prisma.cohort.findUnique({ where: { id: past.id } }))!.status).toBe('completed')
    expect((await prisma.cohort.findUnique({ where: { id: running.id } }))!.status).toBe('active')
    expect((await prisma.cohort.findUnique({ where: { id: draft.id } }))!.status).toBe('draft')
  })

  it('وشعبةٌ بلا جلسةٍ لا حكمَ لها بالتواريخ', async () => {
    const bare = await cohorts.create(managerId, { courseId: COURSE, title: 'شعبةٌ بلا جلسات' })
    await prisma.cohort.update({ where: { id: bare.id }, data: { status: 'active' } })
    const r = await cohorts.syncStatusesByDate(managerId, { now: new Date('2027-01-01T00:00:00Z') })
    expect(r.changes.map((ch) => ch.cohortId)).not.toContain(bare.id)
  })
})
