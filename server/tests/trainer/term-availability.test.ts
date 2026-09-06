/* «فصولي» — إعلانُ المدرّب عن نفسه (البند ٥٣).

   ─────────── ما كان ───────────

   `TrainerTermAvailability` وُلدت بثلاث حالات — `declared` و`confirmed`
   و`declined` — ولم يكن للمدرّب **بابٌ واحدٌ** يبلغ أيّا منها: المسلكُ
   الوحيدُ الذي يكتبها محروسٌ بـ`trainer.assign`. أي أنّ الإدارةَ تُعلن
   نيابةً عنه، وقائمةُ «المتاحون لهذا الفصل» تبقى ما ورّثه الترحيلُ من
   مواسمَ كتبها في طلبه قبل شهور — لا ما يقوله هو اليوم.

   ─────────── وما يُحرَس هنا ───────────

   الحارسُ الأوّلُ ليس أنّ البابَ يعمل، بل **أنّه بابُ صاحبه وحدَه**: الملفُّ
   يُشتقّ من الجلسة لا من الطلب، فلا يُعلن أحدٌ نيابةً عن غيره. وهذا هو ما
   يسقط أوّلا لو كُتب المسلكُ بلا انتباه — `profileId` في المسار بدل الجلسة.

   والثاني أنّ الإعلانَ **يُقرأ حيث يُبنى عليه**: من اعتذر يخرج من قائمة
   المتاحين، ومن أكّد يبقى. وإعلانٌ لا يُقرأ زينةٌ في القاعدة. */

import { beforeAll, describe, expect, it } from 'vitest'
import type { PrismaClient } from '@prisma/client'
import type { FastifyInstance } from 'fastify'
import { setupTestDb, testPrisma } from '../helpers/db'
import { AuthService } from '../../services/auth.service'
import { TrainerReviewService } from '../../services/trainer-review.service'
import { TermService } from '../../services/term.service'
import { buildApp } from '../../http/app'
import { SESSION_COOKIE } from '../../http/auth-plugin'

let prisma: PrismaClient
let auth: AuthService
let review: TrainerReviewService
let terms: TermService
let app: FastifyInstance

let academicId = ''
let termId = ''
let mineProfileId = ''
let mineCookie = ''
let othersProfileId = ''

const COURSE = 'C-BIZ-101'
const DAY = 86_400_000

/** مدرّبٌ نشطٌ مؤهَّلٌ للدورة — بأقصر طريقٍ صادق */
async function makeTrainer(email: string, name: string) {
  const { userId } = await auth.register(email, 'Trainer#12345', name)
  await auth.setRoles(userId, ['trainer'])
  const application = await prisma.trainerApplication.create({
    data: {
      reference: `TR-TERM-${Date.now()}-${Math.random()}`, fullName: name, email,
      status: 'active', motivation: 'اختبار', privacyConsentAt: new Date(),
    },
  })
  const profile = await prisma.trainerProfile.create({
    data: { applicationId: application.id, userId, isVerified: true },
  })
  await review.qualifyForCourse(profile.id, COURSE, academicId)
  const { token } = await auth.login(email, 'Trainer#12345')
  return { userId, profileId: profile.id, cookie: `${SESSION_COOKIE}=${token}` }
}

beforeAll(async () => {
  await setupTestDb()
  prisma = await testPrisma()
  auth = new AuthService(prisma)
  review = new TrainerReviewService(prisma)
  terms = new TermService(prisma)
  app = await buildApp(prisma)

  const academic = await auth.register('term-acad@test.local', 'Acad#12345', 'المدير الأكاديمي')
  academicId = academic.userId
  await auth.setRoles(academicId, ['academic_manager'])

  const mine = await makeTrainer('term-mine@test.local', 'مدرّبُ الفصول')
  mineProfileId = mine.profileId
  mineCookie = mine.cookie
  const others = await makeTrainer('term-others@test.local', 'مدرّبٌ آخر')
  othersProfileId = others.profileId

  termId = (await prisma.term.create({
    data: {
      year: 2075, season: 'feb_apr', titleAr: 'فصلُ الاختبار',
      startsOn: new Date(Date.now() + 30 * DAY), endsOn: new Date(Date.now() + 120 * DAY),
      status: 'planned',
    },
  })).id
}, 240_000)

