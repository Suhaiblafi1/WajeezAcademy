/* إيقافُ التدريب ليس إيقافَ الحساب — إلّا لمن لا موقعَ له سواه.

   ── العطبُ الذي فُتح له هذا الحارس ──

   `suspendTrainer` كان يوقف `User.status` ويُبطل الجلساتِ لكلّ من رُبط
   بملفّ المدرّب، بلا نظرٍ إلى من يكون. وصاحبُ المنصّة له ملفُّ مدرّبٍ كما
   لغيره — فالملفُّ شيءٌ والدورُ شيءٌ آخر، ولا تُخرجه ترقيتُه مديرَ نظامٍ من
   قائمة المدرّبين. فرأى اسمَه فيها فأوقفه، فأُوقف **دخولُه هو**.

   وما ذهب بذلك ليس بوّابةَ التدريب: ذهبت لوحةُ الإدارة، ومعها **رفعُ
   الإيقاف نفسُه** — فهو لا يقع إلّا من داخل لوحةٍ لا يفتحها موقوف. نقرةٌ
   واحدةٌ تُخرج صاحبَ المنصّة من منصّته ولا تُبقي له بابا يعود منه.

   ── ولماذا لم يُحتَج إلى إيقاف الحساب أصلا ──

   `TrainerProfile.suspendedAt` مفحوصةٌ في كلّ مسارٍ يخصّ المدرّب: البوّابةُ
   والعروضُ والشعبُ والإحالةُ والحسابُ البنكيُّ والظهورُ العامُّ والمستحقّات.
   فالإيقافُ تامٌّ بها وحدَها، وإيقافُ الحساب فوقَها زيادةٌ تُصيب ما لا يخصّ
   التدريبَ من حياةِ صاحبه على المنصّة.

   ── وما يُقاس هنا ──

   ثلاثٌ، وكلُّها على الحالة في القاعدة وعلى جلسةٍ حقيقيّةٍ تمرّ بالحارس —
   لا على نصٍّ في ملفّ:

     ① المدرّبُ الخالصُ يُوقف حسابُه كما كان: بوّابتُه هي دخولُه، وتركُه
        داخلا إلى لا شيءٍ عبث.
     ② ومن له موقعٌ فوقَ التدريب يبقى دخولُه — أُوقف تدريبُه لا هو.
     ③ ولا يوقف أحدٌ نفسَه من هذه القائمة. */

import { beforeAll, describe, expect, it } from 'vitest'
import type { PrismaClient } from '@prisma/client'
import type { FastifyInstance } from 'fastify'
import { setupTestDb, testPrisma } from '../helpers/db'
import { AuthService } from '../../services/auth.service'
import { TrainerReviewService } from '../../services/trainer-review.service'
import { buildApp } from '../../http/app'
import { SESSION_COOKIE } from '../../http/auth-plugin'

let prisma: PrismaClient
let auth: AuthService
let review: TrainerReviewService
let app: FastifyInstance

let bossId = ''
let bossCookie = ''
let bossProfileId = ''

/** مدرّبٌ لا شيءَ له على المنصّة سوى تدريبه */
let pureProfileId = ''
let pureUserId = ''
let pureCookie = ''

/** مدرّبٌ هو المديرُ الأكاديميُّ نفسُه — موقعٌ فوقَ التدريب */
let staffProfileId = ''
let staffUserId = ''
let staffCookie = ''

const PW = 'Suspend#12345'

const cookieFor = async (email: string) => {
  const { token } = await auth.login(email, PW)
  return `${SESSION_COOKIE}=${token}`
}

/** حسابٌ + طلبٌ + ملفُّ مدرّبٍ مربوطٌ به — أقصرُ طريقٍ صحيح */
async function makeTrainer(email: string, name: string, roles: string[]) {
  const user = await auth.register(email, PW, name)
  await auth.setRoles(user.userId, roles)
  const application = await prisma.trainerApplication.create({
    data: {
      reference: `TR-SUSP-${Math.random().toString(36).slice(2, 10)}`,
      fullName: name, email, status: 'active', motivation: 'اختبار', privacyConsentAt: new Date(),
    },
  })
  const profile = await prisma.trainerProfile.create({
    data: { applicationId: application.id, userId: user.userId, isVerified: true },
  })
  return { userId: user.userId, profileId: profile.id, cookie: await cookieFor(email) }
}

/** أتَبلغ هذه الجلسةُ الخادمَ بعد؟ — يمرّ بالحارس نفسِه الذي يمرّ به في الإنتاج */
async function sessionAlive(cookie: string): Promise<boolean> {
  const res = await app.inject({ method: 'GET', url: '/api/auth/me', headers: { cookie } })
  expect(res.statusCode).toBe(200)
  return (res.json() as { user: unknown }).user !== null
}

const suspend = (profileId: string, cookie = bossCookie) => app.inject({
  method: 'POST', url: `/api/admin/trainers/${profileId}/suspend`,
  headers: { cookie }, payload: { note: 'فحصُ الحارس' },
})

beforeAll(async () => {
  await setupTestDb()
  prisma = await testPrisma()
  auth = new AuthService(prisma)
  review = new TrainerReviewService(prisma)
  app = await buildApp(prisma)

  const boss = await makeTrainer('susp-boss@test.local', 'صاحبُ المنصّة', ['super_admin', 'trainer'])
  bossId = boss.userId
  bossProfileId = boss.profileId
  bossCookie = boss.cookie

  const pure = await makeTrainer('susp-pure@test.local', 'مدرّبٌ خالص', ['trainer'])
  pureUserId = pure.userId
  pureProfileId = pure.profileId
  pureCookie = pure.cookie

  const staff = await makeTrainer('susp-staff@test.local', 'مديرٌ أكاديميٌّ يدرّس', ['academic_manager', 'trainer'])
  staffUserId = staff.userId
  staffProfileId = staff.profileId
  staffCookie = staff.cookie
}, 240_000)

