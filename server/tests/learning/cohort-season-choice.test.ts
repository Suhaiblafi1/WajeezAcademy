/* اختيارُ الموسم لشعب الموسم الأوّل — على قاعدةٍ حقيقيّة (٢١ نوفمبر ٢٠٢٦).

   قرارُ صاحب المنصّة: كلُّ مدرّبٍ له شعبةٌ لم تبدأ تصله رسالةٌ واحدة، ويختار من صفحته: الربيعَ (أبريل–مايو ٢٠٢٧)، أو
   موسما لاحقا (يوليو–أغسطس أو أكتوبر–نوفمبر ٢٠٢٧)، أو الإلغاءَ بلا التزام. ومن لم يختر حتّى المهلة تُلغى شعبتُه («b»).
   ونصُّ الاتّفاقيّة «A»: نُعفيه من التزامات الشعبة ولا نقول إنّ اتّفاقيّته سقطت. فيُحرس:
   ① المعاينةُ شعبُ الموسم الجاري التي لم تبدأ، والمواسمُ الثلاثة — ولا ترسل شيئا؛
   ② الإرسالُ صفٌّ لكلّ شعبة، وبريدٌ واحدٌ وجرسٌ واحدٌ لكلّ مدرّب بجمل الرسالة، والإعادةُ لا تكرّر؛
   ③ كلُّ موسمٍ يزيح مواعيدَها كلَّها إلى داخل حدوده بأسابيعَ كاملةٍ ويربطها بفصله — وما ليس في القائمة يُردّ؛
   ④ الإلغاءُ يلغيها بسببٍ يقول إنّه اختاره، ولا يُكتب عليه استردادٌ ولا حسمٌ ولا يُمسّ ملفُّه؛
   ⑤ السكوتُ حتّى المهلة يلغيها العامل؛
   ⑥ لا يختار إلّا مدرّبُ الشعبة، ولا يرسل إلّا من له `cohort.manage`.

   والزمنُ ثابتٌ يُمرَّر (`now`) — فلا يتعلّق الحارسُ بيوم تشغيله. */

import { beforeAll, describe, expect as vexpect, it } from 'vitest'
import { plainExpect } from '../helpers/plain-expect'
const expect = plainExpect(vexpect)
import type { PrismaClient } from '@prisma/client'
import type { FastifyInstance } from 'fastify'
import { setupTestDb, testPrisma } from '../helpers/db'
import { AuthService } from '../../services/auth.service'
import { buildApp } from '../../http/app'
import { SESSION_COOKIE } from '../../http/auth-plugin'
import { TrainerReviewService } from '../../services/trainer-review.service'
import { CohortPostponeService, SEASON_CHOICE_MAIL_PURPOSE } from '../../services/cohort-postpone.service'
import { runCohortPostponeExpire } from '../../worker/jobs'
import { termBounds } from '../../../src/application/terms/season'
import {
  CANCEL_OPTION_AR, NO_OBLIGATION_AR, SEASON_CANCEL_REASON_AR, SEASON_EXPIRED_REASON_AR, seasonStartAt,
} from '../../../src/application/trainer/season-choice'
import type { TrainingSeason } from '../../../src/application/trainer/application-options'

let prisma: PrismaClient
let auth: AuthService
let app: FastifyInstance
const ACTOR = '00000000-0000-0000-0000-000000000019'
const COURSE = 'C-BIZ-101'
const STAMP = Date.now()
const PASS = 'Pass#12345'
const DAY = 86_400_000
const WEEK = 7 * DAY

/* السبت ٢١ نوفمبر ٢٠٢٦ صباحا، في موسم الشتاء ٢٠٢٦/٢٠٢٧ — والمهلةُ بعد أسبوع */
const NOW = new Date('2026-11-21T09:00:00Z')
const DEADLINE = new Date('2026-11-28T20:59:00Z')

interface Trainer { userId: string; profileId: string; email: string; name: string }
let A: Trainer
let B: Trainer
const ids: Record<string, string> = {}
const learners: Record<string, string> = {}
let seq = 0

async function trainer(name: string): Promise<Trainer> {
  const email = `sc-${++seq}-${STAMP}@test.local`
  const { profileId } = await new TrainerReviewService(prisma).createTrainerDirectly(ACTOR, { fullName: name, email })
  const userId = (await prisma.trainerProfile.findUniqueOrThrow({ where: { id: profileId } })).userId!
  return { userId, profileId, email, name }
}

