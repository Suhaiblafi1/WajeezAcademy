/* خطّةُ الشعبة حزمةً تُنزَّل للمراجعة (٧ أكتوبر ٢٠٢٦) — على قاعدةٍ ومخزنٍ حقيقيّين.

   النصُّ ومساراتُ الملفّات محضةٌ ومحروسةٌ في `src/tests/trainer/plan-review-bundle.test.ts`.
   وهنا ما لا يُرى إلّا بالخادم:

   ١) **الحزمةُ ZIP يُفتح**، وفيها النصُّ والأصلُ وملفّاتُ الخطّة ببايتاتها كما رُفعت.
   ٢) **لا يدخلها إلّا ملفُّ هذه الشعبة.** مفتاحٌ كتبه المدرّبُ في خطّته لملفّ شعبةٍ
      أخرى يُترك ويُقال لماذا — وإلّا صار المحتوى بابا يقرأ به أيَّ كائنٍ في المخزن.
   ٣) **ومن لا يقرأ الخطّةَ لا ينزّلها**، وكلُّ تنزيلٍ صفٌّ في الأثر. */

import { beforeAll, describe, expect, it } from 'vitest'
import JSZip from 'jszip'
import type { PrismaClient } from '@prisma/client'
import type { FastifyInstance } from 'fastify'
import { setupTestDb, testPrisma } from '../helpers/db'
import { AuthService } from '../../services/auth.service'
import { buildApp } from '../../http/app'
import { SESSION_COOKIE } from '../../http/auth-plugin'
import { putObject } from '../../services/object-store'
import { PLAN_MD_NAME } from '../../services/plan-review-bundle.service'

let prisma: PrismaClient
let auth: AuthService
let app: FastifyInstance
let adminCookie = ''
let adminId = ''
let learnerCookie = ''
let cohortId = ''
let emptyCohortId = ''

const STAMP = Date.now()
const KEYS = {
  workbook: `rbWorkbook${STAMP}`,
  body: `rbModuleBody${STAMP}`,
  foreign: `rbForeign${STAMP}`,
  missing: `rbMissing${STAMP}`,
  session: `rbSessionAtt${STAMP}`,
}
const WORKBOOK_BYTES = Buffer.from('%PDF-1.4 كرّاسةُ المدرّب')

const cookieFor = async (email: string, password: string) =>
  `${SESSION_COOKIE}=${(await auth.login(email, password)).token}`
const get = (url: string, cookie?: string) =>
  app.inject({ method: 'GET', url, headers: cookie ? { cookie } : {} })

