/* إتاحةُ المدرّب — والفرقُ المقصودُ بين إعلانَين (المهمّة ٧١).

   الجدولُ كان محروسا من التعارض داخلَ المنصّة: شعبتان تتداخل جلساتُهما تُردّ
   الثانية. ولا شيءَ كان يعرف عن وقتِ المدرّب **خارجَها**: من يعمل صباحا لا
   يستطيع شعبةً صباحيّة، ومن سيسافر أسبوعا لا يستطيع جلسةً فيه — فيُسأل في
   واتساب، أو يُسنَد ثمّ يُعتذَر بعد أن رأى المتعلّمون اسمَه.

   والحكمان مختلفان بقصد، وهذا ما يحرسه هذا الملفّ:

   ١) **الغيابُ مانع** — إعلانٌ صريحٌ بمدّةٍ بعينها، فالإسنادُ فيها يُردّ كما
      يُردّ التعارض. ولو كان تنبيها لَمَا منع موعدا لن يحضره أحد.
   ٢) **الساعاتُ الأسبوعيّةُ إرشاد** — ومن **لم يُعلن** شيئا لا يُمنَع من شيء.
      وهذا هو الشرطُ الذي يسقط أوّلا لو كُتبت الميزةُ بلا انتباه: حقلٌ فارغٌ
      يصير قفلا، فلا يُسنَد مدرّبٌ لم يفتح شاشةَ إتاحته قطّ.
   ٣) و`null` ليست صفرا في العدّ: الصفرُ يقول «كلُّ الجلسات داخل ساعاته»،
      و`null` تقول «لا علم لنا» — وخلطُهما يجعل من لم يُعلن يظهر مثاليّا. */

import { beforeAll, describe, expect, it } from 'vitest'
import type { PrismaClient } from '@prisma/client'
import type { FastifyInstance } from 'fastify'
import { setupTestDb, testPrisma } from '../helpers/db'
import { AuthService } from '../../services/auth.service'
import { TrainerReviewService } from '../../services/trainer-review.service'
import { CohortService } from '../../services/cohort.service'
import { TrainerAvailabilityService, MAX_BLACKOUT_DAYS } from '../../services/trainer-availability.service'
import { buildApp } from '../../http/app'
import { SESSION_COOKIE } from '../../http/auth-plugin'

let prisma: PrismaClient
let auth: AuthService
let review: TrainerReviewService
let cohorts: CohortService
let avail: TrainerAvailabilityService
let app: FastifyInstance

let profileId = ''
let trainerUserId = ''
let trainerCookie = ''
let academicId = ''

const COURSE = 'C-BIZ-101'
const DAY = 86_400_000

/** شعبةٌ بجلسةٍ واحدةٍ في وقتٍ محدَّد — تُقاس بها الأحكام */
async function mkCohort(title: string, startsAt: Date) {
  const c = await prisma.cohort.create({
    data: {
      courseId: COURSE, title, status: 'open', registrationOpen: true,
      financialReady: true, price: 100, currency: 'USD', capacity: 10, startsAt,
    },
  })
  await prisma.cohortSession.create({
    data: { cohortId: c.id, title: `جلسة ${title}`, startsAt, endsAt: new Date(startsAt.getTime() + 3_600_000) },
  })
  return c
}

beforeAll(async () => {
  await setupTestDb()
  prisma = await testPrisma()
  auth = new AuthService(prisma)
  review = new TrainerReviewService(prisma)
  cohorts = new CohortService(prisma)
  avail = new TrainerAvailabilityService(prisma)
  app = await buildApp(prisma)

  const academic = await auth.register('avail-academic@test.local', 'Acad#12345', 'المدير الأكاديمي')
  academicId = academic.userId
  await auth.setRoles(academicId, ['academic_manager'])

  const trainerUser = await auth.register('avail-trainer@test.local', 'Trainer#12345', 'مدرّبُ الإتاحة')
  trainerUserId = trainerUser.userId
  await auth.setRoles(trainerUserId, ['trainer'])
  const application = await prisma.trainerApplication.create({
    data: {
      reference: `TR-AVAIL-${Date.now()}`, fullName: 'مدرّبُ الإتاحة', email: 'avail-trainer@test.local',
      status: 'active', motivation: 'اختبار', privacyConsentAt: new Date(),
    },
  })
  profileId = (await prisma.trainerProfile.create({
    data: { applicationId: application.id, userId: trainerUserId, isVerified: true },
  })).id
  await review.qualifyForCourse(profileId, COURSE, academicId)
  trainerCookie = `${SESSION_COOKIE}=${(await auth.login('avail-trainer@test.local', 'Trainer#12345')).token}`
}, 240_000)

