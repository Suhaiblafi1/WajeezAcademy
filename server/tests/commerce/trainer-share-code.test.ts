/* كودُ «شارك دوراتك» — خصمُنا ٣٠٪ على دورات المدرّب الذي ينشرها (٢٦ أكتوبر ٢٠٢٦).

   قرارُ صاحب المنصّة: «نعطي خصومات للدورات التي يسوّقها المدرّبون ولا تنقص من حسابهم — بل فقط هذه منّا نحن».
   والعلّةُ في `src/application/trainer/share-code.ts`. وهنا أنّه يقع حيث وُعد:

   ① **واحدٌ لكلّ مدرّب**، بنسبته، ويُعاد كما هو.
   ② **على شعبه وحدَها، فوق الباقة** — ويُردّ حيث لا دورةَ له في السلّة.
   ③ **ولا يُحسم منه شيء**: لا صفَّ استعمالٍ يقع عليه.
   ④ **وموافقةُ الطلبات تردّه** — تخصم من الطلب كلِّه بلا نطاق.
   ⑤ **ومن اشترى به يُحسب لصاحبه بأجر الإحالة** — قرارُ صاحب المنصّة (٢٦ أكتوبر ٢٠٢٦): «نعم، احسبه بأجر الإحالة».
      وما ختمه رابطٌ صريحٌ يبقى، ودورةُ غيره في الطلب نفسِه لا تُختم له. */

import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import type { PrismaClient } from '@prisma/client'
import type { FastifyInstance } from 'fastify'
import { buildApp } from '../../http/app'
import { ShortLinkService } from '../../services/short-link.service'
import { setupTestDb, testPrisma } from '../helpers/db'
import { AuthService } from '../../services/auth.service'
import { CommerceService } from '../../services/commerce.service'
import { TrainerShareCodeService } from '../../services/trainer-share-code.service'
import { TrainerMarketingService } from '../../services/trainer-marketing.service'
import { SHARE_CODE_PERCENT, SHARE_CODE_PREFIX } from '../../../src/application/trainer/share-code'
import { approvedPlanBy } from '../helpers/approved-trainer'

let prisma: PrismaClient
let auth: AuthService
let commerce: CommerceService
let shares: TrainerShareCodeService
let adminId = ''
const cohort: Record<string, string> = {}
const STAMP = Date.now()

async function trainer(tag: string) {
  const user = await prisma.user.create({ data: { email: `tsc-${tag}-${STAMP}@wajeez.test`, displayName: `مدرّب ${tag}`, passwordHash: 'x' } })
  const application = await prisma.trainerApplication.create({
    data: { reference: `WJ-TR-TSC-${tag}-${STAMP}`, fullName: `مدرّب ${tag}`, email: user.email, status: 'active' },
  })
  const profile = await prisma.trainerProfile.create({ data: { userId: user.id, applicationId: application.id } })
  return { userId: user.id, profileId: profile.id }
}

async function openCohort(key: string, courseId: string, price: number, lead: string) {
  const c = await prisma.cohort.create({
    data: {
      plans: { create: approvedPlanBy(lead) },
      courseId, title: `شعبة ${key}`, status: 'open', registrationOpen: true,
      financialReady: true, price, currency: 'USD', capacity: 20,
    },
  })
  await prisma.cohortTrainer.create({ data: { cohortId: c.id, profileId: lead, role: 'lead', assignedBy: adminId } })
  cohort[key] = c.id
}

const learner = async (tag: string) => (await auth.register(`tsc-l-${tag}-${STAMP}@test.local`, 'Learner#12345', `متعلّم ${tag}`)).userId

let A: { userId: string; profileId: string }
let B: { userId: string; profileId: string }
let codeA = ''

