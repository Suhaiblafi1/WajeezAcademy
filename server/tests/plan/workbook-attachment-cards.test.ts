/* عنوانُ الكرّاسة ومواضعُ محاورها، ومرفقُ المهمّة — بطاقاتٌ «قبل/بعد» (١٧ أكتوبر ٢٠٢٦).

   «وما لا تحمله البطاقاتُ بعدُ يُبنى له بابُها، لا يُحال على المدرّب» (قرارُ ١٢ أكتوبر). ووجدت مراجعةُ الخطط
   ثلاثةً بلا باب: عنوانُ كرّاسةٍ فيه نصٌّ ملصوق، وخطأٌ في موضع محورٍ من كرّاسة الدورة، ومرفقُ مهمّةٍ في عنوانه
   خطأ أو فيه نسخةٌ قديمةٌ من الكرّاسة. وهنا على قاعدةٍ حقيقيّة، من الرفع إلى القبول:

   ١) **الكرّاسة** (`workbook_change`): العنوانُ والمواضعُ تُكتب حين يقبلها، والفارغُ يمحو موضعه، وما لم يُسمَّ يبقى.
      ولا موضعَ في كرّاسة محور، ولا محورَ مجهول.
   ٢) **المرفق** (`task_attachment`): يُعرف بعنوانه، ويُكتب عنوانُه أو ملفُّه مكانَ ما كان — والملفُّ رُفع لهذه
      الشعبة من باب الكرّاسة المصحّحة، وإلّا رُدّ. */

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

let prisma: PrismaClient
let auth: AuthService
let app: FastifyInstance
const STAMP = Date.now()
const PASS = 'Pass#12345'
const cookies: Record<string, string> = {}
let profileId = ''

const login = async (email: string) => `${SESSION_COOKIE}=${(await auth.login(email, PASS)).token}`
const call = (method: 'GET' | 'POST', url: string, who: string, payload?: unknown) =>
  app.inject({ method, url, headers: { cookie: cookies[who] }, ...(payload !== undefined ? { payload: payload as never } : {}) })

const PASTED = 'محاكاة: أنت مفاوض عن شركة… (نصّ لصق في خانة العنوان)'
const content = {
  kind: 'trainer',
  modules: [
    { moduleId: 'M1', titleAr: 'التحضير', outcomeAr: 'يحضّر' },
    { moduleId: 'M2', titleAr: 'البديل', outcomeAr: 'يحدّد بديله' },
    { moduleId: 'M3', titleAr: 'منطقة الاتفاق', outcomeAr: 'يحدّد المنطقة' },
  ],
  resources: [],
  workbookMode: 'course',
  workbook: {
    title: PASTED, bodyFileKey: 'wb-course-key-0001', bodyFileName: 'الكراسة.pdf', bodyFileMime: 'application/pdf', onTemplate: true,
    parts: [{ moduleId: 'M1', whereAr: 'ص 3' }, { moduleId: 'M2', whereAr: 'ص 27–30٠' }],
  },
  startsOn: '2026-12-06', endsOn: '2027-01-30',
}

type View = { kind: string; view: { titleAr: string; rows: { labelAr: string; beforeAr: string | null; afterAr: string | null; beforeHref?: string; afterHref?: string }[] } }

/** شعبةٌ خطّتُها في يد مدرّبها، وكرّاستُها للدورة، ومهمّةٌ مرفقُها PDF قديم */
async function inHand() {
  const course = await prisma.course.findFirstOrThrow({ select: { id: true } })
  const cohort = await prisma.cohort.create({
    data: {
      courseId: course.id, title: `دورة التفاوض — ${Math.random().toString(36).slice(2)}`, status: 'draft', capacity: 20,
      scheduleWindowStart: new Date('2026-12-05T21:00:00.000Z'), scheduleWindowEnd: new Date('2027-01-30T20:59:59.999Z'),
    },
  })
  await prisma.cohortTrainer.create({ data: { cohortId: cohort.id, profileId, role: 'lead' } })
  const plan = await prisma.cohortDeliveryPlan.create({
    data: { cohortId: cohort.id, trainerId: profileId, status: 'changes_requested', submittedAt: new Date(), content: content as never },
  })
  const task = await prisma.cohortAssessment.create({
    data: {
      cohortId: cohort.id, moduleId: 'M3', title: 'مشروع التفاوض', type: 'project', maxScore: 40,
      attachments: [
        { title: 'موذج التقييم', url: '', bodyFileKey: 'old-extract-key-01', bodyFileName: 'مستخرج قديم.pdf', bodyFileMime: 'application/pdf' },
        { title: 'دليل المشروع', url: 'https://example.com/guide' },
      ] as never,
    },
  })
  return { cohortId: cohort.id, planId: plan.id, taskId: task.id }
}