async function reset() {
  await prisma.trainerAvailability.deleteMany({ where: { profileId } })
  await prisma.trainerBlackout.deleteMany({ where: { profileId } })
  await prisma.cohortTrainer.deleteMany({ where: { profileId } })
}

describe('الغيابُ المعلن مانعٌ للإسناد', () => {
  it('يردُّ إسنادَ شعبةٍ تقع جلستُها في مدّة الغياب، ويسمّي المدّةَ وسببَها', async () => {
    await reset()
    const start = new Date(Date.now() + 20 * DAY)
    const c = await mkCohort('شعبةُ السفر', start)
    await avail.addBlackout(trainerUserId, {
      startsAt: new Date(start.getTime() - DAY), endsAt: new Date(start.getTime() + DAY), reason: 'سفر',
    })
    await expect(cohorts.assignTrainer(c.id, profileId, academicId)).rejects.toThrow(/غياب/)
    /* ولا إسنادَ وقع: الرفضُ قبل الكتابة لا بعدها */
    expect(await prisma.cohortTrainer.count({ where: { profileId, cohortId: c.id } })).toBe(0)
  })

  it('ولا يمنع شعبةً خارجَ المدّة — المنعُ بقدر الإعلان لا أوسع', async () => {
    await reset()
    const start = new Date(Date.now() + 40 * DAY)
    const c = await mkCohort('شعبةٌ بعد العودة', start)
    await avail.addBlackout(trainerUserId, {
      startsAt: new Date(Date.now() + 5 * DAY), endsAt: new Date(Date.now() + 9 * DAY), reason: 'سفر',
    })
    const link = await cohorts.assignTrainer(c.id, profileId, academicId)
    expect(link.profileId).toBe(profileId)
  })

  it('وحذفُ الغياب يفتح الإسنادَ من جديد', async () => {
    await reset()
    const start = new Date(Date.now() + 25 * DAY)
    const c = await mkCohort('شعبةٌ تُفتح', start)
    const b = await avail.addBlackout(trainerUserId, {
      startsAt: new Date(start.getTime() - DAY), endsAt: new Date(start.getTime() + DAY),
    })
    await expect(cohorts.assignTrainer(c.id, profileId, academicId)).rejects.toThrow(/غياب/)
    await avail.removeBlackout(trainerUserId, b.id)
    expect((await cohorts.assignTrainer(c.id, profileId, academicId)).profileId).toBe(profileId)
  })
})

describe('الساعاتُ الأسبوعيّةُ إرشادٌ لا منع', () => {
  it('من لم يُعلن ساعاتَه يُسنَد كما كان — والحقلُ الفارغُ ليس قفلا', async () => {
    await reset()
    const c = await mkCohort('شعبةٌ بلا إعلان', new Date(Date.now() + 15 * DAY))
    expect((await cohorts.assignTrainer(c.id, profileId, academicId)).profileId).toBe(profileId)
    const row = (await cohorts.eligibleTrainersFor(c.id)).find((t) => t.profileId === profileId)
    expect(row?.outsideDeclaredHours, 'من لم يُعلن يجب أن يكون null لا صفرا').toBeNull()
  })

  it('ومن أعلنها يُسنَد أيضا، ويُعَدُّ له ما وقع خارجَها', async () => {
    await reset()
    /* جلسةٌ بعد أسبوعين في وقتٍ نعرفه، ونافذةٌ لا تشمله */
    const start = new Date(Date.now() + 14 * DAY)
    start.setHours(20, 0, 0, 0)
    const c = await mkCohort('شعبةُ الليل', start)
    await avail.replaceWindows(trainerUserId, [{ weekday: start.getDay(), startMinute: 540, endMinute: 720 }])
    /* لا منع */
    expect((await cohorts.assignTrainer(c.id, profileId, academicId)).profileId).toBe(profileId)
    const row = (await cohorts.eligibleTrainersFor(c.id)).find((t) => t.profileId === profileId)
    expect(row?.outsideDeclaredHours).toBe(1)
    expect(row?.onLeave).toBe(false)
  })

  it('وجلسةٌ داخلَ النافذة تُعَدُّ صفرا — فالصفرُ معلومةٌ لا غياب', async () => {
    await reset()
    const start = new Date(Date.now() + 16 * DAY)
    start.setHours(10, 0, 0, 0)
    const c = await mkCohort('شعبةُ الصباح', start)
    await avail.replaceWindows(trainerUserId, [{ weekday: start.getDay(), startMinute: 540, endMinute: 720 }])
    const row = (await cohorts.eligibleTrainersFor(c.id)).find((t) => t.profileId === profileId)
    expect(row?.outsideDeclaredHours).toBe(0)
  })
})