beforeAll(async () => {
  await setupTestDb()
  prisma = await testPrisma()
  auth = new AuthService(prisma)
  commerce = new CommerceService(prisma)
  shares = new TrainerShareCodeService(prisma)
  adminId = (await auth.register(`tsc-admin-${STAMP}@test.local`, 'Admin#12345', 'المالية')).userId
  await auth.setRoles(adminId, ['academic_manager'])
  A = await trainer('A')
  B = await trainer('B')
  const courses = await prisma.course.findMany({ take: 2, select: { id: true }, orderBy: { id: 'asc' } })
  await openCohort('A1', courses[0].id, 100, A.profileId)
  await openCohort('B1', courses[1].id, 200, B.profileId)
}, 240_000)

describe('① واحدٌ لكلّ مدرّب', () => {
  it('⚠️ يُنشأ أوّلَ مرّةٍ بنسبته، ويُعاد كما هو', async () => {
    const first = await shares.mine(A.userId)
    expect(first.code.startsWith(SHARE_CODE_PREFIX)).toBe(true)
    expect(first.percentOff).toBe(SHARE_CODE_PERCENT)
    expect(SHARE_CODE_PERCENT, 'تغيّرت النسبة عن قرار صاحب المنصّة').toBe(30)
    const again = await shares.mine(A.userId)
    expect(again.code, 'تغيّر الكود فضاع ما نُشر').toBe(first.code)
    expect(await prisma.trainerShareCode.count({ where: { profileId: A.profileId } })).toBe(1)
    codeA = first.code
  })
})

describe('② على شعبه وحدَها، فوق الباقة', () => {
  it('⚠️ يقع على دورته وحدَها في السلّة — ويُردّ حيث لا دورةَ له', async () => {
    const l = await learner('1')
    const q = await commerce.quote(l, [cohort.A1, cohort.B1], codeA)
    /* ٣٠٠ ← الباقةُ ٨٪ = ٢٤ ← ٢٧٦، وحصّةُ دورته منه ٩٢، وثلاثون بالمئة منها ٢٧٫٦٠ */
    expect(q.couponDiscount, 'الكودُ وقع على دورةِ مدرّبٍ آخر').toBe(27.6)
    expect(q.total).toBe(248.4)
    expect(q.items.find((i) => i.cohortId === cohort.B1)!.couponApplies, 'دورةُ غيره مخصومة').toBe(false)
    await expect(commerce.quote(l, [cohort.B1], codeA), 'قُبل على سلّةٍ ليس فيها من دوراته شيء')
      .rejects.toMatchObject({ code: 'code_not_applicable' })
  })
})

describe('③ ولا يُحسم من المدرّب شيء', () => {
  it('⚠️ لا صفَّ استعمالٍ يُحسم منه — والخصمُ كما وُعد', async () => {
    const l = await learner('2')
    const order = await commerce.checkout(l, [cohort.A1], codeA)
    expect(order.total, '١٠٠ بلا باقة، وثلاثون بالمئة').toBe(70)
    expect(await prisma.trainerCodeRedemption.count({ where: { orderId: order.orderId } }), 'صفُّ حسمٍ على المدرّب').toBe(0)
  })
})

describe('④ وموافقةُ الطلبات تردّه', () => {
  it('⚠️ لا يقع على طلبٍ يُعتمد من الإدارة — ذاك يخصم من الطلب كلِّه', async () => {
    const l = await learner('3')
    const req = await prisma.enrollmentRequest.create({ data: { userId: l, cohortId: cohort.B1, status: 'pending' } })
    await expect(commerce.approveEnrollmentRequest(req.id, adminId, codeA))
      .rejects.toMatchObject({ code: 'trainer_code_checkout_only' })
  })
})

async function pay(orderId: string) {
  const invoice = await prisma.invoice.findFirstOrThrow({ where: { orderId } })
  if (invoice.status !== 'paid') await commerce.recordManualPayment(invoice.id, adminId, { methodNote: 'تحويل بنكي اختباري' })
}