/** شعبةٌ بثلاثة لقاءاتٍ أسبوعيّة ومتعلّم */
async function cohortAt(key: string, t: Trainer, firstAt: Date | null, status = 'open') {
  const c = await prisma.cohort.create({
    data: {
      courseId: COURSE, title: `شعبة ${key} ${STAMP}`, status,
      startsAt: firstAt, endsAt: firstAt ? new Date(firstAt.getTime() + 3 * WEEK) : null,
    },
  })
  await prisma.cohortTrainer.create({ data: { cohortId: c.id, profileId: t.profileId, role: 'lead' } })
  if (firstAt) {
    for (let i = 0; i < 3; i++) {
      await prisma.cohortSession.create({ data: { cohortId: c.id, title: `لقاء ${i + 1}`, startsAt: new Date(firstAt.getTime() + i * WEEK) } })
    }
  }
  const u = await prisma.user.create({ data: { email: `sc-l-${key}-${STAMP}@test.local`, passwordHash: 'x', displayName: 'متعلم' } })
  await prisma.enrollment.create({ data: { userId: u.id, cohortId: c.id, status: 'enrolled' } })
  ids[key] = c.id
  learners[key] = u.id
  return c
}

const svc = () => new CohortPostponeService(prisma)
const offerOf = (key: string) => prisma.cohortPostponeOffer.findFirstOrThrow({ where: { cohortId: ids[key], kind: 'season_choice' } })
const sessionsOf = (key: string) => prisma.cohortSession.findMany({ where: { cohortId: ids[key] }, orderBy: { startsAt: 'asc' } })

beforeAll(async () => {
  await setupTestDb()
  prisma = await testPrisma()
  auth = new AuthService(prisma)
  app = await buildApp(prisma)
  A = await trainer('مدرب الشعبتين')
  B = await trainer('مدرب الثلاث')
  /* الأحد ٦ ديسمبر ٢٠٢٦ السابعة مساء عمّان، والأربعاء ٢٠ يناير ٢٠٢٧ — شهرُ الشتاء الثالث */
  await cohortAt('A1', A, new Date('2026-12-06T16:00:00Z'))
  await cohortAt('A2', A, new Date('2027-01-20T15:00:00Z'))
  await cohortAt('B1', B, new Date('2026-12-14T17:00:00Z'))
  await cohortAt('B2', B, new Date('2027-01-05T16:00:00Z'))
  await cohortAt('B3', B, new Date('2026-12-21T16:00:00Z'))
  /* وما لا يُسأل عنه: ملغاةٌ، وشعبةٌ في الربيع أصلا */
  await cohortAt('cancelled', B, new Date('2026-12-08T16:00:00Z'), 'cancelled')
  await cohortAt('spring', B, new Date('2027-04-11T16:00:00Z'))
}, 240_000)

describe('① المعاينة', () => {
  it('⚠️ شعب الموسم الجاري التي لم تبدأ — والمواسم الثلاثة: الربيع ثم الصيف ثم الخريف 2027 — ولا ترسل شيئا', async () => {
    const p = await svc().seasonPreview(NOW)
    expect(p.source).toMatchObject({ year: 2026, season: 'nov_jan' })
    expect(p.choices.map((c) => `${c.season}-${c.year}`)).toEqual(['apr_may-2027', 'jul_aug-2027', 'oct_nov-2027'])
    expect(p.choices[0].optionAr).toBe('موسم الربيع — أبريل ومايو 2027')
    const mine = p.rows.filter((r) => Object.values(ids).includes(r.cohortId)).map((r) => r.cohortId)
    expect(mine.sort()).toEqual(['A1', 'A2', 'B1', 'B2', 'B3'].map((k) => ids[k]).sort())
    const a1 = p.rows.find((r) => r.cohortId === ids.A1)!
    expect(a1.blockedAr).toBeNull()
    expect(a1.targets[0].firstAt, 'أول لقاء في الربيع').toBe('2027-04-04T16:00:00.000Z')
    expect(await prisma.cohortPostponeOffer.count({ where: { cohortId: { in: Object.values(ids) } } }), 'المعاينة أرسلت').toBe(0)
    expect(await prisma.outboxMail.count({ where: { purpose: SEASON_CHOICE_MAIL_PURPOSE } })).toBe(0)
  })
})

