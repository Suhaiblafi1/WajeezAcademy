/* مواعيدُ الفصل بلا تعارض — من الباب إلى بطاقة المدرّب (٢٢ أكتوبر ٢٠٢٦، `term-clash.service.ts`).

   على قاعدةٍ حقيقيّة: دورتان للفئة نفسِها بمستوى واحد، شعبتاهما الأحدَ ١٩:٠٠ بخطّتين معتمدتين، وفي إحداهما طالب.

   ١) **المعاينةُ تقول التعارضَ ولا تكتب شيئا** — والتي بلا طلبةٍ هي التي تنتقل.
   ٢) **والإرسالُ بطاقةٌ عند مدرّبها** معتمَدةٌ بإرسالها، وجرسٌ يفتح «المراجعة».
   ٣) **ورفضُه بسببٍ يعود** — «هذا اليوم لا يناسبني» فلا يُقترح عليه الأحدُ ثانية.
   ٤) **وقبولُه يُكتب في خطّته المعتمدة** — فلا يبقى تعارض. */

import { randomUUID } from 'node:crypto'
import { beforeAll, describe, expect, it } from 'vitest'
import type { PrismaClient } from '@prisma/client'
import type { FastifyInstance } from 'fastify'
import { setupTestDb, testPrisma } from '../helpers/db'
import { AuthService } from '../../services/auth.service'
import { buildApp } from '../../http/app'
import { SESSION_COOKIE } from '../../http/auth-plugin'

let prisma: PrismaClient
let auth: AuthService
let app: FastifyInstance
const STAMP = Date.now()
const PASS = 'Pass#12345'
const cookies: Record<string, string> = {}
const users: Record<string, { userId: string; profileId: string }> = {}
let termId = ''

const login = async (email: string) => `${SESSION_COOKIE}=${(await auth.login(email, PASS)).token}`
const call = (method: 'GET' | 'POST', url: string, who: string, payload?: unknown) =>
  app.inject({ method, url, headers: { cookie: cookies[who] }, ...(payload !== undefined ? { payload: payload as never } : {}) })

const MODS = ['M1', 'M2', 'M3', 'M4']
const WEEKS = [['2026-12-06', '2026-12-12'], ['2026-12-13', '2026-12-19'], ['2026-12-20', '2026-12-26'], ['2026-12-27', '2027-01-08']]
/* الأحد ١٩:٠٠ بتوقيت عمّان كلَّ أسبوع */
const SUNDAYS = ['2026-12-06T16:00:00.000Z', '2026-12-13T16:00:00.000Z', '2026-12-20T16:00:00.000Z', '2026-12-27T16:00:00.000Z']
const h = (iso: string, n: number) => new Date(Date.parse(iso) + n * 3_600_000)

/** دورةٌ بلا مسارٍ عامّ — فئتُها من مسار الكتالوج (قيادة وريادة الأعمال)، ومستواها تطبيقيّ */
async function courseOf(tag: string) {
  const id = `C-TCX-${tag}-${STAMP % 1_000_000}`
  await prisma.course.create({ data: { id, status: 'published', currentVersion: 1, homePathwayId: 'PW-BIZ-001' } })
  await prisma.courseVersion.create({ data: { courseId: id, version: 1, titleAr: `دورة التعارض ${tag}`, levelAr: 'تطبيقي', totalHours: 16, status: 'published' } })
  return id
}

async function cohortOf(tag: string, who: string, courseId: string) {
  const content = {
    kind: 'trainer',
    modules: MODS.map((id) => ({ moduleId: id, titleAr: `محور ${id}`, outcomeAr: 'يحلّل حالةً', activityAr: 'يحلّ حالةً من سوقٍ أردنيّ', artifactAr: 'ورقةُ تحليل' })),
    resources: [],
    slots: MODS.map((id, i) => ({ moduleIds: [id], startsOn: WEEKS[i]![0], endsOn: WEEKS[i]![1] })),
    startsOn: '2026-12-06', endsOn: '2027-01-30',
  }
  const cohort = await prisma.cohort.create({
    data: {
      courseId, termId, title: `شعبة التعارض ${tag} ${STAMP}`, status: 'open', capacity: 20, deliveryMode: 'in_person',
      startsAt: new Date('2026-12-06T00:00:00.000Z'), endsAt: new Date('2027-01-30T00:00:00.000Z'),
      scheduleWindowStart: new Date('2026-12-05T21:00:00.000Z'), scheduleWindowEnd: new Date('2027-01-30T20:59:59.999Z'),
    },
  })
  await prisma.cohortTrainer.create({ data: { cohortId: cohort.id, profileId: users[who]!.profileId, role: 'lead' } })
  const plan = await prisma.cohortDeliveryPlan.create({
    data: { cohortId: cohort.id, trainerId: users[who]!.profileId, status: 'approved', submittedAt: new Date(), content: content as never },
  })
  for (const [i, s] of SUNDAYS.entries()) {
    await prisma.cohortSession.create({
      data: { cohortId: cohort.id, moduleId: MODS[i]!, moduleIds: [MODS[i]!], title: `لقاء ${tag} ${i + 1}`, startsAt: new Date(s), endsAt: h(s, 2), approvalState: 'approved' },
    })
  }
  return { cohortId: cohort.id, planId: plan.id }
}

