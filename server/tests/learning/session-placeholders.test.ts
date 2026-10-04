/* ═══ الموعدُ المبدئيُّ مثالٌ — يُعرض حتّى يُعتمَد أوّلُ لقاءٍ من جدول المدرّب ═══

   قرارُ صاحب المنصّة (٢٧ سبتمبر ٢٠٢٦): «اللقاءات.. امنحه أن يضيفها بنفسه لا
   ينقلها، لأنّ ما هو موجودٌ مثالٌ فقط». والعلّةُ كاملةً في تعليق الحقل
   (`CohortSession.placeholder`) وفي رأس `clearPlaceholders`.

   ═══ وما يُقاس بالسلوك لا بقراءة نصّ ═══

   ① ما يولّده النمطُ مبدئيٌّ — والمدرّبُ لا ينقله ولا يحذفه من بابه.
   ② ولا يأكل من سقف اللقاءات: ليس لقاءً جدوله.
   ③ وأوّلُ لقاءٍ يُعتمَد من جدول المدرّب يرفع المبدئيَّ كلَّه — ما لم ينعقد —
      ويُبلَّغ المسجَّلون مرّةً واحدة. وما انعقد (حضورٌ مسجَّل) واقعةٌ فيبقى.
   ④ واعتمادُ مبدئيٍّ لا يرفع إخوتَه — الرفعُ لجدول المدرّب لا لغيره.
   ⑤ والترحيلُ يسمّي القائمَ بشروطه الأربعة — لا بالعنوان.

   ولا شبكةَ هنا: `fetch` مُلتقَط. */

import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import type { PrismaClient } from '@prisma/client'
import { setupTestDb, testPrisma } from '../helpers/db'
import { CohortService } from '../../services/cohort.service'
import { forgetZoomToken } from '../../services/zoom.service'

let prisma: PrismaClient
let cohorts: CohortService
let adminId = ''
let trainerUserId = ''
let profileId = ''
let cohortId = ''
const learners: string[] = []

const SAVED = { ...process.env }
const ZOOM_ENV = ['ZOOM_ACCOUNT_ID', 'ZOOM_CLIENT_ID', 'ZOOM_CLIENT_SECRET', 'ZOOM_HOST_EMAIL'] as const

function stubZoom() {
  process.env.ZOOM_ACCOUNT_ID = 'acc'
  process.env.ZOOM_CLIENT_ID = 'cid'
  process.env.ZOOM_CLIENT_SECRET = 'sec'
  process.env.ZOOM_HOST_EMAIL = 'lessons@wajeez.test'
  globalThis.fetch = (async (url: string) => {
    if (String(url).includes('/oauth/token')) {
      return { ok: true, status: 200, json: async () => ({ access_token: 't', expires_in: 3600 }) }
    }
    return {
      ok: true, status: 201,
      json: async () => ({ id: 888, join_url: 'https://zoom.us/j/888', start_url: 'https://zoom.us/s/888', password: 'pw88' }),
    }
  }) as unknown as typeof fetch
  forgetZoomToken()
}

beforeAll(async () => {
  await setupTestDb()
  prisma = await testPrisma()
  cohorts = new CohortService(prisma)
  stubZoom()

  const admin = await prisma.user.create({
    data: { email: `ph-admin-${Date.now()}@wajeez.test`, displayName: 'المديرُ الأكاديميّ', passwordHash: 'x' },
  })
  adminId = admin.id
  await prisma.userRole.create({ data: { userId: adminId, roleId: 'academic_manager' } })

  const tUser = await prisma.user.create({
    data: { email: `ph-trainer-${Date.now()}@wajeez.test`, displayName: 'مدرّبُ الشعبة', passwordHash: 'x' },
  })
  trainerUserId = tUser.id
  const application = await prisma.trainerApplication.create({
    data: { reference: `WJ-TR-PH-${Date.now()}`, fullName: 'مدرّبُ الشعبة', email: tUser.email, status: 'active' },
  })
  const profile = await prisma.trainerProfile.create({ data: { userId: tUser.id, applicationId: application.id } })
  profileId = profile.id

  const course = await prisma.course.findFirst({ select: { id: true } })
  const cohort = await prisma.cohort.create({
    data: {
      courseId: course!.id, title: 'شعبةٌ فُتحت بجدولٍ مبدئيّ', status: 'open',
      capacity: 20, price: 100, currency: 'USD', timezone: 'Asia/Amman',
      daysOfWeek: ['tue', 'thu'], startTime: '18:00',
      startsAt: new Date('2027-02-02T15:00:00.000Z'),
      scheduleWindowStart: new Date('2027-01-01T00:00:00.000Z'),
      scheduleWindowEnd: new Date('2027-04-30T00:00:00.000Z'),
      maxSessions: 6,
    },
  })
  cohortId = cohort.id
  await prisma.cohortTrainer.create({ data: { cohortId, profileId, role: 'lead' } })

  for (const i of [0, 1]) {
    const u = await prisma.user.create({
      data: { email: `ph-learner-${i}-${Date.now()}@wajeez.test`, displayName: `متعلّم ${i}`, passwordHash: 'x' },
    })
    await prisma.enrollment.create({ data: { cohortId, userId: u.id, status: 'enrolled' } })
    learners.push(u.id)
  }
}, 240_000)

