/* ═══ «انسخ من شعبةٍ أخرى» — على قاعدةٍ حقيقيّةٍ وعبر المسلك (١١ أكتوبر ٢٠٢٦) ═══

   ملفُّ صاحب المنصّة «تحسينات بوابة مدرّب وجيز»: «المدرّبُ صاحبُ عدّة شعبٍ لنفس الدورة
   يعيد المحاورَ والمهامَّ والمصادرَ يدويّا. النسخُ مع تعديل التواريخ فقط يوفّر ساعات».

   ① تُنسخ الخطّةُ بتواريخَ مُزاحةٍ إلى البدء الجديد، والملفُّ بمفتاحٍ جديدٍ لشعبته،
      والمهامُّ بمواعيدها مُزاحة — ونسخٌ ثانٍ لا يضاعف المهامّ.
   ② ولا يُنسخ من شعبةٍ لدورةٍ أخرى، ولا إلى شعبةٍ اعتُمدت لها خطّة.
   ③ وتعرض الورشةُ ما يُنسخ منه. */

import { mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import type { PrismaClient } from '@prisma/client'
import type { FastifyInstance } from 'fastify'
import { setupTestDb, testPrisma } from '../helpers/db'
import { AuthService } from '../../services/auth.service'
import { CohortPlanService, type TrainerPlanContent } from '../../services/cohort-plan.service'
import { buildApp } from '../../http/app'
import { SESSION_COOKIE } from '../../http/auth-plugin'
import { getObject, putObject } from '../../services/object-store'
import { newStorageKey } from '../../services/storage.service'

let prisma: PrismaClient
let app: FastifyInstance
let plans: CohortPlanService
let userId = ''
let cookie = ''
let profileId = ''
let courseId = ''
let sourceId = ''
let fileKey = ''

const body = 'الشرحُ المكتوب الذي يقرؤه المتعلّمُ قبل اللقاء، وفيه ما يكفيه ليبدأ عملَه في هذا المحور.'
const post = (url: string, payload: unknown) => app.inject({ method: 'POST', url, payload: payload as object, headers: { cookie } })

const newCohort = async (title: string, course = courseId) => {
  const c = await prisma.cohort.create({ data: { courseId: course, title, status: 'draft', deliveryMode: 'in_person', timezone: 'Asia/Amman' } })
  await prisma.cohortTrainer.create({ data: { cohortId: c.id, profileId, role: 'lead', assignedBy: userId } })
  return c.id
}

beforeAll(async () => {
  process.env.STORAGE_ROOT = mkdtempSync(join(tmpdir(), 'wajeez-copy-'))
  await setupTestDb()
  prisma = await testPrisma()
  app = await buildApp(prisma)
  plans = new CohortPlanService(prisma)
  const auth = new AuthService(prisma)
  const t = await auth.register('copy-trainer@test.local', 'Trainer#12345', 'مدرّبُ النسخ')
  userId = t.userId
  await auth.setRoles(userId, ['trainer'])
  cookie = `${SESSION_COOKIE}=${(await auth.login('copy-trainer@test.local', 'Trainer#12345')).token}`
  const application = await prisma.trainerApplication.create({
    data: { reference: `WJ-TR-CP-${Date.now()}`, fullName: 'مدرّبُ النسخ', email: 'copy-trainer@test.local', status: 'active', userId },
  })
  profileId = (await prisma.trainerProfile.create({ data: { userId, applicationId: application.id } })).id
  courseId = (await prisma.course.findFirst({ select: { id: true } }))!.id
  sourceId = await newCohort('الشعبةُ الأولى')

  fileKey = newStorageKey()
  await putObject(fileKey, Buffer.from('%PDF-1.4 copy'), { mime: 'application/pdf', originalName: 'كرّاسة.pdf' })
  await prisma.cohortFile.create({ data: { cohortId: sourceId, purpose: 'plan_resource', refId: 'r1', storageKey: fileKey, originalName: 'كرّاسة.pdf', mime: 'application/pdf' } })

  const content: TrainerPlanContent = {
    kind: 'trainer', summaryAr: 'نبذةُ الأولى', startsOn: '2027-03-07', endsOn: '2027-03-20',
    modules: [
      { moduleId: 'CP-M1', titleAr: 'المحور الأوّل', bodyAr: body, activityAr: 'تطبيق' },
      { moduleId: 'CP-M2', titleAr: 'المحور الثاني', bodyAr: body, activityAr: 'تطبيق' },
    ],
    resources: [
      { title: 'كرّاسةُ المتحدّث', category: 'reading', kind: 'file', bodyFileKey: fileKey, bodyFileName: 'كرّاسة.pdf', bodyFileMime: 'application/pdf' },
      { title: 'تسجيلُ الأوّل', category: 'recorded', url: 'https://x.test/v', moduleId: 'CP-M1', opensAt: '2027-03-08T05:00:00.000Z' },
    ],
    slots: [
      { startsOn: '2027-03-07', endsOn: '2027-03-13', moduleIds: ['CP-M1'] },
      { startsOn: '2027-03-14', endsOn: '2027-03-20', moduleIds: ['CP-M2'] },
    ],
  }
  await plans.savePlan(userId, sourceId, content)
  await prisma.cohortAssessment.create({
    data: { cohortId: sourceId, title: 'مهمّةُ المحور الأوّل', type: 'assignment', moduleId: 'CP-M1', maxScore: 100, dueAt: new Date('2027-03-13T20:59:59.000Z'), createdBy: userId },
  })
}, 240_000)

afterAll(async () => { await app.close() })

describe('① النسخ', () => {
  it('⚠️ الخطّةُ بتواريخَ مُزاحة، والملفُّ بمفتاحٍ جديدٍ لشعبته، والمهمّةُ بموعدها مُزاحا', async () => {
    const targetId = await newCohort('الشعبةُ الثانية')
    const res = await post(`/api/trainer/cohorts/${targetId}/plan/copy-from`, { sourceCohortId: sourceId, startsOn: '2027-04-04' })
    expect(res.statusCode, res.body).toBe(200)
    expect(res.json()).toMatchObject({ days: 28, copiedTasks: 1, files: 1 })

    const ws = await plans.workspace(userId, targetId)
    const c = ws.plan!.content!
    expect([c.startsOn, c.endsOn]).toEqual(['2027-04-04', '2027-04-17'])
    expect(c.slots!.map((s) => [s.startsOn, s.endsOn])).toEqual([['2027-04-04', '2027-04-10'], ['2027-04-11', '2027-04-17']])
    expect(c.modules.map((m) => m.titleAr)).toEqual(['المحور الأوّل', 'المحور الثاني'])
    const [file, rec] = c.resources
    expect(file.bodyFileKey, 'يُشار إلى ملفّ الشعبة الأخرى').not.toBe(fileKey)
    expect((await getObject(file.bodyFileKey!))?.toString()).toBe('%PDF-1.4 copy')
    const row = await prisma.cohortFile.findUnique({ where: { storageKey: file.bodyFileKey! } })
    expect(row?.cohortId, 'الملفُّ المنسوخُ ليس لشعبته').toBe(targetId)
    expect(rec.opensAt).toBe('2027-04-05T05:00:00.000Z')
    expect(ws.assessments.map((a) => [a.title, new Date(a.dueAt!).toISOString()])).toEqual([['مهمّةُ المحور الأوّل', '2027-04-10T20:59:59.000Z']])

    /* ونسخٌ ثانٍ لا يضاعف المهامّ */
    const again = await post(`/api/trainer/cohorts/${targetId}/plan/copy-from`, { sourceCohortId: sourceId, startsOn: '2027-04-04' })
    expect(again.json().copiedTasks).toBe(0)
    expect(await prisma.cohortAssessment.count({ where: { cohortId: targetId } })).toBe(1)
  })
})

describe('② ما لا يُنسخ', () => {
  it('⚠️ من شعبةٍ لدورةٍ أخرى', async () => {
    const other = await prisma.course.findFirst({ where: { id: { not: courseId } }, select: { id: true } })
    const foreign = await newCohort('دورةٌ أخرى', other!.id)
    const res = await post(`/api/trainer/cohorts/${foreign}/plan/copy-from`, { sourceCohortId: sourceId, startsOn: '2027-04-04' })
    expect(res.statusCode).toBe(400)
  })

  it('⚠️ ولا إلى شعبةٍ اعتُمدت لها خطّة — النسخُ يمحو', async () => {
    const targetId = await newCohort('الشعبةُ الثالثة')
    await prisma.cohortDeliveryPlan.create({ data: { cohortId: targetId, trainerId: profileId, status: 'approved', content: { kind: 'trainer', modules: [], resources: [] } } })
    const res = await post(`/api/trainer/cohorts/${targetId}/plan/copy-from`, { sourceCohortId: sourceId, startsOn: '2027-04-04' })
    expect(res.statusCode).toBe(409)
  })

  it('ولا من شعبةٍ ليست له', async () => {
    const stranger = await prisma.cohort.create({ data: { courseId, title: 'لغيره', status: 'draft' } })
    const targetId = await newCohort('الشعبةُ الرابعة')
    const res = await post(`/api/trainer/cohorts/${targetId}/plan/copy-from`, { sourceCohortId: stranger.id, startsOn: '2027-04-04' })
    expect(res.statusCode).toBe(403)
  })
})

describe('③ والورشةُ تعرض ما يُنسخ منه', () => {
  it('شعبُه الأخرى لهذه الدورة وفي خطّتها مدّة', async () => {
    const targetId = await newCohort('الشعبةُ الخامسة')
    const ws = await plans.workspace(userId, targetId)
    expect(ws.copySources.map((c) => c.id)).toContain(sourceId)
    expect(ws.copySources.find((c) => c.id === sourceId)).toMatchObject({ startsOn: '2027-03-07', modules: 2 })
  })
})
