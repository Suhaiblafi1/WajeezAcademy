/* تقريرُ المراجعة — يرفعه المعتمِدُ مع قراره، ويُحفظ مع الخطّة، ويقرؤه مدرّبُها (٨ أكتوبر ٢٠٢٦).

   قرارُ صاحب المنصّة: التقريرُ يصل المدرّبَ من المنصّة نفسِها لا بريدا من خارجها. وهنا على
   قاعدةٍ ومخزنٍ حقيقيّين:

   ١) **المعتمِدُ يرفعه** برابطٍ موقَّتٍ كأيّ ملفّ شعبة، والبايتاتُ تصل المخزن، وتراه بطاقتُه.
   ٢) **ومن يقرؤه**: مدرّبُ الشعبة والإدارة — لا المتعلّمُ الملتحق ولا مدرّبٌ آخر.
   ٣) **والمدرّبُ لا يرفع تقريرا** باسم خطّته من بابه.
   ٤) **ورسالةُ القرار تذكره** وتدلّ على موضعه، وصفحةُ المدرّب تحمله.
   ٥) **ولا يُرفع بعد القرار** — لا تذكره رسالةٌ ولا يدري به أحد. */

import { beforeAll, describe, expect as vexpect, it } from 'vitest'
import { plainExpect } from '../helpers/plain-expect'
/* يُقارَن بلا تشكيلٍ إعرابيّ — العلّةُ في `helpers/plain-expect.ts` */
const expect = plainExpect(vexpect)
import type { PrismaClient } from '@prisma/client'
import type { FastifyInstance } from 'fastify'
import { setupTestDb, testPrisma } from '../helpers/db'
import { AuthService } from '../../services/auth.service'
import { buildApp } from '../../http/app'
import { SESSION_COOKIE } from '../../http/auth-plugin'
import { CohortPlanService } from '../../services/cohort-plan.service'

let prisma: PrismaClient
let auth: AuthService
let app: FastifyInstance
const STAMP = Date.now()
const PASS = 'Pass#12345'
const cookies: Record<string, string> = {}
let cohortId = ''
let planId = ''
let trainerUserId = ''
let reportKey = ''
const REPORT = Buffer.from('%PDF-1.4\n% تقريرُ مراجعة\n%%EOF\n')

const login = async (email: string) => `${SESSION_COOKIE}=${(await auth.login(email, PASS)).token}`
const call = (method: 'GET' | 'POST' | 'DELETE' | 'PUT', url: string, who?: string, payload?: unknown, headers: Record<string, string> = {}) =>
  app.inject({ method, url, headers: { ...(who ? { cookie: cookies[who] } : {}), ...headers }, ...(payload === undefined ? {} : { payload: payload as never }) })

async function trainerFor(tag: string) {
  const email = `rr-${tag}-${STAMP}@test.local`
  const u = await auth.register(email, PASS, `مدرّب ${tag}`)
  await auth.setRoles(u.userId, ['trainer'])
  const application = await prisma.trainerApplication.create({
    data: {
      reference: `WJ-TR-RR-${tag}-${STAMP}`, email, fullName: `مدرّب ${tag}`,
      phoneCountryCode: '+962', phone: `77900${tag.length}${STAMP % 1000}`, country: 'الأردن', status: 'active',
    },
  })
  const profile = await prisma.trainerProfile.create({ data: { applicationId: application.id, userId: u.userId } })
  cookies[tag] = await login(email)
  return { userId: u.userId, profileId: profile.id }
}

