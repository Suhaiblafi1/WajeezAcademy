/* ما نُقل من اللوح القديم لا يحبس المدرّبَ عن الحفظ (٥ أكتوبر ٢٠٢٦).

   بلاغُ صاحب المنصّة: «لماذا لا يستطيع المدرّبون حفظَ عملهم وهم يبنون موادَّهم
   في بوّابتهم؟». وقِيس قبل الإصلاح على هذا الملفّ نفسِه: مدرّبٌ كتب في لوح
   «موادّ دوراتك» القديم مصدرا بلا رابط («كتابُ فنّ الإلقاء لفلان») ثمّ قبِل
   دورتَه، فنُقل السطرُ إلى شعبة إعداده مصدرا بلا رابط — **فرُدّ كلُّ حفظٍ بعده
   بـ٤٢٢**، أيَّ خطوةٍ كان فيها. والمصادرُ في الخطوة الخامسة، لا تُفتح قبل أن
   تتمّ الأولى — فلا مخرج.

   وما يُقاس هنا عبر المسالك كما تنادي الشاشة، لا عبر الخدمة:

   ① ورشتُه تُحفظ كما وصلت — والسطرُ بلا رابطٍ باقٍ فيها لا يضيع.
   ② والمصدرُ بلا رابطٍ يمنع الإرسالَ وحدَه، ويُسمّى في صفّه — ثمّ يُكمَل فيرتفع.
   ③ والنقلُ لا يكتب ما يردّه الحفظ: مخرَجٌ أطولُ من حدّه، وسطرٌ أطولُ من حدّه،
      وحرفٌ واحدٌ في سطر — كلُّها تُنقل إلى ما يُحفظ بعده. */

import { beforeAll, describe, expect, it } from 'vitest'
import { createHash } from 'node:crypto'
import type { PrismaClient } from '@prisma/client'
import type { FastifyInstance } from 'fastify'
import { setupTestDb, testPrisma } from '../helpers/db'
import { AuthService } from '../../services/auth.service'
import { TrainerReviewService } from '../../services/trainer-review.service'
import { buildApp } from '../../http/app'
import { SESSION_COOKIE } from '../../http/auth-plugin'
import { contractAcks, CONDITION_CLAUSE_MARK } from '../../../src/application/trainer/contract-body'
import { PLAN_MAX } from '../../../src/application/trainer/plan-limits'

let prisma: PrismaClient
let auth: AuthService
let review: TrainerReviewService
let app: FastifyInstance
let adminId = ''

const sha256 = (s: string) => createHash('sha256').update(s).digest('hex')
const BODY = `نصُّ اتفاقيّةٍ للاختبار — البند 1 وما بعده.
${CONDITION_CLAUSE_MARK} لا عقد نهائي. ونفاذه معلق على قبول الأكاديمية لمواد المدرب.`
const COURSE = 'C-CARRY-101'
const NO_LINK = 'كتابُ فنّ الإلقاء لفلان'

beforeAll(async () => {
  await setupTestDb()
  prisma = await testPrisma()
  auth = new AuthService(prisma)
  review = new TrainerReviewService(prisma)
  app = await buildApp(prisma)
  await app.ready()
  const admin = await auth.register('carry-admin@test.local', 'Admin#12345', 'المدير الأكاديمي')
  adminId = admin.userId
  await auth.setRoles(adminId, ['academic_manager'])
  await prisma.course.create({ data: { id: COURSE, status: 'published', currentVersion: 1 } })
  await prisma.courseVersion.create({ data: { courseId: COURSE, version: 1, titleAr: 'دورةُ النقل', totalHours: 10 } })
  for (const n of [1, 2]) {
    await prisma.courseModule.create({ data: { id: `${COURSE}-M${n}`, courseId: COURSE, createdAt: new Date(Date.UTC(2026, 0, n)) } })
    await prisma.courseModuleVersion.create({
      data: { moduleId: `${COURSE}-M${n}`, version: 1, sequence: n, hours: 2, titleAr: `محورُ الكتالوج ${n}`, outcomeAr: `مخرجُ الكتالوج ${n}` },
    })
  }
}, 240_000)