afterAll(() => {
  for (const k of ZOOM_ENV) {
    if (SAVED[k] === undefined) delete process.env[k]
    else process.env[k] = SAVED[k]
  }
  forgetZoomToken()
})

describe('① ما يولّده النمطُ مبدئيٌّ — ولا يُنقل من باب المدرّب', () => {
  it('⚠️ التوليدُ يكتب مواعيدَ مبدئيّة', async () => {
    const out = await cohorts.generateSessions(adminId, cohortId, { weeks: 3, apply: true })
    expect(out.created).toBe(6)
    const rows = await prisma.cohortSession.findMany({ where: { cohortId } })
    expect(rows.every((r) => r.placeholder), 'وُلد من النمط موعدٌ غيرُ مبدئيّ').toBe(true)
  })

  it('⚠️ والمدرّبُ لا ينقله ولا يحذفه — ويُقال له لماذا', async () => {
    const one = await prisma.cohortSession.findFirstOrThrow({ where: { cohortId, placeholder: true } })
    await expect(cohorts.trainerMoveSession(trainerUserId, one.id, {
      startsAt: new Date('2027-02-10T15:00:00.000Z'), endsAt: new Date('2027-02-10T17:00:00.000Z'),
    })).rejects.toMatchObject({ code: 'placeholder_session' })
    await expect(cohorts.trainerDeleteSession(trainerUserId, one.id)).rejects.toMatchObject({ code: 'placeholder_session' })
    const still = await prisma.cohortSession.findUniqueOrThrow({ where: { id: one.id } })
    expect(still.startsAt.getTime(), 'نُقل المبدئيُّ رغم الردّ').toBe(one.startsAt.getTime())
  })
})

/* وكان «② ولا يأكل من السقف»: ستّةُ مواعيدَ مبدئيّةٍ وسقفٌ ستّة والمدرّبُ لم يستهلك شيئا.
   ثمّ سقط السقفُ كلُّه (٤ أكتوبر ٢٠٢٦): «يضيفون ما شاؤوا» — فلا عددَ يُحسب عليه أصلا،
   والسقفُ المحفوظُ في الصفّ (ستّة) لا يُقرأ. ويضيف ③ لقاءَه بعدها كما كان. */
describe('② ولا عددَ يُحسب عليه — لا سقفَ للّقاءات', () => {
  it('⚠️ ستّةُ مواعيدَ مبدئيّةٍ وسقفٌ ستّةٌ محفوظٌ من قبل — ولا يُقرأ شيءٌ منهما عددا عليه', async () => {
    const win = await cohorts.scheduleWindowFor(trainerUserId, cohortId)
    expect(win.open).toBe(true)
    expect(win, 'عاد سقفُ اللقاءات إلى ما يراه المدرّب').not.toHaveProperty('remaining')
  })
})