describe('⑤ ومن اشترى به يُحسب لصاحبه بأجر الإحالة', () => {
  it('⚠️ يُختم تسجيلُه في شعبته لصاحب الكود — ودورةُ غيره في الطلب نفسِه عامّة', async () => {
    const l = await learner('5')
    const order = await commerce.checkout(l, [cohort.A1, cohort.B1], codeA)
    await pay(order.orderId)
    const mine = await prisma.enrollment.findFirstOrThrow({ where: { userId: l, cohortId: cohort.A1 } })
    expect(mine.referralProfileId, 'من اشترى بكوده لم يُحسب له').toBe(A.profileId)
    const other = await prisma.enrollment.findFirstOrThrow({ where: { userId: l, cohortId: cohort.B1 } })
    expect(other.referralProfileId, 'خُتمت دورةُ مدرّبٍ آخر لصاحب الكود').toBeNull()
  })

  it('⚠️ وما ختمه رابطٌ صريحٌ يبقى كما هو', async () => {
    const link = await prisma.trainerReferralLink.create({ data: { cohortId: cohort.B1, profileId: B.profileId, code: `WJ-TSC-B-${STAMP}` } })
    const l = await learner('6')
    const order = await commerce.checkout(l, [cohort.A1, cohort.B1], codeA, link.code)
    await pay(order.orderId)
    expect((await prisma.enrollment.findFirstOrThrow({ where: { userId: l, cohortId: cohort.B1 } })).referralProfileId).toBe(B.profileId)
    expect((await prisma.enrollment.findFirstOrThrow({ where: { userId: l, cohortId: cohort.A1 } })).referralProfileId).toBe(A.profileId)
  })

  it('وبلا الكود لا يُختم شيء — الشراءُ العامّ عامّ', async () => {
    const l = await learner('7')
    const order = await commerce.checkout(l, [cohort.A1])
    await pay(order.orderId)
    expect((await prisma.enrollment.findFirstOrThrow({ where: { userId: l, cohortId: cohort.A1 } })).referralProfileId).toBeNull()
  })
})

/* ═══ والرابطُ المنشورُ قصيرٌ ثابت (٢٦ أكتوبر ٢٠٢٦) ═══
   «لا تبدو احترافيّة» — وكان الرابطُ اسمَه بالعربيّة يصير حروفا مرمّزةً في لينكدإن. فلكلّ شعبةٍ رابطٌ قصير،
   يُسكّ مرّةً ويُعاد: ما نُشر لا يتغيّر. */
describe('⑥ روابط «شارك دوراتك» القصيرة', () => {
  it('⚠️ لكل شعبة له رابط قصير إلى رابط إحالتها — والثاني هو الأول', async () => {
    const first = await shares.kit(A.userId)
    const short = first.short.cohorts[cohort.A1]
    expect(short, 'لا رابط قصير لشعبته').toMatch(/\/s\/[A-Z0-9]{6}$/)
    const code = short.slice(short.lastIndexOf('/') + 1)
    const row = await prisma.shortLink.findUniqueOrThrow({ where: { code } })
    expect(row.target, 'الرابط القصير لا يحمل رمز الإحالة').toMatch(/\?ref=/)
    const again = await shares.kit(A.userId)
    expect(again.short.cohorts[cohort.A1], 'تغير الرابط فضاع ما نشر').toBe(short)
    expect(first.short.cohorts[cohort.B1], 'رابط لشعبة غيره').toBeUndefined()
  })
})

/* ⑦ معاينةُ روابطه — قرارُ صاحب المنصّة (٢٦ أكتوبر ٢٠٢٦): «أضف معاينة، نعم». فرابطُه القصيرُ إذا لُصق في واتساب
   وفيسبوك قرأ زاحفُهما صورتَه المصمَّمة ودوراتِه، لا وسومَ الرئيسة. والعلّةُ في `server/services/link-preview.ts`. */