const answer = (cookie: string, body: Record<string, unknown>) =>
  app.inject({
    method: 'POST' as const, url: `/api/trainer/me/terms/${termId}`,
    headers: { cookie }, payload: body,
  })

describe('البابُ الذي لم يكن موجودا', () => {
  it('يقرأ فصولَه الحيّةَ وموقفَه منها — و«لم يُجب» حالةٌ ثالثةٌ لا تُطوى', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/trainer/me/terms', headers: { cookie: mineCookie } })
    expect(res.statusCode).toBe(200)
    const rows = res.json() as { id: string; myStatus: string | null }[]
    const row = rows.find((r) => r.id === termId)
    expect(row, 'الفصلُ الحيُّ لا يظهر في فصوله').toBeDefined()
    /* لا صمتَ يُقرأ موافقةً ولا رفضا */
    expect(row!.myStatus).toBeNull()
  })

  it('ويؤكّد إتاحتَه بنفسه — ولم يكن يستطيع', async () => {
    const res = await answer(mineCookie, { status: 'confirmed' })
    expect(res.statusCode).toBe(200)
    const row = await prisma.trainerTermAvailability.findUnique({
      where: { profileId_termId: { profileId: mineProfileId, termId } },
    })
    expect(row?.status).toBe('confirmed')
  })

  it('ويعتذر فيخرج من قائمة المتاحين — والإعلانُ يُقرأ حيث يُبنى عليه', async () => {
    await terms.setTrainerAvailability(othersProfileId, termId, academicId, { status: 'declared' })
    await answer(mineCookie, { status: 'declined' })

    const available = await terms.availableTrainers(termId)
    const ids = available.map((a) => a.profileId)
    expect(ids, 'المعتذرُ ما زال معروضا متاحا').not.toContain(mineProfileId)
    expect(ids, 'ذهب المعتذرُ ومعه من لم يعتذر').toContain(othersProfileId)
  })
})

describe('وهو بابُ صاحبه وحدَه', () => {
  it('لا يُعلن أحدٌ نيابةً عن غيره — الملفُّ من الجلسة لا من الطلب', async () => {
    /* هذا هو ما يسقط أوّلا لو أُخذ `profileId` من المسار أو الجسد: نُرسل
       ملفَّ مدرّبٍ آخرَ صراحةً مع جلستنا، فيجب أن يُكتب ملفُّنا لا ملفُّه. */
    await terms.setTrainerAvailability(othersProfileId, termId, academicId, { status: 'declared' })
    const res = await answer(mineCookie, { status: 'confirmed', profileId: othersProfileId })
    expect(res.statusCode).toBe(200)

    const others = await prisma.trainerTermAvailability.findUnique({
      where: { profileId_termId: { profileId: othersProfileId, termId } },
    })
    expect(others?.status, 'كُتب على ملفّ مدرّبٍ آخر').toBe('declared')
    const mine = await prisma.trainerTermAvailability.findUnique({
      where: { profileId_termId: { profileId: mineProfileId, termId } },
    })
    expect(mine?.status).toBe('confirmed')
  })

  it('ولا يبلغه زائرٌ بلا جلسة', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/trainer/me/terms' })
    expect(res.statusCode).toBeGreaterThanOrEqual(401)
  })

  it('و«declared» ليست ممّا يقوله المدرّبُ عن نفسه — تأكيدٌ أو اعتذار', async () => {
    /* `declared` ما يكتبه الترحيلُ والإدارة: إعلانٌ عن المدرّب لا منه. وما
       يقوله هو بنفسه حسمٌ — ولا تُقبل منه حالةٌ ملتبسة. */
    await answer(mineCookie, { status: 'confirmed' })
    const res = await answer(mineCookie, { status: 'declared' })
    expect(res.statusCode).toBe(422)
    /* ولا كتابةَ وقعت: الردُّ قبلها لا بعدها */
    const row = await prisma.trainerTermAvailability.findUnique({
      where: { profileId_termId: { profileId: mineProfileId, termId } },
    })
    expect(row?.status).toBe('confirmed')
  })
})
