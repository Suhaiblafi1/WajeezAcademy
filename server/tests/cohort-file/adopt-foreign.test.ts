/* ═══ ملفٌّ من شعبةٍ أخرى في خطّة الشعبة — يُنسخ إليها (٢٤ أكتوبر ٢٠٢٦، `cohort-file-adopt.ts`) ═══

   رُئي في خطّةٍ نُزّلت للمراجعة: كرّاسةٌ مفتاحُها في الخطّة وصفُّها لشعبةٍ أخرى للمدرّبة نفسِها — فلا يفتحها
   متعلّمو الشعبة. فـ:
   ① حفظُ الخطّة بملفٍّ من شعبةٍ أخرى للمدرّب ينسخه إليها، ويكتب مفتاحَ النسخة.
   ② وحفظٌ ثانٍ بالمفتاح القديم (الحفظُ التلقائيُّ يرسله) يأخذ النسخةَ نفسَها — لا نسخةً ثانية.
   ③ وملفٌّ من شعبةٍ لا يدرّسها يُردّ باسمه.
   ④ ومرفقُ المهمّة كذلك.
   ⑤ والعاملُ يُصلح ما كُتب قبل هذا — خطّةً بانتظار القرار ومهمّة — ودورتُه الثانية لا تجد شيئا.

   ورُئي ساقطا: أُسقط النسخُ من الحفظ فسقط ① و④، وجُعل المفتاحُ عشوائيّا فسقط ②، وأُسقط سؤالُ «أله الشعبة؟»
   فسقط ③، وأُسقطت الوظيفةُ من العامل فسقط ⑤. */

import { mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { beforeAll, describe, expect, it } from 'vitest'
import type { PrismaClient } from '@prisma/client'
import { setupTestDb, testPrisma } from '../helpers/db'
import { AuthService } from '../../services/auth.service'
import { CohortPlanService, type TrainerPlanContent } from '../../services/cohort-plan.service'
import { AssessmentService } from '../../services/assessment.service'
import { adoptedKey } from '../../services/cohort-file-adopt'
import { getObject, putObject } from '../../services/object-store'
import { newStorageKey } from '../../services/storage.service'
import { runAdoptForeignFiles } from '../../worker/jobs'

let prisma: PrismaClient
let plans: CohortPlanService
let userId = ''
let profileId = ''
let courseId = ''
let cohortA = ''
let cohortB = ''
let otherCohort = ''
let keyA = ''
let keyOther = ''

const body = 'الشرحُ المكتوب الذي يقرؤه المتعلّمُ قبل اللقاء، وفيه ما يكفيه ليبدأ عملَه في هذا المحور.'

const newCohort = async (title: string, mine = true) => {
  const c = await prisma.cohort.create({ data: { courseId, title, status: 'draft', deliveryMode: 'in_person', timezone: 'Asia/Amman' } })
  if (mine) await prisma.cohortTrainer.create({ data: { cohortId: c.id, profileId, role: 'lead', assignedBy: userId } })
  return c.id
}

const fileIn = async (cohortId: string, name: string, text: string) => {
  const key = newStorageKey()
  await putObject(key, Buffer.from(text), { mime: 'application/pdf', originalName: name })
  await prisma.cohortFile.create({ data: { cohortId, purpose: 'workbook', refId: 'course', storageKey: key, originalName: name, mime: 'application/pdf' } })
  return key
}

const planWith = (key: string): TrainerPlanContent => ({
  kind: 'trainer', summaryAr: 'نبذة', modules: [{ moduleId: 'AD-M1', titleAr: 'المحور الأوّل', bodyAr: body, activityAr: 'تطبيق' }],
  resources: [],
  workbook: { title: 'كرّاسة الدورة', bodyFileKey: key, bodyFileName: 'كرّاسة.pdf', bodyFileMime: 'application/pdf' },
} as TrainerPlanContent)

const savedKey = async (cohortId: string) => {
  const p = await prisma.cohortDeliveryPlan.findFirst({ where: { cohortId, trainerId: { not: null } }, orderBy: { createdAt: 'desc' } })
  return (p?.content as unknown as { workbook?: { bodyFileKey?: string } }).workbook?.bodyFileKey
}

beforeAll(async () => {
  process.env.STORAGE_ROOT = mkdtempSync(join(tmpdir(), 'wajeez-adopt-'))
  await setupTestDb()
  prisma = await testPrisma()
  plans = new CohortPlanService(prisma)
  const auth = new AuthService(prisma)
  const t = await auth.register('adopt-trainer@test.local', 'Trainer#12345', 'مدرّبةُ الشعبتين')
  userId = t.userId
  await auth.setRoles(userId, ['trainer'])
  const application = await prisma.trainerApplication.create({
    data: { reference: `WJ-TR-AD-${Date.now()}`, fullName: 'مدرّبةُ الشعبتين', email: 'adopt-trainer@test.local', status: 'active', userId },
  })
  profileId = (await prisma.trainerProfile.create({ data: { userId, applicationId: application.id } })).id
  courseId = (await prisma.course.findFirst({ select: { id: true } }))!.id
  cohortA = await newCohort('الشعبةُ الأولى')
  cohortB = await newCohort('الشعبةُ الثانية')
  otherCohort = await newCohort('شعبةُ غيرها', false)
  keyA = await fileIn(cohortA, 'كرّاسة.pdf', '%PDF-1.4 A')
  keyOther = await fileIn(otherCohort, 'كرّاسة غيرها.pdf', '%PDF-1.4 other')
}, 240_000)

describe('① و② حفظ الخطّة', () => {
  it('⚠️ ملفٌّ من شعبةٍ أخرى للمدرّب يُنسخ إليها — وحفظٌ ثانٍ بالمفتاح القديم يأخذ النسخةَ نفسَها', async () => {
    await plans.savePlan(userId, cohortB, planWith(keyA))
    const key = await savedKey(cohortB)
    expect(key, 'بقي في الخطّة مفتاحُ الشعبة الأخرى').not.toBe(keyA)
    expect(key).toBe(adoptedKey(keyA, cohortB))
    const row = await prisma.cohortFile.findUnique({ where: { storageKey: key! } })
    expect(row?.cohortId, 'النسخةُ ليست لشعبتها').toBe(cohortB)
    expect((await getObject(key!))?.toString()).toBe('%PDF-1.4 A')
    expect((await prisma.cohortFile.findUnique({ where: { storageKey: keyA } }))?.cohortId, 'مُسّ ملفُّ الأولى').toBe(cohortA)

    await plans.savePlan(userId, cohortB, { ...planWith(keyA), summaryAr: 'نبذة ثانية' })
    expect(await savedKey(cohortB)).toBe(key)
    expect(await prisma.cohortFile.count({ where: { cohortId: cohortB } }), 'نسخةٌ ثانيةٌ لكلّ حفظ').toBe(1)
  })
})

describe('③ شعبةٌ لا يدرّسها', () => {
  it('⚠️ يُردّ باسم الملفّ ولا يُنسخ', async () => {
    const target = await newCohort('الشعبةُ الثالثة')
    await expect(plans.savePlan(userId, target, planWith(keyOther))).rejects.toMatchObject({ code: 'foreign_file' })
    expect(await prisma.cohortFile.count({ where: { cohortId: target } })).toBe(0)
  })
})

describe('④ مرفقُ المهمّة', () => {
  it('⚠️ مرفقٌ من شعبةٍ أخرى للمدرّب يُنسخ إلى شعبة المهمّة', async () => {
    const target = await newCohort('شعبةُ المهمّة')
    const task = await new AssessmentService(prisma).createAssessment(userId, {
      cohortId: target, title: 'مهمّةُ المحور الأوّل', type: 'assignment', moduleId: 'AD-M1',
      attachments: [{ title: 'نموذجُ التسليم', url: '', kind: 'file', bodyFileKey: keyA, bodyFileName: 'كرّاسة.pdf', bodyFileMime: 'application/pdf' }],
    }, { byTrainer: true })
    const [att] = task.attachments as unknown as { bodyFileKey: string }[]
    expect(att!.bodyFileKey).toBe(adoptedKey(keyA, target))
    expect((await prisma.cohortFile.findUnique({ where: { storageKey: att!.bodyFileKey } }))?.cohortId).toBe(target)
  })
})

describe('⑤ العامل', () => {
  it('⚠️ يُصلح خطّةً بانتظار القرار ومهمّةً كُتبتا قبل الحفظ الجديد — ودورتُه الثانية لا تجد شيئا', async () => {
    const target = await newCohort('الشعبةُ القديمة')
    const plan = await prisma.cohortDeliveryPlan.create({
      data: { cohortId: target, trainerId: profileId, status: 'submitted', createdBy: userId, content: planWith(keyA) as object },
    })
    const task = await prisma.cohortAssessment.create({
      data: {
        cohortId: target, title: 'مهمّةٌ قديمة', type: 'assignment', maxScore: 100, createdBy: userId,
        attachments: [{ title: 'نموذج', kind: 'file', bodyFileKey: keyA }],
      },
    })
    const first = await runAdoptForeignFiles(prisma)
    expect(first.done).toBeGreaterThanOrEqual(2)
    const after = await prisma.cohortDeliveryPlan.findUnique({ where: { id: plan.id } })
    expect((after!.content as unknown as { workbook: { bodyFileKey: string } }).workbook.bodyFileKey).toBe(adoptedKey(keyA, target))
    expect(after!.status, 'غيّر العاملُ حالَ الخطّة').toBe('submitted')
    const t = await prisma.cohortAssessment.findUnique({ where: { id: task.id } })
    expect((t!.attachments as unknown as { bodyFileKey: string }[])[0]!.bodyFileKey).toBe(adoptedKey(keyA, target))

    const second = await runAdoptForeignFiles(prisma)
    expect(second.done).toBe(0)
    expect(second.failed).toBe(0)
  })
})
