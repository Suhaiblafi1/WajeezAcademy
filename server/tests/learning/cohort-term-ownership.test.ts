/* ═══ الفصلُ حقيقةٌ إداريّةٌ تُسمَّى عند الإسناد ═══

   في ١٥ سبتمبر ٢٠٢٦ قال صاحبُ المنصّة: «يجب أن يكون هنا تحديدُ الفصل أوّلا،
   ويتمّ تقييدُ المدرّب بتحديد الأوقات ضمنَ أشهر الفصل نفسِه». فقُرئت
   «تحديد» اختيارا، وبُنيت للمدرّب شبكةُ فصولٍ ينقر فيها.

   وفي ١٧ سبتمبر صحّح: المقصودُ أنّ الإدارةَ **قد اعتمدت** الدورةَ في فصلٍ
   فيتقيّد به. وصاغ الفعلَ بنفسه: «عندما نقوم بإسناد دورةٍ لمدرّب نحدّد لأيّ
   فصلٍ ستكون، وبهذا نكون فتحنا شعبةً له».

   ═══ وما يُقاس هنا ═══

   ① **البابُ الإداريُّ يعمل**: دورةٌ + مدرّبٌ + فصلٌ = شعبةٌ مفتوحةٌ
     ونافذةُ جدولةٍ مفتوحةٌ ومدرّبٌ مُسنَد، في فعلٍ واحد.
   ② **وما لم يتمّ كلُّه لم يقع منه شيء**: مدرّبٌ غيرُ مؤهَّلٍ لا يترك
     خلفَه شعبةً يتيمةً بلا مدرّب.
   ③ **والشعبُ القائمةُ تُسمَّى فصولُها** بمسلكٍ إداريّ، ومنه تُفتح نافذتُها.
   ④ **والمحبوسُ يُرى**: شعبةٌ لها مدرّبٌ ولا فصلَ لها تظهر في طابورٍ —
     وهذا وحدَه ما يمنع أن يصير نقلُ الملكيّة حبسا صامتا.
   ⑤ **والفصلُ صار اختياريّا عند الفتح (٣ج-٥)**: المدّةُ للمدرّب، والفصلُ يُشتقّ
     من تاريخ بدئها حين تُعتمَد. فتُفتح الشعبةُ بلا فصلٍ ويُسنَد مدرّبُها، وحفظُ
     مدّته يفتح نافذتَه — من الخدمة ومن المسلك معا.

   ولا يُقاس بقراءة نصّ: العطبُ كان في **وصل** القاعدة بالخادم، لا في
   القاعدة. */

import { beforeAll, describe, expect, it } from 'vitest'
import type { PrismaClient } from '@prisma/client'
import { setupTestDb, testPrisma } from '../helpers/db'
import { CohortService } from '../../services/cohort.service'
import { TermService } from '../../services/term.service'
import { CohortPlanService } from '../../services/cohort-plan.service'
import { AuthService } from '../../services/auth.service'
import { buildApp } from '../../http/app'
import { SESSION_COOKIE } from '../../http/auth-plugin'
import { zonedDay } from '../../../src/application/trainer/cohort-period'

let prisma: PrismaClient
let cohorts: CohortService
let adminId = ''
let profileId = ''
let trainerUserId = ''
let otherProfileId = ''
let termId = ''
const COURSE = 'C-BIZ-101'

async function makeTrainer(tag: string, qualify: boolean) {
  const u = await prisma.user.create({
    data: { email: `to-${tag}-${Date.now()}@wajeez.test`, displayName: `مدرّب ${tag}`, passwordHash: 'x' },
  })
  const application = await prisma.trainerApplication.create({
    data: { reference: `WJ-TR-TO-${tag}-${Date.now()}`, fullName: `مدرّب ${tag}`, email: u.email, status: 'active' },
  })
  const profile = await prisma.trainerProfile.create({ data: { userId: u.id, applicationId: application.id } })
  if (qualify) {
    await prisma.trainerCourseQualification.create({
      data: { profileId: profile.id, courseId: COURSE, status: 'qualified' },
    })
  }
  return { profileId: profile.id, userId: u.id }
}