describe('② الإرسال — رسالة واحدة لكل مدرب', () => {
  it('⚠️ صف لكل شعبة، وبريد واحد وجرس واحد لكل مدرب بجمل الرسالة كلها', async () => {
    const r = await svc().seasonSend(ACTOR, { cohortIds: ['A1', 'A2', 'B1', 'B2', 'B3'].map((k) => ids[k]), deadlineAt: DEADLINE }, NOW)
    expect(r).toMatchObject({ sent: 5, trainers: 2, emailed: 2, skipped: [] })

    for (const t of [A, B]) {
      const mails = await prisma.outboxMail.findMany({ where: { purpose: SEASON_CHOICE_MAIL_PURPOSE, to: t.email } })
      expect(mails, `${t.name}: بريد واحد`).toHaveLength(1)
      const m = mails[0]
      expect(m.subject).toBe('ما تعلمناه من موسمنا الأول، وما سنطلقه معك')
      for (const line of [
        `مرحبا ${t.name}،`,
        'شكرا لك. موسمنا الأول معك أعطانا دروسا واضحة، وبنينا عليها خطة الموسم القادم.',
        '1. الطالب يختار المدرب قبل الدورة. يريد أن يراك ويسمعك قبل أن يسجل.',
        '2. المواعيد المتغيرة تربك الطالب. يريد جدولا ثابتا يعرفه من البداية.',
        '3. الوصف العام لا يقنع. يريد أن يعرف بدقة ماذا سيستطيع أن يفعل في نهاية الدورة.',
        'مواعيد ثابتة (ديسمبر): جدول للأكاديمية تختار منه: سبت واثنين وأربعاء، أو أحد وثلاثاء وخميس، صباحا أو مساء، والجلسة 3 ساعات.',
        'حتى 3 دورات لكل مدرب: تختارها من أقوى ما تقدمه.',
        'خدمات جديدة: دورات مصغرة لمهارة واحدة في 4 ساعات، ومسارات، وجلسات كوتشنج فردية. ويمكنك التقدم لأي منها.',
        'موسم الربيع من 1 أبريل إلى 31 مايو 2027: بعد رمضان والعيد، ونبدأ تسويقه من يناير.',
        '1. أجلها إلى موسم الربيع — أبريل ومايو 2027.',
        '2. أجلها إلى موسم لاحق — يوليو وأغسطس، أو أكتوبر ونوفمبر 2027.',
        `3. ${CANCEL_OPTION_AR}`,
        'لا يترتب عليك أي التزام عن هذه الشعب، ولا شيء عليك إن اخترت الإلغاء.',
        'واتفاقيتك معنا: قد نغير بعض الأمور للموسم القادم، مثل الأسعار والمواعيد، فنضيفها ملحقا لاتفاقيتك. ونرسله لك في يناير لتوقعه إن رغبت في الاستمرار معنا.',
        'اختر من صفحتك قبل ',
        'وإن لم تختر لشعبة حتى هذا التاريخ تلغى.',
        'افتح شعبك:',
        'نعتز بك، ونتطلع لموسم أقوى معا.',
        'فريق أكاديمية وجيز',
      ]) expect(m.text, `${t.name}: «${line.slice(0, 40)}»`).toContain(line)
      expect(m.text).toContain('/trainer/board')
      expect(m.text, 'لا يقال إن الاتفاقية سقطت').not.toMatch(/باطل|ملغاة|انتهت اتفاقيتك|فسخ/)
      expect(m.text).not.toContain('عرضك')
      expect(m.html).toContain('افتح شعبك')
      const bells = await prisma.notification.findMany({ where: { userId: t.userId, templateKey: 'cohort.season_choice.proposed' } })
      expect(bells.map((b) => b.channel), `${t.name}: جرس واحد`).toEqual(['in_app'])
      expect(bells[0].body).toContain('تلغى الشعبة')
    }
    /* والرسالةُ تعدّ شعبَه كلَّها */
    const a = await prisma.outboxMail.findFirstOrThrow({ where: { purpose: SEASON_CHOICE_MAIL_PURPOSE, to: A.email } })
    expect(a.text).toContain(`شعبة A1 ${STAMP}`)
    expect(a.text).toContain(`شعبة A2 ${STAMP}`)
    expect(a.text).not.toContain(`شعبة B1 ${STAMP}`)
    expect(await prisma.auditEvent.count({ where: { action: 'cohort.season_choice.propose', entityId: { in: Object.values(ids) } } })).toBe(5)
    expect(await prisma.auditEvent.count({ where: { action: 'cohort.season_choice.send', actorId: ACTOR } })).toBe(1)
  })

  it('⚠️ ومدرب بشعبة واحدة يقرأ «شعبتك» ونص الشعبة الواحدة', async () => {
    const solo = await trainer('مدرب الشعبة الواحدة')
    await cohortAt('S1', solo, new Date('2026-12-10T16:00:00Z'))
    /* بمهلةٍ أبعدَ من مهلة الباقين — فيبقى ينتظر بعد أن يلغي العاملُ ما مضت مهلتُه (⑥) */
    expect((await svc().seasonSend(ACTOR, { cohortIds: [ids.S1], deadlineAt: new Date(DEADLINE.getTime() + 5 * DAY) }, NOW)).sent).toBe(1)
    const m = await prisma.outboxMail.findFirstOrThrow({ where: { purpose: SEASON_CHOICE_MAIL_PURPOSE, to: solo.email } })
    expect(m.text).toContain(`ومنها شعبة «شعبة S1 ${STAMP}». اختر ما يناسبك:`)
    expect(m.text).toContain(NO_OBLIGATION_AR)
    expect(m.text).toContain('وإن لم تختر حتى هذا التاريخ تلغى الشعبة.')
    expect(m.text).toContain('افتح شعبتك:')
  })

  it('⚠️ والإعادة لا تكرر — لا صف ولا بريد ولا جرس', async () => {
    const before = await prisma.outboxMail.count({ where: { purpose: SEASON_CHOICE_MAIL_PURPOSE } })
    const r = await svc().seasonSend(ACTOR, { cohortIds: ['A1', 'B1'].map((k) => ids[k]), deadlineAt: DEADLINE }, NOW)
    expect(r.sent).toBe(0)
    expect(r.skipped.map((s) => s.reasonAr)).toEqual(['أرسل لها سؤال ينتظر الرد', 'أرسل لها سؤال ينتظر الرد'])
    expect(await prisma.outboxMail.count({ where: { purpose: SEASON_CHOICE_MAIL_PURPOSE } })).toBe(before)
    expect(await prisma.notification.count({ where: { userId: A.userId, templateKey: 'cohort.season_choice.proposed' } })).toBe(1)
    expect(await prisma.cohortPostponeOffer.count({ where: { cohortId: ids.A1 } })).toBe(1)
  })

  it('⚠️ وما يراه المدرب: شعبه وأول لقاء في كل موسم', async () => {
    const mine = (await svc().mine(A.userId)).filter((o) => o.kind === 'season_choice')
    expect(mine.map((o) => o.cohortId).sort()).toEqual([ids.A1, ids.A2].sort())
    const a1 = mine.find((o) => o.cohortId === ids.A1)!
    expect(a1.options.map((o) => `${o.season}-${o.year}`)).toEqual(['apr_may-2027', 'jul_aug-2027', 'oct_nov-2027'])
    expect(a1.options[0].firstAt).toBe('2027-04-04T16:00:00.000Z')
  })
})