beforeAll(async () => {
  await setupTestDb()
  prisma = await testPrisma()
  auth = new AuthService(prisma)
  app = await buildApp(prisma)

  const admin = await auth.register(`rr-admin-${STAMP}@test.local`, PASS, 'المعتمِد')
  await auth.setRoles(admin.userId, ['academic_manager'])
  cookies.admin = await login(`rr-admin-${STAMP}@test.local`)

  const owner = await trainerFor('owner')
  trainerUserId = owner.userId
  await trainerFor('other')
  const learner = await auth.register(`rr-learner-${STAMP}@test.local`, PASS, 'متعلّم')
  cookies.learner = await login(`rr-learner-${STAMP}@test.local`)

  const course = await prisma.course.findFirstOrThrow({ select: { id: true } })
  const cohort = await prisma.cohort.create({ data: { courseId: course.id, title: 'شعبةُ التقرير', status: 'active', capacity: 20 } })
  cohortId = cohort.id
  await prisma.cohortTrainer.create({ data: { cohortId, profileId: owner.profileId, role: 'lead' } })
  await prisma.enrollment.create({ data: { cohortId, userId: learner.userId, status: 'enrolled' } })
  const plan = await prisma.cohortDeliveryPlan.create({
    data: {
      cohortId, trainerId: owner.profileId, status: 'submitted', submittedAt: new Date(),
      content: { kind: 'trainer', modules: [{ moduleId: 'M1', titleAr: 'محور' }], resources: [] } as never,
    },
  })
  planId = plan.id
}, 240_000)

describe('١ — المعتمِدُ يرفعه، والبايتاتُ تصل، وتراه بطاقتُه', () => {
  it('رابطُ رفعٍ موقَّت، ثمّ البايتاتُ إليه، ثمّ يُرى في الخطّة', async () => {
    const start = await call('POST', `/api/admin/cohort-plans/${planId}/review-report`, 'admin', { mime: 'application/pdf', originalName: 'تقرير مراجعة الخطة.pdf' })
    expect(start.statusCode, start.body).toBe(201)
    const { uploadUrl, storageKey } = JSON.parse(start.body) as { uploadUrl: string; storageKey: string }
    reportKey = storageKey
    const put = await call('PUT', uploadUrl, undefined, REPORT, { 'content-type': 'application/pdf' })
    expect(put.statusCode, put.body).toBeLessThan(300)

    const view = JSON.parse((await call('GET', `/api/admin/cohorts/${cohortId}/trainer-plan`, 'admin')).body) as { reviewReports: { storageKey: string; originalName: string }[] }
    expect(view.reviewReports.map((r) => r.originalName)).toEqual(['تقرير مراجعة الخطة.pdf'])
  })

  it('ولا تُقبل شرائح — PDF أو Word وحدَهما', async () => {
    const r = await call('POST', `/api/admin/cohort-plans/${planId}/review-report`, 'admin', {
      mime: 'application/vnd.openxmlformats-officedocument.presentationml.presentation', originalName: 'x.pptx',
    })
    expect(r.statusCode).toBe(422)
  })
})

describe('١ب — ولا يُرفع الملفُّ نفسُه مرّتين (١١ أكتوبر ٢٠٢٦)', () => {
  const start = (originalName: string) =>
    call('POST', `/api/admin/cohort-plans/${planId}/review-report`, 'admin', { mime: 'application/pdf', originalName })

  it('⚠️ ما رُفع باسمه لهذه الخطّة يُردّ — فلا يرى المدرّبُ التقريرَ نفسَه مرّتين', async () => {
    const again = await start('تقرير مراجعة الخطة.pdf')
    expect(again.statusCode).toBe(409)
    expect(again.json().error.code).toBe('report_exists')
    expect(again.json().error.message_ar).toMatch(/^رُفع «تقرير مراجعة الخطة\.pdf» لهذه الخطّة من قبل/)
  })

  it('⚠️ ورفعٌ سابقٌ لم يكتمل لا يمنع — يُخلى صفُّه ويُرفع من جديد', async () => {
    expect((await start('رفعٌ انقطع.pdf')).statusCode).toBe(201)
    const retry = await start('رفعٌ انقطع.pdf')
    expect(retry.statusCode, retry.body).toBe(201)
    const rows = await prisma.cohortFile.count({ where: { purpose: 'review_report', refId: planId, originalName: 'رفعٌ انقطع.pdf' } })
    expect(rows, 'بقي الصفُّ الذي لم يكتمل').toBe(1)
  })
})