beforeAll(async () => {
  await setupTestDb()
  prisma = await testPrisma()
  cohorts = new CohortService(prisma)

  const admin = await prisma.user.create({
    data: { email: `to-admin-${Date.now()}@wajeez.test`, displayName: 'مديرُ الأكاديميّة', passwordHash: 'x' },
  })
  adminId = admin.id
  const lead = await makeTrainer('qualified', true)
  profileId = lead.profileId
  trainerUserId = lead.userId
  otherProfileId = (await makeTrainer('unqualified', false)).profileId

  /* ⚠️ سنةٌ بعيدةٌ بقصد: هجرةُ `term_system` تبذر فصولَ **السنة الجارية
     والتي تليها** بمواسمها الأربعة، وقاعدةُ الاختبار تحملها. فصفٌّ بسنةٍ
     قريبةٍ يصطدم بـ`@@unique([year, season])` ويسقط الملفُّ كلُّه في
     `beforeAll` — وهو ما وقع. والسنةُ الجاريةُ تتحرّك، فلا يُحلّ بسنةٍ
     أخرى قريبة. */
  const term = await prisma.term.create({
    data: {
      titleAr: 'موسمُ الشتاء ٢٠٧١', season: 'nov_jan', year: 2071,
      startsOn: new Date('2071-11-01T00:00:00.000Z'),
      endsOn: new Date('2072-01-31T00:00:00.000Z'),
      status: 'open',
    },
  })
  termId = term.id
})

describe('① بابُ الإدارة: فعلٌ واحدٌ يفتح الشعبة', () => {
  let openedId = ''

  it('⚠️ دورةٌ ومدرّبٌ وفصلٌ — فتُفتح الشعبةُ ونافذتُها ويُسنَد مدرّبُها', async () => {
    const out = await cohorts.openForTrainer(adminId, {
      courseId: COURSE, profileId, termId, title: 'الدفعةُ الأولى · مساءُ الأحد',
    })
    openedId = out.cohortId

    const row = await prisma.cohort.findUniqueOrThrow({
      where: { id: openedId },
      include: { trainers: true },
    })
    expect(row.termId, 'فُتحت شعبةٌ بلا فصل — وهي الحالةُ التي أُلغيت').toBe(termId)
    /* وحدودُها من حدود الفصل: الكتالوجُ العامُّ وصفحةُ التسجيل يقرآن `startsAt` */
    expect(row.startsAt?.toISOString()).toBe('2071-11-01T00:00:00.000Z')
    expect(row.endsAt?.toISOString()).toBe('2072-01-31T00:00:00.000Z')
    expect(row.trainers, 'أُنشئت الشعبةُ ولم يُسنَد مدرّبُها').toHaveLength(1)
    expect(row.trainers[0].profileId).toBe(profileId)
  })

  it('⚠️ ومدرّبُها يجدول من فوره — لا ينتظر إذنا ثانيا', async () => {
    /* هذا هو معنى «وبهذا نكون فتحنا شعبةً له»: الفتحُ عملٌ لا إعلان. */
    const win = await cohorts.scheduleWindowFor(trainerUserId, openedId)
    expect(win.open, 'فُتحت الشعبةُ والنافذةُ مغلقة').toBe(true)
    expect(win.mine).toBe(true)
  })

  it('⚠️ وما لم يتمّ كلُّه لم يقع منه شيء — لا شعبةَ يتيمةٌ خلف إخفاق', async () => {
    const before = await prisma.cohort.count()
    await expect(cohorts.openForTrainer(adminId, {
      courseId: COURSE, profileId: otherProfileId, termId, title: 'شعبةٌ لمدرّبٍ غيرِ مؤهَّل',
    })).rejects.toMatchObject({ code: 'not_qualified' })
    expect(await prisma.cohort.count(), 'بقيت شعبةٌ بلا مدرّبٍ بعد إخفاق الإسناد').toBe(before)
  })

  /* ⚠️ كان الفصلُ يُنهى هنا بـ`prisma.term.create({ status: 'closed' })` —
     أي بحالةٍ لم يكن في المنصّة كلِّها سطرٌ يكتبها، فالحارسُ أخضرُ على ما
     لا يقع في الإنتاج. وصار له بابٌ (`TermService.setStatus`)، فيُنهى منه. */
  it('وفصلٌ أُنهي من بابه لا تُفتح فيه شعبة', async () => {
    const closed = await prisma.term.create({
      data: {
        titleAr: 'موسمٌ يُنهى', season: 'feb_apr', year: 2072,
        startsOn: new Date('2072-02-01T00:00:00.000Z'),
        endsOn: new Date('2072-04-30T00:00:00.000Z'),
      },
    })
    const terms = new TermService(prisma)
    await terms.setStatus(adminId, closed.id, 'open')
    await terms.setStatus(adminId, closed.id, 'closed')
    expect((await prisma.term.findUniqueOrThrow({ where: { id: closed.id } })).status,
      'لم يُنهِ البابُ الفصلَ أصلا').toBe('closed')

    await expect(cohorts.openForTrainer(adminId, {
      courseId: COURSE, profileId, termId: closed.id, title: 'شعبةٌ في موسمٍ منتهٍ',
    })).rejects.toMatchObject({ code: 'term_closed' })
  })
})