let seq = 0

/** مدرّبٌ في طور الموادّ كتب في اللوح القديم — ثمّ قبِل دورتَه، فله ورشةٌ وجلسة */
async function carried(sourcesAr: string, outcomeAr = 'يستطيع كذا') {
  seq += 1
  const email = `carry-${seq}-${Date.now()}@test.local`
  const user = await auth.register(email, 'Trainer#12345', `مرشّحٌ ${seq}`)
  await auth.setRoles(user.userId, ['trainer_applicant'])
  const application = await prisma.trainerApplication.create({
    data: {
      reference: `TR-CARRY-${Date.now()}-${seq}`, fullName: `مرشّحٌ ${seq}`, email,
      status: 'conditionally_approved', motivation: 'اختبار', privacyConsentAt: new Date(), userId: user.userId,
    },
  })
  const profile = await prisma.trainerProfile.create({ data: { applicationId: application.id, isVerified: true } })
  await prisma.trainerCourseQualification.create({
    data: {
      profileId: profile.id, courseId: COURSE, status: 'pending', materialsAt: new Date(),
      materials: {
        modules: [{ titleAr: 'محورٌ كتبتُه', outcomeAr }],
        materialsUrl: 'https://drive.example.com/mine',
        taskAr: 'مشروعٌ يسلّمه المتعلّم', sourcesAr, noteAr: '',
      },
    },
  })
  await prisma.trainerCompensationRule.create({ data: { profileId: profile.id, type: 'per_seat', rate: 25, currency: 'USD', minSeats: 0 } })
  const contract = await prisma.trainerContract.create({
    data: {
      profileId: profile.id, title: `عقدُ ${seq}`, status: 'draft', bodyVersion: 'v-test', bodyAr: BODY, bodyHash: sha256(BODY),
      requiredDocuments: [], signerEmail: email, gatesActivation: true,
    },
  })
  const sent = await review.sendContract(contract.id, adminId)
  await review.signContractByToken(decodeURIComponent(sent.signingUrl.split('/c/')[1]), {
    legalName: 'الاسمُ القانونيُّ الكامل', addressAr: 'عمّان — بناية ١٢',
    phone: '+962790000000', bodyHash: sha256(BODY), acks: contractAcks(true).map((a) => a.key),
  })
  await review.approveSignature(contract.id, adminId)
  const cookie = `${SESSION_COOKIE}=${(await auth.login(email, 'Trainer#12345')).token}`
  const call = (method: 'GET' | 'POST' | 'PUT' | 'PATCH', url: string, payload?: unknown) =>
    app.inject({ method, url, headers: { cookie }, ...(payload === undefined ? {} : { payload: payload as object }) })
  const accepted = await call('POST', `/api/trainer/prep/${COURSE}/accept`, {})
  expect(accepted.statusCode, accepted.body).toBe(200)
  return { call, cohortId: accepted.json().id as string }
}

type Resource = { title: string; url: string | null }
type Workspace = {
  plan: { content: { modules: { outcomeAr: string | null }[]; resources: Resource[]; level?: unknown } } | null
  checklist: { key: string; labelAr: string; done: boolean }[]
}