beforeAll(async () => {
  await setupTestDb()
  prisma = await testPrisma()
  auth = new AuthService(prisma)
  app = await buildApp(prisma)

  const sa = await auth.register(`rb-admin-${STAMP}@test.local`, 'Admin#12345', 'المعتمِد')
  adminId = sa.userId
  await auth.setRoles(adminId, ['academic_manager'])
  adminCookie = await cookieFor(`rb-admin-${STAMP}@test.local`, 'Admin#12345')
  await auth.register(`rb-learner-${STAMP}@test.local`, 'Learner#12345', 'متعلّم')
  learnerCookie = await cookieFor(`rb-learner-${STAMP}@test.local`, 'Learner#12345')

  const t = await auth.register(`rb-trainer-${STAMP}@test.local`, 'Trainer#12345', 'مدرّبةُ الحزمة')
  const application = await prisma.trainerApplication.create({
    data: {
      reference: `WJ-TR-RB-${STAMP}`, email: `rb-trainer-${STAMP}@test.local`, fullName: 'مدرّبةُ الحزمة',
      phoneCountryCode: '+962', phone: '779000222', country: 'الأردن', status: 'active',
    },
  })
  const profile = await prisma.trainerProfile.create({ data: { applicationId: application.id, userId: t.userId } })

  const course = await prisma.course.findFirstOrThrow({ select: { id: true } })
  const cohort = await prisma.cohort.create({ data: { courseId: course.id, title: 'شعبةُ الحزمة', status: 'draft', capacity: 20 } })
  cohortId = cohort.id
  const other = await prisma.cohort.create({ data: { courseId: course.id, title: 'شعبةٌ أخرى', status: 'draft', capacity: 20 } })
  const empty = await prisma.cohort.create({ data: { courseId: course.id, title: 'شعبةٌ بلا خطّة', status: 'draft', capacity: 20 } })
  emptyCohortId = empty.id
  await prisma.cohortTrainer.create({ data: { cohortId, profileId: profile.id, role: 'lead' } })

  /* ملفّاتُ الشعبة كما يكتبها الرفع: بايتاتٌ في المخزن وصفٌّ في `CohortFile` */
  const own = async (key: string, cid: string, name: string, bytes: Buffer | null) => {
    if (bytes) await putObject(key, bytes, { mime: 'application/pdf', originalName: name })
    await prisma.cohortFile.create({ data: { cohortId: cid, purpose: 'plan_resource', refId: 'x', storageKey: key, originalName: name, mime: 'application/pdf' } })
  }
  await own(KEYS.workbook, cohortId, 'كراسة.pdf', WORKBOOK_BYTES)
  await own(KEYS.body, cohortId, 'متن.pdf', Buffer.from('%PDF متنُ المحور'))
  await own(KEYS.missing, cohortId, 'ضائع.pdf', null)
  /* ملفُّ شعبةٍ أخرى — موجودٌ في المخزن ومقروءٌ لمن يملك تلك الشعبة */
  await own(KEYS.foreign, other.id, 'سرّ.pdf', Buffer.from('%PDF ليس لهذه الشعبة'))
  /* ومرفقُ اللقاء على صفّ لقائه، لا في `CohortFile` */
  await putObject(KEYS.session, Buffer.from('شرائح'), { mime: 'application/pdf', originalName: 'شرائح.pdf' })

  await prisma.cohortSession.create({
    data: {
      cohortId, title: 'لقاءُ الافتتاح', startsAt: new Date('2026-12-02T16:00:00Z'), endsAt: new Date('2026-12-02T18:00:00Z'),
      moduleIds: ['M1'], approvalState: 'pending', noteAr: 'أحضروا عمليّة', attachmentKey: KEYS.session, attachmentName: 'شرائح.pdf',
    },
  })
  await prisma.cohortDeliveryPlan.create({
    data: {
      cohortId, trainerId: profile.id, status: 'submitted', submittedAt: new Date(),
      content: {
        kind: 'trainer',
        startsOn: '2026-12-01', endsOn: '2027-01-30',
        modules: [
          { moduleId: 'M1', titleAr: 'رسمُ العمليّة', outcomeAr: 'خريطة', bodyFileKey: KEYS.body, bodyFileName: 'متن.pdf' },
          { moduleId: 'M2', titleAr: 'قياسُ الهدر', bodyAr: 'نصٌّ' },
        ],
        workbook: { title: 'الكرّاسة', bodyFileKey: KEYS.workbook, bodyFileName: 'كراسة.pdf', parts: [{ moduleId: 'M1', whereAr: 'ص ١' }] },
        resources: [
          { title: 'ملفٌّ ليس له', category: 'reading', moduleId: 'M2', bodyFileKey: KEYS.foreign, bodyFileName: 'سرّ.pdf' },
          { title: 'ملفٌّ ضائع', category: 'reading', moduleId: 'M2', bodyFileKey: KEYS.missing, bodyFileName: 'ضائع.pdf' },
        ],
      } as never,
    },
  })
}, 240_000)

const unzip = async (body: Buffer) => JSZip.loadAsync(body)
const names = (zip: JSZip) => Object.values(zip.files).filter((f) => !f.dir).map((f) => f.name)