describe('⑦ معاينة روابطه حين تلصق', () => {
  const JPEG = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 1, 2, 3, 4])
  const codeOf = (url: string) => url.slice(url.lastIndexOf('/') + 1)
  let app: FastifyInstance

  beforeAll(async () => { app = await buildApp(prisma) }, 120_000)
  afterAll(async () => { await app?.close() })

  it('⚠️ تحفظ صورته وبصمتها، والعنوان والوصف يكتبهما الخادم من دورته', async () => {
    const kit = await shares.kit(A.userId)
    const code = codeOf(kit.short.cohorts[cohort.A1])
    expect(kit.previews[code], 'معاينة قبل أن ترفع').toBeNull()
    await shares.savePreview(A.userId, code, JPEG, 'v1-abc')
    const row = await prisma.shortLink.findUniqueOrThrow({ where: { code } })
    expect(Buffer.from(row.previewImage!).equals(JPEG)).toBe(true)
    expect(row.previewTitle, 'العنوان لا يسمي المدرب').toContain('مدرّب A')
    expect(row.previewText, 'الوصف لا يقول البث المباشر').toContain('بث مباشر')
    expect(row.previewText, 'الوصف بلا الكود').toContain(kit.code)
    expect((await shares.kit(A.userId)).previews[code], 'البصمة لا تعود للصفحة فتعيد الرفع كل زيارة').toBe('v1-abc')
  })

  it('ولا تقبل ما ليس JPEG، ولا رابط غيره', async () => {
    const mine = codeOf((await shares.kit(A.userId)).short.cohorts[cohort.A1])
    const his = codeOf((await shares.kit(B.userId)).short.cohorts[cohort.B1])
    await expect(shares.savePreview(A.userId, mine, Buffer.from('<svg/>'), 'x')).rejects.toMatchObject({ code: 'bad_preview' })
    await expect(shares.savePreview(A.userId, his, JPEG, 'x'), 'رفع معاينة لرابط مدرب آخر').rejects.toMatchObject({ status: 404 })
  })

  it('⚠️ والرابط القصير يجيب الزاحف بوسوم المعاينة ثم يحول — وما لا معاينة له 302', async () => {
    const kit = await shares.kit(A.userId)
    const code = codeOf(kit.short.cohorts[cohort.A1])
    const page = await app.inject({ method: 'GET', url: `/s/${code}` })
    expect(page.statusCode).toBe(200)
    expect(page.headers['content-type']).toMatch(/text\/html/)
    expect(page.body, 'لا صورة معاينة للزاحف').toMatch(new RegExp(`og:image" content="[^"]*/api/public/links/${code}/preview\\.jpg\\?v=v1-abc"`))
    expect(page.body).toMatch(/twitter:card" content="summary_large_image"/)
    const row = await prisma.shortLink.findUniqueOrThrow({ where: { code } })
    expect(page.body, 'لا تحويل إلى وجهة الرابط').toMatch(new RegExp(`location\\.replace\\("[^"]*${row.target.replace(/[?.]/g, '\\$&')}"\\)`))

    const img = await app.inject({ method: 'GET', url: `/api/public/links/${code}/preview.jpg` })
    expect(img.statusCode).toBe(200)
    expect(img.headers['content-type']).toBe('image/jpeg')

    const plain = await new ShortLinkService(prisma).mint('/student/learning', null)
    const bare = await app.inject({ method: 'GET', url: `/s/${plain.code}` })
    expect(bare.statusCode, 'رابط بلا معاينة لم يعد يحول').toBe(302)
    expect(bare.headers.location).toMatch(/\/student\/learning$/)

    const dead = await app.inject({ method: 'GET', url: '/s/ZZZZZZ' })
    expect(dead.statusCode).toBe(404)
  })
})