interface View {
  clashesBefore: number
  rows: {
    cohortId: string; action: string; fromAr: string; toAr: string | null; held: boolean
    sent: { status: string; noteAr: string | null } | null
    mail: { to: string | null; subject: string; text: string; bellAr: string } | null
  }[]
}
const view = async (hold: string[] = []) => {
  const r = await call('GET', `/api/admin/terms/${termId}/clashes${hold.length ? `?hold=${hold.join(',')}` : ''}`, 'admin')
  expect(r.statusCode, r.body).toBe(200)
  return r.json() as View
}

let x: { cohortId: string; planId: string }
let y: { cohortId: string; planId: string }

beforeAll(async () => {
  await setupTestDb()
  prisma = await testPrisma()
  auth = new AuthService(prisma)
  app = await buildApp(prisma)
  const admin = await auth.register(`tc-admin-${STAMP}@test.local`, PASS, 'المعتمِد')
  await auth.setRoles(admin.userId, ['academic_manager'])
  cookies.admin = await login(`tc-admin-${STAMP}@test.local`)
  for (const [i, who] of ['a', 'b'].entries()) {
    const email = `tc-${who}-${STAMP}@test.local`
    const u = await auth.register(email, PASS, `مدرّب التعارض ${who}`)
    await auth.setRoles(u.userId, ['trainer'])
    const application = await prisma.trainerApplication.create({
      data: {
        reference: `WJ-TR-TC-${who}-${STAMP}`, email, fullName: `مدرّب التعارض ${who}`,
        phoneCountryCode: '+962', phone: `78${i + 1}${STAMP % 1000000}`, country: 'الأردن', status: 'active',
      },
    })
    users[who] = { userId: u.userId, profileId: (await prisma.trainerProfile.create({ data: { applicationId: application.id, userId: u.userId } })).id }
    cookies[who] = await login(email)
  }
  const term = await prisma.term.create({
    data: { year: 2200 + (STAMP % 500), season: 'nov_jan', titleAr: `فصل التعارض ${STAMP}`, startsOn: new Date('2026-11-29'), endsOn: new Date('2027-01-31') },
  })
  termId = term.id
  x = await cohortOf('س', 'a', await courseOf('X'))
  y = await cohortOf('ص', 'b', await courseOf('Y'))
  /* وفي ص طالبٌ اشترى على موعدها — فتبقى، وتنتقل س */
  const learner = await auth.register(`tc-learner-${STAMP}@test.local`, PASS, 'طالب')
  await prisma.enrollment.create({ data: { cohortId: y.cohortId, userId: learner.userId, status: 'enrolled' } })
}, 240_000)