const statusOf = async (userId: string) =>
  (await prisma.user.findUniqueOrThrow({ where: { id: userId }, select: { status: true } })).status

const profileOf = (profileId: string) =>
  prisma.trainerProfile.findUniqueOrThrow({ where: { id: profileId } })

describe('① المدرّبُ الخالصُ — بوّابتُه هي دخولُه', () => {
  it('يُوقف تدريبُه وحسابُه معا، وتبطل جلستُه', async () => {
    expect(await sessionAlive(pureCookie), 'الجلسةُ ميّتةٌ قبل الإيقاف').toBe(true)

    const res = await suspend(pureProfileId)
    expect(res.statusCode, res.body).toBe(200)

    expect((await profileOf(pureProfileId)).suspendedAt, 'لم يُوقف تدريبُه').not.toBeNull()
    expect(await statusOf(pureUserId), 'بقي دخولُه مفتوحا إلى بوّابةٍ لا تُفتح').toBe('suspended')
    expect(await sessionAlive(pureCookie), 'جلستُه لم تُبطَل').toBe(false)
  })
})

describe('② ومن له موقعٌ فوقَ التدريب — أُوقف تدريبُه لا هو', () => {
  it('يُوقف تدريبُه ويبقى دخولُه وجلستُه', async () => {
    expect(await sessionAlive(staffCookie)).toBe(true)

    const res = await suspend(staffProfileId)
    expect(res.statusCode, res.body).toBe(200)

    expect((await profileOf(staffProfileId)).suspendedAt, 'الإيقافُ لم يقع على تدريبه').not.toBeNull()
    expect(
      await statusOf(staffUserId),
      'أُوقف حسابُ المدير الأكاديميّ كلُّه لأنّ له ملفَّ مدرّب — ومعه كلُّ ما لا يخصّ التدريب',
    ).toBe('active')
    expect(await sessionAlive(staffCookie), 'أُخرج من لوحته بإيقافِ تدريبه').toBe(true)
  })

  it('والظهورُ العامُّ يسقط عنه كما يسقط عن غيره — الإيقافُ تامٌّ في بابه', async () => {
    expect((await profileOf(staffProfileId)).publicVisibility).toBe(false)
    expect((await review.listPublicTrainers()).map((p) => p.id)).not.toContain(staffProfileId)
  })

  it('والأثرُ يقول أيُّ إيقافٍ وقع — فيُقرأ بعد شهرٍ ولا يُخمَّن', async () => {
    const forStaff = await prisma.auditEvent.findFirst({
      where: { action: 'trainer.suspend', entityId: staffProfileId }, orderBy: { createdAt: 'desc' },
    })
    const forPure = await prisma.auditEvent.findFirst({
      where: { action: 'trainer.suspend', entityId: pureProfileId }, orderBy: { createdAt: 'desc' },
    })
    expect((forStaff!.meta as { accountSuspended?: boolean }).accountSuspended).toBe(false)
    expect((forPure!.meta as { accountSuspended?: boolean }).accountSuspended).toBe(true)
  })

  it('ورفعُ إيقافِ التدريب لا يُنشِّط حسابا أوقفته شاشةُ المستخدمين لسببٍ آخر', async () => {
    /* أُوقف حسابُه بقرارٍ مستقلٍّ بعد إيقاف تدريبه. ورفعُ التدريب كان يكتب
       `status: 'active'` بلا شرط — فيرفع إيقافا لم يقرّر أحدٌ رفعَه. */
    await auth.suspend(staffUserId)
    const { applicationId } = await profileOf(staffProfileId)
    await review.decide(applicationId, bossId, 'reinstate', 'انتهى سببُ إيقاف التدريب')

    expect((await profileOf(staffProfileId)).suspendedAt, 'لم يُرفع إيقافُ تدريبه').toBeNull()
    expect(await statusOf(staffUserId), 'رُفع إيقافُ الحساب بلا قرارٍ برفعه').toBe('suspended')
  })
})

describe('③ ولا يوقف أحدٌ نفسَه من قائمة المدرّبين', () => {
  it('يُردّ بـ٤٠٩ ولا يُكتب شيء', async () => {
    const res = await suspend(bossProfileId)
    expect(res.statusCode, res.body).toBe(409)
    expect((res.json() as { error: { code: string } }).error.code).toBe('self_suspend')

    expect((await profileOf(bossProfileId)).suspendedAt, 'أوقف نفسَه ووقع الإيقافُ فعلا').toBeNull()
    expect(await statusOf(bossId)).toBe('active')
    expect(await sessionAlive(bossCookie), 'أخرج نفسَه من لوحته').toBe(true)
  })

  it('وغيرُه يوقف ملفَّه إن أراد — المنعُ على الذات لا على الملفّ', async () => {
    const other = await auth.register('susp-other-boss@test.local', PW, 'مديرُ نظامٍ آخر')
    await auth.setRoles(other.userId, ['super_admin'])
    const res = await suspend(bossProfileId, await cookieFor('susp-other-boss@test.local'))
    expect(res.statusCode, res.body).toBe(200)
    expect((await profileOf(bossProfileId)).suspendedAt).not.toBeNull()
    /* وحسابُه باقٍ: له موقعٌ فوقَ التدريب */
    expect(await statusOf(bossId)).toBe('active')
  })
})