const upload = (planId: string, items: unknown[]) => call('POST', `/api/admin/cohort-plans/${planId}/edits`, 'admin', { items })
const approveAll = async (planId: string) =>
  expect((await call('POST', `/api/admin/cohort-plans/${planId}/edits/approve-all`, 'admin', {})).statusCode).toBe(200)
const idOf = async (planId: string, kind: string) => (await prisma.planEditSuggestion.findFirstOrThrow({ where: { planId, kind } })).id
const accept = (id: string) => call('POST', `/api/trainer/plan-edits/${id}/accept`, 'a', {})
const views = async (cohortId: string) => (await call('GET', `/api/admin/cohorts/${cohortId}/plan-edits`, 'admin')).json() as View[]

beforeAll(async () => {
  await setupTestDb()
  prisma = await testPrisma()
  auth = new AuthService(prisma)
  app = await buildApp(prisma)
  const admin = await auth.register(`wa-admin-${STAMP}@test.local`, PASS, 'المعتمِد')
  await auth.setRoles(admin.userId, ['academic_manager'])
  cookies.admin = await login(`wa-admin-${STAMP}@test.local`)
  const email = `wa-a-${STAMP}@test.local`
  const u = await auth.register(email, PASS, 'مدرّب الكرّاسة')
  await auth.setRoles(u.userId, ['trainer'])
  const application = await prisma.trainerApplication.create({
    data: {
      reference: `WJ-TR-WA-${STAMP}`, email, fullName: 'مدرّب الكرّاسة',
      phoneCountryCode: '+962', phone: `793${STAMP % 1000000}`, country: 'الأردن', status: 'active',
    },
  })
  profileId = (await prisma.trainerProfile.create({ data: { applicationId: application.id, userId: u.userId } })).id
  cookies.a = await login(email)
}, 240_000)