describe('② والشعبُ القائمةُ تُسمَّى فصولُها من عند الإدارة', () => {
  let legacyId = ''

  it('يُهيَّأ: شعبةٌ قديمةٌ بلا فصلٍ ولها مدرّب', async () => {
    const c = await cohorts.create(adminId, { courseId: COURSE, title: 'شعبةٌ وُلدت قبل القرار' })
    legacyId = c.id
    expect(c.termId, 'شعبةٌ بلا فصلٍ حالةٌ مشروعة — «لم تُفتَح بعد»').toBeNull()
    await cohorts.assignTrainer(legacyId, profileId, adminId, 'lead')
  })

  /* ═══ وكان هنا: «ومدرّبُها محبوسٌ حتّى يُسمَّى الفصل» ═══

     صارت المدّةُ للمدرّب (٢٧ سبتمبر ٢٠٢٦): يحدّدها في خطّته فتُفتح نافذتُه
     لحظةَ الحفظ — ولا ينتظر تسمية الفصل. فالنافذةُ مغلقةٌ هنا لأنّ أحدا لم
     يحدّد مدّةً ولم يُسمِّ فصلا بعد، لا لأنّه محبوسٌ دون بابٍ ليس بيده.
     وفتحُها بمدّته يقيسه `server/tests/trainer/cohort-plan.test.ts`. */
  it('⚠️ ونافذتُها مغلقةٌ ما لم تُحدَّد مدّةٌ ولم يُسمَّ فصل', async () => {
    const win = await cohorts.scheduleWindowFor(trainerUserId, legacyId)
    expect(win.open, 'شعبةٌ بلا مدّةٍ ولا فصلٍ فتحت نافذةَ جدولة').toBe(false)
  })

  it('⚠️ فتُسمّيه الإدارةُ — ومنه حدودُها ونافذتُها', async () => {
    await cohorts.setTerm(adminId, legacyId, termId)
    const row = await prisma.cohort.findUniqueOrThrow({ where: { id: legacyId } })
    expect(row.termId).toBe(termId)
    expect(row.scheduleWindowStart?.toISOString()).toBe('2071-11-01T00:00:00.000Z')

    const win = await cohorts.scheduleWindowFor(trainerUserId, legacyId)
    expect(win.open, 'سُمّي الفصلُ والنافذةُ ما زالت مغلقة').toBe(true)
  })

  it('ولقاءٌ خارجَ الفصل يمنع تسميتَه — ولا يُترك موعدٌ معلَنٌ خارجَ شعبته', async () => {
    const c = await cohorts.create(adminId, { courseId: COURSE, title: 'شعبةٌ فيها لقاءٌ شاردٌ' })
    await prisma.cohortSession.create({
      data: { cohortId: c.id, title: 'الجلسة ١', startsAt: new Date('2026-05-01T15:00:00.000Z') },
    })
    await expect(cohorts.setTerm(adminId, c.id, termId))
      .rejects.toMatchObject({ code: 'sessions_outside_term' })
  })
})

/* ═══ ③ وما بلا فصلٍ يُرى — ولم يعد «يحبس» أحدا (٢٧ سبتمبر ٢٠٢٦) ═══

   كان وسمُ `blocksTrainer` يقول للإدارة إنّ مدرّبا محبوسٌ لا يجدول حتّى
   يُسمَّى الفصل. وصار المدرّبُ يحدّد مدّتَه فتُفتح جدولتُه — فسقط الوسمُ،
   وبقي الطابورُ يسرد الشعبَ بلا فصلٍ لمن يريد أن يسمّيها. */