describe('٢ — من يقرؤه', () => {
  it('مدرّبُ الشعبة يقرؤه ببايتاته، والإدارةُ كذلك', async () => {
    const t = await call('GET', `/api/v1/cohort-files/${reportKey}`, 'owner')
    expect(t.statusCode).toBe(200)
    expect(t.rawPayload.equals(REPORT)).toBe(true)
    expect((await call('GET', `/api/v1/cohort-files/${reportKey}`, 'admin')).statusCode).toBe(200)
  })

  it('⚠️ والمتعلّمُ الملتحقُ لا يقرؤه، ولا مدرّبٌ آخر — ٤٠٤ لا ٤٠٣', async () => {
    expect((await call('GET', `/api/v1/cohort-files/${reportKey}`, 'learner')).statusCode).toBe(404)
    expect((await call('GET', `/api/v1/cohort-files/${reportKey}`, 'other')).statusCode).toBe(404)
  })
})

describe('٣ — والمدرّبُ لا يرفع تقريرا', () => {
  it('⚠️ بابُ المدرّب يردّ الغرضَ — وبابُ المعتمِد يردّ المدرّب', async () => {
    const own = await call('POST', `/api/trainer/cohorts/${cohortId}/files`, 'owner', {
      purpose: 'review_report', refId: planId, mime: 'application/pdf', originalName: 'تقريري.pdf',
    })
    /* والتحقّقُ يُردّ في هذه المنصّة بأربعمئةٍ واثنين وعشرين — والمهمُّ أنّه لم يُكتب صفّ */
    expect(own.statusCode, 'صار المدرّبُ يرفع تقريرَ مراجعة خطّته').toBe(422)
    expect(await prisma.cohortFile.count({ where: { purpose: 'review_report', uploadedBy: trainerUserId } })).toBe(0)
    expect((await call('POST', `/api/admin/cohort-plans/${planId}/review-report`, 'owner', { mime: 'application/pdf', originalName: 'x.pdf' })).statusCode).toBe(403)
  })
})

describe('٤ — رسالةُ القرار تذكره، وصفحةُ المدرّب تحمله', () => {
  it('الردُّ يقول في الجرس إنّ التقريرَ في «المراجعة» — ويفتحها', async () => {
    const r = await call('POST', `/api/admin/cohort-plans/${planId}/decide`, 'admin', { approve: false, note: { workbooks: 'ضع كرّاسةَ المحور الأوّل.' } })
    expect(r.statusCode, r.body).toBe(200)
    const bell = await prisma.notification.findFirst({
      where: { userId: trainerUserId, templateKey: 'cohort.plan.decision' }, orderBy: { queuedAt: 'desc' },
    })
    /* والجرسُ سطرٌ بعدد ما ينتظره في «المراجعة» لا الملاحظاتُ بنصوصها (١١ أكتوبر ٢٠٢٦، «فيها كلامٌ كثير»،
       `returnBellAr`) — والنصوصُ بنودٌ هناك */
    expect(bell?.body).toBe('تنتظرك في «المراجعة» ملاحظةٌ واحدة وتقريرُ المراجعة — قرّر فيها ثمّ أرسل مراجعتك.')
    expect(bell?.data).toMatchObject({ cohortId, step: 'review' })
  })

  it('وصفحةُ المدرّب تحمل التقرير', async () => {
    const ws = await new CohortPlanService(prisma).workspace(trainerUserId, cohortId)
    expect(ws.reviewReports.map((r) => r.originalName)).toEqual(['تقرير مراجعة الخطة.pdf'])
  })
})

/* ═══ ٦ — «استبدل التقارير السابقة»: تُحذف تقاريرُ الخطّة كلُّها قبل رفع الجديد (١٢ أكتوبر ٢٠٢٦) ═══
   «أريد أن أعيد كلَّ شيءٍ من البداية» (صاحب المنصّة). على خطّةٍ وحدَها — لا تمسّ خطّةَ الأقسام قبلها. */