/** كلُّ لقاءاتها داخل الموسم، بيومها وساعتها، وأوّلُها في أسبوعه الأوّل */
async function landsIn(key: string, before: Date[], year: number, season: TrainingSeason) {
  const after = (await sessionsOf(key)).map((s) => s.startsAt)
  const start = seasonStartAt({ year, season })
  const end = termBounds(year, season).endsOn.getTime() + DAY
  const shift = after[0].getTime() - before[0].getTime()
  expect(shift % WEEK, `${key}: ليست أسابيع كاملة`).toBe(0)
  expect(after.map((d) => d.getTime()), `${key}: تفرقت المواعيد`).toEqual(before.map((d) => d.getTime() + shift))
  for (const d of after) {
    expect(d.getTime() >= start.getTime() && d.getTime() < end, `${key}: ${d.toISOString()} خارج ${season} ${year}`).toBe(true)
  }
  expect(after[0].getTime() - start.getTime() < WEEK, `${key}: أول لقاء ليس في أول أسبوع`).toBe(true)
  const c = await prisma.cohort.findUniqueOrThrow({ where: { id: ids[key] }, include: { term: true } })
  expect(c.term, `${key}: لم تربط بفصلها`).toMatchObject({ year, season })
  expect(c.startsAt!.getTime()).toBe(after[0].getTime())
  expect(c.status).toBe('open')
  const o = await offerOf(key)
  expect(o).toMatchObject({ status: 'accepted', chosenYear: year, chosenSeason: season })
  expect(o.toFirstAt!.getTime()).toBe(after[0].getTime())
  expect(await prisma.notification.count({ where: { userId: learners[key], channel: 'in_app', templateKey: 'cohort.schedule_changed' } })).toBe(1)
}