describe('③ وما بلا فصلٍ يُرى في طابوره', () => {
  it('⚠️ شعبةٌ لها مدرّبٌ ولا فصلَ لها تظهر في الطابور — بلا وسمِ حبسٍ لا يقع', async () => {
    const c = await cohorts.create(adminId, { courseId: COURSE, title: 'شعبةٌ بلا فصل' })
    await cohorts.assignTrainer(c.id, profileId, adminId, 'lead')

    const queue = await cohorts.cohortsWithoutTerm()
    const mine = queue.find((q) => q.id === c.id)
    expect(mine, 'الشعبةُ بلا فصلٍ لا تظهر لأحدٍ في الإدارة').toBeTruthy()
    expect('blocksTrainer' in mine!, 'عاد وسمُ «تحبس مدرّبَها» — والمدرّبُ يفتح نافذتَه بمدّته').toBe(false)
    expect(mine!.courseTitleAr, 'اسمُ الدورة لا يُقرأ — فلا يُعرف ما هي').toBeTruthy()
  })

  it('وما سُمّي فصلُه يخرج من الطابور', async () => {
    const c = await cohorts.create(adminId, { courseId: COURSE, title: 'شعبةٌ تُسمَّى الآن' })
    await cohorts.setTerm(adminId, c.id, termId)
    const queue = await cohorts.cohortsWithoutTerm()
    expect(queue.map((q) => q.id), 'بقيت في طابور «بلا فصل» بعد تسميتها').not.toContain(c.id)
  })
})

describe('⑤ والفصلُ اختياريٌّ عند الفتح — يُشتقّ من مدّة المدرّب (٣ج-٥)', () => {
  const DAY = 86_400_000
  const day = (n: number) => zonedDay(new Date(Date.now() + n * DAY))

  it('⚠️ بلا فصل: تُفتح الشعبةُ ويُسنَد مدرّبُها — ونافذتُه تفتحها مدّتُه لا فصلٌ يُنتظر', async () => {
    const out = await cohorts.openForTrainer(adminId, { courseId: COURSE, profileId, title: 'شعبةٌ تُفتح بلا فصل' })
    expect(out.term).toBeNull()
    const row = await prisma.cohort.findUniqueOrThrow({ where: { id: out.cohortId }, include: { trainers: true } })
    expect(row.termId).toBeNull()
    expect(row.startsAt, 'حدودٌ لُفّقت لشعبةٍ لم يحدّد أحدٌ مدّتَها').toBeNull()
    expect(row.trainers.map((t) => t.profileId)).toEqual([profileId])

    expect((await cohorts.scheduleWindowFor(trainerUserId, out.cohortId)).open).toBe(false)
    await new CohortPlanService(prisma).savePlan(trainerUserId, out.cohortId, {
      kind: 'trainer', modules: [], resources: [], startsOn: day(10), endsOn: day(40),
    })
    expect((await cohorts.scheduleWindowFor(trainerUserId, out.cohortId)).open, 'حفظُ مدّته لم يفتح نافذتَه').toBe(true)
  })

  it('⚠️ والمسلكُ يقبل الفتحَ بلا فصل — والفصلُ الغريبُ يُردّ كما كان', async () => {
    const app = await buildApp(prisma)
    const auth = new AuthService(prisma)
    const email = `to-super-${Date.now()}@test.local`
    const sa = await auth.register(email, 'Super#12345', 'مديرُ النظام')
    await auth.setRoles(sa.userId, ['super_admin'])
    const cookie = `${SESSION_COOKIE}=${(await auth.login(email, 'Super#12345')).token}`
    const res = await app.inject({
      method: 'POST', url: '/api/admin/cohorts/open-for-trainer', headers: { cookie },
      payload: { courseId: COURSE, profileId, title: 'شعبةٌ من المسلك بلا فصل' },
    })
    expect(res.statusCode).toBe(201)
    const opened = await prisma.cohort.findUniqueOrThrow({ where: { id: res.json().cohortId } })
    expect(opened.termId).toBeNull()

    const ghost = await app.inject({
      method: 'POST', url: '/api/admin/cohorts/open-for-trainer', headers: { cookie },
      payload: { courseId: COURSE, profileId, title: 'فصلٌ لا وجودَ له', termId: '00000000-0000-4000-8000-000000000000' },
    })
    expect(ghost.statusCode).toBe(404)
  }, 120_000)
})