/* ⑧ كم فتح رابطَه ومن أين — اقترحه Claude فقال صاحبُ المنصّة: «كلّهم» (٢٧ أكتوبر ٢٠٢٦). والعلّةُ في
   `server/services/link-opens.ts`: الإنسانُ وحدَه يُعدّ، ومن عاد في نصف ساعةٍ يُعدّ مرّة، والمنصّةُ من `?p=`. */
describe('⑧ عداد روابطه', () => {
  const HUMAN = 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 Mobile/15E148 [FBAN/FBIOS;FBAV/450.0]'
  const codeOf = (url: string) => url.slice(url.lastIndexOf('/') + 1)
  let app: FastifyInstance

  beforeAll(async () => { app = await buildApp(prisma) }, 120_000)
  afterAll(async () => { await app?.close() })

  const open = (code: string, ua: string, ip: string, p?: string) => app.inject({
    method: 'GET', url: `/s/${code}${p ? `?p=${p}` : ''}`, headers: { 'user-agent': ua }, remoteAddress: ip,
  })

  it('⚠️ يعد الإنسان مرة بمنصته، ولا يعد الزاحف، ولا من عاد في نصف ساعة', async () => {
    const code = codeOf((await shares.kit(A.userId)).short.cohorts[cohort.A1])
    const before = (await shares.kit(A.userId)).reach[code]
    await open(code, HUMAN, '10.0.0.1', 'wa')
    await open(code, HUMAN, '10.0.0.1', 'wa')
    await open(code, 'facebookexternalhit/1.1 (+http://www.facebook.com/externalhit_uatext.php)', '10.0.0.2', 'fb')
    await open(code, 'WhatsApp/2.23.20.0 A', '10.0.0.3', 'wa')
    await open(code, HUMAN, '10.0.0.4', 'li')
    await open(code, HUMAN, '10.0.0.5', 'evil')
    const after = (await shares.kit(A.userId)).reach[code]
    expect(after.opens - before.opens, 'عد الزاحف أو من عاد').toBe(3)
    expect((after.byVia.wa ?? 0) - (before.byVia.wa ?? 0)).toBe(1)
    expect((after.byVia.li ?? 0) - (before.byVia.li ?? 0)).toBe(1)
    expect(after.byVia.evil, 'منصة لا نعرفها كتبت في القاعدة').toBeUndefined()
    expect(after.byVia.fb, 'عد زاحف فيسبوك فتحة').toBeUndefined()
  })

  it('⚠️ ومن سجل برمز إحالة الرابط يعد له — والانتظار ليس مقعدا', async () => {
    const kit = await shares.kit(A.userId)
    const code = codeOf(kit.short.cohorts[cohort.A1])
    const link = await prisma.trainerReferralLink.findFirstOrThrow({ where: { profileId: A.profileId, cohortId: cohort.A1 } })
    const before = kit.reach[code].registered
    await prisma.enrollment.create({ data: { cohortId: cohort.A1, userId: await learner('reach1'), status: 'enrolled', referralCode: link.code } })
    await prisma.enrollment.create({ data: { cohortId: cohort.A1, userId: await learner('reach2'), status: 'waitlisted', referralCode: link.code } })
    expect((await shares.kit(A.userId)).reach[code].registered - before).toBe(1)
  })

  it('⚠️ وفي «تسويق المدربين» يرى المدير من ينشر فعلا — بمجموع روابطه نفسه', async () => {
    const a = (await new TrainerMarketingService(prisma).adminList()).find((r) => r.profileId === A.profileId)
    const reach = Object.values((await shares.kit(A.userId)).reach)
    expect(a, 'المدرب النشط غاب عن القائمة').toBeDefined()
    expect(a!.shares.opens, 'مجموع الإدارة غير مجموع روابطه').toBe(reach.reduce((s, r) => s + r.opens, 0))
    expect(a!.shares.opens).toBeGreaterThanOrEqual(3)
    expect(a!.shares.registered, 'من سجل عبره لا يبلغ الإدارة').toBeGreaterThanOrEqual(1)
  })
})