describe('③ كل موسم يزيحها إلى داخل حدوده ويربطها بفصله', () => {
  it('⚠️ الربيع — أبريل ومايو 2027', async () => {
    const before = (await sessionsOf('A1')).map((s) => s.startsAt)
    await svc().choose(A.userId, (await offerOf('A1')).id, { kind: 'season', year: 2027, season: 'apr_may' }, NOW)
    await landsIn('A1', before, 2027, 'apr_may')
    expect((await sessionsOf('A1'))[0].startsAt.toISOString()).toBe('2027-04-04T16:00:00.000Z')
    expect(await prisma.auditEvent.count({ where: { action: 'cohort.season_choice.choose', entityId: ids.A1 } })).toBe(1)
  })

  it('⚠️ الصيف — يوليو وأغسطس 2027، ولو كانت في شهر الشتاء الثالث', async () => {
    const before = (await sessionsOf('A2')).map((s) => s.startsAt)
    await svc().choose(A.userId, (await offerOf('A2')).id, { kind: 'season', year: 2027, season: 'jul_aug' }, NOW)
    await landsIn('A2', before, 2027, 'jul_aug')
  })

  it('⚠️ الخريف — أكتوبر ونوفمبر 2027', async () => {
    const before = (await sessionsOf('B1')).map((s) => s.startsAt)
    await svc().choose(B.userId, (await offerOf('B1')).id, { kind: 'season', year: 2027, season: 'oct_nov' }, NOW)
    await landsIn('B1', before, 2027, 'oct_nov')
  })

  it('⚠️ وما ليس في القائمة يرد، وما حسم لا يحسم ثانية', async () => {
    const o = await offerOf('B2')
    await expect(svc().choose(B.userId, o.id, { kind: 'season', year: 2028, season: 'jan_feb' }, NOW)).rejects.toThrow(/من القائمة/)
    expect((await offerOf('B2')).status).toBe('pending')
    await expect(svc().choose(A.userId, (await offerOf('A1')).id, { kind: 'cancel' }, NOW)).rejects.toThrow(/حسم/)
    expect((await prisma.cohort.findUniqueOrThrow({ where: { id: ids.A1 } })).status).toBe('open')
  })
})

describe('④ الإلغاء باختياره — بلا التزام ولا استرداد', () => {
  it('⚠️ تلغى بسبب يقول إنه اختاره، ويصل متعلميها الخبر — ولا يكتب عليه شيء', async () => {
    const auditBefore = new Date()
    const rolesBefore = await prisma.userRole.findMany({ where: { userId: B.userId }, select: { roleId: true } })
    const appStatus = async () => (await prisma.trainerProfile.findUniqueOrThrow({ where: { id: B.profileId }, include: { application: true } })).application.status
    const statusBefore = await appStatus()
    await svc().choose(B.userId, (await offerOf('B2')).id, { kind: 'cancel' }, NOW)
    expect((await prisma.cohort.findUniqueOrThrow({ where: { id: ids.B2 } })).status).toBe('cancelled')
    expect((await offerOf('B2')).status).toBe('declined')
    expect(await prisma.notification.count({ where: { userId: learners.B2, channel: 'in_app', templateKey: 'cohort.cancelled' } })).toBe(1)
    const told = (await prisma.notification.findMany({ where: { userId: B.userId, templateKey: 'cohort.cancelled.trainer' } }))
      .filter((n) => (n.data as { cohortId?: string } | null)?.cohortId === ids.B2)
    expect(told.length).toBeGreaterThan(0)
    expect(told[0].body).toContain('اختار المدرب إلغاءها')
    const reason = await prisma.auditEvent.findFirstOrThrow({ where: { action: 'cohort.cancel.reason', entityId: ids.B2 } })
    expect((reason.meta as { reasonAr?: string }).reasonAr).toBe(SEASON_CANCEL_REASON_AR)
    const choose = await prisma.auditEvent.findFirstOrThrow({ where: { action: 'cohort.season_choice.choose', entityId: ids.B2 } })
    expect(choose.meta).toMatchObject({ choice: 'cancel', obligationsWaived: true })

    /* لا استردادَ ولا حسمَ ولا كشفَ عليه (البند 6-4 لا يسري) — ولا يُمسّ ملفُّه ولا دورُه ولا إسنادُه */
    expect(await prisma.trainerPayout.count({ where: { profileId: B.profileId } })).toBe(0)
    const after = await prisma.auditEvent.findMany({ where: { createdAt: { gte: auditBefore } }, select: { action: true } })
    expect(after.map((e) => e.action).filter((a) => /payout|recover|penalt|charge|deduct|withdrawal/i.test(a)), 'كتب عليه شيء').toEqual([])
    const profile = await prisma.trainerProfile.findUniqueOrThrow({ where: { id: B.profileId } })
    expect(profile.suspendedAt).toBeNull()
    expect(await appStatus(), 'تغير حال ملفه').toBe(statusBefore)
    expect(await prisma.userRole.findMany({ where: { userId: B.userId }, select: { roleId: true } })).toEqual(rolesBefore)
    expect(await prisma.cohortTrainer.count({ where: { cohortId: ids.B2, profileId: B.profileId } })).toBe(1)
  })
})