describe('مواعيد الفصل بلا تعارض', () => {
  it('⚠️ ١) المعاينة تقول التعارض ولا تكتب شيئا — والتي بلا طلبة تنتقل في يومها', async () => {
    /* وجدولٌ مرفوضٌ من «جهّز جدولا» القديم ليس من هذه الشاشة: لا يُعرض «أرسل قبل»، ولا يُسقط موعدَه من المرشّحات */
    await prisma.planEditSuggestion.create({
      data: {
        cohortId: x.cohortId, planId: x.planId, batchId: randomUUID(), seq: 1, kind: 'schedule', step: 'sessions',
        reasonAr: 'لقاءاتك اليوم على 4 مواعيد مختلفة — نقترح الأحد 17:00 كلّ أسبوع',
        edit: { kind: 'schedule', weekday: 0, clock: '17:00', moves: [], tasks: [] }, status: 'rejected',
        noteAr: 'هذا اليوم لا يناسبني', createdBy: users.a!.userId,
      },
    })
    const v = await view()
    expect(v.clashesBefore).toBe(1)
    const rx = v.rows.find((r) => r.cohortId === x.cohortId)!
    const ry = v.rows.find((r) => r.cohortId === y.cohortId)!
    expect([ry.action, rx.action]).toEqual(['keep', 'move'])
    expect([rx.fromAr, rx.toAr]).toEqual(['الأحد 19:00', 'الأحد 17:00'])
    expect(rx.sent, 'عرض جدول المسار القديم كأنّه من هذه الشاشة').toBeNull()
    await prisma.planEditSuggestion.deleteMany({ where: { cohortId: x.cohortId } })
    expect(await prisma.planEditSuggestion.count({ where: { cohortId: { in: [x.cohortId, y.cohortId] } } }), 'كتبت المعاينة').toBe(0)
  })

  it('⚠️ والمعاينة تعرض البريد بنصه كما يرسل — ومن أبقيته خارج الإرسال يبقى، ويحسب ما حوله عليه', async () => {
    const rx = (await view()).rows.find((r) => r.cohortId === x.cohortId)!
    expect(rx.mail?.to).toBe(`tc-a-${STAMP}@test.local`)
    expect(rx.mail?.subject).toContain('موعد مقترح لشعبتك')
    expect(rx.mail?.text).toContain('الأحد 17:00 كل أسبوع')
    expect(rx.mail?.text).toContain('مدرّب التعارض a')
    expect(rx.mail?.bellAr).toContain('الأحد 17:00')
    expect((await view()).rows.find((r) => r.cohortId === y.cohortId)!.mail, 'بريد لمن لا ينتقل').toBeNull()
    /* أبقى س — فتنتقل ص بدلها، والمعاينةُ تقول ذلك قبل الإرسال */
    const held = await view([x.cohortId])
    const hx = held.rows.find((r) => r.cohortId === x.cohortId)!
    const hy = held.rows.find((r) => r.cohortId === y.cohortId)!
    expect([hx.held, hx.action, hy.action]).toEqual([true, 'keep', 'move'])
    expect(await prisma.planEditSuggestion.count({ where: { cohortId: { in: [x.cohortId, y.cohortId] } } }), 'كتبت المعاينة').toBe(0)
  })

  it('⚠️ ٢) الإرسال بطاقة عند مدرّبها معتمدة بإرسالها — وجرس يفتح «المراجعة»', async () => {
    const r = await call('POST', `/api/admin/terms/${termId}/clashes/send`, 'admin', {})
    expect(r.statusCode, r.body).toBe(200)
    expect((r.json() as { sent: number }).sent).toBe(1)
    const card = await prisma.planEditSuggestion.findFirstOrThrow({ where: { cohortId: x.cohortId } })
    expect([card.kind, card.status]).toEqual(['schedule', 'pending'])
    expect(card.reasonAr).toContain('«دورة التعارض Y»')
    const bell = await prisma.notification.findFirstOrThrow({ where: { userId: users.a!.userId, templateKey: 'cohort.schedule.proposed' } })
    expect(bell.data).toMatchObject({ cohortId: x.cohortId, step: 'review' })
    expect(await prisma.notification.count({ where: { userId: users.b!.userId, templateKey: 'cohort.schedule.proposed' } }), 'وصل من لا ينتقل').toBe(0)
    /* وإرسالٌ ثانٍ لا يكرّرها — عليها اقتراحٌ لم يقرّر فيه */
    const again = await call('POST', `/api/admin/terms/${termId}/clashes/send`, 'admin', {})
    expect((again.json() as { sent: number }).sent).toBe(0)
  })

  it('⚠️ ٣) يرفضه بسبب «اليوم» — فالاقتراح التالي في يوم آخر', async () => {
    const card = await prisma.planEditSuggestion.findFirstOrThrow({ where: { cohortId: x.cohortId, status: 'pending' } })
    const r = await call('POST', `/api/trainer/plan-edits/${card.id}/reject`, 'a', { noteAr: 'هذا اليوم لا يناسبني — عندي محاضرة' })
    expect(r.statusCode, r.body).toBe(200)
    const rx = (await view()).rows.find((row) => row.cohortId === x.cohortId)!
    expect(rx.sent).toMatchObject({ status: 'rejected', noteAr: 'هذا اليوم لا يناسبني — عندي محاضرة' })
    expect(rx.action).toBe('move')
    expect(rx.toAr!.startsWith('الأحد'), 'اقترح الأحد ثانية').toBe(false)
  })

  it('⚠️ ٤) وقبوله يكتب في خطّته المعتمدة — فلا يبقى تعارض', async () => {
    expect((await call('POST', `/api/admin/terms/${termId}/clashes/send`, 'admin', {})).statusCode).toBe(200)
    const card = await prisma.planEditSuggestion.findFirstOrThrow({ where: { cohortId: x.cohortId, status: 'pending' } })
    const r = await call('POST', `/api/trainer/plan-edits/${card.id}/accept`, 'a', {})
    expect(r.statusCode, r.body).toBe(200)
    const plan = await prisma.cohortDeliveryPlan.findUniqueOrThrow({ where: { id: x.planId } })
    expect(plan.status).toBe('approved')
    const v = await view()
    expect(v.clashesBefore).toBe(0)
    expect(v.rows.every((row) => row.action === 'keep')).toBe(true)
  })
})

describe('أوقات الدورات القريبة — يراها المدرب وهو يختار موعده', () => {
  it('⚠️ يرى لقاءات الدورة المربوطة بدورته باسمها وسببها — لا باسم مدربها', async () => {
    const r = await call('GET', `/api/trainer/cohorts/${x.cohortId}/nearby-times`, 'a')
    expect(r.statusCode, r.body).toBe(200)
    const { nearby } = r.json() as { nearby: { startsAt: string; courseTitleAr: string; whyAr: string }[] }
    expect(nearby.map((n) => n.startsAt)).toEqual(SUNDAYS.map((d) => new Date(d).toISOString()))
    expect(nearby.every((n) => n.courseTitleAr === 'دورة التعارض Y' && n.whyAr.includes('للفئة نفسها'))).toBe(true)
    expect(r.body).not.toContain('مدرّب التعارض b')
  })

  it('⚠️ ولا يقرأ أوقات شعبة غير مسندة إليه', async () => {
    expect((await call('GET', `/api/trainer/cohorts/${y.cohortId}/nearby-times`, 'a')).statusCode).toBe(403)
  })
})