describe('٦ — حذفُ تقارير الخطّة كلِّها قبل رفع الجديد', () => {
  let plan2 = ''
  const upload = async (name: string) => {
    const s = await call('POST', `/api/admin/cohort-plans/${plan2}/review-report`, 'admin', { mime: 'application/pdf', originalName: name })
    expect(s.statusCode, s.body).toBe(201)
    const { uploadUrl } = JSON.parse(s.body) as { uploadUrl: string }
    expect((await call('PUT', uploadUrl, undefined, REPORT, { 'content-type': 'application/pdf' })).statusCode).toBeLessThan(300)
  }
  const names = async () => (await prisma.cohortFile.findMany({ where: { purpose: 'review_report', refId: plan2 }, select: { originalName: true } }))
    .map((x) => x.originalName).sort()

  beforeAll(async () => {
    const profile = await prisma.trainerProfile.findFirstOrThrow({ where: { userId: trainerUserId }, select: { id: true } })
    const course = await prisma.course.findFirstOrThrow({ select: { id: true } })
    const cohort = await prisma.cohort.create({ data: { courseId: course.id, title: 'شعبةُ الاستبدال', status: 'draft', capacity: 20 } })
    await prisma.cohortTrainer.create({ data: { cohortId: cohort.id, profileId: profile.id, role: 'lead' } })
    plan2 = (await prisma.cohortDeliveryPlan.create({
      data: {
        cohortId: cohort.id, trainerId: profile.id, status: 'submitted', submittedAt: new Date(),
        content: { kind: 'trainer', modules: [{ moduleId: 'M1', titleAr: 'محور' }], resources: [] } as never,
      },
    })).id
    await upload('التقرير القديم.pdf')
    await upload('ملحق قديم.pdf')
  })

  it('⚠️ لمن يعتمد وحده — المدرّب لا يحذف', async () => {
    expect((await call('DELETE', `/api/admin/cohort-plans/${plan2}/review-reports`, 'owner')).statusCode).toBe(403)
    expect(await names()).toEqual(['التقرير القديم.pdf', 'ملحق قديم.pdf'])
  })

  it('يحذف تقارير الخطّة كلّها ويقول كم — ثمّ يرفع الاسم نفسه من جديد، ولا تمسّ خطّة غيرها', async () => {
    const before = await prisma.cohortFile.count({ where: { purpose: 'review_report', refId: planId } })
    const r = await call('DELETE', `/api/admin/cohort-plans/${plan2}/review-reports`, 'admin')
    expect(r.statusCode, r.body).toBe(200)
    expect(r.json().removed).toBe(2)
    expect(await names()).toEqual([])
    await upload('التقرير القديم.pdf')
    expect(await names()).toEqual(['التقرير القديم.pdf'])
    expect(await prisma.cohortFile.count({ where: { purpose: 'review_report', refId: planId } }), 'خطّة الأقسام قبلها كما هي').toBe(before)
  })

  it('وخطّة بلا تقارير — صفر بلا خطأ', async () => {
    await call('DELETE', `/api/admin/cohort-plans/${plan2}/review-reports`, 'admin')
    const r = await call('DELETE', `/api/admin/cohort-plans/${plan2}/review-reports`, 'admin')
    expect(r.statusCode).toBe(200)
    expect(r.json().removed).toBe(0)
  })

  it('⚠️ ولا بعد القرار', async () => {
    await prisma.cohortDeliveryPlan.update({ where: { id: plan2 }, data: { status: 'approved' } })
    expect((await call('DELETE', `/api/admin/cohort-plans/${plan2}/review-reports`, 'admin')).statusCode).toBe(409)
  })
})

describe('٥ — ولا يُرفع ولا يُحذف بعد القرار', () => {
  it('الخطّةُ ليست بانتظار قرارٍ — ٤٠٩ بسببه', async () => {
    expect((await call('POST', `/api/admin/cohort-plans/${planId}/review-report`, 'admin', { mime: 'application/pdf', originalName: 'متأخّر.pdf' })).statusCode).toBe(409)
    expect((await call('DELETE', `/api/admin/cohort-plans/${planId}/review-report/${reportKey}`, 'admin')).statusCode).toBe(409)
  })
})