describe('⑤ السكوت حتى المهلة يلغيها', () => {
  it('⚠️ قبل المهلة لا شيء، وبعدها يلغيها العامل بسببها', async () => {
    const first = (await sessionsOf('B3'))[0].startsAt
    await runCohortPostponeExpire(prisma, new Date(DEADLINE.getTime() - 60_000))
    expect((await prisma.cohort.findUniqueOrThrow({ where: { id: ids.B3 } })).status, 'ألغاها قبل المهلة').toBe('open')

    await runCohortPostponeExpire(prisma, new Date(DEADLINE.getTime() + 60_000))
    expect((await prisma.cohort.findUniqueOrThrow({ where: { id: ids.B3 } })).status).toBe('cancelled')
    expect((await offerOf('B3')).status).toBe('expired')
    expect(await prisma.auditEvent.count({ where: { action: 'cohort.season_choice.expire', entityId: ids.B3 } })).toBe(1)
    const reason = await prisma.auditEvent.findFirstOrThrow({ where: { action: 'cohort.cancel.reason', entityId: ids.B3 } })
    expect((reason.meta as { reasonAr?: string }).reasonAr).toBe(SEASON_EXPIRED_REASON_AR)
    expect(await prisma.notification.count({ where: { userId: learners.B3, channel: 'in_app', templateKey: 'cohort.cancelled' } })).toBe(1)
    expect((await sessionsOf('B3'))[0].startsAt.getTime(), 'السكوت أزاحها').toBe(first.getTime())
    /* وبعد المهلة لا يختار */
    await expect(svc().choose(B.userId, (await offerOf('B3')).id, { kind: 'cancel' }, new Date(DEADLINE.getTime() + 120_000)))
      .rejects.toThrow(/حسم/)
  })
})

describe('⑥ من يختار ومن يرسل', () => {
  it('⚠️ لا يختار إلا مدرب الشعبة — ولا يرد على سؤال الموسم بزري التأجيل', async () => {
    const o = await offerOf('S1')
    await expect(svc().choose(B.userId, o.id, { kind: 'cancel' }, NOW)).rejects.toThrow(/ليست من شعبك/)
    await expect(svc().choose(ACTOR, o.id, { kind: 'cancel' }, NOW)).rejects.toThrow(/ليست من شعبك/)
    expect((await offerOf('S1')).status).toBe('pending')
  })

  it('⚠️ ولا يرسل ولا يعاين إلا من له cohort.manage — والمدرب يختار من بابه وحده', async () => {
    const login = async (role: string) => {
      const email = `sc-${role}-${STAMP}@test.local`
      const u = await auth.register(email, PASS, role)
      await auth.setRoles(u.userId, [role])
      return `${SESSION_COOKIE}=${(await auth.login(email, PASS)).token}`
    }
    const finance = await login('finance')
    const manager = await login('academic_manager')
    const post = (cookie: string) => app.inject({
      method: 'POST', url: '/api/admin/cohort-season-choices', headers: { cookie }, payload: { cohortIds: [], deadlineAt: DEADLINE.toISOString() },
    })
    expect((await post(finance)).statusCode, 'المالية أرسلت').toBe(403)
    expect((await app.inject({ method: 'GET', url: '/api/admin/cohort-season-choices/preview', headers: { cookie: finance } })).statusCode).toBe(403)
    /* ومن له الصلاحيةُ يمرّ من الباب — ويُردّ طلبُه الفارغ بالتحقّق لا بالصلاحيّة */
    expect((await post(manager)).statusCode).toBe(422)

    expect((await post(await login('trainer'))).statusCode, 'المدرب أرسل').toBe(403)
  })
})