describe('١ — الكرّاسة: العنوان ومواضع المحاور (workbook_change)', () => {
  it('⚠️ يرى العنوان والمواضع قبل وبعد، ويقبل فتكتب — والفارغ يمحو، وما لم يسمّ يبقى، والملف كما هو', async () => {
    const x = await inHand()
    const r = await upload(x.planId, [{
      kind: 'workbook_change', moduleId: null, required: true, reasonAr: 'في خانة العنوان نصّ ملصوق، وفي موضع المحور 2 خطأ',
      set: {
        title: 'دورة التفاوض المنهجي — الكراسة',
        parts: [{ moduleId: 'M2', whereAr: 'ص 27–30' }, { moduleId: 'M3', whereAr: 'ص 31' }],
      },
    }])
    expect(r.statusCode, r.body).toBe(201)
    const v = (await views(x.cohortId)).find((e) => e.kind === 'workbook_change')!.view
    expect(v.titleAr).toBe('كرّاسة الدورة')
    expect(v.rows.map((x) => [x.labelAr, x.beforeAr, x.afterAr])).toEqual([
      ['العنوان', PASTED, 'دورة التفاوض المنهجي — الكراسة'],
      ['موضع المحور 2', 'ص 27–30٠', 'ص 27–30'],
      ['موضع المحور 3', null, 'ص 31'],
    ])

    await approveAll(x.planId)
    const a = await accept(await idOf(x.planId, 'workbook_change'))
    expect(a.statusCode, a.body).toBe(200)
    const wb = ((await prisma.cohortDeliveryPlan.findUniqueOrThrow({ where: { id: x.planId } })).content as typeof content).workbook
    expect(wb.title).toBe('دورة التفاوض المنهجي — الكراسة')
    expect(wb.parts).toEqual([{ moduleId: 'M1', whereAr: 'ص 3' }, { moduleId: 'M2', whereAr: 'ص 27–30' }, { moduleId: 'M3', whereAr: 'ص 31' }])
    expect([wb.bodyFileKey, wb.onTemplate], 'مسّ ما لم يسمّ').toEqual(['wb-course-key-0001', true])
  })

  it('⚠️ والموضع الفارغ يمحى', async () => {
    const x = await inHand()
    expect((await upload(x.planId, [{ kind: 'workbook_change', moduleId: null, reasonAr: 'موضع خاطئ', set: { parts: [{ moduleId: 'M2', whereAr: null }] } }])).statusCode).toBe(201)
    await approveAll(x.planId)
    expect((await accept(await idOf(x.planId, 'workbook_change'))).statusCode).toBe(200)
    const wb = ((await prisma.cohortDeliveryPlan.findUniqueOrThrow({ where: { id: x.planId } })).content as typeof content).workbook
    expect(wb.parts).toEqual([{ moduleId: 'M1', whereAr: 'ص 3' }])
  })

  it('⚠️ ولا محور مجهول، ولا موضع في كرّاسة محور — يردّ الملف ببنده', async () => {
    const x = await inHand()
    const unknown = await upload(x.planId, [{ kind: 'workbook_change', moduleId: null, reasonAr: 'سبب يكفي', set: { parts: [{ moduleId: 'M9', whereAr: 'ص 1' }] } }])
    expect(unknown.statusCode).toBe(422)
    expect(unknown.json().error.message_ar).toMatch(/البند 1: لا محور «M9» في الخطّة/)
    const modules = { ...content, workbookMode: 'modules', workbooks: [{ moduleIds: ['M1', 'M2', 'M3'], title: 'كراسة المحاور', bodyFileKey: 'wb-mod-key-0001' }] }
    await prisma.cohortDeliveryPlan.update({ where: { id: x.planId }, data: { content: modules as never } })
    const parts = await upload(x.planId, [{ kind: 'workbook_change', moduleId: 'M1', reasonAr: 'سبب يكفي', set: { parts: [{ moduleId: 'M1', whereAr: 'ص 1' }] } }])
    expect(parts.statusCode).toBe(422)
    expect(parts.json().error.message_ar).toMatch(/مواضع المحاور في كرّاسة الدورة وحدها/)
    /* وعنوانُ كرّاسة المحاور يُعدَّل */
    expect((await upload(x.planId, [{ kind: 'workbook_change', moduleId: 'M2', reasonAr: 'سبب يكفي', set: { title: 'كراسة التفاوض' } }])).statusCode).toBe(201)
  })
})