describe('ما نُقل من اللوح القديم', () => {
  it('① ورشتُه تُحفظ كما وصلت — والسطرُ بلا رابطٍ باقٍ لا يضيع', async () => {
    const t = await carried(`كتابُ الإقناع https://example.com/book\n${NO_LINK}`)
    const ws = (await t.call('GET', `/api/trainer/cohorts/${t.cohortId}/workspace`)).json() as Workspace
    const content = ws.plan!.content
    expect(content.resources).toEqual(expect.arrayContaining([expect.objectContaining({ title: NO_LINK, url: null })]))

    /* كما يحفظ «احفظ وتابِع» في الخطوة الأولى: الخطّةُ كاملةً ومعها المدّةُ والمستوى */
    const saved = await t.call('PUT', `/api/trainer/cohorts/${t.cohortId}/plan`, {
      ...content, summaryAr: 'نبذةٌ عن الشعبة', startsOn: '2027-03-07', endsOn: '2027-04-03',
      level: { from: 'beginner', to: 'beginner' },
    })
    expect(saved.statusCode, `رُدّ الحفظُ بمصدرٍ بلا رابطٍ لم يلمسه المدرّب: ${saved.body}`).toBe(200)
    const renamed = await t.call('PATCH', `/api/trainer/cohorts/${t.cohortId}`, { title: 'شعبتي الأولى في النقل' })
    expect(renamed.statusCode, renamed.body).toBe(200)

    const after = (await t.call('GET', `/api/trainer/cohorts/${t.cohortId}/workspace`)).json() as Workspace
    expect(after.plan!.content.resources.map((r) => r.title), 'ضاع ما كتبه').toContain(NO_LINK)
    expect(after.checklist.find((c) => c.key === 'identity')?.done, 'لم تتمّ الخطوةُ الأولى وقد حُفظت').toBe(true)
    /* والمستوى يعبر المخطّطَ إلى القاعدة — وكان المخطّطُ يُسقط ما لا يعرفه صامتا (٦ أكتوبر ٢٠٢٦) */
    expect(after.plan!.content.level, 'اختار المدرّبُ المستوى ولم يُحفظ').toEqual({ from: 'beginner', to: 'beginner' })
  })

  it('② والمصدرُ بلا رابطٍ يمنع الإرسالَ وحدَه ويُسمّى — ثمّ يُكمَل فيرتفع', async () => {
    const t = await carried(NO_LINK)
    const ws = (await t.call('GET', `/api/trainer/cohorts/${t.cohortId}/workspace`)).json() as Workspace
    const row = ws.checklist.find((c) => c.key === 'resources')!
    expect(row.done, 'مصدرٌ لا يقود إلى شيءٍ عُدّ تامّا').toBe(false)
    expect(row.labelAr).toContain('مصدرٌ بلا رابطٍ ولا ملفّ')

    const sent = await t.call('POST', `/api/trainer/cohorts/${t.cohortId}/plan/submit`, { confirm: true })
    expect(sent.statusCode).toBe(409)
    expect(sent.json().error.message_ar).toContain('بلا رابطٍ ولا ملفّ')

    const content = ws.plan!.content
    const fixed = await t.call('PUT', `/api/trainer/cohorts/${t.cohortId}/plan`, {
      ...content, resources: content.resources.map((r) => ({ ...r, url: 'https://example.com/ilqaa' })),
    })
    expect(fixed.statusCode, fixed.body).toBe(200)
    const after = (await t.call('GET', `/api/trainer/cohorts/${t.cohortId}/workspace`)).json() as Workspace
    const done = after.checklist.find((c) => c.key === 'resources')!
    expect(done.done).toBe(true)
    expect(done.labelAr).not.toContain('بلا رابط')
  })

  it('③ والنقلُ لا يكتب ما يردّه الحفظ', async () => {
    const longLine = `مرجعٌ ${'طويلٌ '.repeat(80)}https://example.com/long`
    const t = await carried(`${longLine}\nأ\n${NO_LINK}`, 'م'.repeat(1500))
    const ws = (await t.call('GET', `/api/trainer/cohorts/${t.cohortId}/workspace`)).json() as Workspace
    const content = ws.plan!.content
    expect(content.modules[0].outcomeAr!.length).toBeLessThanOrEqual(PLAN_MAX.outcomeAr)
    expect(content.resources.every((r) => r.title.length <= PLAN_MAX.resourceTitle && r.title.length >= 2)).toBe(true)
    expect(content.resources.map((r) => r.title), 'سطرٌ من حرفٍ واحدٍ صار مصدرا').not.toContain('أ')
    expect(content.resources.find((r) => r.url === 'https://example.com/long'), 'ضاع رابطُ السطر الطويل').toBeTruthy()

    const saved = await t.call('PUT', `/api/trainer/cohorts/${t.cohortId}/plan`, content)
    expect(saved.statusCode, `النقلُ كتب خطّةً يردّها الحفظ: ${saved.body}`).toBe(200)
  })
})