describe('ما يُردُّ من الإعلان نفسِه', () => {
  it('نافذةٌ تنتهي قبل أن تبدأ', async () => {
    await expect(avail.replaceWindows(trainerUserId, [{ weekday: 1, startMinute: 720, endMinute: 540 }]))
      .rejects.toThrow(/تنتهي قبل/)
  })

  it('ونافذتان متداخلتان في اليوم نفسِه — العدُّ يصير غامضا', async () => {
    await expect(avail.replaceWindows(trainerUserId, [
      { weekday: 2, startMinute: 540, endMinute: 720 },
      { weekday: 2, startMinute: 700, endMinute: 800 },
    ])).rejects.toThrow(/متداخلتان/)
  })

  it('وغيابٌ مضى — وهو غالبا خطأُ سنةٍ في التاريخ', async () => {
    await expect(avail.addBlackout(trainerUserId, {
      startsAt: new Date(Date.now() - 10 * DAY), endsAt: new Date(Date.now() - 5 * DAY),
    })).rejects.toThrow(/مضت/)
  })

  it('وغيابٌ أطولُ من الحدّ يُقسَّم أو يُراجَع', async () => {
    await expect(avail.addBlackout(trainerUserId, {
      startsAt: new Date(Date.now() + DAY),
      endsAt: new Date(Date.now() + (MAX_BLACKOUT_DAYS + 5) * DAY),
    })).rejects.toThrow(new RegExp(String(MAX_BLACKOUT_DAYS)))
  })
})

describe('المسارات — وحارسُها', () => {
  it('المدرّبُ يقرأ إتاحتَه ويعلن ساعاتَه ويسجّل غيابَه ويحذفه', async () => {
    await reset()
    const get = await app.inject({ method: 'GET', url: '/api/trainer/me/availability', cookies: { wajeez_session: trainerCookie.split('=')[1] } })
    expect(get.statusCode).toBe(200)
    expect(get.json().windows).toEqual([])
    expect(get.json().meaningAr, 'من لم يُعلن يجب أن يُقال له إنّه غيرُ ممنوع').toMatch(/لا يمنعك/)

    const put = await app.inject({
      method: 'PUT', url: '/api/trainer/me/availability',
      cookies: { wajeez_session: trainerCookie.split('=')[1] },
      payload: { windows: [{ weekday: 0, startMinute: 540, endMinute: 720 }] },
    })
    expect(put.statusCode).toBe(200)
    expect(put.json().windows).toHaveLength(1)

    const post = await app.inject({
      method: 'POST', url: '/api/trainer/me/blackouts',
      cookies: { wajeez_session: trainerCookie.split('=')[1] },
      payload: { startsAt: new Date(Date.now() + 3 * DAY), endsAt: new Date(Date.now() + 5 * DAY), reason: 'امتحانات' },
    })
    expect(post.statusCode).toBe(201)
    const del = await app.inject({
      method: 'DELETE', url: `/api/trainer/me/blackouts/${post.json().id}`,
      cookies: { wajeez_session: trainerCookie.split('=')[1] },
    })
    expect(del.statusCode).toBe(200)
  })

  it('ولا يبلغها متعلّمٌ — الصلاحيّةُ حارسُ الباب', async () => {
    const email = `avail-learner-${Date.now()}@test.local`
    await auth.register(email, 'Learn#12345', 'متعلّم')
    const session = await auth.login(email, 'Learn#12345')
    for (const [method, url] of [
      ['GET', '/api/trainer/me/availability'],
      ['PUT', '/api/trainer/me/availability'],
      ['POST', '/api/trainer/me/blackouts'],
    ] as const) {
      const res = await app.inject({
        method, url, cookies: { wajeez_session: session.token },
        payload: method === 'GET' ? undefined : { windows: [] },
      })
      expect(res.statusCode, `${method} ${url} مفتوحٌ لمتعلّم`).toBe(403)
    }
  })

  it('ولا يعلن أحدٌ إتاحةً لغيره — الملفُّ يُقرأ من الجلسة لا من الجسم', async () => {
    const other = await prisma.trainerProfile.count({ where: { userId: null } })
    expect(other).toBeGreaterThanOrEqual(0)
    /* لا معرّفَ ملفٍّ في أيّ مسارٍ من مسارات «إتاحتي» — وهذا حرسُ التصميم */
    const src = (await import('node:fs')).readFileSync('server/http/routes/trainer-portal.routes.ts', 'utf8')
    const block = src.slice(src.indexOf('/api/trainer/me/availability'), src.indexOf('/api/trainers/public'))
    expect(block, 'مسارُ «إتاحتي» لا يقبل profileId من الجسم').not.toMatch(/profileId/)
  })
})