describe('٢ — مرفق المهمّة (task_attachment)', () => {
  const PDF = Buffer.from('%PDF-1.4\n% مستخرجٌ مصحّح\n%%EOF\n')
  const put = (url: string) => app.inject({ method: 'PUT', url, payload: PDF, headers: { 'content-type': 'application/pdf' } })
  const editFile = async (planId: string, name: string) => {
    const start = await call('POST', `/api/admin/cohort-plans/${planId}/edit-files`, 'admin', { mime: 'application/pdf', originalName: name })
    expect(start.statusCode, start.body).toBe(201)
    const { uploadUrl, storageKey } = start.json() as { uploadUrl: string; storageKey: string }
    expect((await put(uploadUrl)).statusCode).toBeLessThan(300)
    return storageKey
  }
  const attachmentsOf = async (taskId: string) =>
    (await prisma.cohortAssessment.findUniqueOrThrow({ where: { id: taskId } })).attachments as Record<string, unknown>[]

  it('⚠️ عنوانه وملفّه مكان ما كان — يرى الملفين ويفتحهما، والمرفق الآخر كما هو', async () => {
    const x = await inHand()
    const key = await editFile(x.planId, 'مستخرج ص 33–34.pdf')
    const r = await upload(x.planId, [{
      kind: 'task_attachment', assessmentId: x.taskId, required: true, reasonAr: 'في العنوان خطأ، والمستخرج فيه بطاقتا الدورين',
      match: { title: 'موذج التقييم' }, title: 'نموذج التقييم',
      file: { key, name: 'مستخرج ص 33–34.pdf', mime: 'application/pdf' },
    }])
    expect(r.statusCode, r.body).toBe(201)
    const v = (await views(x.cohortId)).find((e) => e.kind === 'task_attachment')!.view
    expect(v.titleAr).toBe('مرفق مهمّة: «مشروع التفاوض»')
    expect(v.rows.map((x) => [x.labelAr, x.beforeAr, x.afterAr])).toEqual([
      ['عنوان المرفق', 'موذج التقييم', 'نموذج التقييم'],
      ['ملفّ المرفق', 'مستخرج قديم.pdf', 'مستخرج ص 33–34.pdf'],
    ])
    expect(v.rows[1]).toMatchObject({ beforeHref: '/api/v1/cohort-files/old-extract-key-01', afterHref: `/api/v1/cohort-files/${key}` })

    await approveAll(x.planId)
    const a = await accept(await idOf(x.planId, 'task_attachment'))
    expect(a.statusCode, a.body).toBe(200)
    expect(await attachmentsOf(x.taskId)).toEqual([
      { title: 'نموذج التقييم', url: '', bodyFileKey: key, bodyFileName: 'مستخرج ص 33–34.pdf', bodyFileMime: 'application/pdf' },
      { title: 'دليل المشروع', url: 'https://example.com/guide' },
    ])
  })

  it('⚠️ والعنوان وحده يكتب العنوان — والملف كما هو', async () => {
    const x = await inHand()
    expect((await upload(x.planId, [{ kind: 'task_attachment', assessmentId: x.taskId, reasonAr: 'خطأ في العنوان', match: { title: 'موذج التقييم' }, title: 'نموذج التقييم' }])).statusCode).toBe(201)
    await approveAll(x.planId)
    expect((await accept(await idOf(x.planId, 'task_attachment'))).statusCode).toBe(200)
    expect((await attachmentsOf(x.taskId))[0]).toEqual({ title: 'نموذج التقييم', url: '', bodyFileKey: 'old-extract-key-01', bodyFileName: 'مستخرج قديم.pdf', bodyFileMime: 'application/pdf' })
  })

  it('⚠️ ومرفق لا يعرف بعنوانه، أو بلا تعديل، أو ملفه لم يرفع لهذه الشعبة — يردّ الملف ببنده', async () => {
    const x = await inHand()
    const other = await inHand()
    const foreign = await editFile(other.planId, 'لشعبة أخرى.pdf')
    const r = await upload(x.planId, [
      { kind: 'task_attachment', assessmentId: x.taskId, reasonAr: 'سبب يكفي', match: { title: 'لا وجود له' }, title: 'عنوان' },
      { kind: 'task_attachment', assessmentId: x.taskId, reasonAr: 'سبب يكفي', match: { title: 'دليل المشروع' } },
      { kind: 'task_attachment', assessmentId: x.taskId, reasonAr: 'سبب يكفي', match: { title: 'موذج التقييم' }, file: { key: foreign, name: 'لشعبة أخرى.pdf', mime: 'application/pdf' } },
    ])
    expect(r.statusCode).toBe(422)
    const msg: string = r.json().error.message_ar
    expect(msg).toMatch(/البند 1: لا مرفق بعنوان «لا وجود له» في هذه المهمّة/)
    expect(msg).toMatch(/البند 2: تعديل مرفق بلا عنوان جديد ولا ملفّ/)
    expect(msg).toMatch(/البند 3: ملفّ المرفق لم يرفع لهذه الشعبة/)
  })

  it('⚠️ وما عدّله المدرّب بعد الرفع يقال له — يقبله فوقه أو يرفضه', async () => {
    const x = await inHand()
    expect((await upload(x.planId, [{ kind: 'task_attachment', assessmentId: x.taskId, reasonAr: 'سبب يكفي', match: { title: 'دليل المشروع' }, title: 'دليل مشروع التفاوض' }])).statusCode).toBe(201)
    await approveAll(x.planId)
    const list = await attachmentsOf(x.taskId)
    await prisma.cohortAssessment.update({ where: { id: x.taskId }, data: { attachments: [list[0], { ...list[1], title: 'دليل المشروع النهائي' }] as never } })
    const mine = (await call('GET', `/api/trainer/cohorts/${x.cohortId}/plan-edits`, 'a')).json() as { kind: string; goneAr: string | null }[]
    expect(mine.find((e) => e.kind === 'task_attachment')!.goneAr).toMatch(/لا مرفق بعنوان «دليل المشروع»/)
  })
})