describe('③ وأوّلُ لقاءٍ يُعتمَد من جدوله يرفع المبدئيّ', () => {
  let heldId = ''
  let mineId = ''

  it('يُهيَّأ: موعدٌ مبدئيٌّ انعقد فعلا (حضورٌ مسجَّل)، ولقاءٌ من جدول المدرّب', async () => {
    const first = await prisma.cohortSession.findFirstOrThrow({
      where: { cohortId, placeholder: true }, orderBy: { startsAt: 'asc' },
    })
    heldId = first.id
    const enrollment = await prisma.enrollment.findFirstOrThrow({ where: { cohortId, userId: learners[0] } })
    await prisma.attendance.create({ data: { sessionId: heldId, enrollmentId: enrollment.id, status: 'present' } })

    const out = await cohorts.trainerAddSessionWithMeeting(trainerUserId, cohortId, {
      title: 'لقائي الأوّل', startsAt: new Date('2027-02-15T15:00:00.000Z'), endsAt: new Date('2027-02-15T17:00:00.000Z'),
    })
    mineId = out.session.id
    const row = await prisma.cohortSession.findUniqueOrThrow({ where: { id: mineId } })
    expect(row.placeholder, 'لقاءُ المدرّب وُلد مبدئيّا').toBe(false)
  })

  it('⚠️ باعتماده يُرفع ما لم ينعقد، ويبقى ما انعقد', async () => {
    await prisma.notification.deleteMany({ where: { templateKey: 'cohort.schedule_changed' } })
    await cohorts.decideSession(adminId, mineId, true)

    const left = await prisma.cohortSession.findMany({ where: { cohortId }, select: { id: true, placeholder: true } })
    const ids = left.map((r) => r.id)
    expect(ids, 'رُفع لقاءُ المدرّب نفسُه').toContain(mineId)
    expect(ids, 'رُفع موعدٌ انعقد وفيه حضور — محوُ واقعة').toContain(heldId)
    expect(left.filter((r) => r.placeholder).map((r) => r.id), 'بقي مبدئيٌّ لم ينعقد').toEqual([heldId])
  })

  it('⚠️ والمسجَّلون يُبلَّغون مرّةً واحدة — لا لكلّ موعدٍ رُفع', async () => {
    const notes = await prisma.notification.findMany({ where: { templateKey: 'cohort.schedule_changed' } })
    expect(notes.map((n) => n.userId).sort(), 'لم يُبلَّغ المسجَّلون بتبدّل جدولهم').toEqual([...learners].sort())
  })

  it('والرفعُ يُكتب في الأثر بعدده', async () => {
    const audit = await prisma.auditEvent.findFirst({ where: { action: 'cohort.placeholders.clear', entityId: cohortId } })
    expect(audit, 'لا أثرَ لرفع الجدول المبدئيّ').toBeTruthy()
    expect((audit!.meta as { cleared?: number }).cleared).toBe(5)
  })
})

describe('④ واعتمادُ مبدئيٍّ لا يرفع إخوتَه', () => {
  it('⚠️ الرفعُ لجدول المدرّب — لا لموعدٍ مبدئيٍّ نُقل إلى الانتظار بيدٍ أخرى', async () => {
    const c = await prisma.cohort.create({
      data: {
        courseId: (await prisma.course.findFirst({ select: { id: true } }))!.id,
        title: 'شعبةٌ ثانيةٌ بمبدئيٍّ ينتظر', status: 'open', timezone: 'Asia/Amman',
      },
    })
    const a = await prisma.cohortSession.create({
      data: { cohortId: c.id, title: 'الجلسة ١', startsAt: new Date('2027-03-02T15:00:00.000Z'), placeholder: true, approvalState: 'pending' },
    })
    const b = await prisma.cohortSession.create({
      data: { cohortId: c.id, title: 'الجلسة ٢', startsAt: new Date('2027-03-04T15:00:00.000Z'), placeholder: true },
    })
    await cohorts.decideSession(adminId, a.id, true)
    const left = await prisma.cohortSession.findMany({ where: { cohortId: c.id }, select: { id: true } })
    expect(left.map((r) => r.id).sort(), 'اعتمادُ مبدئيٍّ رفع إخوتَه').toEqual([a.id, b.id].sort())
  })
})