describe('١ — الحزمةُ ZIP يُفتح، وفيه النصُّ والأصلُ والملفّات', () => {
  it('خطّةُ شعبةٍ واحدة', async () => {
    const res = await get(`/api/admin/cohorts/${cohortId}/trainer-plan/review-bundle`, adminCookie)
    expect(res.statusCode).toBe(200)
    expect(res.headers['content-type']).toBe('application/zip')
    expect(String(res.headers['content-disposition'])).toContain(`filename*=UTF-8''${encodeURIComponent('خطة شعبةُ الحزمة')}`)

    const zip = await unzip(res.rawPayload)
    const all = names(zip)
    const md = all.find((n) => n.endsWith(`/${PLAN_MD_NAME}`))!
    expect(md, 'لا نصَّ للخطّة في الحزمة').toBeTruthy()
    const folder = md.slice(0, -PLAN_MD_NAME.length - 1)
    expect(all).toContain(`${folder}/plan.json`)

    const wb = zip.file(`${folder}/files/الكراسة — كراسة.pdf`)
    expect(wb, `الكرّاسةُ ليست في الحزمة: ${all.join(' | ')}`).toBeTruthy()
    expect(Buffer.from(await wb!.async('uint8array')).equals(WORKBOOK_BYTES)).toBe(true)
    expect(all).toContain(`${folder}/files/محاور/المحور 1 — رسمُ العمليّة — متن.pdf`)
    expect(all).toContain(`${folder}/files/لقاءات/لقاءُ الافتتاح — شرائح.pdf`)

    const text = await zip.file(md)!.async('string')
    expect(text).toContain('# خطة شعبة: شعبةُ الحزمة')
    expect(text).toContain('- **المدرّب:** مدرّبةُ الحزمة')
    expect(text).toContain('  - ملاحظته: أحضروا عمليّة')
    expect(text).toContain('لم يدخل: غير موجود في المخزن')

    const plan = JSON.parse(await zip.file(`${folder}/plan.json`)!.async('string')) as { status: string }
    expect(plan.status).toBe('submitted')
  })

  it('والطابورُ كلُّه حزمةٌ واحدة — مرقّمةٌ بمدرّبيها وفي رأسها فهرس', async () => {
    const res = await get('/api/admin/cohort-plans/pending/review-bundle', adminCookie)
    expect(res.statusCode).toBe(200)
    const zip = await unzip(res.rawPayload)
    const index = await zip.file('فهرس.md')!.async('string')
    expect(index).toContain('**مدرّبةُ الحزمة** — شعبةُ الحزمة')
    expect(names(zip).some((n) => /^\d{2}\. مدرّبةُ الحزمة — شعبةُ الحزمة\/خطة-الشعبة\.md$/.test(n))).toBe(true)
  })

  it('وشعبةٌ لم يبدأ مدرّبُها خطّةً — ٤٠٤ بسببها، لا حزمةٌ فارغة', async () => {
    const res = await get(`/api/admin/cohorts/${emptyCohortId}/trainer-plan/review-bundle`, adminCookie)
    expect(res.statusCode).toBe(404)
  })
})

describe('٢ — لا يدخلها إلّا ملفُّ هذه الشعبة', () => {
  it('مفتاحُ ملفِّ شعبةٍ أخرى في محتوى الخطّة يُترك ويُقال لماذا', async () => {
    const res = await get(`/api/admin/cohorts/${cohortId}/trainer-plan/review-bundle`, adminCookie)
    const zip = await unzip(res.rawPayload)
    const all = names(zip)
    expect(all.some((n) => n.includes('سرّ')), 'ملفُّ الشعبة الأخرى دخل الحزمة').toBe(false)
    for (const f of Object.values(zip.files).filter((x) => !x.dir && x.name.includes('/files/'))) {
      expect((await f.async('string')).includes('ليس لهذه الشعبة')).toBe(false)
    }
    const md = await zip.file(all.find((n) => n.endsWith(`/${PLAN_MD_NAME}`))!)!.async('string')
    expect(md).toContain('لم يدخل: ليس من ملفّات هذه الشعبة')
  })
})

describe('٣ — من لا يقرأ الخطّةَ لا ينزّلها، وكلُّ تنزيلٍ في الأثر', () => {
  it('المتعلّمُ يُردّ، والزائرُ بلا جلسة', async () => {
    expect((await get(`/api/admin/cohorts/${cohortId}/trainer-plan/review-bundle`, learnerCookie)).statusCode).toBe(403)
    expect((await get('/api/admin/cohort-plans/pending/review-bundle', learnerCookie)).statusCode).toBe(403)
    expect((await get(`/api/admin/cohorts/${cohortId}/trainer-plan/review-bundle`)).statusCode).toBe(401)
  })

  it('التنزيلُ صفٌّ في أثر الشعبة باسم من نزّل', async () => {
    const rows = await prisma.auditEvent.findMany({
      where: { action: 'cohort.plan.review_bundle', entityType: 'cohort', entityId: cohortId },
      select: { actorId: true, meta: true },
    })
    expect(rows.length).toBeGreaterThanOrEqual(2)
    expect(rows.every((r) => r.actorId === adminId)).toBe(true)
    expect(rows.some((r) => (r.meta as { bulk?: boolean } | null)?.bulk === true)).toBe(true)
  })
})