/* ═══ ⑤ الترحيلُ يسمّي القائمَ بشروطه — لا بالعنوان ═══

   الترحيلُ جرى على قاعدةٍ فارغةٍ حين هُيّئت قاعدةُ الاختبار، فلا يُقاس أثرُه
   هناك. فيُقرأ استعلامُه من ملفّه **نفسِه** ويُنفَّذ على صفوفٍ تُصنع هنا بكلّ
   حالٍ من أحواله — فلو تبدّل شرطٌ في الملفّ سقط هذا لا نسخةٌ عنه. */
describe('⑤ والترحيلُ يسمّي القائمَ بشروطه الأربعة', () => {
  it('⚠️ ما جدولته الإدارةُ ولم ينعقد في شعبةٍ بلا خطّةٍ معتمَدة — وحدَه', async () => {
    const sql = readFileSync(
      join(process.cwd(), 'prisma/migrations/20260927130000_cohort_session_placeholder/migration.sql'), 'utf8',
    )
    const update = sql.slice(sql.indexOf('UPDATE "CohortSession"'))
    expect(update.length, 'لا استعلامَ ترحيلٍ في الملفّ').toBeGreaterThan(50)

    const courseId = (await prisma.course.findFirst({ select: { id: true } }))!.id
    const fresh = await prisma.cohort.create({ data: { courseId, title: 'بلا خطّة', status: 'open' } })
    const planned = await prisma.cohort.create({ data: { courseId, title: 'خطّتُها معتمَدة', status: 'open' } })
    const done = await prisma.cohort.create({ data: { courseId, title: 'منتهية', status: 'completed' } })
    await prisma.cohortDeliveryPlan.create({
      data: { cohortId: planned.id, trainerId: profileId, status: 'approved', content: { kind: 'trainer', modules: [], resources: [] } },
    })
    const at = (d: number) => new Date(Date.UTC(2027, 4, d, 15))
    const mk = (cohort: string, d: number, extra: Record<string, unknown> = {}) =>
      prisma.cohortSession.create({ data: { cohortId: cohort, title: `ل${d}`, startsAt: at(d), ...extra } })

    const staff = await mk(fresh.id, 1)
    const byTrainer = await mk(fresh.id, 2, { approvedBy: adminId, approvedAt: new Date() })
    const waiting = await mk(fresh.id, 3, { approvalState: 'pending' })
    const held = await mk(fresh.id, 4)
    const enr = await prisma.enrollment.create({ data: { cohortId: fresh.id, userId: learners[1], status: 'enrolled' } })
    await prisma.attendance.create({ data: { sessionId: held.id, enrollmentId: enr.id, status: 'present' } })
    const inPlanned = await mk(planned.id, 5)
    const inDone = await mk(done.id, 6)

    /* ويُحصر في صفوف هذا الاختبار: الملفّاتُ المتتاليةُ في العامل نفسِه تتقاسم
       القاعدة (`helpers/db.ts`)، واستعلامٌ على الجدول كلِّه يمسّ صفوفَ غيره.
       والحصرُ **شرطٌ يُضاف** لا نسخةٌ تُكتب — شروطُ الملفّ الأربعةُ كما هي. */
    const scope = [fresh.id, planned.id, done.id].map((id) => `'${id}'`).join(', ')
    const scoped = update.trim().replace(/;\s*$/, ` AND s."cohortId" IN (${scope});`)
    expect(scoped, 'لم يُضَف الحصرُ إلى الاستعلام').toContain('AND s."cohortId" IN (')
    await prisma.$executeRawUnsafe(scoped)

    const flag = async (id: string) => (await prisma.cohortSession.findUniqueOrThrow({ where: { id } })).placeholder
    expect(await flag(staff.id), 'موعدُ الإدارة لم يُسمَّ مبدئيّا').toBe(true)
    expect(await flag(byTrainer.id), 'لقاءٌ اعتُمد بيدٍ صار مبدئيّا').toBe(false)
    expect(await flag(waiting.id), 'لقاءُ مدرّبٍ ينتظر صار مبدئيّا').toBe(false)
    expect(await flag(held.id), 'موعدٌ انعقد صار مبدئيّا — فيُمحى').toBe(false)
    expect(await flag(inPlanned.id), 'جدولُ شعبةٍ اعتُمدت خطّتُها صار مبدئيّا').toBe(false)
    expect(await flag(inDone.id), 'شعبةٌ منتهيةٌ مُسّ جدولُها').toBe(false)
  })
})
